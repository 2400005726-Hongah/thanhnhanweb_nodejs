import { access, readFile } from 'node:fs/promises'

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url)
const generatedClientPath = new URL(
  '../src/generated/prisma/client.ts',
  import.meta.url,
)
const schema = await readFile(schemaPath, 'utf8')

describe('Prisma PostgreSQL schema', () => {
  test('defines all required models including Task 10 administration', () => {
    for (const model of [
      'User',
      'Location',
      'Route',
      'Bus',
      'Seat',
      'Trip',
      'TripSeat',
      'Booking',
      'BookingItem',
      'Payment',
      'News',
      'AuditLog',
    ]) {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s+\\{`))
    }
  })

  test('uses PostgreSQL and generated Prisma Client', async () => {
    expect(schema).toContain('provider = "postgresql"')
    await expect(access(generatedClientPath)).resolves.toBeUndefined()
  })

  test('uses UUID primary keys for every model', () => {
    const ids = schema.match(/id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/g)
    expect(ids).toHaveLength(12)
  })

  test('defines required enums', () => {
    for (const enumName of [
      'UserRole',
      'UserStatus',
      'RecordStatus',
      'BusStatus',
      'SeatType',
      'TripStatus',
      'TripSeatStatus',
      'BookingStatus',
      'PaymentStatus',
      'PaymentMethod',
      'NewsStatus',
    ]) {
      expect(schema).toMatch(new RegExp(`enum\\s+${enumName}\\s+\\{`))
    }
  })

  test('keeps ADMIN and adds STAFF without renaming roles', () => {
    const roleEnum = schema.match(/enum\s+UserRole\s+\{([\s\S]*?)\}/)?.[1]
    expect(roleEnum).toContain('ADMIN')
    expect(roleEnum).toContain('STAFF')
    expect(roleEnum).not.toContain('OWNER')
  })

  test('defines required unique constraints', () => {
    expect(schema).toContain('@@unique([name, province])')
    expect(schema).toContain(
      '@@unique([departureLocationId, arrivalLocationId])',
    )
    expect(schema).toContain('@@unique([busId, seatCode])')
    expect(schema).toContain('@@unique([tripId, seatId])')
    expect(schema).toContain('@@unique([tripId, seatCode])')
    expect(schema).toContain('tripSeatId String   @unique')
    expect(schema).toMatch(/bookingCode\s+String\s+@unique/)
    expect(schema).toMatch(/transactionCode\s+String\?\s+@unique/)
  })

  test('maps Decimal money fields and safe relations', () => {
    expect(schema).toContain('@db.Decimal(12, 2)')
    expect(schema).not.toContain('onDelete: Cascade')
    expect(schema).toContain('onDelete: Restrict')
    expect(schema).toContain('onDelete: SetNull')
  })
})
