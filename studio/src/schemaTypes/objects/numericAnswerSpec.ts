import {NumberIcon} from '@sanity/icons/Number'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const numericAnswerSpec = defineType({
  name: 'numericAnswerSpec',
  title: 'Numeric answer',
  type: 'object',
  icon: NumberIcon,
  fields: [
    defineField({
      name: 'value',
      title: 'Correct value',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tolerance',
      title: 'Accepted tolerance (±)',
      type: 'number',
      initialValue: 0,
      description: 'Absolute tolerance in the canonical unit.',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'unit',
      title: 'Canonical unit',
      type: 'string',
      description: 'For example, kt, lb, °F, or inHg.',
      validation: (rule) => rule.required().min(1).max(30),
    }),
    defineField({
      name: 'acceptedFormats',
      title: 'Accepted formats',
      type: 'array',
      description: 'Human-readable examples or unit aliases accepted by the answer parser.',
      of: [defineArrayMember({type: 'string'})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'decimalPlaces',
      title: 'Display decimal places',
      type: 'number',
      initialValue: 0,
      validation: (rule) => rule.required().integer().min(0).max(6),
    }),
  ],
  preview: {
    select: {value: 'value', tolerance: 'tolerance', unit: 'unit'},
    prepare({value, tolerance, unit}) {
      return {
        title: `${value ?? '?'} ${unit ?? ''}`.trim(),
        subtitle: `Accepted tolerance: ±${tolerance ?? 0}`,
      }
    },
  },
})
