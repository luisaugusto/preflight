import {TransferIcon} from '@sanity/icons/Transfer'
import {defineArrayMember, defineField, defineType} from 'sanity'

type PairValue = {pairId?: string}

export const matchingAnswerSpec = defineType({
  name: 'matchingAnswerSpec',
  title: 'Matching answer',
  type: 'object',
  icon: TransferIcon,
  fields: [
    defineField({
      name: 'pairs',
      title: 'Correct pairs',
      type: 'array',
      of: [defineArrayMember({type: 'matchingPair'})],
      validation: (rule) =>
        rule
          .required()
          .min(2)
          .max(8)
          .custom((pairs: PairValue[] | undefined) => {
            if (!pairs) return true
            const ids = pairs.map((pair) => pair.pairId).filter(Boolean)
            return new Set(ids).size === ids.length || 'Pair IDs must be unique.'
          }),
    }),
    defineField({
      name: 'shuffleRightColumn',
      title: 'Shuffle right column',
      type: 'boolean',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {pairs: 'pairs'},
    prepare({pairs}) {
      return {title: `${Array.isArray(pairs) ? pairs.length : 0} matching pairs`}
    },
  },
})
