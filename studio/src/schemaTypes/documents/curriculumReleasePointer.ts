import {RocketIcon} from '@sanity/icons/Rocket'
import {defineField, defineType} from 'sanity'

export const CURRICULUM_RELEASE_POINTER_DOCUMENT_ID = 'curriculumReleasePointer.current'

export const curriculumReleasePointer = defineType({
  name: 'curriculumReleasePointer',
  title: 'Current curriculum release',
  type: 'document',
  icon: RocketIcon,
  fields: [
    defineField({
      name: 'release',
      title: 'Release',
      type: 'reference',
      weak: true,
      readOnly: true,
      to: [{type: 'contentRelease'}],
      description: 'Audit link to the private production release record.',
    }),
    defineField({
      name: 'schemaVersion',
      title: 'Schema version',
      type: 'number',
      readOnly: true,
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'catalogId',
      title: 'Catalog ID',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'moduleIds',
      title: 'Ordered module IDs',
      type: 'array',
      readOnly: true,
      of: [{type: 'string'}],
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'contentVersion',
      title: 'Content version',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'minimumAppVersion',
      title: 'Minimum app version',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bundleUrl',
      title: 'Bundle URL',
      type: 'url',
      readOnly: true,
      validation: (rule) => rule.required().uri({scheme: ['https']}),
    }),
    defineField({
      name: 'checksum',
      title: 'Bundle SHA-256',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required().regex(/^[a-f0-9]{64}$/, {name: 'SHA-256 digest'}),
    }),
    defineField({
      name: 'algorithm',
      title: 'Checksum algorithm',
      type: 'string',
      readOnly: true,
      initialValue: 'sha256',
      validation: (rule) =>
        rule.required().custom((value) => (value === 'sha256' ? true : 'Only SHA-256 is supported.')),
    }),
    defineField({
      name: 'byteLength',
      title: 'Bundle byte length',
      type: 'number',
      readOnly: true,
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Published at',
      type: 'datetime',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {version: 'contentVersion', createdAt: 'createdAt'},
    prepare({version, createdAt}) {
      return {
        title: `Current · ${version ?? 'unpublished'}`,
        subtitle: createdAt ? new Date(createdAt).toLocaleString() : 'No release published',
      }
    },
  },
})
