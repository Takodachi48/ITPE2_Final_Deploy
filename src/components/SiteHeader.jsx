import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ArrowUpRight } from './Icons';
import { PRODUCT_NAME } from '../lib/product-name';

const navItems = [
  { label: 'Home', to: '/', match: (path) => path === '/' },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { status, profile, logout } = useAuth();
  const location = useLocation();

  const dashboardPath =
    profile?.role === 'admin'
      ? '/admin/users'
      : profile?.role === 'faculty'
        ? '/faculty'
        : '/student';

  const isAuthenticated = status === 'authenticated';
  const dashboardActive = isAuthenticated && (
    profile?.role === 'admin'
      ? location.pathname.startsWith('/admin')
      : profile?.role === 'faculty'
        ? location.pathname.startsWith('/faculty')
        : location.pathname.startsWith('/student')
  );

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
        <Link
          to="/"
          className="brand"
          aria-label={PRODUCT_NAME + " home"}
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-mark" aria-hidden="true">
            <span>LMS</span>
          </span>
          <span className="brand-copy">
            <span className="brand-name">{PRODUCT_NAME}</span>
            <span className="brand-sub">Subjects · Topics · Quizzes</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`nav-link ${item.match(location.pathname) ? 'is-active' : ''}`}
              aria-current={item.match(location.pathname) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <>
              <Link to={dashboardPath} className={`nav-link ${dashboardActive ? 'is-active' : ''}`} aria-current={dashboardActive ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <span className="nav-link nav-user">{profile?.fullName || profile?.email}</span>
              <button type="button" className="nav-link nav-logout" onClick={() => { setMenuOpen(false); logout(); }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
              <Link to="/register" className="nav-link" onClick={() => setMenuOpen(false)}>
                Register
              </Link>
            </>
          )}
        </nav>

        {/* <div className="header-meta" aria-hidden="true">
          <span>ITPE / Final</span>
          <strong>{modules.length} modules</strong>
        </div> */}

        <button
          type="button"
          className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav" id="mobile-navigation">
          <nav className="mobile-nav-list" aria-label="Mobile">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`mobile-nav-link ${item.match(location.pathname) ? 'is-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span>{item.label}</span>
                <ArrowUpRight />
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link to={dashboardPath} className={`mobile-nav-link ${dashboardActive ? 'is-active' : ''}`} onClick={() => setMenuOpen(false)}>
                  <span>Dashboard</span>
                  <ArrowUpRight />
                </Link>
                <button type="button" className="mobile-nav-link" onClick={() => { setMenuOpen(false); logout(); }}>
                  <span>Logout</span>
                  <ArrowUpRight />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                  <span>Login</span>
                  <ArrowUpRight />
                </Link>
                <Link to="/register" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                  <span>Register</span>
                  <ArrowUpRight />
                </Link>
              </>
            )}
          </nav>
          <div className="mobile-nav-meta">
            <span>{PRODUCT_NAME}</span>
            <span>Class learning management system</span>
          </div>
        </div>
      )}
    </>
  );
}
