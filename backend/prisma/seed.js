import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { seedAdmin } from '../src/jobs/seedAdmin.js'
import { seedData } from '../src/jobs/seedData.js'

try {
  await connectDatabase()
  await seedAdmin()
  await seedData()
} catch (error) {
  console.error(`Không thể seed Supabase PostgreSQL: ${error.message}`)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
