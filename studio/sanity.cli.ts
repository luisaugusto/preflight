import {defineCliConfig} from 'sanity/cli'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? '4qoowg94'
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

export default defineCliConfig({
  api: {projectId, dataset},
  deployment: {
    appId: 'mizks1va7idui39p6rwct8w6',
  },
  schemaExtraction: {
    enabled: true,
    path: './schema.json',
    enforceRequiredFields: true,
  },
  typegen: {
    enabled: true,
    path: './src/**/*.{ts,tsx}',
    schema: './schema.json',
    generates: './sanity.types.ts',
    overloadClientMethods: true,
  },
})
