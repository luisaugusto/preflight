import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'

import {schemaTypes} from './src/schemaTypes'
import {structure} from './src/structure'
import {isProtectedContentType} from './src/schemaTypes/shared/curriculum'
import {CURRICULUM_CATALOG_DOCUMENT_ID} from './src/schemaTypes/documents/curriculumCatalog'
import {CURRICULUM_RELEASE_POINTER_DOCUMENT_ID} from './src/schemaTypes/documents/curriculumReleasePointer'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? '4qoowg94'
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

export default defineConfig({
  name: 'preflight',
  title: 'Preflight Content Studio',
  projectId,
  dataset,
  plugins: [
    structureTool({
      name: 'content',
      title: 'Content',
      structure,
    }),
    visionTool({defaultApiVersion: '2026-07-12'}),
  ],
  document: {
    actions: (previousActions, context) => {
      if (context.schemaType === 'contentReport') {
        return previousActions.filter((action) => action.action !== 'publish' && action.action !== 'unpublish')
      }
      if (context.schemaType === 'curriculumReleasePointer') return []
      if (isProtectedContentType(context.schemaType)) {
        return previousActions.filter((action) => action.action !== 'delete' && action.action !== 'unpublish')
      }
      return previousActions
    },
    newDocumentOptions: (previousOptions, context) => {
      if (context.creationContext.type === 'global') {
        return previousOptions.filter(
          (option) =>
            option.templateId !== 'contentReport' &&
            option.templateId !== 'curriculumCatalog' &&
            option.templateId !== 'curriculumReleasePointer',
        )
      }
      return previousOptions
    },
  },
  schema: {
    types: schemaTypes,
    templates: (previousTemplates) => [
      ...previousTemplates.filter(
        (template) =>
          template.schemaType !== 'curriculumCatalog' &&
          template.schemaType !== 'curriculumReleasePointer',
      ),
      {
        id: 'curriculumCatalog',
        title: 'Curriculum catalog',
        schemaType: 'curriculumCatalog',
        value: {
          _id: CURRICULUM_CATALOG_DOCUMENT_ID,
          stableId: 'preflight-faa-curriculum',
          title: 'Preflight FAA curriculum',
          lifecycle: 'active',
          minimumAppVersion: '1.0.0',
        },
      },
      {
        id: 'curriculumReleasePointer',
        title: 'Current curriculum release',
        schemaType: 'curriculumReleasePointer',
        value: {_id: CURRICULUM_RELEASE_POINTER_DOCUMENT_ID},
      },
    ],
  },
})
