import { useState } from "react";
import Papa from "papaparse";
import { importQuestions } from "../api/quizzes";
import { CheckIcon, CloseIcon } from "./Icons";

function rowToQuestion(row) {
  const type = (row.type || "").trim().toLowerCase();
  if (type === "choice") {
    const options = ["A", "B", "C", "D"]
      .map((l) => row[`option${l}`])
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .map((label) => ({ label: String(label).trim() }));
    const correctLetter = String(row.correct || "").trim().toUpperCase();
    const correctIndex = "ABCD".indexOf(correctLetter);
    return {
      type: "choice",
      prompt: String(row.question || "").trim(),
      options,
      correctOptionIndex: correctIndex >= 0 ? correctIndex : 0,
      points: Number(row.points) > 0 ? Number(row.points) : 1,
    };
  }
  if (type === "text") {
    const accepted = String(row.acceptedAnswers || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      type: "text",
      prompt: String(row.question || "").trim(),
      acceptedAnswers: accepted.length ? accepted : [String(row.acceptedAnswers || "").trim()],
      points: Number(row.points) > 0 ? Number(row.points) : 1,
    };
  }
  return { type, prompt: String(row.question || "").trim() };
}

function validateRow(q) {
  const issues = [];
  if (!q.prompt) issues.push("Question prompt is required.");
  if (q.type === "choice") {
    if (!q.options || q.options.length !== 4) issues.push("Multiple choice questions must have exactly 4 options (A-D).");
    if (!Number.isInteger(q.correctOptionIndex) || q.correctOptionIndex < 0 || q.correctOptionIndex > 3) {
      issues.push("Select the correct option (A-D).");
    }
    (q.options || []).forEach((o) => { if (!o.label) issues.push("Every option needs a label."); });
  }
  if (q.type === "text") {
    if (!q.acceptedAnswers || q.acceptedAnswers.length === 0) issues.push("Text questions need at least one accepted answer.");
  }
  if (!q.points || q.points <= 0) issues.push("Points must be greater than 0.");
  return issues;
}

export default function QuestionImport({ quizId, onImported }) {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data || []).map(rowToQuestion);
        const rowsOut = parsed.map((q, i) => {
          const issues = validateRow(q);
          return { index: i, question: q, valid: issues.length === 0, issues };
        });
        setRows(rowsOut);
      },
      error: (err) => setError(err?.message || "Parse failed."),
    });
  };

  const handleConfirm = async () => {
    const invalid = rows.some((r) => !r.valid);
    if (invalid) return;
    setError("");
    setImporting(true);
    try {
      const payload = rows.map((r) => r.question);
      await importQuestions(quizId, payload);
      onImported?.();
      setRows([]);
    } catch (err) {
      setError(err?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const invalidCount = rows.filter((r) => !r.valid).length;
  const total = rows.length;
  const canConfirm = total > 0 && invalidCount === 0 && !importing;

  return (
    <section className="qi-panel">
      <div className="qi-head">
        <h2 className="qi-title">Import questions from CSV</h2>
        <p className="qi-hint">
          <a href="/question-template.csv" download className="qi-link">
            Download template
          </a>
        </p>
      </div>

      <div className="qi-file">
        <label className="qi-label">
          <span>CSV file</span>
          <input type="file" accept=".csv" onChange={handleFile} className="qi-file-input" />
        </label>
          <p className="qi-hint">
            Columns: <span className="qi-mono">type,question,optionA..optionD,correct,acceptedAnswers,points</span>
          </p>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      {rows.length > 0 && (
        <>
          <div className="qi-summary">
            <span className="qi-count">{total} question{total !== 1 ? "s" : ""} parsed</span>
            {invalidCount > 0 && (
              <span className="qi-count qi-count-invalid">
                {invalidCount} invalid
              </span>
            )}
          </div>

          <table className="qi-table">
            <thead>
              <tr>
                <th className="qi-th">#</th>
                <th className="qi-th">Type</th>
                <th className="qi-th">Prompt</th>
                <th className="qi-th qi-th-issues">Issues</th>
                <th className="qi-th qi-th-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index} className={`qi-row ${r.valid ? "qi-row-valid" : "qi-row-invalid"}`}>
                  <td className="qi-td qi-td-num">{r.index + 1}</td>
                  <td className="qi-td">{r.question.type}</td>
                  <td className="qi-td qi-td-prompt">{r.question.prompt || "—"}</td>
                  <td className="qi-td qi-td-issues">
                    {r.valid ? (
                      <span className="qi-ok"><CheckIcon /> Valid</span>
                    ) : (
                      <ul className="qi-issues">
                        {r.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="qi-td qi-td-status">
                    {r.valid ? (
                      <span className="qi-badge qi-badge-valid"><CheckIcon /> Valid</span>
                    ) : (
                      <span className="qi-badge qi-badge-invalid"><CloseIcon /> Invalid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="qi-actions">
            <button
              type="button"
              className={`btn btn-solid ${!canConfirm ? "qi-btn-disabled" : ""}`}
              disabled={!canConfirm}
              aria-disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {importing ? "Importing…" : "Confirm import"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
