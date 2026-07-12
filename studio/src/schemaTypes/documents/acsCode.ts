import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineField, defineType} from 'sanity'

export const acsCode = defineType({
  name: 'acsCode',
  title: 'ACS code',
  type: 'document',
  icon: EarthGlobeIcon,
  groups: [
    {name: 'code', title: 'Code', default: true},
    {name: 'source', title: 'Source'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'code',
      description: 'Lowercase app-facing form of the ACS code.',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'code',
      title: 'ACS element code',
      type: 'string',
      group: 'code',
      description: 'For example, PA.I.A.K1.',
      validation: (rule) =>
        rule.required().regex(/^[A-Z]{2}\.[IVXLCDM]+\.[A-Z]+\.(?:K|R|S)\d+[a-z]?$/, {
          name: 'Private Pilot ACS element code',
        }),
    }),
    defineField({
      name: 'elementType',
      title: 'Element type',
      type: 'string',
      group: 'code',
      options: {
        list: [
          {title: 'Knowledge', value: 'knowledge'},
          {title: 'Risk management', value: 'riskManagement'},
          {title: 'Skill', value: 'skill'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Element description',
      type: 'text',
      rows: 4,
      group: 'code',
      validation: (rule) => rule.required().min(3),
    }),
    defineField({
      name: 'areaCode',
      title: 'Area code',
      type: 'string',
      group: 'code',
      description: 'Roman numeral, such as I.',
      validation: (rule) => rule.required().uppercase().regex(/^[IVXLCDM]+$/, {name: 'Roman numeral'}),
    }),
    defineField({
      name: 'areaTitle',
      title: 'Area title',
      type: 'string',
      group: 'code',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'taskCode',
      title: 'Task code',
      type: 'string',
      group: 'code',
      validation: (rule) => rule.required().uppercase().regex(/^[A-Z]+$/, {name: 'uppercase task code'}),
    }),
    defineField({
      name: 'taskTitle',
      title: 'Task title',
      type: 'string',
      group: 'code',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'acsVersion',
      title: 'ACS version',
      type: 'string',
      group: 'source',
      description: 'For example, FAA-S-ACS-6C.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'citation',
      title: 'Source citation',
      type: 'sourceCitation',
      group: 'source',
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [
    {title: 'ACS code', name: 'codeAsc', by: [{field: 'code', direction: 'asc'}]},
    {title: 'Area and task', name: 'areaTaskAsc', by: [
      {field: 'areaCode', direction: 'asc'},
      {field: 'taskCode', direction: 'asc'},
      {field: 'code', direction: 'asc'},
    ]},
  ],
  preview: {
    select: {title: 'code', description: 'description', taskTitle: 'taskTitle'},
    prepare({title, description, taskTitle}) {
      return {title, subtitle: `${taskTitle ?? 'Untitled task'} · ${description ?? ''}`}
    },
  },
})
