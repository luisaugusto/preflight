/// <reference types="jest" />

import type { ModuleContent, MultipleChoiceQuestion, SourceCitation } from './content/types';
import catalogJson from '../content/catalog.json';
import {
  MemoryContentStore,
  compareContentVersions,
  normalizeContent,
  normalizeCurriculum,
  overlayCurriculum,
  safeParseModuleContent,
  updateContentFromManifest,
  validateContentPayload,
  type ContentManifest,
} from './content-sync';

const checksumForVersion = (version: string) => (version.startsWith('1') ? 'a' : 'b').repeat(64);
const citation: SourceCitation = {
  handbook: "Pilot's Handbook of Aeronautical Knowledge",
  edition: 'FAA-H-8083-25C',
  chapter: 'Introduction to Flying',
  page: '1-2',
  url: 'https://www.faa.gov/example.pdf',
};

function makeQuestion(id: string): MultipleChoiceQuestion {
  return {
    id,
    type: 'multipleChoice',
    prompt: 'Which answer is correct?',
    explanation: 'The first answer is correct.',
    sourceCitation: citation,
    acsCodes: ['PA.I.A.K1'],
    options: ['Correct', 'Incorrect'],
    correctIndex: 0,
  };
}

function makeModule(version: string): ModuleContent {
  return {
    id: 'phak',
    title: "Pilot's Handbook of Aeronautical Knowledge",
    shortTitle: 'PHAK',
    description: 'A complete private-pilot knowledge module.',
    version,
    source: {
      title: 'FAA-H-8083-25C',
      url: 'https://www.faa.gov/example.pdf',
      edition: 'FAA-H-8083-25C',
      checksum: 'source-checksum',
    },
    sections: [
      {
        id: 'section-1',
        title: 'Introduction',
        order: 1,
        summary: 'An introduction to aviation knowledge.',
        sourcePages: '1-1–1-10',
        acsCodes: ['PA.I.A.K1'],
        lessons: [
          {
            id: 'lesson-1',
            title: 'Getting Started',
            order: 1,
            estimatedMinutes: 4,
            concept: 'Aviation knowledge supports sound decisions.',
            explanation: 'Pilots combine knowledge and judgment.',
            workedExample: 'Review a decision before flight.',
            sourceCitation: citation,
            acsCodes: ['PA.I.A.K1'],
            practice: makeQuestion('practice-1'),
          },
        ],
        quiz: [makeQuestion('quiz-1')],
      },
    ],
    exam: [makeQuestion('exam-1')],
    glossary: [
      {
        id: 'term-1',
        term: 'Aeronautical decision-making',
        definition: 'A systematic approach to choosing the best action.',
        sectionId: 'section-1',
        sourceCitation: citation,
        acsCodes: ['PA.I.A.K1'],
      },
    ],
  };
}

function manifest(version: string): ContentManifest {
  return {
    schemaVersion: 1,
    moduleId: 'phak',
    contentVersion: version,
    bundleUrl: `https://cdn.example.com/phak-${version}.json`,
    checksum: checksumForVersion(version),
    algorithm: 'sha256',
    createdAt: '2026-07-12T12:00:00.000Z',
  };
}

const hash = async (raw: string) =>
  checksumForVersion((JSON.parse(raw) as { version: string }).version);

describe('content validation', () => {
  it('accepts the canonical top-level module and an optional bundle wrapper', () => {
    const module = makeModule('1.0.0');
    expect(normalizeContent(module)).toEqual(module);
    expect(
      normalizeContent({
        schemaVersion: 1,
        contentVersion: '1.0.0',
        module,
      }),
    ).toEqual(module);
  });

  it('rejects invalid answer indexes and broken glossary references', () => {
    const invalid = makeModule('1.0.0');
    invalid.exam[0] = { ...makeQuestion('exam-1'), correctIndex: 9 };
    invalid.glossary[0] = { ...invalid.glossary[0], sectionId: 'missing' };
    const parsed = safeParseModuleContent(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'correctIndex must refer to an option',
          'Glossary sectionId must refer to a section in this module',
        ]),
      );
    }
  });

  it('checks payload checksum, module id, and content version', async () => {
    const raw = JSON.stringify(makeModule('2.0.0'));
    await expect(validateContentPayload(raw, manifest('2.0.0'), hash)).resolves.toMatchObject({
      module: { id: 'phak', version: '2.0.0' },
    });
    await expect(
      validateContentPayload(raw, { ...manifest('2.0.0'), moduleId: 'other' }, hash),
    ).rejects.toThrow('module id');
  });

  it('accepts the four-module schema-v2 catalog and ordered manifest', async () => {
    const catalog = normalizeCurriculum(catalogJson);
    const raw = JSON.stringify(catalogJson);
    const v2Manifest: ContentManifest = {
      schemaVersion: 2,
      catalogId: catalog.catalogId,
      moduleIds: catalog.modules.map((module) => module.id),
      contentVersion: catalog.contentVersion,
      bundleUrl: 'https://cdn.example.com/catalog.json',
      checksum: 'c'.repeat(64),
      algorithm: 'sha256',
      createdAt: '2026-07-14T00:00:00.000Z',
    };

    await expect(
      validateContentPayload(raw, v2Manifest, async () => 'c'.repeat(64)),
    ).resolves.toMatchObject({
      catalog: { catalogId: 'preflight-faa-curriculum' },
      module: { id: 'phak' },
    });
    await expect(
      validateContentPayload(
        raw,
        { ...v2Manifest, moduleIds: ['afh', 'phak', 'awh', 'rmh'] },
        async () => 'c'.repeat(64),
      ),
    ).rejects.toThrow('module order');
  });

  it('overlays a schema-v1 PHAK update without removing the other modules', () => {
    const bundled = normalizeCurriculum(catalogJson);
    const candidate = normalizeCurriculum(makeModule('2.0.0'));
    const overlaid = overlayCurriculum(bundled, candidate);

    expect(overlaid.modules.map((module) => module.id)).toEqual(['phak', 'afh', 'awh', 'rmh']);
    expect(overlaid.modules[0].version).toBe('2.0.0');
    expect(overlaid.modules[1]).toEqual(bundled.modules[1]);
  });

  it('compares semantic versions numerically', () => {
    expect(compareContentVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareContentVersions('v2.0', '2.0.0')).toBe(0);
    expect(compareContentVersions('1.0.0', '2.0.0')).toBe(-1);
  });
});

describe('safe content updates', () => {
  it('stages, validates, and activates a newer payload', async () => {
    const oldRaw = JSON.stringify(makeModule('1.0.0'));
    const oldContent = await validateContentPayload(oldRaw, manifest('1.0.0'), hash);
    const store = new MemoryContentStore(oldContent);
    const newRaw = JSON.stringify(makeModule('2.0.0'));

    const result = await updateContentFromManifest(manifest('2.0.0'), {
      store,
      hash,
      downloadText: async () => newRaw,
    });

    expect(result.status).toBe('updated');
    expect(result.previousVersion).toBe('1.0.0');
    expect((await store.readActive())?.module.version).toBe('2.0.0');
  });

  it('leaves active content untouched when validation fails', async () => {
    const oldRaw = JSON.stringify(makeModule('1.0.0'));
    const oldContent = await validateContentPayload(oldRaw, manifest('1.0.0'), hash);
    const store = new MemoryContentStore(oldContent);

    const result = await updateContentFromManifest(manifest('2.0.0'), {
      store,
      hash: async () => 'c'.repeat(64),
      downloadText: async () => JSON.stringify(makeModule('2.0.0')),
    });

    expect(result.status).toBe('failed');
    expect((await store.readActive())?.module.version).toBe('1.0.0');
  });

  it('rolls back when activation fails after staging', async () => {
    const oldRaw = JSON.stringify(makeModule('1.0.0'));
    const oldContent = await validateContentPayload(oldRaw, manifest('1.0.0'), hash);
    const store = new MemoryContentStore(oldContent);
    store.failActivation = true;

    const result = await updateContentFromManifest(manifest('2.0.0'), {
      store,
      hash,
      downloadText: async () => JSON.stringify(makeModule('2.0.0')),
    });

    expect(result.status).toBe('rolledBack');
    expect((await store.readActive())?.module.version).toBe('1.0.0');
  });
});
