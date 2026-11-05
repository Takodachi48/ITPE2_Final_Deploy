// src/pages/admin/Users.jsx
import { useCallback, useEffect, useState } from 'react';
import { listProfiles, updateProfile } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'student', label: 'Student' },
];

export default function AdminUsers() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ approvalStatus: '', role: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter.approvalStatus) params.set('approvalStatus', filter.approvalStatus);
      if (filter.role) params.set('role', filter.role);
      const qs = params.toString();
      const data = await listProfiles(qs);
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id) => {
    try {
      await updateProfile(id, { approvalStatus: 'approved' });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to approve.');
    }
  };

  const handleReject = async (id) => {
    try {
      await updateProfile(id, { approvalStatus: 'rejected' });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to reject.');
    }
  };

  const handleChangeRole = async (id, newRole) => {
    try {
      await updateProfile(id, { role: newRole });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to change role.');
    }
  };

  if (loading) return <Loading label="Loading users" />;

  return (
    <div className="page-shell">
      <header className="admin-head">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Admin · Accounts
          </p>
          <h1 className="admin-title">Users</h1>
        </div>
        <span className="admin-count">
          {profiles.length} {profiles.length === 1 ? 'account' : 'accounts'}
        </span>
      </header>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <div className="admin-filters">
        <div className="admin-filter-group" role="group" aria-label="Filter by approval status">
          <span className="admin-filter-label">Status</span>
          <div className="filter-tabs">
            {STATUS_FILTERS.map((option) => {
              const active = filter.approvalStatus === option.value;
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  className={`filter-tab ${active ? 'is-active' : ''}`.trim()}
                  aria-pressed={active}
                  onClick={() => setFilter((f) => ({ ...f, approvalStatus: option.value }))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-filter-group" role="group" aria-label="Filter by role">
          <span className="admin-filter-label">Role</span>
          <div className="filter-tabs">
            {ROLE_FILTERS.map((option) => {
              const active = filter.role === option.value;
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  className={`filter-tab ${active ? 'is-active' : ''}`.trim()}
                  aria-pressed={active}
                  onClick={() => setFilter((f) => ({ ...f, role: option.value }))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {profiles.length === 0 ? (
        <p className="empty-state">No users match the current filters.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const name = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim() || 'Unnamed account';
                const isSelf = p.id === profile?.id;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="admin-name">{name}</span>
                      {isSelf && <span className="admin-self">You</span>}
                    </td>
                    <td className="admin-email">{p.email}</td>
                    <td>
                      <select
                        className="admin-role-select"
                        value={p.role}
                        aria-label={`Role for ${name}`}
                        onChange={(e) => handleChangeRole(p.id, e.target.value)}
                        disabled={isSelf}
                      >
                        <option value="admin">Admin</option>
                        <option value="faculty">Faculty</option>
                        <option value="student">Student</option>
                      </select>
                    </td>
                    <td>
                      <StatusBadge status={p.approvalStatus} />
                    </td>
                    <td>
                      {p.approvalStatus === 'pending' ? (
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-solid"
                            onClick={() => handleApprove(p.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-line"
                            onClick={() => handleReject(p.id)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="admin-action-none">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">No actions available</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
