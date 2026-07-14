import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestionInteraction } from '@/components/question-interaction';
import {
  Card,
  Eyebrow,
  Header,
  Pill,
  IconButton,
  PrimaryButton,
  Screen,
  SegmentedProgress,
} from '@/components/ui';
import type { Lesson, Section } from '@/lib/content/types';
import { colors, fonts, type } from '@/theme';

export function LessonScreen({
  section,
  lesson,
  lessonIndex,
  initialStage = 0,
  onExit,
  onStageChange,
  onNavigateLesson,
  isLessonComplete = false,
  canNavigateToPreviousLesson = false,
  canNavigateToNextLesson = false,
  onComplete,
}: {
  section: Section;
  lesson: Lesson;
  lessonIndex: number;
  initialStage?: number;
  onExit: () => void;
  onStageChange?: (stage: number) => void;
  onNavigateLesson?: (direction: 'previous' | 'next') => void;
  isLessonComplete?: boolean;
  canNavigateToPreviousLesson?: boolean;
  canNavigateToNextLesson?: boolean;
  onComplete: (correct: boolean) => void;
}) {
  const [stage, setStage] = useState(initialStage);
  const [maxStageReached, setMaxStageReached] = useState(initialStage);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const totalStages = 4;
  const moveToStage = (nextStage: number) => {
    const clampedStage = Math.min(totalStages - 1, Math.max(0, nextStage));
    setStage(clampedStage);
    setMaxStageReached((current) => Math.max(current, clampedStage));
    onStageChange?.(clampedStage);
  };
  const canGoBack = stage > 0 || canNavigateToPreviousLesson;
  const canGoForward =
    stage < Math.max(maxStageReached, initialStage) ||
    (stage === totalStages - 1 && isLessonComplete && canNavigateToNextLesson);
  const navigateBack = () => {
    if (stage > 0) {
      moveToStage(stage - 1);
      return;
    }
    onNavigateLesson?.('previous');
  };
  const navigateForward = () => {
    if (stage < Math.max(maxStageReached, initialStage)) {
      moveToStage(stage + 1);
      return;
    }
    if (stage === totalStages - 1 && isLessonComplete) onNavigateLesson?.('next');
  };

  return (
    <Screen contentStyle={styles.content}>
      <Header
        label={`SECTION ${section.order} · LESSON ${lessonIndex + 1}/${section.lessons.length}`}
        onBack={onExit}
        trailing={<Pill tone="blue">~{lesson.estimatedMinutes} MIN</Pill>}
      />
      <SegmentedProgress current={stage + 1} total={totalStages} />
      <View style={styles.navigationRow}>
        <IconButton
          name="chevron-left"
          accessibilityLabel="Previous lesson screen"
          onPress={navigateBack}
          disabled={!canGoBack}
        />
        <Text style={styles.navigationText}>
          Screen {stage + 1} of {totalStages}
        </Text>
        <IconButton
          name="chevron-right"
          accessibilityLabel="Next lesson screen"
          onPress={navigateForward}
          disabled={!canGoForward}
        />
      </View>

      <View style={styles.lessonHead}>
        <Eyebrow>
          {stage === 0
            ? 'CONCEPT'
            : stage === 1
              ? 'WORKED EXAMPLE'
              : stage === 2
                ? 'YOUR TURN'
                : 'LEG COMPLETE'}
        </Eyebrow>
        <Text style={styles.lessonTitle}>{lesson.title}</Text>
      </View>

      {stage === 0 ? (
        <View style={styles.stageWrap}>
          <Card style={styles.conceptCard} accent={colors.blue}>
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons name="head-lightbulb-outline" size={24} color={colors.blue} />
            </View>
            <Text style={styles.concept}>{lesson.concept}</Text>
            <View style={styles.rule} />
            <Text style={styles.explanation}>{lesson.explanation}</Text>
          </Card>
          <PrimaryButton label="SHOW ME HOW" onPress={() => moveToStage(1)} />
        </View>
      ) : null}

      {stage === 1 ? (
        <View style={styles.stageWrap}>
          <Card style={styles.exampleCard} accent={colors.magenta}>
            <View style={styles.exampleLabel}>
              <MaterialCommunityIcons name="pencil-ruler" size={19} color={colors.magenta} />
              <Eyebrow color={colors.magenta}>FLY THE EXAMPLE</Eyebrow>
            </View>
            <Text style={styles.example}>{lesson.workedExample}</Text>
          </Card>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="compass-outline" size={19} color={colors.blue} />
            <Text style={styles.tip}>
              The written changes the numbers and wording. Keep the relationship, not the answer.
            </Text>
          </View>
          <PrimaryButton label="TRY ONE" onPress={() => moveToStage(2)} />
        </View>
      ) : null}

      {stage === 2 ? (
        <QuestionInteraction
          key={lesson.practice.id}
          question={lesson.practice}
          continueLabel="STAMP THIS LESSON"
          onComplete={(correct) => {
            setPracticeCorrect(correct);
            moveToStage(3);
          }}
        />
      ) : null}

      {stage === 3 ? (
        <View style={styles.completeWrap}>
          <View style={styles.stamp}>
            <MaterialCommunityIcons name="airplane-check" size={42} color={colors.paper} />
          </View>
          <Text style={styles.completeTitle}>
            {practiceCorrect ? 'Clean landing.' : 'Lesson logged.'}
          </Text>
          <Text style={styles.completeText}>
            {practiceCorrect
              ? 'You understood the concept on the first pass. It will return in daily review.'
              : 'This concept is marked for an earlier review. Keep moving - repetition will do its job.'}
          </Text>
          <Card style={styles.sourceCard}>
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={20}
              color={colors.muted}
            />
            <Text style={styles.sourceText}>
              Source: {lesson.practice.sourceCitation.handbook}, chapter{' '}
              {lesson.practice.sourceCitation.chapter}, page {lesson.practice.sourceCitation.page}
            </Text>
          </Card>
          <PrimaryButton
            label="NEXT LEG"
            icon="arrow-right"
            onPress={() => onComplete(practiceCorrect)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34 },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  navigationText: { ...type.eyebrow, color: colors.muted },
  lessonHead: { marginTop: 20, marginBottom: 22, gap: 8 },
  lessonTitle: { ...type.title, fontSize: 34 },
  stageWrap: { gap: 18 },
  conceptCard: { gap: 16, padding: 20, borderWidth: 1.5 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bluePale,
  },
  concept: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: colors.ink },
  rule: { height: 1, backgroundColor: colors.line },
  explanation: { ...type.body },
  exampleCard: { gap: 18, padding: 20, backgroundColor: colors.magentaPale, borderWidth: 1.5 },
  exampleLabel: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  example: { fontFamily: fonts.body, fontSize: 19, lineHeight: 27, color: colors.body },
  tipRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 3 },
  tip: { ...type.small, flex: 1 },
  completeWrap: { alignItems: 'center', gap: 18, paddingTop: 26 },
  stamp: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
    borderWidth: 7,
    borderColor: colors.greenPale,
  },
  completeTitle: { ...type.title, textAlign: 'center' },
  completeText: { ...type.body, textAlign: 'center', maxWidth: 360 },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    shadowOpacity: 0,
  },
  sourceText: { ...type.small, flex: 1 },
});
