import {BookIcon} from '@sanity/icons/Book'
import {defineArrayMember, defineField, defineType} from 'sanity'

type ModuleValue = {
  status?: string
  publishedAt?: string
}

export const module = defineType({
  name: 'module',
  title: 'Module',
  type: 'document',
  icon: BookIcon,
  groups: [
    {name: 'identity', title: 'Identity', default: true},
    {name: 'curriculum', title: 'Curriculum'},
    {name: 'publishing', title: 'Publishing'},
    {name: 'sources', title: 'Sources'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'identity',
      description: 'Immutable app-facing ID, for example phak-v1.',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'identity',
      validation: (rule) => rule.required().min(3).max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'identity',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle',
      type: 'string',
      group: 'identity',
      validation: (rule) => rule.max(180),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'richText',
      group: 'identity',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'coverFigure',
      title: 'Cover figure',
      type: 'reference',
      weak: true,
      to: [{type: 'figure'}],
      group: 'identity',
    }),
    defineField({
      name: 'sections',
      title: 'Ordered sections',
      type: 'array',
      group: 'curriculum',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'section'}]})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'finalExamQuestions',
      title: 'Final exam questions',
      type: 'array',
      group: 'curriculum',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'question'}]})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'glossaryTerms',
      title: 'Glossary terms',
      type: 'array',
      group: 'curriculum',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'glossaryTerm'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'acsCodes',
      title: 'ACS coverage',
      type: 'array',
      group: 'curriculum',
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
      name: 'passingScore',
      title: 'Passing score (%)',
      type: 'number',
      group: 'curriculum',
      initialValue: 80,
      validation: (rule) => rule.required().integer().min(0).max(100),
    }),
    defineField({
      name: 'estimatedMinutes',
      title: 'Estimated completion time (minutes)',
      type: 'number',
      group: 'curriculum',
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'publishing',
      initialValue: 'draft',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'In review', value: 'review'},
          {title: 'Published', value: 'published'},
          {title: 'Archived', value: 'archived'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'contentVersion',
      title: 'Content version',
      type: 'string',
      group: 'publishing',
      description: 'Semantic version used by app content bundles.',
      validation: (rule) =>
        rule.required().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, {name: 'semantic version'}),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'publishing',
      hidden: ({document}) => document?.status !== 'published',
    }),
    defineField({
      name: 'disclaimer',
      title: 'Study-aid disclaimer',
      type: 'text',
      rows: 4,
      group: 'publishing',
      initialValue:
        'Preflight is an unofficial study aid. It is not approved or endorsed by the FAA and has not been reviewed by a certified flight instructor. Always consult current FAA publications and your flight instructor.',
      validation: (rule) => rule.required().min(30).max(1000),
    }),
    defineField({
      name: 'documentCode',
      title: 'Source document code',
      type: 'string',
      group: 'sources',
      description: 'For example, FAA-H-8083-25C.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'edition',
      title: 'Edition',
      type: 'string',
      group: 'sources',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourcePdfUrl',
      title: 'Official PDF URL',
      type: 'url',
      group: 'sources',
      validation: (rule) => rule.required().uri({scheme: ['https']}),
    }),
    defineField({
      name: 'sourceChecksum',
      title: 'Source checksum',
      type: 'string',
      group: 'sources',
      description: 'Checksum recorded by the source extraction pipeline.',
      validation: (rule) => rule.required().min(8).max(128),
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
      const value = rawValue as ModuleValue | undefined
      return value?.status !== 'published' || value.publishedAt
        ? true
        : 'Published modules require a publication date.'
    }),
  orderings: [
    {title: 'Title', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
    {title: 'Recently updated', name: 'updatedDesc', by: [{field: '_updatedAt', direction: 'desc'}]},
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'contentVersion',
      status: 'status',
      media: 'coverFigure.image',
    },
    prepare({title, subtitle, status, media}) {
      return {title, subtitle: `${status ?? 'draft'} · v${subtitle ?? '?'}`, media}
    },
  },
})
