import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, fonts, shadows, type } from '@/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Screen({
  children,
  scroll = true,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.staticContent, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ImageBackground
        source={require('../../assets/paper-texture.png')}
        resizeMode="repeat"
        style={styles.frame}
        imageStyle={styles.paperTexture}
      >
        {body}
        {footer}
      </ImageBackground>
    </SafeAreaView>
  );
}

export function Eyebrow({
  children,
  color = colors.muted,
}: {
  children: ReactNode;
  color?: string;
}) {
  return <Text style={[type.eyebrow, { color }]}>{children}</Text>;
}

export function Header({
  label,
  title,
  onBack,
  trailing,
}: {
  label?: string;
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <IconButton name="close" accessibilityLabel="Close" onPress={onBack} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
        {label ? <Eyebrow>{label}</Eyebrow> : <View />}
        {trailing ?? <View style={styles.headerSpacer} />}
      </View>
      {title ? <Text style={[type.title, styles.headerTitle]}>{title}</Text> : null}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  active = false,
}: {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconButton,
        active && styles.iconButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons name={name} size={21} color={active ? colors.paper : colors.ink} />
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'magenta',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'magenta' | 'ink' | 'quiet';
  icon?: IconName;
}) {
  const palette =
    tone === 'ink'
      ? { bg: colors.ink, fg: colors.paper, shadow: colors.navy }
      : tone === 'quiet'
        ? { bg: colors.paperDeep, fg: colors.body, shadow: colors.lineStrong }
        : { bg: colors.magenta, fg: colors.paper, shadow: colors.magentaDark };
  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: disabled ? colors.line : palette.bg, shadowColor: palette.shadow },
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.buttonLabelRow}>
          {icon ? (
            <MaterialCommunityIcons
              name={icon}
              size={19}
              color={disabled ? colors.muted : palette.fg}
            />
          ) : null}
          <Text
            style={[styles.primaryButtonLabel, { color: disabled ? colors.muted : palette.fg }]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
}) {
  return (
    <View style={[styles.card, accent ? { borderColor: accent } : null, style]}>{children}</View>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'magenta' | 'blue' | 'green' | 'red';
}) {
  const value = {
    neutral: [colors.paperDeep, colors.muted],
    magenta: [colors.magentaPale, colors.magenta],
    blue: [colors.bluePale, colors.blue],
    green: [colors.greenPale, colors.green],
    red: [colors.redPale, colors.red],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: value[0] }]}>
      <Text style={[styles.pillText, { color: value[1] }]}>{children}</Text>
    </View>
  );
}

export function SegmentedProgress({ current, total }: { current: number; total: number }) {
  return (
    <View
      style={styles.segmentRow}
      accessibilityRole="progressbar"
      accessibilityLabel={`${current} of ${total} complete`}
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            { backgroundColor: index < current ? colors.magenta : colors.line },
          ]}
        />
      ))}
    </View>
  );
}

export function BottomNav({
  active,
  onPath,
  onPractice,
}: {
  active: 'path' | 'practice' | null;
  onPath: () => void;
  onPractice: () => void;
}) {
  const items: { id: typeof active; label: string; icon: IconName; press: () => void }[] = [
    { id: 'path', label: 'Route', icon: 'map-marker-path', press: onPath },
    { id: 'practice', label: 'Practice', icon: 'cards-outline', press: onPractice },
  ];
  return (
    <View style={styles.navWrap}>
      <View style={styles.nav}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.press}
            accessibilityRole="tab"
            accessibilityState={{ selected: active === item.id }}
            style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={22}
              color={active === item.id ? colors.magenta : colors.muted}
            />
            <Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Option({
  label,
  index,
  selected,
  state = 'idle',
  disabled = false,
  onPress,
}: {
  label: string;
  index?: number;
  selected: boolean;
  state?: 'idle' | 'correct' | 'wrong' | 'muted';
  disabled?: boolean;
  onPress: () => void;
}) {
  const border =
    state === 'correct'
      ? colors.green
      : state === 'wrong'
        ? colors.red
        : selected
          ? colors.magenta
          : colors.line;
  const background =
    state === 'correct'
      ? colors.greenPale
      : state === 'wrong'
        ? colors.redPale
        : selected
          ? colors.magentaPale
          : colors.paper;
  const icon = state === 'correct' ? 'check' : state === 'wrong' ? 'close' : undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.option,
        { borderColor: border, backgroundColor: background },
        state === 'muted' && styles.optionMuted,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.optionMarker, { borderColor: border }]}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={16} color={border} />
        ) : (
          <Text style={[styles.optionIndex, { color: selected ? colors.magenta : colors.muted }]}>
            {typeof index === 'number' ? String.fromCharCode(65 + index) : ''}
          </Text>
        )}
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

export function Feedback({
  correct,
  title,
  children,
}: {
  correct: boolean;
  title: string;
  children: ReactNode;
}) {
  const tone = correct ? colors.green : colors.red;
  return (
    <View
      style={[styles.feedback, { borderColor: `${tone}55` }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.feedbackHead}>
        <MaterialCommunityIcons
          name={correct ? 'check-circle-outline' : 'compass-off-outline'}
          size={20}
          color={tone}
        />
        <Text style={[styles.feedbackTitle, { color: tone }]}>{title}</Text>
      </View>
      <Text style={styles.feedbackBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.paper,
  },
  paperTexture: { opacity: 0.72 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 116 },
  staticContent: { flex: 1, paddingHorizontal: 22 },
  header: { paddingTop: 6, paddingBottom: 16 },
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { marginTop: 14 },
  headerSpacer: { width: 44, height: 44 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  iconButtonActive: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  pressed: { opacity: 0.72 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    ...shadows.button,
  },
  buttonPressed: { transform: [{ translateY: 2 }], shadowOffset: { width: 0, height: 1 } },
  buttonLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  primaryButtonLabel: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.2 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    ...shadows.card,
  },
  pill: {
    minHeight: 25,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.strong, fontSize: 10, letterSpacing: 1.25 },
  segmentRow: { flexDirection: 'row', gap: 6, height: 5 },
  segment: { flex: 1, borderRadius: 4 },
  navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 10 : 14,
  },
  nav: {
    minHeight: 64,
    borderRadius: 20,
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { fontFamily: fonts.strong, fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  navLabelActive: { color: colors.magenta },
  option: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionMuted: { opacity: 0.55 },
  optionMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIndex: { fontFamily: fonts.display, fontSize: 14 },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 21,
    color: colors.body,
  },
  feedback: {
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: colors.paper,
    padding: 15,
    gap: 8,
  },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackTitle: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.1 },
  feedbackBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.body },
});
