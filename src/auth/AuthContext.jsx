/* eslint-disable react-refresh/only-export-components */
// src/auth/AuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth.js';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

function safeNextPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  // Only accept same-origin paths.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | anonymous | authenticated
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const applyMe = useCallback((me) => {
    if (me?.user && me?.profile) {
      setUser(me.user);
      setProfile(me.profile);
      setStatus('authenticated');
      return true;
    }
    setUser(null);
    setProfile(null);
    setStatus('anonymous');
    return false;
  }, []);

  // Initial session check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.getMe();
        if (!cancelled) applyMe(me);
      } catch {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setStatus('anonymous');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMe]);

  const login = useCallback(
    async (email, password, nextParam) => {
      const result = await authApi.login(email, password);
      applyMe({ user: result.user, profile: result.profile });

      const role = result.profile?.role;
      const approvalStatus = result.profile?.approvalStatus;
      const next = safeNextPath(nextParam);

      let target = next;
      if (!target) {
        if (role === 'admin') target = '/admin/users';
        else if (role === 'faculty') {
          target = approvalStatus === 'pending' ? '/pending-approval' : '/faculty';
        } else {
          target = '/student';
        }
      }

      // Pending faculty always land on pending-approval even with ?next=
      if (role === 'faculty' && approvalStatus === 'pending') {
        target = '/pending-approval';
      }

      navigate(target, { replace: true });
      return result;
    },
    [applyMe, navigate],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setProfile(null);
    setStatus('anonymous');
    navigate('/login', { replace: true });
  }, [navigate]);

  const refreshProfile = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      applyMe(me);
      return me;
    } catch {
      setUser(null);
      setProfile(null);
      setStatus('anonymous');
      return null;
    }
  }, [applyMe]);

  const value = useMemo(
    () => ({
      status,
      user,
      profile,
      login,
      logout,
      refreshProfile,
    }),
    [status, user, profile, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}