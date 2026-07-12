import {ImageIcon} from '@sanity/icons/Image'
import {defineField, defineType} from 'sanity'

export const imageQuestionSpec = defineType({
  name: 'imageQuestionSpec',
  title: 'Image question answer',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'stimulusFigure',
      title: 'Stimulus figure',
      type: 'reference',
      weak: true,
      to: [{type: 'figure'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'instruction',
      title: 'Image instruction',
      type: 'string',
      description: 'For example, “Use the loading graph to answer.”',
      validation: (rule) => rule.required().min(3).max(500),
    }),
    defineField({
      name: 'answer',
      title: 'Answer choices',
      type: 'multipleChoiceAnswerSpec',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'instruction', media: 'stimulusFigure.image'},
  },
})
