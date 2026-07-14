import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, Header, Pill, Screen } from '@/components/ui';
import type { ModuleContent } from '@/lib/content/types';
import { colors, fonts, type } from '@/theme';

export function ModulesScreen({
  modules,
  activeModuleId,
  completedLessonIds,
  completedSectionIds,
  completedModuleIds,
  onSelect,
  onBack,
}: {
  modules: ModuleContent[];
  activeModuleId: string;
  completedLessonIds: ReadonlySet<string>;
  completedSectionIds: ReadonlySet<string>;
  completedModuleIds: ReadonlySet<string>;
  onSelect: (moduleId: string) => void;
  onBack: () => void;
}) {
  return (
    <Screen contentStyle={styles.content}>
      <Header label="CURRICULUM / MODULES" onBack={onBack} />
      <View style={styles.hero}>
        <Eyebrow>CHOOSE A FLIGHT PLAN</Eyebrow>
        <Text style={type.title}>Modules</Text>
        <Text style={type.body}>
          Each route keeps its own position. Practice combines every section you have completed.
        </Text>
      </View>

      <View style={styles.list}>
        {modules.map((module, index) => {
          const lessons = module.sections.flatMap((section) => section.lessons);
          const completedLessons = lessons.filter((lesson) =>
            completedLessonIds.has(lesson.id),
          ).length;
          const completedSections = module.sections.filter((section) =>
            completedSectionIds.has(section.id),
          ).length;
          const percentage = lessons.length
            ? Math.round((completedLessons / lessons.length) * 100)
            : 0;
          const active = module.id === activeModuleId;
          const complete =
            completedModuleIds.has(module.id) && completedSections === module.sections.length;
          return (
            <Pressable
              key={module.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${module.title}, ${percentage}% complete`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(module.id)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card
                style={[styles.moduleCard, active && styles.activeCard]}
                accent={active ? colors.magenta : undefined}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.number, active && styles.numberActive]}>
                    <Text style={[styles.numberText, active && styles.numberTextActive]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                  <Pill tone={complete ? 'green' : active ? 'magenta' : 'neutral'}>
                    {complete ? 'COMPLETE' : active ? 'CURRENT' : 'AVAILABLE'}
                  </Pill>
                </View>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleDescription}>{module.description}</Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                  </View>
                  <Text style={styles.percentage}>{percentage}%</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    {completedSections} OF {module.sections.length} SECTIONS
                  </Text>
                  <MaterialCommunityIcons
                    name={active ? 'check-circle' : 'chevron-right'}
                    size={22}
                    color={active ? colors.magenta : colors.muted}
                  />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 36 },
  hero: { gap: 8, marginBottom: 24 },
  list: { gap: 12 },
  pressed: { opacity: 0.72 },
  moduleCard: { gap: 10, padding: 17, shadowOpacity: 0, borderWidth: 1.5 },
  activeCard: { backgroundColor: colors.magentaPale },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDeep,
  },
  numberActive: { backgroundColor: colors.magenta },
  numberText: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  numberTextActive: { color: colors.paper },
  moduleTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, color: colors.ink },
  moduleDescription: { ...type.small, color: colors.body },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.line,
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.blue },
  percentage: {
    fontFamily: fonts.strong,
    fontSize: 13,
    color: colors.blue,
    minWidth: 36,
    textAlign: 'right',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { ...type.eyebrow, color: colors.muted },
});
