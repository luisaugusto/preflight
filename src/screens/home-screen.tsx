import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomNav, Card, Eyebrow, Header, IconButton, Pill, Screen } from '@/components/ui';
import { colors, fonts, type } from '@/theme';
import type { ModuleContent, Section } from '@/lib/content/types';

export function HomeScreen({
  module,
  completedLessonIds,
  completedSectionIds,
  onOpenSection,
  onPractice,
  onInfo,
  onExam,
}: {
  module: ModuleContent;
  completedLessonIds: Set<string>;
  completedSectionIds: Set<string>;
  onOpenSection: (section: Section) => void;
  onPractice: () => void;
  onInfo: () => void;
  onExam: () => void;
}) {
  const sections = [...module.sections].sort((a, b) => a.order - b.order);
  const completedSections = sections.filter((section) => completedSectionIds.has(section.id));
  const nextIncompleteIndex = sections.findIndex((item) => !completedSectionIds.has(item.id));
  const allSectionsComplete = nextIncompleteIndex === -1;
  const activeIndex = allSectionsComplete ? sections.length - 1 : nextIncompleteIndex;
  const activeSection = sections[activeIndex];
  const sectionLessonDone = activeSection.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const overallLessons = sections.flatMap((section) => section.lessons);
  const completedCount = overallLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const progress = overallLessons.length ? Math.round((completedCount / overallLessons.length) * 100) : 0;
  const examUnlocked = sections.length > 0 && sections.every((section) => completedSectionIds.has(section.id));

  return (
    <Screen
      contentStyle={styles.content}
      footer={<BottomNav active="path" onPath={() => undefined} onPractice={onPractice} />}
    >
      <Header label="PHAK / FLIGHT PLAN" trailing={<IconButton name="information-outline" accessibilityLabel="About Preflight" onPress={onInfo} />} />

      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Eyebrow>MODULE 01</Eyebrow>
          <Text style={styles.title}>PILOT&apos;S HANDBOOK</Text>
        </View>
        <View style={styles.roundel}>
          <Text style={styles.roundelValue}>{progress}</Text>
          <Text style={styles.roundelUnit}>%</Text>
        </View>
      </View>

      <Card style={styles.distanceCard}>
        <View style={styles.distanceHead}>
          <Eyebrow>DISTANCE FLOWN</Eyebrow>
          <Text style={styles.distanceValue}>{completedSections.length} OF {sections.length} LEGS · {progress}%</Text>
        </View>
        <View style={styles.progressTicks}>
          {sections.map((section, index) => (
            <View key={section.id} style={[styles.progressTick, completedSectionIds.has(section.id) && styles.progressTickDone]} />
          ))}
        </View>
      </Card>

      <Pressable
        onPress={() => allSectionsComplete ? onExam() : onOpenSection(activeSection)}
        accessibilityRole="button"
        accessibilityLabel={allSectionsComplete ? 'Start PHAK module exam' : `Continue ${activeSection.title}`}
      >
        <Card style={styles.continueCard} accent={colors.ink}>
          <View style={styles.continueTop}>
            <Eyebrow color={colors.magentaPale}>{allSectionsComplete ? 'FINAL CHECK' : 'NEXT LEG'}</Eyebrow>
            <MaterialCommunityIcons name="navigation-variant" size={27} color={colors.magenta} />
          </View>
          <Text style={styles.continueTitle}>{allSectionsComplete ? 'PHAK MODULE EXAM' : activeSection.title.toUpperCase()}</Text>
          <Text style={styles.continueMeta}>
            {allSectionsComplete
              ? `${module.exam.length} questions · 80% to pass · retakes allowed`
              : `Section ${activeSection.order} · Lesson ${Math.min(sectionLessonDone + 1, activeSection.lessons.length)} of ${activeSection.lessons.length} · ~4 min`}
          </Text>
        </Card>
      </Pressable>

      <View style={styles.routeHeading}>
        <Eyebrow>THE ROUTE</Eyebrow>
        <Text style={styles.routeCount}>{completedSections.length} OF {sections.length} LEGS</Text>
      </View>

      <View style={styles.route}>
        {sections.map((section, index) => {
          const done = completedSectionIds.has(section.id);
          const active = !allSectionsComplete && index === activeIndex;
          const locked = !allSectionsComplete && index > activeIndex;
          return (
            <RouteSection
              key={section.id}
              section={section}
              done={done}
              active={active}
              locked={locked}
              last={index === sections.length - 1}
              lessonDone={section.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length}
              onPress={() => !locked && onOpenSection(section)}
            />
          );
        })}
      </View>

      <Pressable
        onPress={onExam}
        disabled={!examUnlocked}
        accessibilityRole="button"
        accessibilityLabel="PHAK module exam"
        accessibilityState={{ disabled: !examUnlocked }}
      >
        <Card style={[styles.examCard, !examUnlocked && styles.lockedCard]} accent={examUnlocked ? colors.blue : colors.lineStrong}>
          <View style={[styles.examIcon, { backgroundColor: examUnlocked ? colors.bluePale : colors.paperDeep }]}>
            <MaterialCommunityIcons name={examUnlocked ? 'shield-star-outline' : 'lock-outline'} size={25} color={examUnlocked ? colors.blue : colors.muted} />
          </View>
          <View style={styles.examCopy}>
            <Eyebrow color={examUnlocked ? colors.blue : colors.muted}>FINAL CHECK</Eyebrow>
            <Text style={styles.examTitle}>PHAK module exam</Text>
            <Text style={styles.examSub}>{examUnlocked ? `${module.exam.length} questions · retakes allowed` : 'Complete every section to unlock'}</Text>
          </View>
        </Card>
      </Pressable>
    </Screen>
  );
}

function RouteSection({
  section,
  done,
  active,
  locked,
  last,
  lessonDone,
  onPress,
}: {
  section: Section;
  done: boolean;
  active: boolean;
  locked: boolean;
  last: boolean;
  lessonDone: number;
  onPress: () => void;
}) {
  const percent = section.lessons.length ? Math.round((lessonDone / section.lessons.length) * 100) : 0;
  return (
    <View style={styles.routeItem}>
      <View style={styles.routeRail}>
        <View style={[styles.marker, done && styles.markerDone, active && styles.markerActive]}>
          {done ? <MaterialCommunityIcons name="check" size={14} color={colors.paper} /> : active ? <View style={styles.activeDot} /> : null}
        </View>
        {!last ? <View style={[styles.routeLine, (done || active) && styles.routeLineTraveled]} /> : null}
      </View>
      <Pressable
        onPress={onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={`Section ${section.order}: ${section.title}`}
        accessibilityState={{ disabled: locked }}
        style={({ pressed }) => [styles.routePressable, pressed && { opacity: 0.72 }]}
      >
        <View style={[styles.routeCard, active && styles.routeCardActive, locked && styles.lockedCard]}>
          <View style={styles.routeCardHead}>
            <Text style={styles.routeNumber}>{String(section.order).padStart(2, '0')}</Text>
            <Pill tone={done ? 'green' : active ? 'magenta' : 'neutral'}>{done ? 'STAMPED' : active ? 'FLY' : 'LOCKED'}</Pill>
          </View>
          <Text style={styles.routeTitle}>{section.title}</Text>
          <Text style={styles.routeMeta}>
            {done ? `${section.lessons.length} lessons · quiz passed · 100%` : `${lessonDone} of ${section.lessons.length} lessons flown · ${percent}%`}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  titleCopy: { flex: 1, gap: 4 },
  title: { ...type.title, fontSize: 31, lineHeight: 34 },
  roundel: { width: 58, height: 58, borderRadius: 29, borderWidth: 5, borderColor: colors.bluePale, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  roundelValue: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  roundelUnit: { fontFamily: fonts.strong, fontSize: 11, color: colors.paper, marginTop: 8 },
  distanceCard: { marginTop: 17, padding: 14, gap: 10, shadowOpacity: 0 },
  distanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  distanceValue: { ...type.eyebrow, color: colors.blue },
  progressTicks: { height: 7, flexDirection: 'row', gap: 4 },
  progressTick: { flex: 1, borderRadius: 2, backgroundColor: colors.line },
  progressTickDone: { backgroundColor: colors.blue },
  continueCard: { marginTop: 14, gap: 5, padding: 16, borderWidth: 1.5, backgroundColor: colors.ink },
  continueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  continueTime: { ...type.eyebrow, color: colors.muted },
  continueTitle: { ...type.heading, fontSize: 22, color: colors.paper },
  continueMeta: { ...type.small, color: colors.line },
  routeHeading: { marginTop: 25, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  routeCount: { ...type.eyebrow, color: colors.blue },
  route: { gap: 0 },
  routeItem: { flexDirection: 'row', minHeight: 82 },
  routeRail: { width: 38, alignItems: 'center' },
  marker: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', zIndex: 2, marginTop: 13 },
  markerDone: { width: 21, height: 21, borderRadius: 11, backgroundColor: colors.magenta, borderColor: colors.magenta, marginTop: 10 },
  markerActive: { width: 22, height: 22, borderRadius: 11, borderColor: colors.magenta, backgroundColor: colors.paper, marginTop: 9 },
  activeDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.magenta },
  routeLine: { position: 'absolute', width: 1.5, top: 26, bottom: -2, backgroundColor: colors.lineStrong },
  routeLineTraveled: { backgroundColor: colors.magenta },
  routePressable: { flex: 1, paddingBottom: 8 },
  routeCard: { minHeight: 72, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.paper },
  routeCardActive: { borderColor: colors.magenta, borderWidth: 1.5 },
  lockedCard: { opacity: 0.52 },
  routeCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeNumber: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, letterSpacing: 1.5 },
  routeTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, color: colors.ink, marginTop: 3 },
  routeMeta: { ...type.small, fontSize: 12, lineHeight: 15 },
  examCard: { marginTop: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5 },
  examIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  examCopy: { flex: 1, gap: 3 },
  examTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  examSub: { ...type.small },
});
