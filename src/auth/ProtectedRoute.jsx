// src/auth/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Loading from '../components/Loading';

export default function ProtectedRoute({ roles, children }) {
  const { status, profile } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <Loading label="Checking your session" />;
  }

  if (status !== 'authenticated' || !profile) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Pending faculty land on pending-approval
  if (profile.role === 'faculty' && profile.approvalStatus === 'pending') {
    if (location.pathname !== '/pending-approval') {
      return <Navigate to="/pending-approval" replace />;
    }
  }

  if (roles && roles.length > 0 && !roles.includes(profile.role)) {
    // Redirect to appropriate dashboard
    if (profile.role === 'admin') return <Navigate to="/admin/users" replace />;
    if (profile.role === 'faculty') return <Navigate to="/faculty" replace />;
    return <Navigate to="/student" replace />;
  }

  return children;
}