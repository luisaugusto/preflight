import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';
import { BottomNav, Card, Eyebrow, Header, Screen } from '@/components/ui';
import type { ModuleContent } from '@/lib/content/types';
import { colors, fonts, type } from '@/theme';

export function InfoScreen({
  module,
  onPath,
  onPractice,
}: {
  module: ModuleContent;
  onPath: () => void;
  onPractice: () => void;
}) {
  return (
    <Screen
      contentStyle={styles.content}
      footer={<BottomNav active={null} onPath={onPath} onPractice={onPractice} />}
    >
      <Header label="BRIEFING / ABOUT" />
      <View style={styles.hero}>
        <View style={styles.mark}>
          <MaterialCommunityIcons name="airplane-takeoff" size={30} color={colors.paper} />
        </View>
        <Eyebrow>PRE-FLIGHT BRIEFING</Eyebrow>
        <Text style={type.title}>Know the source.</Text>
        <Text style={type.body}>
          Every lesson and question is traceable to the FAA handbook it teaches.
        </Text>
      </View>

      <Card style={styles.warning} accent={colors.magenta}>
        <View style={styles.warningHead}>
          <MaterialCommunityIcons name="alert-decagram-outline" size={23} color={colors.magenta} />
          <Text style={styles.warningTitle}>Unofficial study aid</Text>
        </View>
        <Text style={styles.warningText}>
          Preflight is not FAA-approved and its content has not been reviewed or endorsed by a
          certified flight instructor. Verify safety-critical information against current FAA
          publications and your instructor.
        </Text>
      </Card>

      <InfoRow
        icon="book-open-page-variant-outline"
        title="Primary source"
        body={`${module.source.title} · ${module.source.edition}`}
      />
      <InfoRow icon="tag-multiple-outline" title="Content version" body={module.version} />
      <InfoRow
        icon="cloud-download-outline"
        title="Offline content"
        body="The complete seed module and figures remain available after download."
      />
      <InfoRow
        icon="shield-lock-outline"
        title="Private by design"
        body="Progress, answers, and review history stay on this device. No account is required."
      />

      <Card style={styles.coverageCard}>
        <Eyebrow color={colors.blue}>MODULE COVERAGE</Eyebrow>
        <View style={styles.coverageRow}>
          <View>
            <Text style={styles.coverageValue}>{module.sections.length}</Text>
            <Text style={styles.coverageLabel}>SECTIONS</Text>
          </View>
          <View>
            <Text style={styles.coverageValue}>
              {module.sections.reduce((sum, section) => sum + section.lessons.length, 0)}
            </Text>
            <Text style={styles.coverageLabel}>LESSONS</Text>
          </View>
          <View>
            <Text style={styles.coverageValue}>{module.glossary.length}</Text>
            <Text style={styles.coverageLabel}>TERMS</Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

function InfoRow({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={21} color={colors.blue} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  hero: { gap: 9, marginBottom: 24 },
  mark: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  warning: { backgroundColor: colors.magentaPale, borderWidth: 1.5, gap: 10, marginBottom: 24 },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  warningTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  warningText: { ...type.body, fontSize: 15, lineHeight: 21 },
  infoRow: {
    flexDirection: 'row',
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1, gap: 3 },
  infoTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  infoBody: { ...type.small, color: colors.body },
  coverageCard: { marginTop: 24, gap: 16 },
  coverageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  coverageValue: { fontFamily: fonts.display, fontSize: 31, color: colors.ink },
  coverageLabel: { ...type.eyebrow, color: colors.muted },
});
