import {BulbOutlineIcon} from '@sanity/icons/BulbOutline'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const lessonBlock = defineType({
  name: 'lessonBlock',
  title: 'Lesson block',
  type: 'object',
  icon: BulbOutlineIcon,
  fields: [
    defineField({
      name: 'blockType',
      title: 'Block type',
      type: 'string',
      options: {
        list: [
          {title: 'Concept', value: 'concept'},
          {title: 'Explanation', value: 'explanation'},
          {title: 'Worked example', value: 'workedExample'},
          {title: 'Practice', value: 'practice'},
          {title: 'Callout', value: 'callout'},
          {title: 'Summary', value: 'summary'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (rule) => rule.max(140),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'richText',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'figures',
      title: 'Figures',
      type: 'array',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'figure'}]})],
      validation: (rule) => rule.unique().max(4),
    }),
    defineField({
      name: 'practiceQuestion',
      title: 'Practice question',
      type: 'reference',
      weak: true,
      to: [{type: 'question'}],
      description: 'Optional inline check. Use a non-scored question.',
      hidden: ({parent}) => parent?.blockType !== 'practice',
    }),
    defineField({
      name: 'citations',
      title: 'Source citations',
      type: 'array',
      of: [defineArrayMember({type: 'sourceCitation'})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'heading', blockType: 'blockType', media: 'figures.0.image'},
    prepare({title, blockType, media}) {
      return {title: title ?? 'Untitled block', subtitle: blockType, media}
    },
  },
})
