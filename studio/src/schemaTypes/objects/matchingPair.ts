import {TransferIcon} from '@sanity/icons/Transfer'
import {defineField, defineType} from 'sanity'

type MatchSide = {
  label?: string
  figure?: unknown
}

type MatchingPairValue = {
  left?: MatchSide
  right?: MatchSide
}

const matchSide = (name: 'left' | 'right', title: string) =>
  defineField({
    name,
    title,
    type: 'object',
    fields: [
      defineField({name: 'label', title: 'Label', type: 'string', validation: (rule) => rule.max(500)}),
      defineField({
        name: 'figure',
        title: 'Optional figure',
        type: 'reference',
        weak: true,
        to: [{type: 'figure'}],
      }),
    ],
    validation: (rule) =>
      rule.required().custom((value: MatchSide | undefined) => {
        return Boolean(value?.label?.trim() || value?.figure) || 'Add a label or figure.'
      }),
  })

export const matchingPair = defineType({
  name: 'matchingPair',
  title: 'Matching pair',
  type: 'object',
  icon: TransferIcon,
  fields: [
    defineField({
      name: 'pairId',
      title: 'Pair ID',
      type: 'string',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    matchSide('left', 'Left item'),
    matchSide('right', 'Right item'),
  ],
  validation: (rule) => rule.custom((_value: MatchingPairValue | undefined) => true),
  preview: {
    select: {left: 'left.label', right: 'right.label', media: 'left.figure.image'},
    prepare({left, right, media}) {
      return {title: left ?? 'Image item', subtitle: `Matches ${right ?? 'image item'}`, media}
    },
  },
})
