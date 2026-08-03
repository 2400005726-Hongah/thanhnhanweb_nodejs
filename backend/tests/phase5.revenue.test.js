import { jest } from '@jest/globals'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters'

const aggregate = jest.fn(async ({ where }) => {
  if (where.status === 'SUCCESS') {
    return { _sum: { amount: 900000 }, _count: 3 }
  }
  if (where.status === 'REFUNDED') {
    return { _sum: { amount: 300000 }, _count: 1 }
  }
  throw new Error(`Unexpected revenue status ${where.status}`)
})

jest.unstable_mockModule('../src/config/prisma.js', () => ({
  default: {
    payment: { aggregate },
  },
}))

const { getRevenueSummary } = await import('../src/services/admin.service.js')

beforeEach(() => jest.clearAllMocks())

describe('Phase 5 revenue ownership', () => {
  test('counts only SUCCESS Payments and reports REFUNDED separately', async () => {
    const result = await getRevenueSummary({})

    expect(result).toEqual({
      revenue: 900000,
      successfulPayments: 3,
      refundedAmount: 300000,
      refundedPayments: 1,
    })
    expect(aggregate).toHaveBeenNthCalledWith(1, {
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
      _count: true,
    })
    expect(aggregate).toHaveBeenNthCalledWith(2, {
      where: { status: 'REFUNDED' },
      _sum: { amount: true },
      _count: true,
    })
    expect(JSON.stringify(aggregate.mock.calls)).not.toContain('PENDING')
    expect(JSON.stringify(aggregate.mock.calls)).not.toContain('FAILED')
  })
})
