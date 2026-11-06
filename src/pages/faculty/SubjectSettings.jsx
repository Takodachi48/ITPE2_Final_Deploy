import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getFacultySubject, updateSubject, toggleEnrollment, archiveSubject } from '../../api/subjects';
import PassingPercentControl from '../../components/PassingPercentControl';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export default function SubjectSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passingPercent, setPassingPercent] = useState(75);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [meetingDay, setMeetingDay] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getFacultySubject(id);
        if (!cancelled) {
          setSubject(data);
          setPassingPercent(data?.passingPercent ?? 75);
          setStartDate(data?.startDate ? String(data.startDate).split('T')[0] : '');
          setMeetingDay(data?.meetingDay === null || data?.meetingDay === undefined ? '' : String(data.meetingDay));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load subject.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleSavePassing = async () => {
    if (!window.confirm('Changing passing percent affects computed pass/fail for students. Continue?')) return;
    setSaving(true); setError('');
    try {
      const updated = await updateSubject(id, { passingPercent });
      setSubject(updated);
    } catch (err) {
      setError(err?.message || 'Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!startDate) { setError('Start date (week 1) is required to reschedule topics.'); return; }
    if (!window.confirm('Save start date / meeting day and reschedule succeeding topic dates automatically?')) return;
    setSavingSchedule(true); setError('');
    try {
      const payload = {
        startDate,
        meetingDay: meetingDay === '' ? null : Number(meetingDay),
      };
      const updated = await updateSubject(id, payload);
      setSubject(updated);
    } catch (err) {
      setError(err?.message || 'Failed to update schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleEnrollment = async () => {
    const open = !subject.enrollmentOpen;
    if (!window.confirm(open ? 'Open enrollment?' : 'Close enrollment?')) return;
    try {
      const updated = await toggleEnrollment(id, open);
      setSubject(updated);
    } catch (err) {
      setError(err?.message || 'Failed to update enrollment.');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Archive this subject?')) return;
    try {
      await archiveSubject(id);
      navigate('/faculty');
    } catch (err) {
      setError(err?.message || 'Failed to archive.');
    }
  };

  if (loading) return <div className='page-shell'><p>Loading…</p></div>;
  if (!subject) return <div className='page-shell'><p>Subject not found.</p></div>;

  return (
    <div className='page-shell ss-page'>
      <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>

      <header className="ss-header">
        <h1>Subject settings</h1>
        <p className="ss-subject" title={`${subject.code} · ${subject.name}`}>{subject.code} · {subject.name}</p>
      </header>

      {error && <div className='auth-error' role='alert'>{error}</div>}

      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && (
      <section className="ss-card">
        <div className="ss-card-head">
          <h2>Schedule</h2>
          <p className='ss-help'>Change the start date (week 1) to automatically reschedule succeeding topic dates.</p>
        </div>
        <label className="qb-label" htmlFor="ss-start-date">Start date (week 1)</label>
        <input id="ss-start-date" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label className="qb-label" htmlFor="ss-meeting-day" style={{ marginTop: 8 }}>Meeting day (optional)</label>
        <select id="ss-meeting-day" className="input" value={meetingDay} onChange={(e) => setMeetingDay(e.target.value)}>
          <option value="">Weekly (+7 days) / no fixed weekday</option>
          {WEEKDAYS.map((d) => <option key={d.value} value={String(d.value)}>{d.label}</option>)}
        </select>
        <div className="ss-actions">
          <button className='btn btn-solid' onClick={handleSaveSchedule} disabled={savingSchedule}>{savingSchedule ? 'Saving…' : 'Save & reschedule topics'}</button>
        </div>
      </section>
      )}

      <section className="ss-card">
        <div className="ss-card-head">
          <h2>Passing percent</h2>
          <p className='ss-help'>Choose the minimum score students need to pass. Changing this affects pass/fail results automatically.</p>
        </div>
        <PassingPercentControl value={passingPercent} onChange={setPassingPercent} />
        <div className="ss-actions">
          <button className='btn btn-solid' onClick={handleSavePassing} disabled={saving}>{saving ? 'Saving…' : 'Save passing percent'}</button>
        </div>
      </section>

      <section className="ss-card">
        <div className="ss-card-head">
          <h2>Enrollment</h2>
          <p className='ss-help'>Students join using the code shown on the Topics page.</p>
        </div>
        <div className="ss-status-row">
          <span className="ss-status-label">Status</span>
          <span className={`ss-status-pill ${subject.enrollmentOpen ? 'is-open' : 'is-closed'}`}>{subject.enrollmentOpen ? 'Open' : 'Closed'}</span>
        </div>
        <div className="ss-actions">
          <button className='btn btn-line' onClick={handleToggleEnrollment}>{subject.enrollmentOpen ? 'Close enrollment' : 'Open enrollment'}</button>
        </div>
      </section>

      <section className="ss-card ss-card-danger">
        <div className="ss-card-head">
          <h2>Archive</h2>
          <p className='ss-help'>Archiving hides this subject from active lists. This action is intended to be permanent for normal use.</p>
        </div>
        <div className="ss-actions">
          <button className='btn btn-danger' onClick={handleArchive}>Archive subject</button>
        </div>
      </section>
    </div>
  );
}
