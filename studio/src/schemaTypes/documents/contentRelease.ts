import {RocketIcon} from '@sanity/icons/Rocket'
import {defineArrayMember, defineField, defineType} from 'sanity'

type ContentReleaseValue = {
  status?: 'draft' | 'ready' | 'published' | 'retired'
  publishedAt?: string
  bundleUrl?: string
  bundleSha256?: string
}

export const contentRelease = defineType({
  name: 'contentRelease',
  title: 'Content release',
  type: 'document',
  icon: RocketIcon,
  groups: [
    {name: 'release', title: 'Release', default: true},
    {name: 'bundle', title: 'Bundle'},
  ],
  fields: [
    defineField({
      name: 'stableId',
      title: 'Stable ID',
      type: 'string',
      group: 'release',
      description: 'Immutable release ID, for example content-1-0-0.',
      validation: (rule) =>
        rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {name: 'kebab-case ID'}),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'release',
      validation: (rule) => rule.required().min(3).max(140),
    }),
    defineField({
      name: 'version',
      title: 'Release version',
      type: 'string',
      group: 'release',
      validation: (rule) =>
        rule.required().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, {name: 'semantic version'}),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'release',
      initialValue: 'draft',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'Ready', value: 'ready'},
          {title: 'Published', value: 'published'},
          {title: 'Retired', value: 'retired'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'modules',
      title: 'Included modules',
      type: 'array',
      group: 'release',
      of: [defineArrayMember({type: 'reference', weak: true, to: [{type: 'module'}]})],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'releaseNotes',
      title: 'Release notes',
      type: 'richText',
      group: 'release',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'release',
      hidden: ({document}) => document?.status !== 'published',
    }),
    defineField({
      name: 'schemaVersion',
      title: 'Bundle schema version',
      type: 'number',
      group: 'bundle',
      initialValue: 1,
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'minimumAppVersion',
      title: 'Minimum app version',
      type: 'string',
      group: 'bundle',
      validation: (rule) =>
        rule.required().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, {name: 'semantic version'}),
    }),
    defineField({
      name: 'bundleUrl',
      title: 'Bundle URL',
      type: 'url',
      group: 'bundle',
      validation: (rule) => rule.uri({scheme: ['https']}),
    }),
    defineField({
      name: 'bundleSha256',
      title: 'Bundle SHA-256',
      type: 'string',
      group: 'bundle',
      description: 'Lowercase 64-character hexadecimal digest.',
      validation: (rule) => rule.regex(/^[a-f0-9]{64}$/, {name: 'SHA-256 digest'}),
    }),
    defineField({
      name: 'assetManifestUrl',
      title: 'Asset manifest URL',
      type: 'url',
      group: 'bundle',
      validation: (rule) => rule.uri({scheme: ['https']}),
    }),
  ],
  validation: (rule) =>
    rule.custom((rawValue) => {
      const value = rawValue as ContentReleaseValue | undefined
      if (!value) return true
      if (value.status === 'published' && !value.publishedAt) {
        return 'Published releases require a publication date.'
      }
      if (['ready', 'published'].includes(value.status ?? '')) {
        if (!value.bundleUrl || !value.bundleSha256) {
          return 'Ready and published releases require a bundle URL and SHA-256 digest.'
        }
      }
      return true
    }),
  orderings: [
    {title: 'Newest published', name: 'publishedDesc', by: [{field: 'publishedAt', direction: 'desc'}]},
    {title: 'Version', name: 'versionDesc', by: [{field: 'version', direction: 'desc'}]},
  ],
  preview: {
    select: {title: 'title', version: 'version', status: 'status', publishedAt: 'publishedAt'},
    prepare({title, version, status, publishedAt}) {
      return {
        title: `${title ?? 'Untitled release'} · v${version ?? '?'}`,
        subtitle: `${status ?? 'draft'}${publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString()}` : ''}`,
      }
    },
  },
})
