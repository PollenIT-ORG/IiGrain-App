import { COLORS } from '../../constants';

interface TypeMeta {
  icon: string;
  color: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  new_program_available: { icon: 'bullhorn-outline', color: COLORS.infoBlue },
  enrolled_in_program: { icon: 'check-decagram-outline', color: COLORS.success },
  assessor_assigned: { icon: 'account-tie-outline', color: COLORS.primary },
  assessor_visit_started: { icon: 'map-marker-radius-outline', color: COLORS.warning },
  assessment_submitted: { icon: 'clipboard-check-outline', color: COLORS.success },
  assessment_reviewed: { icon: 'star-check-outline', color: COLORS.success },
};

const DEFAULT_META: TypeMeta = { icon: 'bell-outline', color: COLORS.gray600 };

export const metaForNotificationType = (type: string): TypeMeta => TYPE_META[type] ?? DEFAULT_META;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const formatRelativeTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) {
    return 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) {
    return 'Yesterday';
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};
