// src/pages/faculty/SubjectNew.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createSubject } from '../../api/subjects';

const TERMS = ['1st Semester', '2nd Semester', '3rd Semester', 'Summer'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SubjectNew() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [term, setTerm] = useState('1st Semester');
  const [schoolYear, setSchoolYear] = useState('');
  const [passingPercent, setPassingPercent] = useState(75);
  const [startDate, setStartDate] = useState('');
  const [meetingDay, setMeetingDay] = useState('1');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await createSubject({
        code,
        name,
        description: description || null,
        term,
        schoolYear,
        passingPercent: Number(passingPercent),
        startDate: startDate || null,
        meetingDay: startDate ? Number(meetingDay) : null,
      });
      navigate(`/faculty/subjects/${result.id}`, { replace: true });
    } catch (err) {
      if (err?.details) {
        const fe = {};
        for (const d of err.details) fe[d.path] = d.message;
        setFieldErrors(fe);
      } else {
        setError(err?.message || 'Failed to create subject.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="page-back"><Link className="page-back-link" to="/faculty">← Back to subjects</Link></div>
      <h1>Create subject</h1>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label>
          Subject code
          <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="IT101" />
          {fieldErrors.code && <span className="field-error">{fieldErrors.code}</span>}
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Term
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          School year (YYYY-YYYY)
          <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} required placeholder="2026-2027" />
          {fieldErrors.schoolYear && <span className="field-error">{fieldErrors.schoolYear}</span>}
        </label>
        <label>
          Passing percent
          <input type="number" min="1" max="100" value={passingPercent} onChange={(e) => setPassingPercent(e.target.value)} />
          {fieldErrors.passingPercent && <span className="field-error">{fieldErrors.passingPercent}</span>}
        </label>
        <label>
          Term start date (Week 1)
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          Meeting day
          <select value={meetingDay} onChange={(e) => setMeetingDay(e.target.value)}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-solid" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create subject'}
        </button>
      </form>
    </div>
  );
}