import {CheckmarkCircleIcon} from '@sanity/icons/CheckmarkCircle'
import {defineField, defineType} from 'sanity'

export const answerOption = defineType({
  name: 'answerOption',
  title: 'Answer option',
  type: 'object',
  icon: CheckmarkCircleIcon,
  fields: [
    defineField({
      name: 'optionId',
      title: 'Option ID',
      type: 'string',
      description: 'Stable, machine-readable ID such as lift-increases.',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
          name: 'kebab-case ID',
        }),
    }),
    defineField({
      name: 'text',
      title: 'Option text',
      type: 'string',
      validation: (rule) => rule.required().min(1).max(500),
    }),
    defineField({
      name: 'figure',
      title: 'Optional figure',
      type: 'reference',
      weak: true,
      to: [{type: 'figure'}],
      description: 'Use only when the answer choice requires an image.',
    }),
    defineField({
      name: 'feedback',
      title: 'Option-specific feedback',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(1000),
    }),
  ],
  preview: {
    select: {title: 'text', subtitle: 'optionId', media: 'figure.image'},
  },
})
