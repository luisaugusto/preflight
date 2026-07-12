import {ImageIcon} from '@sanity/icons/Image'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const figure = defineType({
  name: 'figure',
  title: 'Figure',
  type: 'document',
  icon: ImageIcon,
  groups: [
    {name: 'asset', title: 'Asset', default: true},
    {name: 'placement', title: 'Placement'},
    {name: 'source', title: 'Source'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'asset',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'title',
      title: 'Internal title',
      type: 'string',
      group: 'asset',
      validation: (rule) => rule.required().min(3).max(160),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      group: 'asset',
      options: {
        hotspot: true,
        metadata: ['blurhash', 'lqip', 'palette'],
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          description: 'Describe the information conveyed by the figure.',
          validation: (rule) => rule.required().min(10).max(500),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'caption',
      title: 'Learner-facing caption',
      type: 'text',
      rows: 3,
      group: 'asset',
      validation: (rule) => rule.required().min(3).max(1000),
    }),
    defineField({
      name: 'figureNumber',
      title: 'Source figure number',
      type: 'string',
      group: 'source',
      description: 'For example, 5-12. Leave blank for a page crop without a figure number.',
    }),
    defineField({
      name: 'extractionMethod',
      title: 'Extraction method',
      type: 'string',
      group: 'source',
      options: {
        list: [
          {title: 'Embedded PDF image', value: 'embeddedImage'},
          {title: 'Rendered page crop', value: 'pageCrop'},
          {title: 'Editorially recreated', value: 'recreated'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'originalFilename',
      title: 'Original filename',
      type: 'string',
      group: 'source',
      description: 'Filename produced by the extraction pipeline for traceability.',
    }),
    defineField({
      name: 'citation',
      title: 'Source citation',
      type: 'sourceCitation',
      group: 'source',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sections',
      title: 'Related sections',
      type: 'array',
      group: 'placement',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'section'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'acsCodes',
      title: 'ACS alignment',
      type: 'array',
      group: 'placement',
      of: [
        defineArrayMember({
          type: 'reference',
          weak: true,
          to: [{type: 'acsCode'}],
          options: {disableNew: true},
        }),
      ],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      group: 'placement',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      validation: (rule) => rule.unique(),
    }),
  ],
  orderings: [
    {title: 'Figure number', name: 'figureNumberAsc', by: [{field: 'figureNumber', direction: 'asc'}]},
    {title: 'Title', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'title', figureNumber: 'figureNumber', caption: 'caption', media: 'image'},
    prepare({title, figureNumber, caption, media}) {
      return {
        title: figureNumber ? `Figure ${figureNumber} · ${title}` : title,
        subtitle: caption,
        media,
      }
    },
  },
})
