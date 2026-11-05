// src/pages/student/JoinSubject.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { enroll } from '../../api/subjects';

export default function JoinSubject() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await enroll(code.trim().toUpperCase());
      const subjectId = result?.subject?.id;
      if (subjectId) {
        navigate(`/student/subjects/${subjectId}`, { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Failed to join subject.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="page-back"><Link className="page-back-link" to="/student">← Back to subjects</Link></div>
      <h1>Join a subject</h1>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label>
          Join code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            placeholder="e.g. ABCD1234"
            className="js-code-input"
          />
        </label>
        <button type="submit" className="btn btn-solid" disabled={submitting}>
          {submitting ? 'Joining...' : 'Join'}
        </button>
      </form>
    </div>
  );
}