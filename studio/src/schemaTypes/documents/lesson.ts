import {ComposeIcon} from '@sanity/icons/Compose'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const lesson = defineType({
  name: 'lesson',
  title: 'Lesson',
  type: 'document',
  icon: ComposeIcon,
  groups: [
    {name: 'identity', title: 'Identity', default: true},
    {name: 'content', title: 'Content'},
    {name: 'alignment', title: 'Alignment & sources'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'identity',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'section',
      title: 'Section',
      type: 'reference',
      weak: true,
      to: [{type: 'section'}],
      group: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'identity',
      validation: (rule) => rule.required().min(3).max(140),
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
      name: 'order',
      title: 'Order',
      type: 'number',
      group: 'identity',
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'estimatedMinutes',
      title: 'Estimated duration (minutes)',
      type: 'number',
      group: 'identity',
      description: 'Microlessons should take no more than five minutes.',
      validation: (rule) => rule.required().integer().min(1).max(5),
    }),
    defineField({
      name: 'isRequired',
      title: 'Required for section completion',
      type: 'boolean',
      group: 'identity',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'learningObjectives',
      title: 'Learning objectives',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'string'})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'content',
      title: 'Lesson content',
      type: 'array',
      group: 'content',
      description: 'Order blocks as concept → worked example → active practice where applicable.',
      of: [defineArrayMember({type: 'lessonBlock'})],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'reviewQuestions',
      title: 'Review questions',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'question'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'glossaryTerms',
      title: 'Glossary terms',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'glossaryTerm'}]})],
      validation: (rule) => rule.unique(),
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
      name: 'citations',
      title: 'Source citations',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'sourceCitation'})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  orderings: [
    {title: 'Curriculum order', name: 'orderAsc', by: [{field: 'order', direction: 'asc'}]},
    {title: 'Title', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'title', order: 'order', section: 'section.title', minutes: 'estimatedMinutes'},
    prepare({title, order, section: sectionTitle, minutes}) {
      return {
        title: `${order ?? '?'}. ${title ?? 'Untitled lesson'}`,
        subtitle: `${sectionTitle ?? 'Unassigned'} · ${minutes ?? '?'} min`,
      }
    },
  },
})
