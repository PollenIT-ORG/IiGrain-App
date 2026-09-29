import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import {
  AppGradient,
  AppProgressBar,
  AppStatusBadge,
  AppText,
  ConfirmationModal,
} from '../../../components';
import { EmptyState } from '../../../components/farms';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';
import { recordAnsweredCount } from '../../../utils/recordAnswers';
import type {
  AssessmentQuestionDetail,
  AssessmentRecord,
  AssessmentRecordAnswer,
} from '../../../types/assessment';

const SUMMARY_FIELDS = 2;

const answerLabel = (
  question: AssessmentQuestionDetail,
  answer: AssessmentRecordAnswer,
): string | null => {
  switch (question.questionType) {
    case 'number':
      return answer.answerNumber === null ? null : String(answer.answerNumber);
    case 'date':
      return answer.answerDate;
    case 'boolean':
      return answer.answerBoolean === null ? null : answer.answerBoolean ? 'Yes' : 'No';
    case 'mcq':
      return answer.optionText;
    case 'scored':
      return answer.score === null ? null : String(answer.score);
    default:
      return answer.answerText;
  }
};

const summaryLine = (
  record: AssessmentRecord,
  questions: AssessmentQuestionDetail[],
): string => {
  const byId = new Map(record.answers.map(answer => [answer.questionId, answer]));
  const parts: string[] = [];
  for (const question of questions) {
    if (parts.length === SUMMARY_FIELDS) {
      break;
    }
    const answer = byId.get(question.id);
    const label = answer ? answerLabel(question, answer) : null;
    if (label && label.trim()) {
      parts.push(`${question.text}: ${label.trim()}`);
    }
  }
  return parts.join('   ');
};

const photoCount = (record: AssessmentRecord): number =>
  record.evidenceUrls.length +
  record.answers.reduce((total, answer) => total + answer.evidenceUrls.length, 0);

interface RecordRowProps {
  record: AssessmentRecord;
  questions: AssessmentQuestionDetail[];
  locked: boolean;
  onOpen: (recordId: string) => void;
  onDelete: (record: AssessmentRecord) => void;
}

const RecordRow = React.memo(function RecordRowImpl({
  record,
  questions,
  locked,
  onOpen,
  onDelete,
}: RecordRowProps) {
  const summary = useMemo(() => summaryLine(record, questions), [record, questions]);
  const answered = useMemo(
    () => recordAnsweredCount(questions, record),
    [questions, record],
  );
  const photos = photoCount(record);

  const complete = questions.length > 0 && answered >= questions.length;
  const accent = complete ? COLORS.primary : COLORS.gray500;

  const open = useCallback(() => onOpen(record.id), [onOpen, record.id]);
  const remove = useCallback(() => onDelete(record), [onDelete, record]);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Open entry ${record.number}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={[styles.accent, { backgroundColor: accent }]} pointerEvents="none" />

      <View style={styles.top}>
        <View
          style={[
            styles.leading,
            { backgroundColor: addAlpha(accent, complete ? 0.12 : 0.08) },
          ]}>
          <AppText style={styles.leadingText} color={accent}>
            {record.number}
          </AppText>
        </View>

        <View style={styles.headTexts}>
          <AppText style={styles.title} numberOfLines={1}>
            Entry {record.number}
          </AppText>
          <AppText style={styles.meta} numberOfLines={1}>
            {answered} of {questions.length} filled in
          </AppText>
        </View>

        <View style={styles.tail}>
          <AppStatusBadge
            size="sm"
            label={complete ? 'Complete' : 'In progress'}
            tone={complete ? 'success' : 'neutral'}
          />
          <AppIcon
            name={ICONS.CHEVRON_RIGHT}
            size={moderateScale(16)}
            color={COLORS.gray500}
          />
        </View>
      </View>

      {summary ? (
        <AppText style={styles.summary} numberOfLines={2}>
          {summary}
        </AppText>
      ) : (
        <AppText style={styles.summaryEmpty}>Nothing filled in yet</AppText>
      )}

      <View style={styles.chips}>
        {photos > 0 ? (
          <View style={styles.chip}>
            <AppIcon
              name={ICONS.EVIDENCE}
              size={moderateScale(12)}
              color={COLORS.gray600}
            />
            <AppText style={styles.chipText}>
              {photos} {photos === 1 ? 'file' : 'files'}
            </AppText>
          </View>
        ) : null}

        {locked ? null : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={remove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete entry ${record.number}`}
            style={styles.removeBtn}>
            <AppIcon name={ICONS.DELETE} size={moderateScale(13)} color={COLORS.danger} />
            <AppText style={styles.removeText}>Remove</AppText>
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

export interface CategoryRecordsViewProps {
  categoryName: string;
  questions: AssessmentQuestionDetail[];
  records: AssessmentRecord[];
  locked: boolean;
  busy: boolean;
  onOpen: (recordId: string | null) => void;
  onDelete: (recordId: string) => void;
}

const CategoryRecordsView: React.FC<CategoryRecordsViewProps> = ({
  categoryName,
  questions,
  records,
  locked,
  busy,
  onOpen,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [pendingDelete, setPendingDelete] = useState<AssessmentRecord | null>(null);

  const add = useCallback(() => onOpen(null), [onOpen]);
  const openRecord = useCallback((recordId: string) => onOpen(recordId), [onOpen]);
  const askDelete = useCallback((record: AssessmentRecord) => setPendingDelete(record), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = useCallback(() => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target) {
      onDelete(target.id);
    }
  }, [pendingDelete, onDelete]);

  const filled = useMemo(
    () =>
      records.reduce((total, record) => total + recordAnsweredCount(questions, record), 0),
    [records, questions],
  );
  const capacity = records.length * questions.length;

  const header = useMemo(
    () => (
      <View style={styles.meterCard}>
        <View style={styles.meterHead}>
          <AppText style={styles.meterTitle} numberOfLines={1}>
            {categoryName}
          </AppText>
          <AppText style={styles.meterCount}>
            {records.length} {records.length === 1 ? 'entry' : 'entries'}
          </AppText>
        </View>
        <AppProgressBar percent={capacity > 0 ? (filled / capacity) * 100 : 0} />
        <AppText style={styles.meterHint}>
          {locked
            ? 'This assessment has been submitted. You can open each entry to read it, but not change it.'
            : 'Fill the form once for each one you have. Add as many entries as you need.'}
        </AppText>
      </View>
    ),
    [categoryName, records.length, capacity, filled, locked],
  );

  const renderItem = useCallback(
    ({ item }: { item: AssessmentRecord }) => (
      <RecordRow
        record={item}
        questions={questions}
        locked={locked}
        onOpen={openRecord}
        onDelete={askDelete}
      />
    ),
    [questions, locked, openRecord, askDelete],
  );

  const keyExtractor = useCallback((item: AssessmentRecord) => item.id, []);

  return (
    <View style={styles.flex}>
      <FlatList
        data={records}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={ICONS.SURVEY}
            title="Nothing added yet"
            message={
              locked
                ? 'This form was submitted without any entries.'
                : 'Fill the form once for each one you have to record.'
            }
            actionLabel={locked ? undefined : 'Add entry'}
            onAction={locked ? undefined : add}
          />
        }
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + scale(96) },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {locked ? null : (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={add}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add entry"
          style={[styles.fab, { bottom: insets.bottom + spacing[4] }, busy && styles.fabBusy]}>
          <AppGradient variant="fab" style={styles.fabInner}>
            <AppIcon name={ICONS.PLUS} size={moderateScale(20)} color={COLORS.white} />
            <AppText style={styles.fabText}>Add entry</AppText>
          </AppGradient>
        </TouchableOpacity>
      )}

      <ConfirmationModal
        visible={!!pendingDelete}
        icon={ICONS.DELETE}
        title="Delete this entry?"
        message={`Entry ${pendingDelete?.number ?? ''} and everything filled into it is removed for good.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </View>
  );
};

export default CategoryRecordsView;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing[4], gap: spacing[3] },

  meterCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  meterTitle: { ...presets.labelMD, color: COLORS.gray900, flex: 1 },
  meterCount: { ...presets.labelMD, color: COLORS.primary },
  meterHint: { ...presets.bodyXS, color: COLORS.gray600 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingVertical: spacing[3.5],
    paddingLeft: spacing[4],
    paddingRight: spacing[3.5],
    gap: spacing[2.5],
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardPressed: {
    backgroundColor: COLORS.lightPrimaryBg,
    borderColor: COLORS.primaryLighter,
    transform: [{ scale: 0.995 }],
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: scale(4),
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  leading: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingText: { ...presets.labelLG },
  headTexts: { flex: 1, gap: scale(2) },
  title: { ...presets.labelLG, color: COLORS.gray900 },
  meta: { ...presets.bodyXS, color: COLORS.gray600 },
  tail: { alignItems: 'flex-end', gap: spacing[1] },
  summary: { ...presets.bodyXS, color: COLORS.gray700 },
  summaryEmpty: { ...presets.bodyXS, color: COLORS.gray500 },

  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
  },
  chipText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.gray600,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
  },
  removeText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.danger,
  },

  fab: {
    position: 'absolute',
    right: spacing[4],
    borderRadius: borderRadius.full,
    ...shadows.lg,
  },
  fabBusy: { opacity: 0.6 },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingLeft: spacing[4],
    paddingRight: spacing[5],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fabText: { ...presets.buttonSM, color: COLORS.white },
});
