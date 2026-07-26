import {BookIcon} from '@sanity/icons/Book'
import {defineArrayMember, defineField, defineType} from 'sanity'

import {lifecycleField} from '../shared/curriculum'

export const CURRICULUM_CATALOG_DOCUMENT_ID = 'curriculumCatalog.current'

export const curriculumCatalog = defineType({
  name: 'curriculumCatalog',
  title: 'Curriculum catalog',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      readOnly: true,
      initialValue: 'preflight-faa-curriculum',
      validation: (rule) =>
        rule
          .required()
          .custom((value) =>
            value === 'preflight-faa-curriculum'
              ? true
              : 'The catalog stable ID is fixed because installed apps rely on it.',
          ),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      initialValue: 'Preflight FAA curriculum',
      validation: (rule) => rule.required().min(3).max(140),
    }),
    defineField({
      name: 'modules',
      title: 'Ordered modules',
      description: 'This is the authoritative module order. Reorder references here; do not duplicate a module.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'module'}],
          options: {disableNew: true},
        }),
      ],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'minimumAppVersion',
      title: 'Minimum compatible app version',
      type: 'string',
      initialValue: '1.0.0',
      description:
        'Raise this only when the exported content requires app behavior that older installations do not support.',
      validation: (rule) =>
        rule.required().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, {
          name: 'semantic version',
        }),
    }),
    lifecycleField,
  ],
  preview: {
    select: {title: 'title', lifecycle: 'lifecycle'},
    prepare({title, lifecycle}) {
      return {title, subtitle: `${lifecycle ?? 'active'} · authoritative ordering`}
    },
  },
})
