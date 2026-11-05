// src/auth/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const nextParam = new URLSearchParams(location.search).get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(email, password, nextParam);
    } catch (err) {
      if (err?.details) {
        const fe = {};
        for (const d of err.details) {
          fe[d.path] = d.message;
        }
        setFieldErrors(fe);
      } else {
        setError(err?.message || 'Login failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>
          Password
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        <button type="submit" className="btn btn-solid" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p>
        <Link to="/forgot-password">Forgot password?</Link> · <Link to="/register">Create account</Link>
      </p>
    </div>
  );
}