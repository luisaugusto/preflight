import {ListIcon} from '@sanity/icons/List'
import {defineArrayMember, defineField, defineType} from 'sanity'

type AnswerOptionValue = {
  optionId?: string
}

type MultipleChoiceSpecValue = {
  options?: AnswerOptionValue[]
  correctOptionId?: string
}

export const multipleChoiceAnswerSpec = defineType({
  name: 'multipleChoiceAnswerSpec',
  title: 'Multiple-choice answer',
  type: 'object',
  icon: ListIcon,
  fields: [
    defineField({
      name: 'options',
      title: 'Answer options',
      type: 'array',
      of: [defineArrayMember({type: 'answerOption'})],
      validation: (rule) =>
        rule
          .required()
          .min(2)
          .max(6)
          .unique()
          .custom((options: AnswerOptionValue[] | undefined) => {
            if (!options) return true
            const ids = options.map((option) => option.optionId).filter(Boolean)
            return new Set(ids).size === ids.length || 'Option IDs must be unique.'
          }),
    }),
    defineField({
      name: 'correctOptionId',
      title: 'Correct option ID',
      type: 'string',
      description: 'Must exactly match one answer option ID.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'shuffleOptions',
      title: 'Shuffle options',
      type: 'boolean',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
  ],
  validation: (rule) =>
    rule.custom((value: MultipleChoiceSpecValue | undefined) => {
      if (!value?.correctOptionId || !value.options?.length) return true
      return (
        value.options.some((option) => option.optionId === value.correctOptionId) ||
        'Correct option ID must match one of the answer options.'
      )
    }),
  preview: {
    select: {correctOptionId: 'correctOptionId', options: 'options'},
    prepare({correctOptionId, options}) {
      return {
        title: `${Array.isArray(options) ? options.length : 0} answer options`,
        subtitle: correctOptionId ? `Correct: ${correctOptionId}` : 'Correct option not set',
      }
    },
  },
})
