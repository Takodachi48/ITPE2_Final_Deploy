// src/auth/pages/PendingApprovalPage.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function PendingApprovalPage() {
  const { profile, logout } = useAuth();

  return (
    <div className="auth-page">
      <h1>Pending approval</h1>
      <p>
        Your faculty account{profile?.email ? ` (${profile.email})` : ''} is
        waiting for an administrator to approve it. You'll be able to access
        faculty features once approved.
      </p>
      <button type="button" onClick={logout}>Sign out</button>
      <p><Link to="/login">Back to sign in</Link></p>
    </div>
  );
}