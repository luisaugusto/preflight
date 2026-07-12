import {LinkIcon} from '@sanity/icons/Link'
import {defineField, defineType} from 'sanity'

export const sourceCitation = defineType({
  name: 'sourceCitation',
  title: 'Source citation',
  type: 'object',
  icon: LinkIcon,
  fields: [
    defineField({
      name: 'publication',
      title: 'Publication',
      type: 'string',
      description: 'For example, Pilot’s Handbook of Aeronautical Knowledge.',
      validation: (rule) => rule.required().min(3),
    }),
    defineField({
      name: 'documentCode',
      title: 'Document code / edition',
      type: 'string',
      description: 'For example, FAA-H-8083-25C.',
      validation: (rule) => rule.required().min(3),
    }),
    defineField({
      name: 'url',
      title: 'Official source URL',
      type: 'url',
      validation: (rule) =>
        rule.required().uri({
          scheme: ['https'],
          allowRelative: false,
        }),
    }),
    defineField({
      name: 'chapterNumber',
      title: 'Chapter number',
      type: 'number',
      validation: (rule) => rule.integer().positive(),
    }),
    defineField({
      name: 'chapterTitle',
      title: 'Chapter title',
      type: 'string',
    }),
    defineField({
      name: 'pageNumber',
      title: 'PDF page number',
      type: 'number',
      description: 'One-based page number in the source PDF.',
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'pageLabel',
      title: 'Printed page label',
      type: 'string',
      description: 'Optional printed page label, such as 5-12.',
    }),
    defineField({
      name: 'figureNumber',
      title: 'Figure number',
      type: 'string',
      description: 'Include only when the citation points to a figure.',
    }),
    defineField({
      name: 'note',
      title: 'Editorial note',
      type: 'text',
      rows: 2,
      description: 'Optional note describing exactly what this citation supports.',
      validation: (rule) => rule.max(500),
    }),
  ],
  preview: {
    select: {
      publication: 'publication',
      documentCode: 'documentCode',
      pageLabel: 'pageLabel',
      pageNumber: 'pageNumber',
      figureNumber: 'figureNumber',
    },
    prepare({publication, documentCode, pageLabel, pageNumber, figureNumber}) {
      const locator = figureNumber
        ? `Figure ${figureNumber}`
        : pageLabel
          ? `p. ${pageLabel}`
          : pageNumber
            ? `PDF p. ${pageNumber}`
            : 'Unlocated'

      return {
        title: `${documentCode ?? publication ?? 'Source'} · ${locator}`,
        subtitle: publication,
      }
    },
  },
})
