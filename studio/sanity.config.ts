import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'

import {schemaTypes} from './src/schemaTypes'
import {structure} from './src/structure'

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
  schema: {types: schemaTypes},
})
