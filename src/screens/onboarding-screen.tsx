import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, PrimaryButton, Screen } from '@/components/ui';
import { colors, fonts, type } from '@/theme';

const timelines = [
  { id: 'month', title: 'Within a month', detail: 'Sprint plan - about 20 min a day' },
  { id: 'quarter', title: '1-3 months out', detail: 'Steady plan - about 10 min a day' },
  { id: 'later', title: '3+ months out', detail: 'Cruise plan - a section a week' },
  { id: 'exploring', title: 'Just exploring', detail: 'No date yet - we will keep it light' },
] as const;

export function OnboardingScreen({ onComplete }: { onComplete: (timeline: string) => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState('');

  if (step === 0) {
    return (
      <Screen scroll={false} contentStyle={styles.welcome}>
        <View style={styles.routeGraphic}>
          <MaterialCommunityIcons name="map-marker" size={30} color={colors.magenta} />
          <View style={[styles.routeDash, { borderColor: colors.magenta }]} />
          <MaterialCommunityIcons name="navigation-variant-outline" size={31} color={colors.blue} />
          <View style={[styles.routeDash, { borderColor: colors.blue }]} />
          <MaterialCommunityIcons name="circle-outline" size={22} color={colors.lineStrong} />
        </View>
        <View style={styles.welcomeCopy}>
          <Eyebrow color={colors.magenta}>PREFLIGHT</Eyebrow>
          <Text style={styles.tagline}>
            CHART YOUR{`\n`}COURSE TO THE{`\n`}CHECKRIDE.
          </Text>
          <Text style={styles.intro}>
            The four FAA handbooks, replotted as short, active lessons. Fly the route a leg a day -
            understand it, don&apos;t memorize it.
          </Text>
        </View>
        <PrimaryButton label="OPEN THE CHART" onPress={() => setStep(1)} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.timelineContent}>
      <View style={styles.timelineHeader}>
        <View style={styles.miniMark}>
          <MaterialCommunityIcons name="airplane" size={18} color={colors.magenta} />
        </View>
        <Eyebrow color={colors.magenta}>FLIGHT PLAN · 1 OF 1</Eyebrow>
        <Text style={type.title}>When are you taking the written?</Text>
        <Text style={type.body}>
          We&apos;ll use this to pace the route. You can change it later.
        </Text>
      </View>
      <View style={styles.timelineOptions}>
        {timelines.map((item) => {
          const active = selected === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelected(item.id)}
              accessibilityRole="radio"
              accessibilityLabel={`${item.title}. ${item.detail}`}
              accessibilityState={{ selected: active }}
            >
              <Card style={[styles.timelineCard, active && styles.timelineCardActive]}>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.timelineText}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineDetail}>{item.detail}</Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        label="FILE & DEPART"
        disabled={!selected}
        onPress={() => onComplete(selected)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { justifyContent: 'flex-start', paddingTop: 250, paddingBottom: 34, gap: 27 },
  routeGraphic: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  routeDash: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', marginHorizontal: 7 },
  welcomeCopy: { gap: 15 },
  tagline: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 43,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  intro: { ...type.body, maxWidth: 360, color: colors.muted },
  timelineContent: { paddingTop: 26, gap: 26 },
  timelineHeader: { gap: 13 },
  miniMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.magenta,
  },
  timelineOptions: { gap: 11 },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 13,
    shadowOpacity: 0,
  },
  timelineCardActive: { borderColor: colors.magenta, backgroundColor: colors.magentaPale },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.magenta },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.magenta },
  timelineText: { flex: 1, gap: 2 },
  timelineTitle: { fontFamily: fonts.strong, fontSize: 17, color: colors.ink },
  timelineDetail: { ...type.small },
});
