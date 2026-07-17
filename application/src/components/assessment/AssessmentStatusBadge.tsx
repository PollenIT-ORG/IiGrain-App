import React from 'react';
import AppStatusBadge from '../AppStatusBadge/AppStatusBadge';
import type {
  AppStatusBadgeProps,
  StatusBadgeSize,
} from '../AppStatusBadge/AppStatusBadge';
import type { AssessmentStatus } from '../../types/assessment';

const STATUS_TO_BADGE: Record<
  AssessmentStatus,
  Pick<AppStatusBadgeProps, 'status' | 'tone' | 'label'>
> = {
  IN_PROGRESS: { status: 'in_progress' },
  COMPLETED: { status: 'completed' },
  PENDING: { status: 'pending' },
  DRAFT: { tone: 'neutral', label: 'Draft' },
  FAILED: { tone: 'danger', label: 'Failed' },
};

export interface AssessmentStatusBadgeProps {
  status: AssessmentStatus;
  size?: StatusBadgeSize;
}

const AssessmentStatusBadge: React.FC<AssessmentStatusBadgeProps> = ({
  status,
  size = 'md',
}) => <AppStatusBadge size={size} {...STATUS_TO_BADGE[status]} />;

export default React.memo(AssessmentStatusBadge);
