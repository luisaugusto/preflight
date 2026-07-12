import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { FIGURE_ASSETS } from '@/content/figure-assets';
import type { Question } from '@/lib/content/types';
import { Card, Feedback, Option, PrimaryButton } from '@/components/ui';
import { colors, fonts, type } from '@/theme';

export function QuestionInteraction({
  question,
  onComplete,
  continueLabel = 'CONTINUE',
}: {
  question: Question;
  onComplete: (correct: boolean) => void;
  continueLabel?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [numeric, setNumeric] = useState('');
  const [checked, setChecked] = useState(false);
  const [matched, setMatched] = useState<string[]>([]);
  const [activePair, setActivePair] = useState<string | null>(null);
  const [matchingMiss, setMatchingMiss] = useState(false);

  useEffect(() => {
    setSelected(null);
    setNumeric('');
    setChecked(false);
    setMatched([]);
    setActivePair(null);
    setMatchingMiss(false);
  }, [question.id]);

  const correct = useMemo(() => {
    if (question.type === 'multipleChoice' || question.type === 'image') {
      return selected === question.correctIndex;
    }
    if (question.type === 'numeric') {
      const normalized = numeric.replace(/,/g, '').replace(/[a-zA-Z°%]+/g, '').trim();
      const value = Number.parseFloat(normalized);
      return Number.isFinite(value) && Math.abs(value - question.answer.value) <= question.answer.tolerance;
    }
    return matched.length === question.pairs.length && !matchingMiss;
  }, [matched.length, matchingMiss, numeric, question, selected]);

  const ready = question.type === 'multipleChoice' || question.type === 'image'
    ? selected !== null
    : question.type === 'numeric'
      ? numeric.trim().length > 0
      : matched.length === question.pairs.length;

  if (question.type === 'matching') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <View style={styles.matchTerms}>
          {question.pairs.map((pair) => {
            const done = matched.includes(pair.id);
            const active = activePair === pair.id;
            return (
              <Pressable
                key={pair.id}
                disabled={done || checked}
                onPress={() => setActivePair(pair.id)}
                accessibilityRole="radio"
                accessibilityLabel={pair.left}
                accessibilityState={{ selected: active, disabled: done || checked }}
                style={[styles.term, done && styles.termDone, active && styles.termActive]}
              >
                <Text style={[styles.termText, done && styles.termTextDone, active && styles.termTextSelected]}>{pair.left}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.definitions}>
          {[...question.pairs].reverse().map((pair) => {
            const done = matched.includes(pair.id);
            return (
              <Pressable
                key={pair.id}
                disabled={done || checked || !activePair}
                accessibilityRole="button"
                accessibilityLabel={`Match with ${pair.right}`}
                accessibilityState={{ disabled: done || checked || !activePair }}
                onPress={() => {
                  if (!activePair) return;
                  if (activePair === pair.id) {
                    setMatched((items) => [...items, pair.id]);
                  } else {
                    setMatchingMiss(true);
                  }
                  setActivePair(null);
                }}
                style={[styles.definition, done && styles.definitionDone]}
              >
                <Text style={styles.definitionText}>{pair.right}</Text>
                {done ? <MaterialCommunityIcons name="check-circle" size={19} color={colors.green} /> : null}
              </Pressable>
            );
          })}
        </View>
        {checked ? (
          <Feedback correct={correct} title={correct ? 'ALL CONNECTED' : 'CONNECTED - ONE BOBBLE'}>
            {question.explanation}
          </Feedback>
        ) : null}
        <PrimaryButton
          label={checked ? continueLabel : 'CHECK CONNECTIONS'}
          disabled={!ready}
          onPress={() => checked ? onComplete(correct) : setChecked(true)}
        />
        <Citation question={question} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>{question.prompt}</Text>
      {question.type === 'image' ? <QuestionFigure question={question} /> : null}
      {question.type === 'numeric' ? (
        <Card style={styles.numericCard} accent={checked ? (correct ? colors.green : colors.red) : colors.ink}>
          <TextInput
            value={numeric}
            editable={!checked}
            onChangeText={setNumeric}
            keyboardType="decimal-pad"
            placeholder="Enter your answer"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Numeric answer"
            style={styles.numericInput}
          />
          <Text style={styles.numericUnit}>{question.answer.unit}</Text>
        </Card>
      ) : (
        <View style={styles.options}>
          {question.options.map((option, index) => {
            let state: 'idle' | 'correct' | 'wrong' | 'muted' = 'idle';
            if (checked) {
              if (index === question.correctIndex) state = 'correct';
              else if (index === selected) state = 'wrong';
              else state = 'muted';
            }
            return (
              <Option
                key={`${question.id}-${index}`}
                index={index}
                label={option}
                selected={selected === index}
                state={state}
                disabled={checked}
                onPress={() => !checked && setSelected(index)}
              />
            );
          })}
        </View>
      )}
      {checked ? (
        <Feedback correct={correct} title={correct ? 'CORRECT' : 'NOT QUITE'}>
          {question.explanation}
        </Feedback>
      ) : null}
      <PrimaryButton
        label={checked ? continueLabel : 'CHECK'}
        disabled={!ready}
        onPress={() => checked ? onComplete(correct) : setChecked(true)}
      />
      <Citation question={question} />
    </View>
  );
}

function QuestionFigure({ question }: { question: Extract<Question, { type: 'image' }> }) {
  const [open, setOpen] = useState(false);
  const source = resolveFigure(question.image.uri);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.figureCard}
        accessibilityRole="button"
        accessibilityLabel={`Open figure full screen: ${question.image.alt}`}
      >
        <Image source={source} style={styles.figure} contentFit="contain" transition={180} accessibilityLabel={question.image.alt} />
        <View style={styles.figureCaptionRow}>
          <Text style={styles.figureCaption} numberOfLines={2}>{question.image.caption}</Text>
          <MaterialCommunityIcons name="magnify-plus-outline" size={22} color={colors.magenta} />
        </View>
      </Pressable>
      <ZoomModal open={open} source={source} alt={question.image.alt} onClose={() => setOpen(false)} />
    </>
  );
}

function ZoomModal({ open, source, alt, onClose }: { open: boolean; source: ImageSource; alt: string; onClose: () => void }) {
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const pinch = Gesture.Pinch().onUpdate((event) => {
    scale.value = Math.max(1, Math.min(4, event.scale));
  });
  const pan = Gesture.Pan().onUpdate((event) => {
    offsetX.value = event.translationX;
    offsetY.value = event.translationY;
  });
  const composed = Gesture.Simultaneous(pinch, pan);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }],
  }));
  const close = () => {
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    onClose();
  };
  return (
    <Modal visible={open} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.modal}>
        <Pressable onPress={close} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close figure">
          <MaterialCommunityIcons name="close" size={25} color={colors.paper} />
        </Pressable>
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.zoomStage, animated]}>
            <Image source={source} style={styles.zoomImage} contentFit="contain" accessibilityLabel={alt} />
          </Animated.View>
        </GestureDetector>
        <Text style={styles.zoomHint}>PINCH TO ZOOM · DRAG TO PAN</Text>
      </View>
    </Modal>
  );
}

function Citation({ question }: { question: Question }) {
  return (
    <View style={styles.citation}>
      <MaterialCommunityIcons name="book-open-page-variant-outline" size={15} color={colors.muted} />
      <Text style={styles.citationText}>
        {question.sourceCitation.handbook} · Ch. {question.sourceCitation.chapter} · p. {question.sourceCitation.page}
      </Text>
    </View>
  );
}

function resolveFigure(uri: string): ImageSource {
  return FIGURE_ASSETS[uri] ?? { uri };
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  prompt: { ...type.heading, fontSize: 25, lineHeight: 30 },
  options: { gap: 10 },
  numericCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5 },
  numericInput: { flex: 1, fontFamily: fonts.display, fontSize: 32, color: colors.ink, paddingVertical: 0 },
  numericUnit: { fontFamily: fonts.strong, fontSize: 16, color: colors.muted },
  figureCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.white },
  figure: { width: '100%', aspectRatio: 1.45, backgroundColor: colors.white },
  figureCaptionRow: { padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper },
  figureCaption: { ...type.small, flex: 1 },
  matchTerms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  term: { borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 13, backgroundColor: colors.paper },
  termActive: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  termDone: { backgroundColor: colors.greenPale, borderColor: colors.green },
  termText: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 1, color: colors.body },
  termTextDone: { color: colors.green },
  termTextSelected: { color: colors.paper },
  definitions: { gap: 9 },
  definition: { minHeight: 57, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  definitionDone: { borderColor: colors.green, borderStyle: 'dashed', backgroundColor: colors.greenPale },
  definitionText: { ...type.body, flex: 1, fontSize: 15, lineHeight: 20 },
  citation: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  citationText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  modal: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalClose: { position: 'absolute', right: 20, top: 58, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF20', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  zoomStage: { width: '100%', height: '80%', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '96%', height: '96%' },
  zoomHint: { position: 'absolute', bottom: 44, fontFamily: fonts.strong, fontSize: 11, letterSpacing: 1.6, color: colors.paper },
});
