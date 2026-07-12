import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestionInteraction } from '@/components/question-interaction';
import { Card, Eyebrow, Header, Pill, PrimaryButton, Screen, SegmentedProgress } from '@/components/ui';
import type { Question } from '@/lib/content/types';
import { colors, fonts, type } from '@/theme';

export function QuizScreen({
  title,
  label,
  questions,
  passThreshold = 0.7,
  schedulesReview = true,
  onExit,
  onFinish,
  onQuestionAnswered,
}: {
  title: string;
  label: string;
  questions: Question[];
  passThreshold?: number;
  schedulesReview?: boolean;
  onExit: () => void;
  onFinish: (result: { score: number; total: number; passed: boolean; missedQuestionIds: string[] }) => void;
  onQuestionAnswered?: (question: Question, correct: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  const passed = score / questions.length >= passThreshold;
  const percentage = Math.round((score / questions.length) * 100);
  const questionTypes = useMemo(() => new Set(questions.map((item) => item.type)).size, [questions]);

  if (!question) {
    return (
      <Screen>
        <Header label={label} onBack={onExit} />
        <Card><Text style={type.body}>No questions are available for this check yet.</Text></Card>
      </Screen>
    );
  }

  if (finished) {
    return (
      <Screen contentStyle={styles.resultsContent}>
        <Header label="CHECK COMPLETE" onBack={onExit} />
        <View style={styles.resultsHero}>
          <View style={[styles.scoreRoundel, { backgroundColor: passed ? colors.green : colors.magenta }]}> 
            <Text style={styles.scoreNumber}>{percentage}</Text>
            <Text style={styles.scoreUnit}>%</Text>
          </View>
          <Eyebrow color={passed ? colors.green : colors.magenta}>{passed ? 'CLEARED' : 'ONE MORE PATTERN'}</Eyebrow>
          <Text style={styles.resultTitle}>{passed ? 'Textbook.' : 'Good grind.'}</Text>
          <Text style={styles.resultBody}>
            {passed
              ? `${score} of ${questions.length} correct across ${questionTypes} interaction types. The next leg is clear.`
              : `${score} of ${questions.length} correct. Review the flagged concepts, then fly this check again.`}
          </Text>
        </View>
        <Card style={styles.reviewCard} accent={missed.length ? colors.magenta : colors.green}>
          <View style={styles.reviewHead}>
            <MaterialCommunityIcons name={missed.length ? 'cards-outline' : 'check-decagram-outline'} size={23} color={missed.length ? colors.magenta : colors.green} />
            <Text style={styles.reviewTitle}>
              {missed.length
                ? schedulesReview
                  ? `${missed.length} concept${missed.length === 1 ? '' : 's'} scheduled`
                  : `${missed.length} problem${missed.length === 1 ? '' : 's'} to retry`
                : 'Nothing flagged'}
            </Text>
          </View>
          <Text style={styles.reviewText}>
            {missed.length
              ? schedulesReview
                ? 'Missed items are already in your spaced-repetition queue and will return sooner.'
                : 'Run the calculation circuit again for a fresh set of generated values.'
              : schedulesReview
                ? 'Tomorrow&apos;s daily review will stay light and reinforce recent material.'
                : 'All generated calculation problems were cleared on this pass.'}
          </Text>
        </Card>
        <PrimaryButton
          label={passed ? 'BACK TO THE ROUTE' : 'REVIEW THE ROUTE'}
          onPress={() => onFinish({ score, total: questions.length, passed, missedQuestionIds: missed })}
        />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <Header
        label={label}
        onBack={onExit}
        trailing={<Pill tone="magenta">Q{index + 1}/{questions.length}</Pill>}
      />
      <SegmentedProgress current={index + 1} total={questions.length} />
      <View style={styles.quizHead}>
        <Eyebrow>{question.type === 'multipleChoice' ? 'MULTIPLE CHOICE' : question.type === 'numeric' ? 'CALCULATE' : question.type === 'matching' ? 'CONNECT' : 'READ THE FIGURE'}</Eyebrow>
        <Text style={styles.quizTitle}>{title}</Text>
      </View>
      <QuestionInteraction
        key={question.id}
        question={question}
        continueLabel={index === questions.length - 1 ? 'SEE RESULTS' : 'NEXT QUESTION'}
        onComplete={(correct) => {
          onQuestionAnswered?.(question, correct);
          const nextScore = score + (correct ? 1 : 0);
          const nextMissed = correct ? missed : [...missed, question.id];
          setScore(nextScore);
          setMissed(nextMissed);
          if (index === questions.length - 1) setFinished(true);
          else setIndex((value) => value + 1);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 38 },
  quizHead: { marginTop: 24, marginBottom: 20, gap: 7 },
  quizTitle: { ...type.small, fontFamily: fonts.strong, color: colors.ink },
  resultsContent: { paddingBottom: 38 },
  resultsHero: { alignItems: 'center', gap: 9, marginTop: 22, marginBottom: 26 },
  scoreRoundel: { width: 116, height: 116, borderRadius: 58, borderWidth: 9, borderColor: colors.paperDeep, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 12 },
  scoreNumber: { fontFamily: fonts.display, fontSize: 43, color: colors.paper },
  scoreUnit: { fontFamily: fonts.strong, fontSize: 15, color: colors.paper, marginTop: 16 },
  resultTitle: { ...type.title, textAlign: 'center' },
  resultBody: { ...type.body, textAlign: 'center', maxWidth: 370 },
  reviewCard: { gap: 9, marginBottom: 20, borderWidth: 1.5 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  reviewTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  reviewText: { ...type.small },
});
