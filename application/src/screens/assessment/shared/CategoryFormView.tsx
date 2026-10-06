import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { AppProgressBar, AppText, Button, Input } from '../../../components';
import AnswerInput from '../../../components/assessment/questionTypes/AnswerInput';
import EvidenceUploader, {
  type EvidenceMedia,
} from '../../../components/assessment/EvidenceUploader';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../../constants';
import { moderateScale, scale } from '../../../utils';
import { uploadEvidenceFile } from '../../../api/assessmentApi';
import { showSuccess, showToast } from '../../../services/toastService';
import { buildFormAnswerEntry } from '../../../utils/answerPayload';
import {
  answerValueFromDetail,
  hasAnswerValue,
  type AnswerLocalValue,
} from '../../../utils/answerValue';
import {
  groupErrorsByQuestion,
  resumeQuestionId,
  validateCategoryForm,
  type FieldErrorMap,
} from '../../../utils/categoryFormValidation';
import type {
  AssessmentQuestionDetail,
  SaveFormAnswerInput,
} from '../../../types/assessment';

const COMMENT_MAX = 2000;
const COUNTER_AT = 0.7;
const SCROLL_GAP = 16;

const commentNearLimit = (text: string): boolean =>
  text.length >= Math.floor(COMMENT_MAX * COUNTER_AT);

const ANSWER_LABEL: Record<string, string> = {
  scored: 'Score',
  mcq: 'Answer',
  text: 'Answer',
  long_text: 'Answer',
  number: 'Answer',
  date: 'Answer',
  boolean: 'Answer',
};

const NATIVE_LABEL_TYPES = new Set(['text', 'long_text', 'number', 'date']);

interface FieldState {
  value: AnswerLocalValue;
  comment: string;
  evidenceUrls: string[];
}

const fieldStateFromDetail = (q: AssessmentQuestionDetail): FieldState => ({
  value: answerValueFromDetail(q),
  comment: q.answerComment ?? '',
  evidenceUrls: q.answerEvidenceUrls,
});

interface FormFieldProps {
  index: number;
  question: AssessmentQuestionDetail;
  field: FieldState;
  locked: boolean;
  errors?: FieldErrorMap;
  onChange: (questionId: string, patch: Partial<FieldState>) => void;
  onUploadingChange: (questionId: string, uploading: boolean) => void;
  onLayout: (questionId: string, y: number) => void;
}

const FormField = React.memo(function FormFieldImpl({
  index,
  question,
  field,
  locked,
  errors,
  onChange,
  onUploadingChange,
  onLayout,
}: FormFieldProps) {
  const questionId = question.id;
  const uploadEvidence = useCallback(
    (file: EvidenceMedia, onProgress: (fraction: number) => void) =>
      uploadEvidenceFile({ uri: file.uri, name: file.name, mime: file.mime }, onProgress),
    [],
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onLayout(questionId, event.nativeEvent.layout.y),
    [onLayout, questionId],
  );
  const handleValueChange = useCallback(
    (value: AnswerLocalValue) => onChange(questionId, { value }),
    [onChange, questionId],
  );
  const handleCommentChange = useCallback(
    (comment: string) => onChange(questionId, { comment }),
    [onChange, questionId],
  );
  const handleEvidence = useCallback(
    (urls: string[], busy: boolean) => {
      onUploadingChange(questionId, busy);
      onChange(questionId, { evidenceUrls: urls });
    },
    [onChange, onUploadingChange, questionId],
  );

  const hasError = !!errors?.answer || !!errors?.comment || !!errors?.evidence;

  return (
    <View style={[styles.card, hasError && styles.cardError]} onLayout={handleLayout}>
      <View style={styles.cardHead}>
        <View style={styles.indexBadge}>
          <AppText style={styles.indexText} color={COLORS.primary}>
            {index}
          </AppText>
        </View>
        <View style={styles.cardHeadText}>
          {question.code ? <AppText style={styles.code}>{question.code}</AppText> : null}
          <AppText style={styles.questionText}>{question.text}</AppText>
          {question.guidance ? (
            <AppText style={styles.guidance}>{question.guidance}</AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.fieldGap}>
        {NATIVE_LABEL_TYPES.has(question.questionType) ? null : (
          <AppText style={styles.fieldLabel}>
            {ANSWER_LABEL[question.questionType] ?? 'Answer'}
          </AppText>
        )}
        <AnswerInput
          questionType={question.questionType}
          value={field.value}
          onChange={handleValueChange}
          options={question.options}
          scoreDescriptions={question.scoreDescriptions}
          readOnly={locked}
          label={
            NATIVE_LABEL_TYPES.has(question.questionType)
              ? ANSWER_LABEL[question.questionType] ?? 'Answer'
              : undefined
          }
        />
        {errors?.answer ? <AppText style={styles.errorText}>{errors.answer}</AppText> : null}
      </View>

      {question.commentMode !== 'off' ? (
        <Input
          label="Description"
          required={question.commentMode === 'required'}
          error={errors?.comment}
          value={field.comment}
          onChangeText={handleCommentChange}
          placeholder="Add a description…"
          multiline
          maxLength={COMMENT_MAX}
          editable={!locked}
          hint={commentNearLimit(field.comment) ? `${field.comment.length}/${COMMENT_MAX}` : undefined}
          hintTone={field.comment.length >= COMMENT_MAX ? 'warning' : 'muted'}
        />
      ) : null}

      {question.evidenceMode !== 'off' ? (
        <View style={styles.fieldGap}>
          <AppText style={[styles.fieldLabel, !!errors?.evidence && styles.fieldLabelError]}>
            Evidence
            {question.evidenceMode === 'required' ? (
              <AppText style={styles.requiredMark}> *</AppText>
            ) : null}
          </AppText>
          <EvidenceUploader
            initialUrls={question.answerEvidenceUrls}
            onChange={handleEvidence}
            upload={uploadEvidence}
            disabled={locked}
            maxSelection={5}
            maxSizeMB={50}
          />
          {errors?.evidence ? (
            <AppText style={styles.errorText}>{errors.evidence}</AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

export interface CategoryFormViewProps {
  title: string;
  questions: AssessmentQuestionDetail[];
  locked: boolean;
  saving: boolean;
  onSave: (answers: SaveFormAnswerInput[]) => Promise<boolean>;
  onDone: () => void;
}

const CategoryFormView: React.FC<CategoryFormViewProps> = ({
  title,
  questions,
  locked,
  saving,
  onSave,
  onDone,
}) => {
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState<Record<string, FieldState>>(() =>
    Object.fromEntries(questions.map(q => [q.id, fieldStateFromDetail(q)])),
  );
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, FieldErrorMap>>({});

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const cardOffsets = useRef<Record<string, number>>({});
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const resumedFor = useRef<string | null>(null);

  const resumeTargetId = useMemo(() => {
    if (locked) {
      return null;
    }
    const saved = Object.fromEntries(questions.map(q => [q.id, fieldStateFromDetail(q)]));
    return resumeQuestionId(questions, saved);
  }, [questions, locked]);

  const scrollToCard = useCallback((y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(y - SCROLL_GAP, 0), animated: true });
  }, []);

  const focusQuestion = useCallback(
    (questionId: string) => {
      const y = cardOffsets.current[questionId];
      if (y === undefined) {
        return;
      }
      const top = scrollY.current;
      const bottom = top + viewportHeight.current;
      const visible = viewportHeight.current > 0 && y >= top && y < bottom - SCROLL_GAP;
      if (!visible) {
        scrollToCard(y);
      }
    },
    [scrollToCard],
  );

  const handleCardLayout = useCallback(
    (questionId: string, y: number) => {
      cardOffsets.current[questionId] = y;
      if (resumeTargetId && questionId === resumeTargetId && resumedFor.current !== resumeTargetId) {
        resumedFor.current = resumeTargetId;
        scrollToCard(y);
      }
    },
    [resumeTargetId, scrollToCard],
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  const setField = useCallback((questionId: string, patch: Partial<FieldState>) => {
    setFields(prev => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
    setErrors(prev => {
      if (!prev[questionId]) {
        return prev;
      }
      return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== questionId));
    });
  }, []);

  const setUploading = useCallback((questionId: string, busy: boolean) => {
    setUploadingIds(prev => {
      const next = new Set(prev);
      if (busy) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  }, []);

  const answeredCount = useMemo(
    () =>
      questions.filter(q => {
        const field = fields[q.id];
        return field ? hasAnswerValue(q.questionType, field.value) : q.answered;
      }).length,
    [questions, fields],
  );

  const handleSave = useCallback(async () => {
    if (uploadingIds.size > 0) {
      showToast('Please wait for evidence to finish uploading.', { type: 'error' });
      return;
    }
    const found = validateCategoryForm(questions, fields);
    if (found.length > 0) {
      setErrors(groupErrorsByQuestion(found));
      const first = found[0];
      focusQuestion(first.questionId);
      showToast(
        found.length === 1
          ? `Field ${first.index}: ${first.message}`
          : `${found.length} fields need attention — starting with field ${first.index}.`,
        { type: 'error' },
      );
      return;
    }
    setErrors(prev => (Object.keys(prev).length > 0 ? {} : prev));

    const answers: SaveFormAnswerInput[] = [];
    for (const q of questions) {
      const field = fields[q.id];
      if (!field) {
        continue;
      }
      const entry = buildFormAnswerEntry(
        q.id,
        {
          questionType: q.questionType,
          value: field.value,
          comment: field.comment,
          evidenceUrls: field.evidenceUrls,
        },
        { comment: q.answerComment, evidenceUrls: q.answerEvidenceUrls },
      );
      if (entry) {
        answers.push(entry);
      }
    }
    if (answers.length === 0) {
      showToast('Fill in at least one field before saving.', { type: 'error' });
      return;
    }
    const ok = await onSave(answers);
    if (ok) {
      showSuccess('Form saved');
      onDone();
    }
  }, [questions, fields, uploadingIds, onSave, onDone, focusQuestion]);

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onLayout={handleViewportLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bottomOffset={spacing[6]}>
        <View style={styles.meterCard}>
          <View style={styles.meterHead}>
            <AppText style={styles.meterTitle}>{title}</AppText>
            <AppText style={styles.meterCount}>
              {answeredCount} of {questions.length}
            </AppText>
          </View>
          <AppProgressBar
            percent={questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}
          />
          <AppText style={styles.meterHint}>
            {locked
              ? 'This assessment has been submitted. You can view the answers but can no longer edit them.'
              : 'Fill in whatever you have — save when ready. Nothing is lost if you come back later.'}
          </AppText>
        </View>

        {questions.map((question, i) => (
          <FormField
            key={question.id}
            index={i + 1}
            question={question}
            field={fields[question.id] ?? fieldStateFromDetail(question)}
            locked={locked}
            errors={errors[question.id]}
            onChange={setField}
            onUploadingChange={setUploading}
            onLayout={handleCardLayout}
          />
        ))}
      </KeyboardAwareScrollView>

      {!locked ? (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
            <Button title="Save form" loading={saving} onPress={handleSave} />
          </View>
        </KeyboardStickyView>
      ) : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
          <View style={styles.lockNote}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(18)} color={COLORS.primary} />
            <AppText style={styles.lockNoteText}>Submitted &amp; locked</AppText>
          </View>
        </View>
      )}
    </View>
  );
};

export default CategoryFormView;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing[4],
    gap: spacing[3],
    paddingBottom: spacing[8],
  },
  meterCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    gap: spacing[2],
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
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.xs,
  },
  cardError: { borderColor: COLORS.danger },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  indexBadge: {
    width: scale(26),
    height: scale(26),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { ...presets.labelSM },
  cardHeadText: { flex: 1, gap: spacing[0.5] },
  code: { ...presets.caption, color: COLORS.gray500 },
  questionText: { ...presets.labelLG, color: COLORS.gray900 },
  guidance: { ...presets.bodyXS, color: COLORS.gray600 },

  fieldGap: { gap: spacing[1.5] },
  fieldLabel: { ...presets.inputLabel, color: COLORS.gray700 },
  fieldLabelError: { color: COLORS.danger },
  requiredMark: { color: COLORS.danger },
  errorText: { ...presets.bodyXS, color: COLORS.danger },

  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  lockNoteText: { ...presets.labelMD, color: COLORS.primary },
});
