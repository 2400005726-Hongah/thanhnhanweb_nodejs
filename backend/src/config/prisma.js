import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.ts'
import env from './env.js'

const adapter = new PrismaPg({ connectionString: env.databaseUrl })
const prisma = new PrismaClient({ adapter })

export default prisma
