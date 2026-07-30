import { randomUUID } from 'node:crypto'

import {
  VIOLATION_STATUSES,
  buildViolationSummary,
  findOrCreateBookableCustomer,
  getCustomerViolationSummary,
} from '../src/services/customer.service.js'

const customers = []
const bookings = []

const database = {
  customer: {
    upsert: async ({ where, create, update }) => {
      let customer = customers.find((item) => item.phone === where.phone)
      if (customer) {
        Object.assign(customer, update)
      } else {
        customer = {
          id: randomUUID(),
          status: 'ACTIVE',
          ...create,
        }
        customers.push(customer)
      }
      return { ...customer }
    },
  },
  booking: {
    count: async ({ where }) =>
      bookings.filter(
        (booking) =>
          booking.customerId === where.customerId &&
          where.status.in.includes(booking.status),
      ).length,
  },
}

const passenger = {
  fullName: '  Nguyễn   Văn A  ',
  phone: '+84987654321',
  email: ' A@EXAMPLE.COM ',
}

beforeEach(() => {
  customers.length = 0
  bookings.length = 0
})

describe('Customer profile and violation service', () => {
  test('creates one normalized Customer and reuses it for 0/+84 phone formats', async () => {
    const first = await findOrCreateBookableCustomer(database, passenger)
    const second = await findOrCreateBookableCustomer(database, {
      ...passenger,
      phone: '0987654321',
      email: 'new@example.com',
    })

    expect(customers).toHaveLength(1)
    expect(first.customer.id).toBe(second.customer.id)
    expect(second.customer).toMatchObject({
      fullName: 'Nguyễn Văn A',
      phone: '0987654321',
      email: 'new@example.com',
    })
  })

  test('counts CANCELLED and NO_SHOW but excludes DELETED', async () => {
    const customerId = randomUUID()
    bookings.push(
      { customerId, status: 'CANCELLED' },
      { customerId, status: 'NO_SHOW' },
      { customerId, status: 'DELETED' },
      { customerId, status: 'CONFIRMED' },
    )

    const summary = await getCustomerViolationSummary(database, customerId)

    expect(VIOLATION_STATUSES).toEqual(['CANCELLED', 'NO_SHOW'])
    expect(summary).toEqual({
      count: 2,
      warning: true,
      blocked: false,
      level: 'WARNING',
    })
  })

  test('warns at two violations and blocks from three violations', () => {
    expect(buildViolationSummary(1).level).toBe('NORMAL')
    expect(buildViolationSummary(2).level).toBe('WARNING')
    expect(buildViolationSummary(3).level).toBe('BLOCKED')
  })

  test('rejects a Customer with three violations', async () => {
    const customer = await findOrCreateBookableCustomer(database, passenger)
    bookings.push(
      { customerId: customer.customer.id, status: 'CANCELLED' },
      { customerId: customer.customer.id, status: 'NO_SHOW' },
      { customerId: customer.customer.id, status: 'CANCELLED' },
    )

    await expect(
      findOrCreateBookableCustomer(database, passenger),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})
