import { pathToFileURL } from 'node:url'

import { connectDatabase, disconnectDatabase } from '../config/database.js'
import env from '../config/env.js'
import prisma from '../config/prisma.js'
import {
  isVietnamesePhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from '../utils/normalize.js'
import { hashPassword } from '../utils/password.js'

const validateAdminEnv = () => {
  const values = {
    ADMIN_FULL_NAME: env.adminFullName,
    ADMIN_EMAIL: env.adminEmail,
    ADMIN_PHONE: env.adminPhone,
    ADMIN_PASSWORD: env.adminPassword,
  }
  const missingVariables = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missingVariables.length > 0) {
    throw new Error(
      `Thiếu biến môi trường seed admin: ${missingVariables.join(', ')}`,
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(env.adminEmail))) {
    throw new Error('ADMIN_EMAIL không hợp lệ')
  }
  if (!isVietnamesePhone(env.adminPhone)) {
    throw new Error('ADMIN_PHONE không hợp lệ')
  }
  if (
    env.adminPassword.length < 8 ||
    !/[A-Za-z]/.test(env.adminPassword) ||
    !/[0-9]/.test(env.adminPassword)
  ) {
    throw new Error(
      'ADMIN_PASSWORD phải có ít nhất 8 ký tự, một chữ cái và một chữ số',
    )
  }
}

const seedAdmin = async () => {
  validateAdminEnv()
  const email = normalizeEmail(env.adminEmail)
  const phone = normalizePhone(env.adminPhone)
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  })

  if (existingUser) {
    if (existingUser.role === 'ADMIN') {
      console.log('Tài khoản admin đã tồn tại, không tạo trùng')
      return existingUser
    }
    throw new Error('Email hoặc số điện thoại đã thuộc tài khoản khác')
  }

  const admin = await prisma.user.create({
    data: {
      fullName: normalizeFullName(env.adminFullName),
      email,
      phone,
      passwordHash: await hashPassword(env.adminPassword),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  console.log('Đã tạo tài khoản admin thành công')
  return admin
}

const run = async () => {
  try {
    await connectDatabase()
    await seedAdmin()
  } catch (error) {
    console.error(`Không thể seed admin: ${error.message}`)
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
}

export { seedAdmin, validateAdminEnv }
