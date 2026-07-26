import {FeedbackIcon} from '@sanity/icons/Feedback'
import {defineArrayMember, defineField, defineType} from 'sanity'

type ContentReportValue = {
  status?: 'new' | 'inProgress' | 'resolved' | 'wontFix'
  resolutionNotes?: string
}

const statusOptions = [
  {title: 'New', value: 'new'},
  {title: 'In progress', value: 'inProgress'},
  {title: 'Resolved', value: 'resolved'},
  {title: 'Won’t fix', value: 'wontFix'},
]

const relatedDocumentTypes = [
  {type: 'module'},
  {type: 'section'},
  {type: 'lesson'},
  {type: 'question'},
  {type: 'figure'},
  {type: 'glossaryTerm'},
  {type: 'acsCode'},
]

export const contentReport = defineType({
  name: 'contentReport',
  title: 'Content report',
  type: 'document',
  icon: FeedbackIcon,
  initialValue: {
    status: 'new',
  },
  groups: [
    {name: 'report', title: 'Report', default: true},
    {name: 'context', title: 'Reported content'},
    {name: 'resolution', title: 'Resolution'},
  ],
  fields: [
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'report',
      initialValue: 'new',
      options: {list: statusOptions, layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'details',
      title: 'Details from learner',
      type: 'text',
      rows: 8,
      group: 'report',
      description: 'Anonymous text submitted from the app. Do not publish this document.',
      validation: (rule) => rule.required().min(1).max(2000),
    }),
    defineField({
      name: 'reportedContent',
      title: 'Reported lesson or question',
      type: 'reference',
      weak: true,
      to: [{type: 'lesson'}, {type: 'question'}],
      group: 'context',
      description:
        'Resolved automatically from the stable ID. It may be empty for content removed after an older app release.',
    }),
    defineField({
      name: 'contentType',
      title: 'Content type',
      type: 'string',
      group: 'context',
      options: {
        list: [
          {title: 'Lesson', value: 'lesson'},
          {title: 'Question', value: 'question'},
        ],
      },
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'contentStableId',
      title: 'Content stable ID',
      type: 'string',
      group: 'context',
      readOnly: true,
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: 'contentPart',
      title: 'Reported part',
      type: 'string',
      group: 'context',
      readOnly: true,
      options: {
        list: [
          {title: 'Question', value: 'question'},
          {title: 'Concept and explanation', value: 'concept'},
          {title: 'Worked example', value: 'workedExample'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'contentSnapshot',
      title: 'Content shown when reported',
      type: 'text',
      rows: 8,
      group: 'context',
      readOnly: true,
      description: 'A bounded snapshot retained in case the connected content changes later.',
      validation: (rule) => rule.required().max(8000),
    }),
    defineField({
      name: 'sourceLabel',
      title: 'Source shown in app',
      type: 'string',
      group: 'context',
      readOnly: true,
      validation: (rule) => rule.required().max(300),
    }),
    defineField({
      name: 'appVersion',
      title: 'App version',
      type: 'string',
      group: 'context',
      readOnly: true,
      validation: (rule) => rule.required().max(40),
    }),
    defineField({
      name: 'platform',
      title: 'Platform',
      type: 'string',
      group: 'context',
      readOnly: true,
      options: {
        list: [
          {title: 'iOS', value: 'ios'},
          {title: 'Android', value: 'android'},
          {title: 'Web', value: 'web'},
          {title: 'Unknown', value: 'unknown'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'relatedContent',
      title: 'Additional related content',
      type: 'array',
      group: 'resolution',
      of: [
        defineArrayMember({
          type: 'reference',
          weak: true,
          to: relatedDocumentTypes,
        }),
      ],
      description: 'Attach any other curriculum documents involved in the report or its fix.',
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'resolutionNotes',
      title: 'Resolution notes',
      type: 'text',
      rows: 5,
      group: 'resolution',
      hidden: ({document}) => !['resolved', 'wontFix'].includes(String(document?.status)),
      description: 'Record what changed or why the report will not be addressed.',
      validation: (rule) => rule.max(2000),
    }),
  ],
  validation: (rule) =>
    rule.custom((rawValue) => {
      const value = rawValue as ContentReportValue | undefined
      const closed = value?.status === 'resolved' || value?.status === 'wontFix'
      return !closed || value.resolutionNotes?.trim()
        ? true
        : 'Resolution notes are required when closing a report.'
    }),
  orderings: [
    {title: 'Newest first', name: 'createdDesc', by: [{field: '_createdAt', direction: 'desc'}]},
    {title: 'Oldest first', name: 'createdAsc', by: [{field: '_createdAt', direction: 'asc'}]},
    {title: 'Status', name: 'statusAsc', by: [{field: 'status', direction: 'asc'}]},
  ],
  preview: {
    select: {
      contentStableId: 'contentStableId',
      contentType: 'contentType',
      status: 'status',
      details: 'details',
    },
    prepare({contentStableId, contentType, status, details}) {
      const statusTitle =
        statusOptions.find((option) => option.value === status)?.title ?? 'Unknown status'
      return {
        title: `${contentType === 'question' ? 'Question' : 'Lesson'} · ${contentStableId ?? 'Unknown ID'}`,
        subtitle: `${statusTitle} · ${String(details ?? '').replace(/\s+/g, ' ').slice(0, 90)}`,
      }
    },
  },
})
