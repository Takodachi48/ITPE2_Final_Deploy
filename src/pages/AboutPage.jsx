import Reveal from '../components/Reveal';
import { PRODUCT_NAME } from '../lib/product-name';

export default function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-hero">
        <div className="shell about-hero-grid">
          <Reveal className="about-hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              About
            </p>
            <h1>
              {PRODUCT_NAME}
              <span className="accent">.</span>
            </h1>
            <p className="about-lead">
              {PRODUCT_NAME} is a class learning management system for managing
              subjects, scheduled topics, learning content, quizzes, grading, and
              reports.
            </p>
          </Reveal>
        </div>
      </header>

      <section className="section about-story">
        <div className="shell split-grid about-story-grid">
          <Reveal className="section-intro">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              What it supports
            </p>
            <h2 className="section-title">Faculty and student workflows.</h2>
          </Reveal>

          <Reveal className="story-copy" delay={100}>
            <p>
              Faculty can create subjects, share join codes, publish topics and
              content, build or generate draft quizzes, review submissions, and
              export reports.
            </p>
            <p>
              Students can join subjects, access scheduled topics, take quizzes,
              submit uploaded assessments when required, and view grades and
              progress.
            </p>
            <p>
              Some legacy public module/content pages may still exist from the
              project’s earlier iteration; the authenticated LMS flows are the
              primary application.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
