// src/auth/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function RegisterPage() {
  const { login } = useAuth();

  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const { register: registerApi } = await import('../../api/auth.js');
      const result = await registerApi({
        role,
        email,
        password,
        firstName,
        lastName,
        studentNumber: role === 'student' ? studentNumber : undefined,
      });
      if (result.pendingApproval) {
        setSuccess('Your faculty account is pending approval. You can sign in once approved.');
      } else if (result.requiresEmailConfirmation) {
        setSuccess('Account created. Please confirm your email before signing in.');
      } else {
        await login(email, password);
      }
    } catch (err) {
      if (err?.details) {
        const fe = {};
        for (const d of err.details) fe[d.path] = d.message;
        setFieldErrors(fe);
      } else {
        setError(err?.message || 'Registration failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <h1>Registration complete</h1>
        <p>{success}</p>
        <p><Link to="/login">Go to sign in</Link></p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Create account</h1>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label>
          Account type
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
          </select>
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>
          Password
          <div className="password-field">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            <button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        <label>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          {fieldErrors.firstName && <span className="field-error">{fieldErrors.firstName}</span>}
        </label>
        <label>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          {fieldErrors.lastName && <span className="field-error">{fieldErrors.lastName}</span>}
        </label>
        {role === 'student' && (
          <label>
            Student number
            <input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} required />
            {fieldErrors.studentNumber && <span className="field-error">{fieldErrors.studentNumber}</span>}
          </label>
        )}
        <button type="submit" className="btn btn-solid" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p><Link to="/login">Already have an account? Sign in</Link></p>
    </div>
  );
}