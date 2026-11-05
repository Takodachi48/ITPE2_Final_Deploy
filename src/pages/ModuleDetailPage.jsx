import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Reveal from '../components/Reveal';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from '../components/Icons';
import { useContent } from '../data/ContentContext';
import { formatName } from '../data/modules';

const pad = (value) => String(value).padStart(2, '0');

const getVideos = (module) => {
  if (!module) return [];
  if (Array.isArray(module.videoUrls)) return module.videoUrls;
  if (Array.isArray(module.videoUrl)) return module.videoUrl;
  return module.videoUrl ? [module.videoUrl] : [];
};

const toEmbedUrl = (value) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (url.pathname.startsWith('/embed/')) return value;
      if (url.pathname.startsWith('/shorts/')) {
        return `https://www.youtube.com/embed/${url.pathname.split('/')[2]}`;
      }
    }
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return value;
  } catch {
    return value;
  }
};

const toSlidesEmbedUrl = (value) => {
  if (!value) return '';
  try {
    const match = value.match(/\/presentation\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    return value;
  } catch {
    return value;
  }
};

const initialsFor = (name = '') => {
  const [last = '', ...rest] = name.split(',');
  const first = rest.join(',').trim();
  return `${first.charAt(0)}${last.trim().charAt(0)}`.toUpperCase();
};

const renderInline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? <strong key={index}>{bold[1]}</strong> : <span key={index}>{part}</span>;
  });

const renderSummary = (text) => {
  if (!text) return null;
  return text
    .trim()
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={index}>{renderInline(paragraph.replace(/\s*\n\s*/g, ' '))}</p>
    ));
};

export default function ModuleDetailPage() {
  const { id } = useParams();
  const { modules, themeForModule } = useContent();
  const moduleId = Number(id);
  const module = modules.find((item) => item.id === moduleId);
  const videos = getVideos(module);
  const [videoChoice, setVideoChoice] = useState({ moduleId: null, index: 0 });
  const activeVideoIndex =
    videoChoice.moduleId === moduleId && videos.length
      ? Math.min(videoChoice.index, videos.length - 1)
      : 0;

  if (!module) {
    return (
      <section className="notfound-shell">
        <div className="shell notfound-inner">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Error / 404
          </p>
          <h1>That module is not in the index.</h1>
          <p>
            The link may be incomplete, or the module may have moved. The index
            runs from 01 to 16.
          </p>
          <div className="notfound-actions">
            <Link to="/topics" className="btn btn-solid">
              Back to the index
              <ArrowRight />
            </Link>
            <Link to="/topics/1" className="link-arrow">
              Start at module 01
              <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const theme = themeForModule(moduleId);
  const moduleIndex = modules.findIndex((item) => item.id === moduleId);
  const previous = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
  const next =
    moduleIndex >= 0 && moduleIndex < modules.length - 1
      ? modules[moduleIndex + 1]
      : null;

  return (
    <article className="module-page">
      <div className="shell">
        <div className="module-top">
          <Link to="/topics" className="back-link">
            <ArrowLeft />
            All modules
          </Link>
          <span className="module-top-index">
            {pad(moduleId)} / {modules.length}
          </span>
        </div>

        <Reveal className="module-head">
          <div className="module-head-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              Module {pad(moduleId)} · {theme?.label}
            </p>
            <h1>{module.title}</h1>
            <p className="module-desc">{module.description}</p>
            <div className="module-tags">
              <span>{module.members.length} presenters</span>
              {module.pptUrl && <span>Slide deck</span>}
              {videos.length > 0 && (
                <span>
                  {videos.length} video{videos.length > 1 ? 's' : ''}
                </span>
              )}
              <span>Class LMS</span>
            </div>
          </div>
          <span className="module-head-number" aria-hidden="true">
            {pad(moduleId)}
          </span>
        </Reveal>

        <div className="module-layout">
          <div className="module-main">
            <section className="media-block" id="presentation">
              <div className="block-head">
                <p className="block-label">
                  <span className="block-index">01</span>
                  Presentation
                </p>
                {module.pptUrl && (
                  <a
                    href={module.pptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block-link"
                  >
                    Open in Google Slides
                    <ArrowUpRight />
                  </a>
                )}
              </div>

              <div className="frame">
                <div className="frame-bar">
                  <span className="frame-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>Slides / Embedded</span>
                </div>
                <div className="frame-body">
                  {module.pptUrl ? (
                    <iframe
                      src={toSlidesEmbedUrl(module.pptUrl)}
                      title={`${module.title} slide deck`}
                      allowFullScreen
                    />
                  ) : (
                    <div className="frame-empty">
                      <p>The slide deck for this module has not been added yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="media-block" id="video">
              <div className="block-head">
                <p className="block-label">
                  <span className="block-index">02</span>
                  Video discussion
                </p>
                {videos[activeVideoIndex] && (
                  <a
                    href={videos[activeVideoIndex]}
                    target="_blank"
                    rel="noreferrer"
                    className="block-link"
                  >
                    Watch on YouTube
                    <ArrowUpRight />
                  </a>
                )}
              </div>

              {videos.length > 1 && (
                <div className="video-tabs" role="tablist" aria-label="Video discussions">
                  {videos.map((video, index) => (
                    <button
                      key={video}
                      id={`video-tab-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={index === activeVideoIndex}
                      aria-controls="video-panel"
                      className={`video-tab ${
                        index === activeVideoIndex ? 'is-active' : ''
                      }`}
                      onClick={() => setVideoChoice({ moduleId, index })}
                    >
                      Discussion {pad(index + 1)}
                    </button>
                  ))}
                </div>
              )}

              <div className="frame">
                <div className="frame-bar">
                  <span className="frame-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    Video / {pad(activeVideoIndex + 1)}
                    {videos.length > 1 ? ` of ${pad(videos.length)}` : ''}
                  </span>
                </div>
                {videos.length > 0 ? (
                  <div
                    className="frame-body"
                    id="video-panel"
                    {...(videos.length > 1
                      ? {
                          role: 'tabpanel',
                          'aria-labelledby': `video-tab-${activeVideoIndex}`,
                        }
                      : { 'aria-label': 'Video discussion' })}
                  >
                    <iframe
                      key={videos[activeVideoIndex]}
                      src={toEmbedUrl(videos[activeVideoIndex])}
                      title={`${module.title} video discussion ${
                        activeVideoIndex + 1
                      }`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="frame-body frame-empty">
                    <p>The video discussion for this module has not been added yet.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="summary-block" id="summary">
              <div className="block-head">
                <p className="block-label">
                  <span className="block-index">03</span>
                  Topic summary
                </p>
                <span className="block-note">Written overview</span>
              </div>
              {module.summary ? (
                <div className="prose">{renderSummary(module.summary)}</div>
              ) : (
                <p className="summary-missing">
                  No written summary is available for this topic yet.
                </p>
              )}
            </section>
          </div>

          <aside className="module-aside" aria-label="Module details">
            <div className="aside-inner">
              <div className="aside-block">
                <p className="aside-label">Presented by</p>
                <ul className="presenter-list">
                  {module.members.map((member) => (
                    <li key={member.name} className="presenter">
                      <span className="presenter-mark" aria-hidden="true">
                        {initialsFor(member.name)}
                      </span>
                      <span>
                        <span className="presenter-name">
                          {formatName(member.name)}
                        </span>
                        <span className="presenter-role">Presenter</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="aside-block">
                <p className="aside-label">On this page</p>
                <nav className="aside-nav" aria-label="On this page">
                  <a href="#presentation">
                    <span>01</span> Presentation
                  </a>
                  <a href="#video">
                    <span>02</span> Video discussion
                  </a>
                  <a href="#summary">
                    <span>03</span> Topic summary
                  </a>
                </nav>
              </div>

              <div className="aside-block">
                <p className="aside-label">Module record</p>
                <dl className="aside-facts">
                  <div>
                    <dt>Module</dt>
                    <dd>
                      {pad(moduleId)} / {modules.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Theme</dt>
                    <dd>{theme?.label}</dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>Slides + video</dd>
                  </div>
                  <div>
                    <dt>Course</dt>
                    <dd>Class LMS</dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </div>

        <nav className="module-pager" aria-label="Module navigation">
          {previous && (
            <Link to={`/topics/${previous.id}`} className="pager-link pager-prev">
              <span className="pager-label">
                <ArrowLeft />
                Previous module
              </span>
              <span className="pager-title">
                {pad(previous.id)} — {previous.title}
              </span>
            </Link>
          )}
          {next && (
            <Link to={`/topics/${next.id}`} className="pager-link pager-next">
              <span className="pager-label">
                Next module
                <ArrowRight />
              </span>
              <span className="pager-title">
                {pad(next.id)} — {next.title}
              </span>
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
}
