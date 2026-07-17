import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '../../constants';
import EmptyAssessmentState from './EmptyAssessmentState';

const AssessmentHistory: React.FC = () => (
  <ScrollView
    contentContainerStyle={styles.content}
    showsVerticalScrollIndicator={false}>
    <EmptyAssessmentState
      icon="clipboard-check-outline"
      title="No History Yet"
      message="Completed assessments will appear here once you finish your first evaluation."
    />
  </ScrollView>
);

export default React.memo(AssessmentHistory);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[4],
  },
});
