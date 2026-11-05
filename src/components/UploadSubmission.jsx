import { useState, useEffect, useCallback } from "react";
import {
  getStudentUploadUrl,
  submitQuizImage,
  deletePendingAttempt,
  getAttemptImageUrl,
  getAttemptHistory,
  getStudentQuizAttachmentUrl,
} from "../api/quizzes";
import { uploadToSignedUrl } from "../api/client";
import StatusBadge from "./StatusBadge";

// Downscale & JPEG re-encode if image is large
async function processImageFile(file) {
  return new Promise((resolve) => {
    // If not image or small enough, return as-is
    if (!file.type.startsWith("image/")) return resolve(file);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1920;
      let width = img.width;
      let height = img.height;

      // Check if resizing needed
      if (width <= maxDim && height <= maxDim && file.size <= 2 * 1024 * 1024) {
        return resolve(file);
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
          });
          resolve(compressed);
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function UploadSubmission({ quiz, onStatusChange }) {
  const quizId = quiz?.id;
  const [history, setHistory] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [serverImageUrl, setServerImageUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pendingAttempt = history?.attempts?.find((a) => a.status === "pending_review");
  const latestGraded = history?.attempts?.slice().reverse().find((a) => a.status === "graded");

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUploadProgress(null);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const h = await getAttemptHistory(quizId);
      setHistory(h);
      const pending = h?.attempts?.find((a) => a.status === "pending_review");
      const graded = h?.attempts?.slice().reverse().find((a) => a.status === "graded");
      const shown = pending ?? graded;
      if (shown) {
        try {
          const { url } = await getAttemptImageUrl(shown.id);
          setServerImageUrl(url || null);
        } catch {
          setServerImageUrl(null);
        }
      } else {
        setServerImageUrl(null);
      }
    } catch {
      // History is informational: a failed load must not block a new submission.
    }
  }, [quizId]);

  useEffect(() => {
    if (quizId) loadHistory();
  }, [quizId, loadHistory]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError("Only JPG, PNG, and WebP images are accepted.");
      return;
    }

    setError("");
    setSuccess("");

    const processed = await processImageFile(file);
    if (processed.size > 5 * 1024 * 1024) {
      setError("Image exceeds the 5 MB limit even after optimization.");
      return;
    }

    clearSelectedFile();
    setSelectedFile(processed);
    setPreviewUrl(URL.createObjectURL(processed));
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    setUploadProgress(0);

    try {
      // 1. Get signed upload URL
      const { uploadUrl, path } = await getStudentUploadUrl(quiz.id, {
        fileName: selectedFile.name,
        mime: selectedFile.type,
        size: selectedFile.size,
      });

      // 2. Upload with progress
      await uploadToSignedUrl(uploadUrl, selectedFile, (pct) => setUploadProgress(pct));

      // 3. Create submission
      await submitQuizImage(quiz.id, path);

      setSuccess("Submission received. It is now pending instructor grading.");
      clearSelectedFile();
      await loadHistory();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      if (err?.code === "PENDING_REVIEW_EXISTS") {
        setError("You already have a submission pending review. Remove it before uploading a new one.");
      } else if (err?.code === "MAX_ATTEMPTS_REACHED") {
        setError("Maximum submission attempts reached for this quiz.");
      } else {
        setError(err?.message || "Failed to submit image.");
      }
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleDeletePending = async () => {
    if (!pendingAttempt) return;
    if (!window.confirm("Remove this submitted photo? You can upload a new one after it is deleted.")) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await deletePendingAttempt(pendingAttempt.id);
      setSuccess("Submission removed. You can upload a new photo.");
      clearSelectedFile();
      await loadHistory();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      setError(err?.message || "Failed to remove submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAttachment = async () => {
    setError("");
    try {
      const { url } = await getStudentQuizAttachmentUrl(quiz.id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err?.message || "Could not open the quiz attachment.");
    }
  };

  return (
    <div className="upload-submission">
      <div className="upload-submission-head">
        <h2 className="upload-submission-title">{quiz.title}</h2>
        <span className="upload-submission-badge">Manual submission</span>
      </div>

      {quiz.instructions && (
        <p className="upload-submission-instructions">{quiz.instructions}</p>
      )}

      {(quiz.externalUrl || quiz.attachmentPath) && (
        <div className="upload-submission-links">
          {quiz.externalUrl && (
            <a
              href={quiz.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-line upload-submission-link"
            >
              Open assignment link ↗
            </a>
          )}
          {quiz.attachmentPath && (
            <button
              type="button"
              className="btn btn-line upload-submission-link"
              onClick={handleOpenAttachment}
            >
              Open {quiz.attachmentName || "quiz attachment"}
            </button>
          )}
        </div>
      )}

      {error && <div className="auth-error upload-submission-alert" role="alert">{error}</div>}
      {success && <div className="upload-submission-success" role="status">{success}</div>}

      {pendingAttempt ? (
        <div className="upload-submission-panel upload-submission-pending">
          <div className="upload-submission-row">
            <div>
              <p className="upload-submission-status">Submission pending review</p>
              <p className="upload-submission-meta">
                Submitted {new Date(pendingAttempt.submittedAt || pendingAttempt.startedAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-line upload-submission-action"
              onClick={handleDeletePending}
              disabled={submitting}
            >
              Remove / replace
            </button>
          </div>
          {serverImageUrl && (
            <div className="upload-submission-proof">
              <p className="upload-submission-proof-label">Uploaded proof</p>
              <img src={serverImageUrl} alt="Submitted proof" className="upload-submission-image" />
            </div>
          )}
        </div>
      ) : latestGraded ? (
        <div className={`upload-submission-panel ${history?.passed ? "upload-submission-passed" : "upload-submission-failed"}`}>
          <div className="upload-submission-row">
            <p className="upload-submission-score">
              Grade: {latestGraded.score} / {latestGraded.total}
            </p>
            <StatusBadge status={history?.passed ? "completed" : "failed"} />
          </div>
          {latestGraded.feedback && (
            <p className="upload-submission-feedback">
              <strong>Instructor feedback:</strong> {latestGraded.feedback}
            </p>
          )}
          <p className="upload-submission-meta">
            Graded {latestGraded.gradedAt ? new Date(latestGraded.gradedAt).toLocaleString() : ""}
          </p>
        </div>
      ) : null}

      {!pendingAttempt && !latestGraded && (
        <div className="upload-submission-form">
          {!selectedFile ? (
            <label className="upload-submission-picker" htmlFor="quiz-proof-upload">
              <span className="upload-submission-picker-title">Choose photo to upload</span>
              <span className="upload-submission-picker-help">JPG, PNG, or WebP · up to 5 MB</span>
              <input
                id="quiz-proof-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileSelect}
                disabled={submitting}
                className="upload-submission-file upload-submission-file-hidden"
              />
            </label>
          ) : (
            <div className="upload-submission-selected">
              <div className="upload-submission-row">
                <div>
                  <p className="upload-submission-status">Selected photo</p>
                  <p className="upload-submission-meta">{selectedFile.name}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-line upload-submission-action"
                  onClick={clearSelectedFile}
                  disabled={submitting}
                >
                  Remove selected
                </button>
              </div>

              {previewUrl && (
                <div className="upload-submission-proof">
                  <p className="upload-submission-proof-label">Preview</p>
                  <img src={previewUrl} alt="Upload preview" className="upload-submission-image" />
                </div>
              )}

              {uploadProgress !== null && (
                <div className="upload-submission-progress" aria-live="polite">
                  <div className="upload-submission-progress-track">
                    <div className="upload-submission-progress-bar" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="upload-submission-progress-text">Uploading: {uploadProgress}%</span>
                </div>
              )}

              <div className="upload-submission-actions">
                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={handleUploadSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Uploading..." : "Submit for grading"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

