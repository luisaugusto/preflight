import {TagIcon} from '@sanity/icons/Tag'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const glossaryTerm = defineType({
  name: 'glossaryTerm',
  title: 'Glossary term',
  type: 'document',
  icon: TagIcon,
  groups: [
    {name: 'definition', title: 'Definition', default: true},
    {name: 'alignment', title: 'Alignment'},
    {name: 'sources', title: 'Sources'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'definition',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'term',
      title: 'Term',
      type: 'string',
      group: 'definition',
      validation: (rule) => rule.required().min(1).max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'definition',
      options: {source: 'term', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'pronunciation',
      title: 'Pronunciation',
      type: 'string',
      group: 'definition',
      validation: (rule) => rule.max(160),
    }),
    defineField({
      name: 'shortDefinition',
      title: 'Short definition',
      type: 'text',
      rows: 2,
      group: 'definition',
      description: 'Concise review-card definition.',
      validation: (rule) => rule.required().min(3).max(300),
    }),
    defineField({
      name: 'definition',
      title: 'Full definition',
      type: 'richText',
      group: 'definition',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'figures',
      title: 'Supporting figures',
      type: 'array',
      group: 'definition',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'figure'}]})],
      validation: (rule) => rule.unique().max(4),
    }),
    defineField({
      name: 'sections',
      title: 'Related sections',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'section'}]})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'relatedTerms',
      title: 'Related terms',
      type: 'array',
      group: 'alignment',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'glossaryTerm'}]})],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: 'acsCodes',
      title: 'ACS alignment',
      type: 'array',
      group: 'alignment',
      of: [
        defineArrayMember({
          type: 'reference',
          weak: true,
          to: [{type: 'acsCode'}],
          options: {disableNew: true},
        }),
      ],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'citations',
      title: 'Source citations',
      type: 'array',
      group: 'sources',
      of: [defineArrayMember({type: 'sourceCitation'})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  orderings: [
    {title: 'Term A–Z', name: 'termAsc', by: [{field: 'term', direction: 'asc'}]},
    {title: 'Recently updated', name: 'updatedDesc', by: [{field: '_updatedAt', direction: 'desc'}]},
  ],
  preview: {
    select: {title: 'term', subtitle: 'shortDefinition', media: 'figures.0.image'},
  },
})
