import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomNav,
  Card,
  Eyebrow,
  Header,
  IconButton,
  Pill,
  PrimaryButton,
  Screen,
} from '@/components/ui';
import { colors, fonts, type } from '@/theme';

type PracticeRoute = 'daily' | 'vocabulary' | 'calculations' | 'mistakes';

export function PracticeScreen({
  dueCount,
  onOpen,
  onPath,
  onInfo,
  eligibleSectionCount,
  vocabularyCount,
  calculationCount,
  mistakeCount,
}: {
  dueCount: number;
  onOpen: (route: PracticeRoute) => void;
  onPath: () => void;
  onInfo: () => void;
  eligibleSectionCount: number;
  vocabularyCount: number;
  calculationCount: number;
  mistakeCount: number;
}) {
  return (
    <Screen
      contentStyle={styles.content}
      footer={<BottomNav active="practice" onPath={onPath} onPractice={() => undefined} />}
    >
      <Header
        label="PRACTICE / HANGAR"
        trailing={
          <IconButton
            name="information-outline"
            accessibilityLabel="About Preflight"
            onPress={onInfo}
          />
        }
      />
      <View style={styles.hero}>
        <Eyebrow>KEEP IT AIRWORTHY</Eyebrow>
        <Text style={type.title}>Practice</Text>
        <Text style={type.body}>
          Short drills tuned to what you&apos;ve learned and what is due next.
        </Text>
      </View>

      {!eligibleSectionCount ? (
        <Card style={styles.emptyCard} accent={colors.blue}>
          <MaterialCommunityIcons name="map-marker-path" size={27} color={colors.blue} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Complete a section first</Text>
            <Text style={styles.emptyText}>
              Practice unlocks only after you have learned and passed a section check.
            </Text>
          </View>
          <PrimaryButton label="RETURN TO THE ROUTE" tone="ink" onPress={onPath} />
        </Card>
      ) : null}

      <Card style={styles.dailyCard} accent={colors.magenta}>
        <View style={styles.dailyHead}>
          <View style={styles.dailyIcon}>
            <MaterialCommunityIcons
              name="calendar-refresh-outline"
              size={25}
              color={colors.magenta}
            />
          </View>
          <Pill tone="magenta">{dueCount ? 'DUE NOW' : 'CLEAR'}</Pill>
        </View>
        <Text style={styles.dailyTitle}>Daily review</Text>
        <Text style={styles.dailySub}>
          {dueCount
            ? `${dueCount} cards · about ${Math.max(2, Math.ceil(dueCount / 2))} min`
            : eligibleSectionCount
              ? 'Nothing due - fly a light review from completed sections.'
              : 'Complete a section to unlock review cards.'}
        </Text>
        <PrimaryButton
          label={dueCount ? 'START REVIEW' : 'QUICK REVIEW'}
          onPress={() => onOpen('daily')}
          disabled={!eligibleSectionCount}
        />
      </Card>

      <View style={styles.drillHeading}>
        <Eyebrow>OPEN DRILLS</Eyebrow>
        <Text style={styles.drillHint}>PRACTICE ANYTIME</Text>
      </View>
      <View style={styles.drills}>
        <DrillCard
          icon="alphabetical-variant"
          name="Vocabulary"
          detail={`${vocabularyCount} eligible terms from completed sections across all modules`}
          color={colors.blue}
          onPress={() => onOpen('vocabulary')}
          disabled={vocabularyCount < 4}
        />
        <DrillCard
          icon="calculator-variant-outline"
          name="Calculations"
          detail="W&B · crosswind · performance · weather"
          color={colors.green}
          onPress={() => onOpen('calculations')}
          disabled={!calculationCount}
        />
        <DrillCard
          icon="alert-circle-outline"
          name="Mistakes"
          detail={
            mistakeCount
              ? `${mistakeCount} unresolved miss${mistakeCount === 1 ? '' : 'es'} ready to retry`
              : 'Missed answers will appear here for focused retry'
          }
          color={colors.magenta}
          onPress={() => onOpen('mistakes')}
          disabled={!mistakeCount}
        />
      </View>

      <Card style={styles.fsrsCard}>
        <MaterialCommunityIcons name="brain" size={24} color={colors.blue} />
        <View style={styles.fsrsCopy}>
          <Text style={styles.fsrsTitle}>How review works</Text>
          <Text style={styles.fsrsText}>
            Correct answers wait longer. Misses return sooner. The schedule stays on this device.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function DrillCard({
  icon,
  name,
  detail,
  color,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  name: string;
  detail: string;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${detail}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={[styles.drillCard, disabled && styles.disabled]}>
        <View style={[styles.drillIcon, { backgroundColor: `${color}15` }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <View style={styles.drillCopy}>
          <Text style={styles.drillName}>{name}</Text>
          <Text style={styles.drillDetail}>{detail}</Text>
        </View>
        <MaterialCommunityIcons
          name={disabled ? 'lock-outline' : 'chevron-right'}
          size={24}
          color={colors.muted}
        />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  hero: { gap: 8, marginBottom: 24 },
  emptyCard: { gap: 13, marginBottom: 18, backgroundColor: colors.bluePale, shadowOpacity: 0 },
  emptyCopy: { gap: 3 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  emptyText: { ...type.small, color: colors.body },
  dailyCard: { gap: 12, borderWidth: 1.5 },
  dailyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dailyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.magentaPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTitle: { ...type.heading, fontSize: 27 },
  dailySub: { ...type.small, marginTop: -7 },
  drillHeading: {
    marginTop: 30,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drillHint: { ...type.eyebrow, color: colors.blue },
  drills: { gap: 11 },
  pressed: { opacity: 0.72 },
  drillCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, shadowOpacity: 0 },
  disabled: { opacity: 0.55 },
  drillIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drillCopy: { flex: 1, gap: 2 },
  drillName: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  drillDetail: { ...type.small, fontSize: 13, lineHeight: 17 },
  fsrsCard: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.bluePale,
    shadowOpacity: 0,
  },
  fsrsCopy: { flex: 1, gap: 3 },
  fsrsTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  fsrsText: { ...type.small, color: colors.body },
});
