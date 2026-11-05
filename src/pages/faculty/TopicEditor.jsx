import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MarkdownView from "../../components/MarkdownView";
import SlidesEmbed from "../../components/SlidesEmbed";
import FileUpload from "../../components/FileUpload";
import {
  getUploadUrl,
  listTopicContent,
  createContentBlock,
  updateContentBlock,
  deleteContentBlock,
  reorderContentBlocks,
  updateTopic,
  getTopic,
} from "../../api/topics";

const BLOCK_TYPES = ["text", "summary", "notes", "presentation", "video", "file"];

export default function TopicEditor() {
  const { id: topicId } = useParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [status, setStatus] = useState("draft");
  const [savedDetails, setSavedDetails] = useState({ title: "", description: "", availableFrom: "", status: "draft" });
  const [blocks, setBlocks] = useState([]);
  const [subjectId, setSubjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [newType, setNewType] = useState("text");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newVisible, setNewVisible] = useState(true);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [topicResult, contentResult] = await Promise.allSettled([
        getTopic(topicId),
        listTopicContent(topicId),
      ]);
      if (topicResult.status === 'fulfilled' && topicResult.value) {
        const topic = topicResult.value;
        const details = {
          title: topic.title || "",
          description: topic.description || "",
          availableFrom: topic.availableFrom ? String(topic.availableFrom).slice(0, 10) : "",
          status: topic.status || "draft",
        };
        setTitle(details.title);
        setDescription(details.description);
        setAvailableFrom(details.availableFrom);
        setStatus(details.status);
        setSavedDetails(details);
        setSubjectId(topic.subjectId || null);
      }
      if (contentResult.status === 'fulfilled') {
        setBlocks(Array.isArray(contentResult.value) ? contentResult.value : []);
      } else {
        setError(contentResult.reason?.message || "Failed to load content.");
      }
    } catch (err) { setError(err?.message || "Failed to load content."); }
    finally { setLoading(false); }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const detailsDirty =
    title !== savedDetails.title ||
    description !== savedDetails.description ||
    availableFrom !== savedDetails.availableFrom ||
    status !== savedDetails.status;
  const canSaveDetails = detailsDirty && !saving;

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!canSaveDetails) return;
    setSaving(true);
    setError("");
    try {
      const payload = { title, description, availableFrom, status };
      await updateTopic(topicId, payload);
      setSavedDetails(payload);
    } catch (err) { setError(err?.message || "Save failed."); }
    finally { setSaving(false); }
  };

  const handleAddBlock = async (e) => {
    e.preventDefault();
    try {
      const visible = newType === "notes" ? false : newVisible;
      const payload = {
        type: newType,
        title: newTitle || null,
        body: ["text", "summary", "notes"].includes(newType) ? newBody : null,
        url: ["presentation", "video"].includes(newType) ? (newUrl || null) : null,
        visibleToStudents: visible,
      };
      await createContentBlock(topicId, payload);
      setNewTitle(""); setNewBody(""); setNewUrl("");
      load();
    } catch (err) { setError(err?.message || "Add block failed."); }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm("Delete this block?")) return;
    try { await deleteContentBlock(blockId); load(); }
    catch (err) { setError(err?.message || "Delete failed."); }
  };

  const handleToggleVisible = async (block) => {
    try {
      await updateContentBlock(block.id, { visibleToStudents: !block.visibleToStudents });
      load();
    } catch (err) { setError(err?.message || "Update failed."); }
  };

  const handleReorderBlock = async (index, dir) => {
    const next = [...blocks];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    const ids = next.map((b) => b.id);
    try {
      const updated = await reorderContentBlocks(topicId, ids);
      setBlocks(Array.isArray(updated) ? updated : next);
    } catch (err) { setError(err?.message || "Reorder failed."); }
  };

  const handleUpload = async (path, file) => {
    try {
      await createContentBlock(topicId, {
        type: newType === "presentation" ? "presentation" : "file",
        title: newTitle || file?.name || null,
        filePath: path,
        fileName: file?.name || newTitle || "file",
        fileMime: file?.type,
        fileSize: file?.size,
        visibleToStudents: newType === "notes" ? false : newVisible,
      });
      load();
    } catch (err) { setError(err?.message || "Save block failed."); }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-back">
          <Link className="page-back-link" to="/faculty">← Back to topics</Link>
        </div>
        <p className="sr-only" role="status">Loading topic editor…</p>
        <div className="te-skeleton" aria-hidden="true">
          <span className="skeleton-line te-skeleton-title" />
          <div className="te-skeleton-form">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="skeleton-line" />
            ))}
          </div>
          <span className="skeleton-line te-skeleton-subtitle" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="te-skeleton-block">
              <span className="skeleton-line te-skeleton-short" />
              <span className="skeleton-line" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-back">
        <Link className="page-back-link" to="/faculty">← Back to subjects</Link>
      </div>
      <h1>Topic Editor</h1>
      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={handleSaveDetails} className="te-details-form te-panel">
        <h2 className="te-section-title">Details</h2>
        <div className="te-field">
          <label className="qb-label" htmlFor="te-title">Title</label>
          <input id="te-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="te-field">
          <label className="qb-label" htmlFor="te-desc">Description</label>
          <textarea id="te-desc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="te-field-row">
          <div className="te-field">
            <label className="qb-label" htmlFor="te-date">Available from</label>
            <input id="te-date" type="date" className="input" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
          </div>
          <div className="te-field">
            <label className="qb-label" htmlFor="te-status">Status</label>
            <select id="te-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </div>
        </div>
        <div className="te-form-actions">
          <button type="submit" className="btn btn-solid" disabled={!canSaveDetails} aria-disabled={!canSaveDetails}>{saving ? "Saving…" : "Save details"}</button>
        </div>
      </form>

      <h2 className="te-section-title te-section-gap">Content blocks</h2>
      {blocks.length === 0 ? (
        <div className="empty-state te-panel">
          No content blocks yet. Add text, a summary, a presentation, a video,
          or a file below.
        </div>
      ) : (
        <ul className="te-block-list">
          {blocks.map((b, idx) => (
            <li key={b.id} className="te-block-item">
              <div className="te-block-header">
                <strong>{b.type}</strong>
                {b.title && <span>· {b.title}</span>}
                <span className="te-block-visibility">
                  {b.visibleToStudents ? "students" : "faculty-only"}
                </span>
              </div>
              {b.type === "file" && (
                <div className="te-block-body">
                  <p><strong>{b.title || b.fileName}</strong> {b.fileName && b.title !== b.fileName ? `(${b.fileName})` : ''}</p>
                  {b.filePath && <span className="te-block-note">File uploaded</span>}
                </div>
              )}
              {b.url && <p className="te-block-link"><a href={b.url} target="_blank" rel="noopener noreferrer">{b.url}</a></p>}
              {b.filePath && <SlidesEmbed fileUrl={`#`} fileName={b.fileName} title={b.title} />}
              <div className="te-block-actions">
                <button type="button" className="btn btn-line" onClick={() => handleReorderBlock(idx, -1)} disabled={idx === 0} aria-disabled={idx === 0} aria-label="Move block up">↑</button>
                <button type="button" className="btn btn-line" onClick={() => handleReorderBlock(idx, 1)} disabled={idx === blocks.length - 1} aria-disabled={idx === blocks.length - 1} aria-label="Move block down">↓</button>
                <button type="button" className="btn btn-line" onClick={() => handleToggleVisible(b)}>{b.visibleToStudents ? "Make faculty-only" : "Make visible"}</button>
                <button type="button" className="btn btn-line" onClick={() => handleDeleteBlock(b.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="te-add-block te-panel">
        <h3 className="te-section-title">Add block</h3>
        <div className="te-field-row">
          <div className="te-field">
            <label className="qb-label" htmlFor="te-new-type">Type</label>
            <select id="te-new-type" className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>
              {BLOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="te-field te-field-grow">
            <label className="qb-label" htmlFor="te-new-title">Title</label>
            <input id="te-new-title" className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Optional title" />
          </div>
        </div>

        {(["text", "summary", "notes"].includes(newType)) && (
          <div className="te-field">
            <label className="qb-label" htmlFor="te-new-body">Body (markdown)</label>
            <textarea id="te-new-body" className="input" value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={6} />
            <label className="qb-check te-check">
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
              <span className="qb-check-label">Preview markdown</span>
            </label>
            {preview && <div className="te-preview"><MarkdownView content={newBody} /></div>}
          </div>
        )}

        {(["presentation", "video"].includes(newType)) && (
          <div className="te-field">
            <label className="qb-label" htmlFor="te-new-url">URL</label>
            <input id="te-new-url" className="input" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…" />
          </div>
        )}

        {newType !== "notes" && (
          <label className="qb-check te-check">
            <input type="checkbox" checked={newVisible} onChange={(e) => setNewVisible(e.target.checked)} />
            <span className="qb-check-label">Visible to students</span>
          </label>
        )}

        {newType === "file" && (
          <div className="te-file-upload te-field">
            <FileUpload
              accept=".pdf,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
              maxSizeMb={25}
              getUploadUrl={(info) => getUploadUrl(topicId, { ...info, kind: "file" })}
              onUploaded={(path, file) => handleUpload(path, file)}
              onError={setError}
            />
          </div>
        )}

        <div className="te-form-actions">
          {newType === "presentation" && (
            <button type="button" className="btn btn-solid te-add-btn" onClick={handleAddBlock}>Add presentation link</button>
          )}
          {newType === "video" && (
            <button type="button" className="btn btn-solid te-add-btn" onClick={handleAddBlock}>Add video link</button>
          )}
          {!["presentation", "video", "file"].includes(newType) && (
            <button type="button" className="btn btn-solid te-add-btn" onClick={handleAddBlock}>Add block</button>
          )}
        </div>
      </div>
    </div>
  );
}
