import {
  connectDatabase,
  disconnectDatabase,
} from '../src/config/database.js'
import { seedOperationalData } from '../src/jobs/seedOperationalData.js'

try {
  await connectDatabase()
  await seedOperationalData()
} catch (error) {
  console.error(`Không thể seed Supabase PostgreSQL: ${error.message}`)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}
