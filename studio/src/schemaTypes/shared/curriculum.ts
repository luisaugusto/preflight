import {defineField} from 'sanity'

export const CURRICULUM_DOCUMENT_TYPES = [
  'curriculumCatalog',
  'module',
  'section',
  'lesson',
  'question',
  'glossaryTerm',
  'figure',
] as const

export const RELEASE_DOCUMENT_TYPES = ['contentRelease', 'curriculumReleasePointer'] as const

export const lifecycleField = defineField({
  name: 'lifecycle',
  title: 'Lifecycle',
  type: 'string',
  description: 'Retire content instead of deleting it so existing learner history keeps its stable ID.',
  initialValue: 'active',
  options: {
    list: [
      {title: 'Active', value: 'active'},
      {title: 'Retired', value: 'retired'},
    ],
    layout: 'radio',
  },
  validation: (rule) => rule.required(),
})

export function isProtectedContentType(schemaType: string): boolean {
  return [...CURRICULUM_DOCUMENT_TYPES, ...RELEASE_DOCUMENT_TYPES].includes(
    schemaType as (typeof CURRICULUM_DOCUMENT_TYPES)[number],
  )
}
