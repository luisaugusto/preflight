/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/components/question-interaction', () => {
  const { Text } = require('react-native');
  return {
    QuestionInteraction: ({ continueLabel }: { continueLabel?: string }) => (
      <Text>{continueLabel}</Text>
    ),
  };
});

import catalogContent from '@/content/catalog.json';
import { normalizeCurriculum } from '@/lib/content-sync';
import { LessonScreen } from '@/screens/lesson-screen';

const catalog = normalizeCurriculum(catalogContent);
const section = catalog.modules[0].sections[0];
const lesson = section.lessons[0];

describe('LessonScreen section navigation', () => {
  it('moves back to earlier completed screens and forward only to the furthest reached screen', async () => {
    const onStageChange = jest.fn();
    const screen = await render(
      <LessonScreen
        section={section}
        lesson={lesson}
        lessonIndex={0}
        initialStage={2}
        onExit={jest.fn()}
        onStageChange={onStageChange}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Previous lesson screen'));
    expect(screen.getByText('WORKED EXAMPLE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Previous lesson screen'));
    expect(screen.getByText('CONCEPT')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next lesson screen'));
    expect(screen.getByText('WORKED EXAMPLE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next lesson screen'));
    expect(screen.getByText('YOUR TURN')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Next lesson screen'));
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
  });

  it('allows completed lessons to move between neighboring reached lessons', async () => {
    const onNavigateLesson = jest.fn();
    const screen = await render(
      <LessonScreen
        section={section}
        lesson={section.lessons[1]}
        lessonIndex={1}
        initialStage={0}
        isLessonComplete
        canNavigateToPreviousLesson
        canNavigateToNextLesson
        onExit={jest.fn()}
        onNavigateLesson={onNavigateLesson}
        onComplete={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Previous lesson screen'));
    expect(onNavigateLesson).toHaveBeenCalledWith('previous');

    await fireEvent.press(screen.getByText('SHOW ME HOW'));
    await fireEvent.press(screen.getByText('TRY ONE'));
    await fireEvent.press(screen.getByLabelText('Previous lesson screen'));
    await fireEvent.press(screen.getByLabelText('Previous lesson screen'));
    await fireEvent.press(screen.getByLabelText('Next lesson screen'));
    await fireEvent.press(screen.getByLabelText('Next lesson screen'));
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(onNavigateLesson).toHaveBeenCalledTimes(1);
  });
});
