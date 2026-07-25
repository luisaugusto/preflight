import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card, PrimaryButton } from '@/components/ui';
import type { Lesson, Question } from '@/lib/content/types';
import { colors, fonts, type } from '@/theme';

export const CONTENT_REPORT_EMAIL = 'hello@luis.app';

type ContentReportProps =
  | {
      contentType: 'question';
      content: Question;
    }
  | {
      contentType: 'lesson';
      content: Lesson;
      lessonPart: 'concept' | 'workedExample';
    };

export function ContentReport(props: ContentReportProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState('');
  const report = getReportContext(props);

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setDetails('');
  };

  const sendReport = () => {
    Keyboard.dismiss();
    const body = [
      'I found a content issue while studying:',
      '',
      details.trim() || '[Describe what looks wrong or confusing here.]',
      '',
      `--- ${report.displayName} context ---`,
      ...report.context,
    ].join('\n');
    const url = `mailto:${CONTENT_REPORT_EMAIL}?subject=${encodeURIComponent(
      `Preflight content report: ${report.id}`,
    )}&body=${encodeURIComponent(body)}`;

    void Linking.openURL(url)
      .then(() => close())
      .catch(() => {
        Alert.alert(
          'Unable to open email',
          `Please send your note to ${CONTENT_REPORT_EMAIL} and include ${report.name} ${report.id}.`,
        );
      });
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Report a content issue with this ${report.name}`}
        style={({ pressed }) => [styles.reportButton, pressed && styles.reportButtonPressed]}
      >
        <MaterialCommunityIcons name="flag-outline" size={16} color={colors.magenta} />
        <Text style={styles.reportButtonText}>REPORT CONTENT ISSUE</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.reportKeyboardAvoider}
        >
          <ScrollView
            contentContainerStyle={styles.reportBackdrop}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Card style={styles.reportModal} accent={colors.magenta}>
              <View style={styles.reportHeader}>
                <View style={styles.reportTitleRow}>
                  <MaterialCommunityIcons name="flag-outline" size={21} color={colors.magenta} />
                  <Text style={styles.reportTitle}>Report this {report.name}</Text>
                </View>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close report form"
                  hitSlop={12}
                >
                  <MaterialCommunityIcons name="close" size={23} color={colors.ink} />
                </Pressable>
              </View>
              <Text style={styles.reportHelp}>
                Capture typos, wrong answers, bad explanations, source problems, or anything that
                feels off. We&apos;ll include the {report.name} ID and citation automatically.
              </Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                multiline
                enterKeyHint="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={Keyboard.dismiss}
                placeholder="What should we fix?"
                placeholderTextColor={colors.faint}
                accessibilityLabel="Content issue details"
                style={styles.reportInput}
                textAlignVertical="top"
              />
              <Pressable
                onPress={Keyboard.dismiss}
                accessibilityRole="button"
                accessibilityLabel="Dismiss keyboard"
                style={({ pressed }) => [
                  styles.dismissKeyboard,
                  pressed && styles.reportButtonPressed,
                ]}
              >
                <MaterialCommunityIcons name="keyboard-close" size={16} color={colors.magenta} />
                <Text style={styles.dismissKeyboardText}>DONE TYPING</Text>
              </Pressable>
              <View style={styles.reportMeta}>
                <Text style={styles.reportMetaText}>
                  {report.displayName} {report.id}
                </Text>
                <Text style={styles.reportMetaText}>{report.sourceLabel}</Text>
              </View>
              <PrimaryButton label="SEND REPORT" icon="email-outline" onPress={sendReport} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function getReportContext(props: ContentReportProps) {
  if (props.contentType === 'question') {
    const { content } = props;
    const sourceLabel = `${content.sourceCitation.handbook} · p. ${content.sourceCitation.page}`;
    return {
      id: content.id,
      name: 'question',
      displayName: 'Question',
      sourceLabel,
      context: [
        `Question ID: ${content.id}`,
        `Type: ${content.type}`,
        `Prompt: ${content.prompt}`,
        sourceContext(content),
        acsContext(content),
      ],
    };
  }

  const { content } = props;
  const sourceLabel = `${content.sourceCitation.handbook} · p. ${content.sourceCitation.page}`;
  const part =
    props.lessonPart === 'concept'
      ? {
          label: 'Concept and explanation',
          value: `${content.concept}\n\n${content.explanation}`,
        }
      : { label: 'Worked example', value: content.workedExample };

  return {
    id: content.id,
    name: 'lesson',
    displayName: 'Lesson',
    sourceLabel,
    context: [
      `Lesson ID: ${content.id}`,
      `Title: ${content.title}`,
      `Part: ${part.label}`,
      `Content: ${part.value}`,
      sourceContext(content),
      acsContext(content),
    ],
  };
}

function sourceContext(content: Question | Lesson) {
  return `Source: ${content.sourceCitation.handbook}, chapter ${content.sourceCitation.chapter}, page ${content.sourceCitation.page}`;
}

function acsContext(content: Question | Lesson) {
  return `ACS: ${content.acsCodes.join(', ') || 'None listed'}`;
}

const styles = StyleSheet.create({
  reportButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.magentaPale,
  },
  reportButtonPressed: { opacity: 0.72 },
  reportButtonText: {
    fontFamily: fonts.strong,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.magenta,
  },
  reportKeyboardAvoider: { flex: 1 },
  reportBackdrop: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#071B2CCC',
  },
  reportModal: { gap: 13, borderWidth: 1.5 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  reportHelp: { ...type.small, color: colors.body },
  reportInput: {
    minHeight: 128,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 12,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  dismissKeyboard: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dismissKeyboardText: {
    fontFamily: fonts.strong,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.magenta,
  },
  reportMeta: { gap: 2 },
  reportMetaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
