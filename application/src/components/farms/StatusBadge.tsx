import React from 'react';
import AppStatusBadge from '../AppStatusBadge/AppStatusBadge';
import type { BadgeTone } from '../../types/farm';

export interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone = 'neutral' }) => (
  <AppStatusBadge label={label} tone={tone} />
);

export default React.memo(StatusBadge);
