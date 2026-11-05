import { Link } from 'react-router-dom';
import { ArrowUpRight } from './Icons';
import { PRODUCT_NAME } from '../lib/product-name';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-brandline">
              <span className="footer-mark" aria-hidden="true">
                LMS
              </span>
              <span>{PRODUCT_NAME}</span>
            </Link>
            <p>
              A class learning management system for subjects, topics, quizzes,
              grading, and reports.
            </p>
          </div>

          <nav className="footer-nav" aria-label="Account">
            <span className="footer-label">Get started</span>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create an account</Link>
          </nav>

          <nav className="footer-nav" aria-label="Footer">
            <span className="footer-label">Explore</span>
            <Link to="/">Home</Link>
            <Link to="/topics">Topics</Link>
            <Link to="/about">About the class</Link>
          </nav>
        </div>

        <div className="footer-bottom">
          <span>© {year} {PRODUCT_NAME}</span>
          <a href="#top" className="footer-top">
            Back to top <ArrowUpRight />
          </a>
        </div>
      </div>
    </footer>
  );
}