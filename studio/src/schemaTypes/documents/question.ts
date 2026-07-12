import {HelpCircleIcon} from '@sanity/icons/HelpCircle'
import {defineArrayMember, defineField, defineType} from 'sanity'

type QuestionValue = {
  questionType?: 'multipleChoice' | 'numeric' | 'matching' | 'image'
  multipleChoiceAnswer?: unknown
  numericAnswer?: unknown
  matchingAnswer?: unknown
  imageAnswer?: unknown
}

const questionTypes = [
  {title: 'Multiple choice', value: 'multipleChoice'},
  {title: 'Numeric calculation', value: 'numeric'},
  {title: 'Matching', value: 'matching'},
  {title: 'Image-based multiple choice', value: 'image'},
]

export const question = defineType({
  name: 'question',
  title: 'Question',
  type: 'document',
  icon: HelpCircleIcon,
  groups: [
    {name: 'question', title: 'Question', default: true},
    {name: 'answer', title: 'Answer & feedback'},
    {name: 'alignment', title: 'Placement & alignment'},
    {name: 'sources', title: 'Sources'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'question',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'title',
      title: 'Internal title',
      type: 'string',
      group: 'question',
      description: 'Short editor-facing label; not shown to learners.',
      validation: (rule) => rule.required().min(3).max(140),
    }),
    defineField({
      name: 'prompt',
      title: 'Prompt',
      type: 'richText',
      group: 'question',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'questionType',
      title: 'Question type',
      type: 'string',
      group: 'question',
      options: {list: questionTypes, layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'difficulty',
      title: 'Difficulty',
      type: 'number',
      group: 'question',
      options: {
        list: [
          {title: '1 · Foundational', value: 1},
          {title: '2 · Basic application', value: 2},
          {title: '3 · Applied', value: 3},
          {title: '4 · Advanced', value: 4},
          {title: '5 · Mastery', value: 5},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required().integer().min(1).max(5),
    }),
    defineField({
      name: 'estimatedSeconds',
      title: 'Estimated answer time (seconds)',
      type: 'number',
      group: 'question',
      validation: (rule) => rule.required().integer().min(5).max(600),
    }),
    defineField({
      name: 'multipleChoiceAnswer',
      title: 'Multiple-choice answer',
      type: 'multipleChoiceAnswerSpec',
      group: 'answer',
      hidden: ({document}) => document?.questionType !== 'multipleChoice',
    }),
    defineField({
      name: 'numericAnswer',
      title: 'Numeric answer',
      type: 'numericAnswerSpec',
      group: 'answer',
      hidden: ({document}) => document?.questionType !== 'numeric',
    }),
    defineField({
      name: 'matchingAnswer',
      title: 'Matching answer',
      type: 'matchingAnswerSpec',
      group: 'answer',
      hidden: ({document}) => document?.questionType !== 'matching',
    }),
    defineField({
      name: 'imageAnswer',
      title: 'Image-based answer',
      type: 'imageQuestionSpec',
      group: 'answer',
      hidden: ({document}) => document?.questionType !== 'image',
    }),
    defineField({
      name: 'explanation',
      title: 'Correct-answer explanation',
      type: 'richText',
      group: 'answer',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'remediation',
      title: 'Incorrect-answer remediation',
      type: 'text',
      rows: 3,
      group: 'answer',
      description: 'Optional concise guidance shown after an incorrect response.',
      validation: (rule) => rule.max(1000),
    }),
    defineField({
      name: 'module',
      title: 'Module',
      type: 'reference',
      weak: true,
      to: [{type: 'module'}],
      group: 'alignment',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'section',
      title: 'Section',
      type: 'reference',
      weak: true,
      to: [{type: 'section'}],
      group: 'alignment',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'lessons',
      title: 'Related lessons',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'lesson'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'usage',
      title: 'Allowed usage',
      type: 'array',
      group: 'alignment',
      of: [
        defineArrayMember({
          type: 'string',
          options: {
            list: [
              {title: 'Inline practice', value: 'practice'},
              {title: 'Section quiz', value: 'sectionQuiz'},
              {title: 'Module exam', value: 'moduleExam'},
              {title: 'Daily review', value: 'dailyReview'},
            ],
          },
        }),
      ],
      options: {layout: 'grid'},
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'acsCodes',
      title: 'ACS alignment',
      type: 'array',
      group: 'alignment',
      of: [
        defineArrayMember({
          type: 'reference',
          weak: true,
          to: [{type: 'acsCode'}],
          options: {disableNew: true},
        }),
      ],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'glossaryTerms',
      title: 'Related glossary terms',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'glossaryTerm'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'active',
      title: 'Active',
      type: 'boolean',
      group: 'alignment',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'citations',
      title: 'Source citations',
      type: 'array',
      group: 'sources',
      of: [defineArrayMember({type: 'sourceCitation'})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  validation: (rule) =>
    rule.custom((rawValue) => {
      const value = rawValue as QuestionValue | undefined
      if (!value?.questionType) return true
      const answerByType = {
        multipleChoice: value.multipleChoiceAnswer,
        numeric: value.numericAnswer,
        matching: value.matchingAnswer,
        image: value.imageAnswer,
      }

      return answerByType[value.questionType]
        ? true
        : `Add the answer specification for the selected ${value.questionType} question type.`
    }),
  orderings: [
    {title: 'Title', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
    {title: 'Difficulty', name: 'difficultyAsc', by: [{field: 'difficulty', direction: 'asc'}]},
  ],
  preview: {
    select: {
      title: 'title',
      questionType: 'questionType',
      difficulty: 'difficulty',
      section: 'section.title',
      media: 'imageAnswer.stimulusFigure.image',
    },
    prepare({title, questionType, difficulty, section, media}) {
      return {
        title,
        subtitle: `${questionType ?? 'untyped'} · difficulty ${difficulty ?? '?'} · ${section ?? 'unassigned'}`,
        media,
      }
    },
  },
})
