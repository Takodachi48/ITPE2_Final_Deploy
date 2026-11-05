// src/auth/pages/ForgotPasswordPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setMessage('If an account exists for that email, a reset link has been sent.');
    } catch (err) {
      setMessage(err?.message || 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <h1>Forgot password</h1>
      {message && <div className="auth-info" role="status">{message}</div>}
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <button type="submit" className="btn btn-solid" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p><Link to="/login">Back to sign in</Link></p>
    </div>
  );
}