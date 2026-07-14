import {
  BarlowSemiCondensed_400Regular,
  BarlowSemiCondensed_500Medium,
  BarlowSemiCondensed_600SemiBold,
  BarlowSemiCondensed_700Bold,
  useFonts,
} from '@expo-google-fonts/barlow-semi-condensed';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import catalogContent from '@/content/catalog.json';
import type { CurriculumBundle, Question, Section } from '@/lib/content/types';
import { createPreflightRepository, type PreflightRepository, type ResumePosition } from '@/lib/db';
import { answerOutcomeToRating, createReviewCard, scheduleReview } from '@/lib/fsrs';
import {
  ExpoFileContentStore,
  MemoryContentStore,
  overlayCurriculum,
  syncContent,
} from '@/lib/content-sync';
import {
  buildCalculationQuestions,
  buildVocabularyQuestions,
  selectQuestionWindow,
} from '@/lib/practice-questions';
import { colors, fonts } from '@/theme';
import { OnboardingScreen } from '@/screens/onboarding-screen';
import { HomeScreen } from '@/screens/home-screen';
import { LessonScreen } from '@/screens/lesson-screen';
import { QuizScreen } from '@/screens/quiz-screen';
import { PracticeScreen } from '@/screens/practice-screen';
import { InfoScreen } from '@/screens/info-screen';
import { ModulesScreen } from '@/screens/modules-screen';
import {
  loadLocalLearningState,
  saveCompletedLessons,
  saveCompletedSections,
  saveActiveModuleId,
  saveCompletedModules,
  saveOnboarding,
} from '@/application/local-state';
import { analytics } from '@/application/analytics';

type AppRoute =
  | 'home'
  | 'lesson'
  | 'sectionQuiz'
  | 'exam'
  | 'practice'
  | 'daily'
  | 'vocabulary'
  | 'calculations'
  | 'info'
  | 'modules';

const bundledCurriculum = catalogContent as CurriculumBundle;
const firstBundledModule = bundledCurriculum.modules[0];

function reconcileCompletedSections(
  curriculum: CurriculumBundle,
  completedLessonIds: ReadonlySet<string>,
  recordedSectionIds: ReadonlySet<string>,
): Set<string> {
  return new Set(
    curriculum.modules.flatMap((module) =>
      module.sections
        .filter(
          (section) =>
            recordedSectionIds.has(section.id) &&
            section.lessons.every((lesson) => completedLessonIds.has(lesson.id)),
        )
        .map((section) => section.id),
    ),
  );
}

export function PreflightApp() {
  const [fontsLoaded] = useFonts({
    BarlowSemiCondensed_400Regular,
    BarlowSemiCondensed_500Medium,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });
  const [hydrated, setHydrated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [route, setRoute] = useState<AppRoute>('home');
  const [curriculum, setCurriculum] = useState<CurriculumBundle>(bundledCurriculum);
  const [activeModuleId, setActiveModuleId] = useState(firstBundledModule.id);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [completedSectionIds, setCompletedSectionIds] = useState<Set<string>>(new Set());
  const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState(firstBundledModule.sections[0]?.id ?? '');
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonStage, setLessonStage] = useState(0);
  const [resumePosition, setResumePosition] = useState<ResumePosition | null>(null);
  const [dueQuestionIds, setDueQuestionIds] = useState<string[]>([]);
  const [dailySessionQuestions, setDailySessionQuestions] = useState<Question[]>([]);
  const [vocabularyOffset, setVocabularyOffset] = useState(0);
  const repository = useRef<PreflightRepository | null>(null);
  const moduleSelectionRequest = useRef(0);
  const moduleContent = useMemo(
    () =>
      curriculum.modules.find((module) => module.id === activeModuleId) ?? curriculum.modules[0],
    [activeModuleId, curriculum],
  );
  const verifiedCompletedSectionIds = useMemo(
    () => reconcileCompletedSections(curriculum, completedLessonIds, completedSectionIds),
    [completedLessonIds, completedSectionIds, curriculum],
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([loadLocalLearningState(), createPreflightRepository().catch(() => null)])
      .then(async ([state, repo]) => {
        if (!mounted) return;
        repository.current = repo;
        const databaseCompletions = repo ? await repo.listCompletions() : [];
        const databaseLessons = databaseCompletions
          .filter((item) => item.contentType === 'lesson')
          .map((item) => item.contentId);
        const databaseSections = databaseCompletions
          .filter((item) => item.contentType === 'section')
          .map((item) => item.contentId);
        const databaseModules = databaseCompletions
          .filter((item) => item.contentType === 'module')
          .map((item) => item.contentId);
        const lessons = new Set([...state.completedLessonIds, ...databaseLessons]);
        const recordedSections = new Set([...state.completedSectionIds, ...databaseSections]);
        const requestedModule = bundledCurriculum.modules.find(
          (module) => module.id === state.activeModuleId,
        );
        const selectedModule = requestedModule ?? firstBundledModule;
        setOnboardingComplete(state.onboardingComplete);
        setCompletedLessonIds(lessons);
        setCompletedSectionIds(
          reconcileCompletedSections(bundledCurriculum, lessons, recordedSections),
        );
        setCompletedModuleIds(new Set([...state.completedModuleIds, ...databaseModules]));
        setActiveModuleId(selectedModule.id);
        setActiveSectionId(selectedModule.sections[0]?.id ?? '');
        if (repo) {
          const resume = await repo.getResumePosition(selectedModule.id);
          if (
            resume?.contentVersion === selectedModule.version &&
            resume.sectionId &&
            resume.lessonId
          ) {
            const section = selectedModule.sections.find((item) => item.id === resume.sectionId);
            const resumedLessonIndex =
              section?.lessons.findIndex((item) => item.id === resume.lessonId) ?? -1;
            if (section && resumedLessonIndex >= 0) {
              setActiveSectionId(section.id);
              setLessonIndex(resumedLessonIndex);
              setLessonStage(Math.min(3, Math.max(0, resume.blockIndex)));
              setResumePosition(resume);
            }
          }
          const due = await repo.listDueReviewCards(new Date(), 1000);
          setDueQuestionIds(
            due.filter((card) => card.contentType === 'question').map((card) => card.contentId),
          );
        }
      })
      .catch(() => {
        // A corrupt or unavailable local store must never block the bundled course.
      })
      .finally(() => mounted && setHydrated(true));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const manifestUrl =
      process.env.EXPO_PUBLIC_CONTENT_MANIFEST_URL ||
      (Constants.expoConfig?.extra?.contentManifestUrl as string | undefined);
    const store = Platform.OS === 'web' ? new MemoryContentStore() : new ExpoFileContentStore();
    let mounted = true;
    void (async () => {
      try {
        const cached = await store.readActive().catch(() => null);
        if (mounted && cached?.catalog) {
          setCurriculum(
            cached.manifest.schemaVersion >= 2
              ? cached.catalog
              : overlayCurriculum(bundledCurriculum, cached.catalog),
          );
        }
        if (!manifestUrl) return;
        const result = await syncContent(manifestUrl, { store });
        if (mounted && result.active?.catalog) {
          setCurriculum(
            result.active.manifest.schemaVersion >= 2
              ? result.active.catalog
              : overlayCurriculum(bundledCurriculum, result.active.catalog),
          );
          await repository.current?.saveContentState({
            version: result.active.manifest.contentVersion,
            checksum: result.active.manifest.checksum,
            manifest: result.active.manifest,
          });
        }
      } catch {
        // Cached or bundled content remains active when a manifest is unavailable or invalid.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const activeSection = useMemo(
    () =>
      moduleContent.sections.find((section) => section.id === activeSectionId) ??
      moduleContent.sections[0],
    [activeSectionId, moduleContent],
  );

  const selectModule = (moduleId: string) => {
    const nextModule = curriculum.modules.find((module) => module.id === moduleId);
    if (!nextModule) return;
    const request = moduleSelectionRequest.current + 1;
    moduleSelectionRequest.current = request;
    setActiveModuleId(nextModule.id);
    setActiveSectionId(nextModule.sections[0]?.id ?? '');
    setLessonIndex(0);
    setResumePosition(null);
    setRoute('home');
    void saveActiveModuleId(nextModule.id);
    void (async () => {
      const resume = await repository.current?.getResumePosition(nextModule.id);
      if (resume?.contentVersion !== nextModule.version || !resume.sectionId || !resume.lessonId) {
        return;
      }
      const section = nextModule.sections.find((item) => item.id === resume.sectionId);
      const resumedLessonIndex =
        section?.lessons.findIndex((item) => item.id === resume.lessonId) ?? -1;
      if (!section || resumedLessonIndex < 0 || moduleSelectionRequest.current !== request) return;
      setActiveSectionId(section.id);
      setLessonIndex(resumedLessonIndex);
      setLessonStage(Math.min(3, Math.max(0, resume.blockIndex)));
      setResumePosition(resume);
    })().catch(() => undefined);
  };

  const openSection = (section: Section) => {
    const firstIncomplete = section.lessons.findIndex(
      (lesson) => !completedLessonIds.has(lesson.id),
    );
    setActiveSectionId(section.id);
    if (firstIncomplete < 0 && !verifiedCompletedSectionIds.has(section.id)) {
      setResumePosition(null);
      void repository.current?.clearResumePosition(moduleContent.id);
      setRoute('sectionQuiz');
      return;
    }
    const targetIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
    const targetLesson = section.lessons[targetIndex];
    const resumedStage =
      resumePosition?.contentVersion === moduleContent.version &&
      resumePosition.sectionId === section.id &&
      resumePosition.lessonId === targetLesson.id
        ? resumePosition.blockIndex
        : 0;
    setLessonIndex(targetIndex);
    setLessonStage(resumedStage);
    const nextResume: ResumePosition = {
      moduleId: moduleContent.id,
      sectionId: section.id,
      lessonId: targetLesson.id,
      blockIndex: resumedStage,
      contentVersion: moduleContent.version,
      updatedAt: new Date().toISOString(),
    };
    setResumePosition(nextResume);
    void repository.current?.saveResumePosition(nextResume);
    analytics.track('section_started', { sectionId: section.id });
    analytics.track('lesson_started', { sectionId: section.id, lessonId: targetLesson.id });
    setRoute('lesson');
  };

  const completeLesson = () => {
    const lesson = activeSection.lessons[lessonIndex];
    const next = new Set(completedLessonIds);
    next.add(lesson.id);
    setCompletedLessonIds(next);
    void saveCompletedLessons(next);
    void repository.current?.saveCompletion({
      contentId: lesson.id,
      contentType: 'lesson',
      contentVersion: moduleContent.version,
    });
    analytics.track('lesson_completed', { sectionId: activeSection.id, lessonId: lesson.id });
    if (lessonIndex < activeSection.lessons.length - 1) {
      const nextLesson = activeSection.lessons[lessonIndex + 1];
      const nextResume: ResumePosition = {
        moduleId: moduleContent.id,
        sectionId: activeSection.id,
        lessonId: nextLesson.id,
        blockIndex: 0,
        contentVersion: moduleContent.version,
        updatedAt: new Date().toISOString(),
      };
      setResumePosition(nextResume);
      setLessonStage(0);
      void repository.current?.saveResumePosition(nextResume);
      setLessonIndex((value) => value + 1);
    } else {
      setResumePosition(null);
      void repository.current?.clearResumePosition(moduleContent.id);
      setRoute('sectionQuiz');
    }
  };

  const vocabularyQuestions = useMemo(
    () => buildVocabularyQuestions(curriculum.modules, verifiedCompletedSectionIds),
    [curriculum.modules, verifiedCompletedSectionIds],
  );
  const vocabularyDrillQuestions = useMemo(
    () => selectQuestionWindow(vocabularyQuestions, vocabularyOffset, 10),
    [vocabularyOffset, vocabularyQuestions],
  );
  const calculationQuestions = useMemo(
    () => buildCalculationQuestions(curriculum.modules, verifiedCompletedSectionIds),
    [curriculum.modules, verifiedCompletedSectionIds],
  );

  const eligibleSections = useMemo(
    () =>
      curriculum.modules.flatMap((module) =>
        module.sections
          .filter((section) => verifiedCompletedSectionIds.has(section.id))
          .map((section) => ({ module, section })),
      ),
    [curriculum.modules, verifiedCompletedSectionIds],
  );

  const reviewableQuestions = useMemo(
    () => [
      ...eligibleSections.flatMap(({ section }) => [
        ...section.lessons.map((lesson) => lesson.practice),
        ...section.quiz,
      ]),
      ...curriculum.modules.flatMap((module) =>
        module.exam.filter(
          (question) => question.sectionId && verifiedCompletedSectionIds.has(question.sectionId),
        ),
      ),
      ...vocabularyQuestions,
    ],
    [curriculum.modules, eligibleSections, verifiedCompletedSectionIds, vocabularyQuestions],
  );

  const dueQuestions = useMemo(() => {
    const byId = new Map(reviewableQuestions.map((question) => [question.id, question]));
    return dueQuestionIds
      .map((id) => byId.get(id))
      .filter((item): item is Question => Boolean(item));
  }, [dueQuestionIds, reviewableQuestions]);

  const dailyQuestions = useMemo(() => {
    if (dueQuestions.length) return dueQuestions.slice(0, 8);
    return eligibleSections
      .flatMap(({ section }) => [
        ...section.lessons.map((lesson) => lesson.practice),
        ...section.quiz,
      ])
      .slice(0, 8);
  }, [dueQuestions, eligibleSections]);

  const recordQuestionResult = (
    question: Question,
    correct: boolean,
    sectionId?: string,
    scheduleForReview = true,
  ) => {
    analytics.track('question_answered', { questionId: question.id, type: question.type, correct });
    const repo = repository.current;
    if (!repo) return;
    void (async () => {
      await repo.recordAttempt({
        questionId: question.id,
        sectionId: question.sectionId ?? sectionId ?? null,
        moduleId: question.moduleId ?? moduleContent.id,
        isCorrect: correct,
        score: correct ? 1 : 0,
        maxScore: 1,
        contentVersion:
          curriculum.modules.find((module) => module.id === question.moduleId)?.version ??
          moduleContent.version,
      });
      if (!scheduleForReview) return;
      const existing = await repo.getReviewCard(question.id, 'question');
      const current = existing ?? createReviewCard(question.id, 'question');
      const review = scheduleReview(current, answerOutcomeToRating(correct));
      await repo.saveReview(review.card, review.log);
      const due = await repo.listDueReviewCards(new Date(), 1000);
      setDueQuestionIds(
        due.filter((card) => card.contentType === 'question').map((card) => card.contentId),
      );
    })().catch(() => {
      // A local persistence failure must not interrupt the learning flow.
    });
  };

  if (!fontsLoaded || !hydrated) return <LoadingScreen />;

  if (!onboardingComplete) {
    return (
      <OnboardingScreen
        onComplete={(timeline) => {
          setOnboardingComplete(true);
          void saveOnboarding(timeline);
        }}
      />
    );
  }

  if (route === 'modules') {
    return (
      <ModulesScreen
        modules={curriculum.modules}
        activeModuleId={moduleContent.id}
        completedLessonIds={completedLessonIds}
        completedSectionIds={verifiedCompletedSectionIds}
        completedModuleIds={completedModuleIds}
        onSelect={selectModule}
        onBack={() => setRoute('home')}
      />
    );
  }

  if (route === 'home') {
    return (
      <HomeScreen
        module={moduleContent}
        completedLessonIds={completedLessonIds}
        completedSectionIds={verifiedCompletedSectionIds}
        onOpenSection={openSection}
        onPractice={() => setRoute('practice')}
        onInfo={() => setRoute('info')}
        onExam={() => setRoute('exam')}
        onModules={() => setRoute('modules')}
        moduleNumber={curriculum.modules.findIndex((module) => module.id === moduleContent.id) + 1}
      />
    );
  }

  if (route === 'lesson') {
    return (
      <LessonScreen
        key={`${activeSection.id}-${lessonIndex}`}
        section={activeSection}
        lesson={activeSection.lessons[lessonIndex]}
        lessonIndex={lessonIndex}
        initialStage={lessonStage}
        onExit={() => setRoute('home')}
        onStageChange={(stage) => {
          const lesson = activeSection.lessons[lessonIndex];
          setLessonStage(stage);
          const nextResume: ResumePosition = {
            moduleId: moduleContent.id,
            sectionId: activeSection.id,
            lessonId: lesson.id,
            blockIndex: stage,
            contentVersion: moduleContent.version,
            updatedAt: new Date().toISOString(),
          };
          setResumePosition(nextResume);
          void repository.current?.saveResumePosition(nextResume);
        }}
        onComplete={(correct) => {
          recordQuestionResult(
            activeSection.lessons[lessonIndex].practice,
            correct,
            activeSection.id,
          );
          completeLesson();
        }}
      />
    );
  }

  if (route === 'sectionQuiz') {
    return (
      <QuizScreen
        title={activeSection.title}
        label={`SECTION ${activeSection.order} / KNOWLEDGE CHECK`}
        questions={activeSection.quiz}
        onExit={() => setRoute('home')}
        onFinish={({ passed }) => {
          analytics.track('quiz_completed', { sectionId: activeSection.id, passed });
          if (passed) {
            const next = new Set(verifiedCompletedSectionIds);
            next.add(activeSection.id);
            setCompletedSectionIds(next);
            void saveCompletedSections(next);
            void repository.current?.saveCompletion({
              contentId: activeSection.id,
              contentType: 'section',
              contentVersion: moduleContent.version,
            });
            if (!verifiedCompletedSectionIds.has(activeSection.id)) {
              analytics.track('section_completed', { sectionId: activeSection.id });
              if (moduleContent.sections.every((section) => next.has(section.id))) {
                analytics.track('module_exam_unlocked', { moduleId: moduleContent.id });
              }
            }
          }
          setRoute('home');
        }}
        onQuestionAnswered={(question, correct) =>
          recordQuestionResult(question, correct, activeSection.id)
        }
      />
    );
  }

  if (route === 'exam') {
    return (
      <QuizScreen
        title={`${moduleContent.shortTitle} module exam`}
        label={`FINAL CHECK / MODULE ${String(
          curriculum.modules.findIndex((module) => module.id === moduleContent.id) + 1,
        ).padStart(2, '0')}`}
        questions={moduleContent.exam}
        passThreshold={0.8}
        onExit={() => setRoute('home')}
        onFinish={({ passed }) => {
          analytics.track('module_exam_completed', { passed });
          if (passed) {
            const next = new Set(completedModuleIds);
            next.add(moduleContent.id);
            setCompletedModuleIds(next);
            void saveCompletedModules(next);
            void repository.current?.saveCompletion({
              contentId: moduleContent.id,
              contentType: 'module',
              contentVersion: moduleContent.version,
            });
          }
          setRoute('home');
        }}
        onQuestionAnswered={(question, correct) => recordQuestionResult(question, correct)}
      />
    );
  }

  if (route === 'practice') {
    return (
      <PracticeScreen
        dueCount={Math.min(dueQuestions.length, 8)}
        eligibleSectionCount={eligibleSections.length}
        vocabularyCount={vocabularyQuestions.length}
        calculationCount={calculationQuestions.length}
        onOpen={(nextRoute) => {
          if (nextRoute === 'daily') setDailySessionQuestions(dailyQuestions);
          setRoute(nextRoute);
        }}
        onPath={() => setRoute('home')}
        onInfo={() => setRoute('info')}
      />
    );
  }

  if (route === 'daily') {
    return (
      <QuizScreen
        title="Daily review"
        label="PRACTICE / DUE ITEMS"
        questions={dailySessionQuestions.length ? dailySessionQuestions : dailyQuestions}
        passThreshold={0}
        onExit={() => setRoute('practice')}
        onFinish={({ score, total }) => {
          analytics.track('daily_practice_completed', { score, total });
          setDailySessionQuestions([]);
          setRoute('practice');
        }}
        onQuestionAnswered={(question, correct) => recordQuestionResult(question, correct)}
      />
    );
  }

  if (route === 'vocabulary') {
    return (
      <QuizScreen
        title="Vocabulary drill"
        label="PRACTICE / VOCABULARY"
        questions={vocabularyDrillQuestions}
        passThreshold={0}
        onExit={() => setRoute('practice')}
        onFinish={() => {
          setVocabularyOffset((offset) =>
            vocabularyQuestions.length ? (offset + 10) % vocabularyQuestions.length : 0,
          );
          setRoute('practice');
        }}
        onQuestionAnswered={(question, correct) => recordQuestionResult(question, correct)}
      />
    );
  }

  if (route === 'calculations') {
    return (
      <QuizScreen
        title="Calculation circuit"
        label="PRACTICE / CALCULATIONS"
        questions={calculationQuestions}
        passThreshold={0}
        schedulesReview={false}
        onExit={() => setRoute('practice')}
        onFinish={() => setRoute('practice')}
        onQuestionAnswered={(question, correct) =>
          recordQuestionResult(question, correct, undefined, false)
        }
      />
    );
  }

  return (
    <InfoScreen
      module={moduleContent}
      onPath={() => setRoute('home')}
      onPractice={() => setRoute('practice')}
    />
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <View style={styles.loadingMark}>
        <MaterialCommunityIcons name="airplane-takeoff" size={31} color={colors.paper} />
      </View>
      <Text style={styles.loadingBrand}>Preflight</Text>
      <ActivityIndicator color={colors.magenta} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    backgroundColor: colors.paper,
  },
  loadingMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magenta,
  },
  loadingBrand: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
});
