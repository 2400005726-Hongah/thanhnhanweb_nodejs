import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

import { getPrismaCliDatabaseUrl } from './src/config/databaseConnection.js'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: getPrismaCliDatabaseUrl(env('DATABASE_URL')),
  },
})
