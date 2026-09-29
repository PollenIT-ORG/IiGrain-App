import React from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components';
import { AppShimmer, AppShimmerText } from '../../../components/Shimmer';
import { formatDate } from '../../../utils';
import { formatAcres } from '../../../maps/utils/fieldAcres';
import type { AvailableProgram } from '../../../types/enrollment';
import { styles } from './ProgramSummaryCardStyle';

export interface ProgramSummaryCardProps {
  program: AvailableProgram | null;
  enrollmentId: string | null;
  enrolledAcres: number | null;
  loading?: boolean;
}

const DASH = '-';

export const programYear = (program: AvailableProgram): string => {
  const { startDateISO: start, endDateISO: end } = program;
  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (start) {
    return `From ${formatDate(start)}`;
  }
  if (end) {
    return `Until ${formatDate(end)}`;
  }
  return DASH;
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <AppText style={styles.label}>{label}</AppText>
    <AppText style={styles.value} numberOfLines={2}>
      {value}
    </AppText>
  </View>
);

const ProgramSummaryCard: React.FC<ProgramSummaryCardProps> = ({
  program,
  enrollmentId,
  enrolledAcres,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.card}>
        <AppShimmerText width="70%" />
        <View style={styles.shimmerBody}>
          <AppShimmer width="45%" height={14} radius={4} />
          <AppShimmer width="60%" height={14} radius={4} />
          <AppShimmer width="55%" height={14} radius={4} />
        </View>
      </View>
    );
  }

  if (!program) {
    return (
      <View style={styles.card}>
        <AppText style={styles.name}>Program details unavailable</AppText>
        <AppText style={styles.emptyNote}>
          We could not load your program just now. Your setup steps below still
          work, and the details will appear once you are back online.
        </AppText>
      </View>
    );
  }

  const tier = program.type?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText style={styles.name} numberOfLines={2}>
          {program.name}
        </AppText>
        {tier ? (
          <View style={styles.tier}>
            <AppText style={styles.tierText} numberOfLines={1}>
              {tier.toUpperCase()}
            </AppText>
          </View>
        ) : null}
      </View>

      <Row label="Enrollment ID" value={enrollmentId ?? DASH} />
      <Row
        label="Enrolled Acres"
        value={enrolledAcres === null ? DASH : formatAcres(enrolledAcres)}
      />
      <Row label="Program Year" value={programYear(program)} />
    </View>
  );
};

export default ProgramSummaryCard;
