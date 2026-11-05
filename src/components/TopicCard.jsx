// src/components/TopicCard.jsx
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

function truncate(text, n = 30) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n).trimEnd()}...` : s;
}

export default function TopicCard({ topic, isStudent }) {
  const isScheduled = topic.state === 'scheduled' || (topic.status === 'published' && topic.state !== 'open' && topic.state !== 'failed' && topic.state !== 'pending_review' && topic.state !== 'completed' && topic.state !== 'locked' && new Date(topic.availableFrom) > new Date());
  const isLocked = topic.state === 'locked';
  const isBlocked = isStudent && (isScheduled || isLocked);

  let helperText = '';
  if (isScheduled) {
    helperText = `Opens ${new Date(topic.availableFrom).toLocaleDateString()}`;
  } else if (isLocked) {
    helperText = topic.reason || 'Locked';
  } else if (topic.state === 'pending_review') {
    helperText = 'Waiting for instructor to grade';
  } else if (topic.state === 'failed') {
    helperText = 'Repeat this topic';
  } else if (topic.state === 'completed') {
    helperText = 'Completed';
  } else if (topic.state === 'open') {
    helperText = 'Available';
  }

  const card = (
    <div
      className={`subject-card topic-card ${isBlocked ? 'topic-blocked' : ''}`}
      aria-disabled={isBlocked ? 'true' : undefined}
    >
      <div className="topic-card-head">
        <h3 className="topic-card-title">
          {topic.position}. {topic.title}
        </h3>
        <StatusBadge status={topic.state || topic.status} />
      </div>

      <p className="topic-card-desc">{truncate(topic.description, 30)}</p>

      <p className={`topic-card-helper ${isLocked || isScheduled ? 'is-muted' : ''}`}>
        {helperText || '\u00a0'}
      </p>
    </div>
  );

  if (isStudent && !isBlocked) {
    return (
      <Link
        to={`/student/topics/${topic.id}`}
        className="topic-card-link"
      >
        {card}
      </Link>
    );
  }

  return card;
}
