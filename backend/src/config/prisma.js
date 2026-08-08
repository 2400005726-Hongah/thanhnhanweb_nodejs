import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.ts'
import { getPrismaPgAdapterOptions } from './databaseConnection.js'
import env from './env.js'

const adapter = new PrismaPg(getPrismaPgAdapterOptions(env.databaseUrl))
const prisma = new PrismaClient({ adapter })

export default prisma
