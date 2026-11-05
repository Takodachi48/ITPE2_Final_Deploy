// src/components/StatusBadge.jsx
import {
  BookIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  GlobeIcon,
  HourglassIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  RotateIcon,
} from './Icons';

// Colours live in `src/index.css` (`.status-badge.status-<status>`): attention states use
// `--accent-ink`, neutral or done states use `--ink`, inactive states use `--muted`.
const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: HourglassIcon },
  approved: { label: 'Approved', icon: CheckIcon },
  rejected: { label: 'Rejected', icon: CloseIcon },
  draft: { label: 'Draft', icon: PencilIcon },
  published: { label: 'Published', icon: GlobeIcon },
  scheduled: { label: 'Scheduled', icon: ClockIcon },
  locked: { label: 'Locked', icon: LockIcon },
  open: { label: 'Open', icon: BookIcon },
  completed: { label: 'Completed', icon: CheckIcon },
  pending_review: { label: 'Pending Review', icon: HourglassIcon },
  failed: { label: 'Repeat Topic', icon: RotateIcon },
  passed: { label: 'Passed', icon: CheckIcon },
  not_passed: { label: 'Failed', icon: CloseIcon },
  graded: { label: 'Graded', icon: CheckIcon },
  in_progress: { label: 'In Progress', icon: PlayIcon },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status];
  const Icon = config && config.icon;

  return (
    <span className={`status-badge status-${status}`}>
      {Icon && <Icon />}
      <span>{config ? config.label : status}</span>
    </span>
  );
}
