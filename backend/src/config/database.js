import env from './env.js'
import prisma from './prisma.js'

const connectDatabase = async () => {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL chưa được cấu hình')
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('Đã kết nối Supabase PostgreSQL')
    return prisma
  } catch (error) {
    console.error(
      'Không thể kết nối Supabase PostgreSQL. Hãy kiểm tra DATABASE_URL và trạng thái Supabase.',
    )
    throw error
  }
}

const disconnectDatabase = async () => {
  await prisma.$disconnect()
}

export { connectDatabase, disconnectDatabase }
