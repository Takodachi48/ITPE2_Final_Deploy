import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from '../components/Icons';

export default function NotFoundPage() {
  return (
    <section className="notfound-shell">
      <div className="shell notfound-inner">
        <span className="notfound-code" aria-hidden="true">
          404
        </span>
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Page not found
        </p>
        <h1>This page is not in the index.</h1>
        <p>
          The address may be incomplete, or the page may have moved. The module
          index is still where you left it.
        </p>
        <div className="notfound-actions">
          <Link to="/topics" className="btn btn-solid">
            Open the module index
            <ArrowRight />
          </Link>
          <Link to="/" className="link-arrow">
            Back home
            <ArrowUpRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
