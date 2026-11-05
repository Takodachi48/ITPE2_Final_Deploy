import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { ArrowUpRight, CloseIcon, SearchIcon } from '../components/Icons';
import { useContent } from '../data/ContentContext';
import { formatName, shortName } from '../data/modules';

const pad = (value) => String(value).padStart(2, '0');

export default function TopicsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const { modules, presenterCount, themes, themeForModule } = useContent();

  const requestedTheme = searchParams.get('theme');
  const activeTheme = themes.some((theme) => theme.id === requestedTheme)
    ? requestedTheme
    : 'all';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return modules.filter((module) => {
      const inTheme =
        activeTheme === 'all' ||
        themeForModule(module.id)?.id === activeTheme;

      if (!inTheme) return false;
      if (!needle) return true;

      const haystack = [
        module.title,
        module.description,
        module.summary,
        ...module.members.flatMap((member) => [
          member.name,
          formatName(member.name),
          shortName(member.name),
        ]),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [activeTheme, modules, query, themeForModule]);

  const setTheme = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('theme');
    else next.set('theme', id);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setQuery('');
    setSearchParams({}, { replace: true });
  };

  const hasFilters = query.trim() !== '' || activeTheme !== 'all';

  return (
    <div className="topics-page">
      <header className="page-head">
        <div className="shell">
          <Reveal>
            <div className="page-head-meta">
              <p className="eyebrow">
                <span className="eyebrow-dot" />
                Index / {modules.length} modules
              </p>
              <span className="index-total">
                {presenterCount} presenters · {themes.length} themes
              </span>
            </div>
            <h1 className="page-title">
              The module index<span className="accent">.</span>
            </h1>
            <p className="page-lead">
              Every presentation from the semester, in order. Search by title or
              presenter, or narrow the list by theme. Each entry includes the
              slide deck, video discussion, and written summary.
            </p>
          </Reveal>
        </div>
      </header>

      <div className="topic-toolbar">
        <div className="shell toolbar-inner">
          <div className="filter-tabs" role="group" aria-label="Filter by theme">
            <button
              type="button"
              className={`filter-tab ${activeTheme === 'all' ? 'is-active' : ''}`}
              aria-pressed={activeTheme === 'all'}
              onClick={() => setTheme('all')}
            >
              All
            </button>
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`filter-tab ${
                  activeTheme === theme.id ? 'is-active' : ''
                }`}
                aria-pressed={activeTheme === theme.id}
                onClick={() => setTheme(theme.id)}
              >
                {theme.label}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <label className="search-field">
              <span className="sr-only">Search modules and presenters</span>
              <SearchIcon className="search-icon" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the index"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                >
                  <CloseIcon />
                </button>
              )}
            </label>
            <span className="result-count" aria-live="polite">
              {pad(filtered.length)} / {pad(modules.length)}
            </span>
          </div>
        </div>
      </div>

      <section className="shell index-section" aria-label="Module list">
        <div className="index-head" aria-hidden="true">
          <span>No.</span>
          <span>Module</span>
          <span>Presented by</span>
          <span>Theme</span>
          <span />
        </div>

        {filtered.length > 0 ? (
          <ol className="index-list">
            {filtered.map((module, index) => {
              const theme = themeForModule(module.id);
              return (
                <li key={module.id} style={{ '--row-index': index }}>
                  <Link to={`/topics/${module.id}`} className="index-row">
                    <span className="index-num">{pad(module.id)}</span>
                    <span className="index-main">
                      <span className="index-title">{module.title}</span>
                      <span className="index-desc">{module.description}</span>
                      <span className="index-mobile-meta">
                        {theme?.label} ·{' '}
                        {module.members.map((member) => shortName(member.name)).join(', ')}
                      </span>
                    </span>
                    <span className="index-presenters">
                      {module.members
                        .map((member) => shortName(member.name))
                        .join(', ')}
                    </span>
                    <span className="index-theme">{theme?.label}</span>
                    <span className="index-arrow">
                      <ArrowUpRight />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="index-empty">
            <span className="empty-code" aria-hidden="true">
              00
            </span>
            <h2>No modules match that search.</h2>
            <p>
              Try a broader term like “security”, “data”, or a presenter’s
              surname. You can also reset the theme filter.
            </p>
            <button type="button" className="btn btn-line" onClick={clearFilters}>
              Clear filters
              <CloseIcon />
            </button>
          </div>
        )}

        {hasFilters && filtered.length > 0 && (
          <div className="index-footer-note">
            <span>
              Showing {filtered.length} of {modules.length} modules
              {activeTheme !== 'all'
                ? ` in ${themes.find((theme) => theme.id === activeTheme)?.label}`
                : ''}
            </span>
            <button type="button" className="text-button" onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
