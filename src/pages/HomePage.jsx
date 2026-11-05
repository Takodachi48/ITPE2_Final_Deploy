import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { ArrowRight, ArrowUpRight } from '../components/Icons';
import { useContent } from '../data/ContentContext';

const pad = (value) => String(value).padStart(2, '0');

const FEATURES = [
  {
    id: 'subjects',
    label: 'Subjects',
    blurb: 'Create a subject for each class and enroll students with a join code.',
  },
  {
    id: 'topics',
    label: 'Topics',
    blurb: 'Organize lessons, slides, and readings so students always know what comes next.',
  },
  {
    id: 'quizzes',
    label: 'Quizzes',
    blurb: 'Build quizzes with a time limit and let students take them on any device.',
  },
  {
    id: 'grades',
    label: 'Grades',
    blurb: 'Scores are recorded automatically. Students see their own results, and teachers see the whole class.',
  },
];

const ROLES = [
  {
    id: 'teacher',
    label: 'For teachers',
    points: [
      'Set up subjects and topics',
      'Publish quizzes and review submissions',
      'Track grades across the class',
    ],
  },
  {
    id: 'student',
    label: 'For students',
    points: [
      'Join a subject with a code',
      'Read topics and take quizzes',
      'Check your grades at any time',
    ],
  },
];

export default function HomePage() {
  const { modules } = useContent();
  const sample = modules.slice(0, 6);

  return (
    <div className="home">
      <section className="hero" id="home">
        <div className="shell hero-grid">
          <Reveal className="hero-copy" delay={60}>
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              Class LMS
            </p>

            <h1 className="hero-title">
              <span>Run your class</span>
              <span className="accent">in one place.</span>
            </h1>

            <p className="hero-lead">
              Manage subjects and topics, give quizzes, and keep every grade
              together. Built for the classes of TUP Taguig.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="btn btn-solid">
                Sign in
                <ArrowRight />
              </Link>
              <Link to="/register" className="link-arrow">
                Create an account
                <ArrowUpRight />
              </Link>
            </div>
          </Reveal>

          <Reveal className="hero-visual" delay={220}>
            <div className="hero-panel">
              <div className="panel-top">
                <span>Sample subject</span>
                <span>Computer System &amp; Platform Technology</span>
              </div>

              <ol className="hero-index">
                {sample.map((module) => (
                  <li key={module.id}>
                    <Link to={`/topics/${module.id}`} className="hero-index-row">
                      <span className="hero-index-num">{pad(module.id)}</span>
                      <span className="hero-index-name">{module.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>

              <Link to="/topics" className="panel-foot">
                <span>Browse all {modules.length} topics</span>
                <ArrowUpRight />
              </Link>
            </div>
            <p className="hero-note">What a subject looks like once it is set up.</p>
          </Reveal>
        </div>
      </section>

      <section className="section course-map" id="features">
        <div className="shell split-grid">
          <Reveal className="section-intro">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              What it does
            </p>
            <h2 className="section-title">Everything a class needs, nothing it doesn’t.</h2>
            <p className="section-copy">
              Teachers set up the material and the quizzes. Students read, take
              them, and see their results. No spreadsheets or shared drives in between.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <ul className="theme-list">
              {FEATURES.map((feature) => (
                <li key={feature.id}>
                  <div
                    className="theme-row"
                    style={{ display: 'block', textAlign: 'left' }}
                  >
                    <span
                      className="theme-body"
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}
                    >
                      <span className="theme-name">{feature.label}</span>
                      <span className="theme-blurb">{feature.blurb}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section class-preview" id="roles">
        <div className="shell split-grid">
          {ROLES.map((role, index) => (
            <Reveal key={role.id} className="class-copy" delay={index * 120}>
              <h2 className="section-title">{role.label}</h2>
              <ul className="section-copy">
                {role.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div className="shell cta-grid">
          <Reveal>
            <h2>Ready to start? Sign in or create your account.</h2>
          </Reveal>
          <Reveal className="cta-actions" delay={120}>
            <Link to="/register" className="btn btn-paper">
              Create an account
              <ArrowRight />
            </Link>
            <Link to="/login" className="btn btn-ghost-light">
              Sign in
              <ArrowUpRight />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}