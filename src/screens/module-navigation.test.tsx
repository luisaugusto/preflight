import { fireEvent, render } from '@testing-library/react-native';

import catalogContent from '@/content/catalog.json';
import { normalizeCurriculum } from '@/lib/content-sync';
import { HomeScreen } from '@/screens/home-screen';
import { ModulesScreen } from '@/screens/modules-screen';

const catalog = normalizeCurriculum(catalogContent);
const [phak] = catalog.modules;

describe('module navigation', () => {
  it('opens the module selector from the module name on the path screen', async () => {
    const onModules = jest.fn();
    const screen = await render(
      <HomeScreen
        module={phak}
        moduleNumber={1}
        completedLessonIds={new Set()}
        completedSectionIds={new Set()}
        onOpenSection={jest.fn()}
        onPractice={jest.fn()}
        onInfo={jest.fn()}
        onExam={jest.fn()}
        onModules={onModules}
      />,
    );

    await fireEvent.press(screen.getByLabelText(`Change module. Current module: ${phak.title}`));
    expect(onModules).toHaveBeenCalledTimes(1);
  });

  it('shows a distinct knowledge-check-ready state after required lessons are complete', async () => {
    const section = phak.sections[0];
    const completedLessonIds = new Set(
      section.lessons.filter((lesson) => lesson.isRequired !== false).map((lesson) => lesson.id),
    );
    const onOpenSection = jest.fn();
    const screen = await render(
      <HomeScreen
        module={phak}
        moduleNumber={1}
        completedLessonIds={completedLessonIds}
        completedSectionIds={new Set()}
        onOpenSection={onOpenSection}
        onPractice={jest.fn()}
        onInfo={jest.fn()}
        onExam={jest.fn()}
        onModules={jest.fn()}
      />,
    );

    expect(screen.getByText('KNOWLEDGE CHECK READY')).toBeTruthy();
    expect(
      screen.getByText(`Knowledge check ready · ${section.quiz.length} questions`),
    ).toBeTruthy();
    expect(screen.getByText('CHECK')).toBeTruthy();

    await fireEvent.press(
      screen.getByLabelText(`Section ${section.order}: ${section.title}, knowledge check ready`),
    );
    expect(onOpenSection).toHaveBeenCalledWith(section);
  });

  it('shows all module progress cards and selects another module', async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <ModulesScreen
        modules={catalog.modules}
        activeModuleId="phak"
        completedLessonIds={new Set()}
        completedSectionIds={new Set()}
        completedModuleIds={new Set()}
        onSelect={onSelect}
        onBack={jest.fn()}
      />,
    );

    catalog.modules.forEach((module) => expect(screen.getByText(module.title)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText(`Select ${catalog.modules[1].title}, 0% complete`));
    expect(onSelect).toHaveBeenCalledWith('afh');
  });
});
