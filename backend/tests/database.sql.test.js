import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const schemaPath = new URL('../../database/supabase_schema.sql', import.meta.url)
const seedPath = new URL('../../database/supabase_seed.sql', import.meta.url)
const migrationPath = new URL(
  '../prisma/migrations/20260721000100_init_supabase/migration.sql',
  import.meta.url,
)
const adminMigrationPath = new URL(
  '../prisma/migrations/20260729000100_admin_staff_permissions/migration.sql',
  import.meta.url,
)
const businessUpgradeMigrationPath = new URL(
  '../prisma/migrations/20260730000100_full_business_upgrade/migration.sql',
  import.meta.url,
)

const [schema, seed, migration, adminMigration, businessUpgradeMigration] =
  await Promise.all([
  readFile(schemaPath, 'utf8'),
  readFile(seedPath, 'utf8'),
  readFile(migrationPath, 'utf8'),
  readFile(adminMigrationPath, 'utf8'),
  readFile(businessUpgradeMigrationPath, 'utf8'),
])

const tables = [
  'users',
  'locations',
  'routes',
  'buses',
  'seats',
  'trips',
  'trip_seats',
  'bookings',
  'booking_items',
  'payments',
]

describe('Supabase SQL assets', () => {
  test('defines all required public tables and enables RLS', () => {
    for (const table of tables) {
      expect(schema).toMatch(
        new RegExp(`create table if not exists public\\.${table}\\s*\\(`, 'i'),
      )
      expect(schema).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          'i',
        ),
      )
    }
  })

  test('does not contain destructive schema statements or plaintext password column', () => {
    expect(schema).not.toMatch(/drop\s+(table|type|schema)/i)
    expect(schema).not.toMatch(/\bpassword\s+text\b/i)
    expect(schema).toMatch(/\bpassword_hash\s+text\s+not null\b/i)
  })

  test('keeps the Prisma baseline migration synchronized with the schema SQL', () => {
    expect(migration.trim()).toBe(schema.trim())
  })

  test('seeds exactly 44 sleeper seats and 22 limousine seats', () => {
    expect(seed).toContain('generate_series(1,44)')
    expect(seed).toContain('generate_series(1,22)')
    expect(seed).toContain("on conflict (bus_id, seat_code) do nothing")
  })

  test('adds STAFF, News and AuditLog without destructive statements', () => {
    expect(adminMigration).toContain(
      "alter type public.user_role add value if not exists 'STAFF'",
    )
    expect(adminMigration).toContain(
      'create table if not exists public.news',
    )
    expect(adminMigration).toContain(
      'create table if not exists public.audit_logs',
    )
    expect(adminMigration).toContain(
      'alter table public.news enable row level security',
    )
    expect(adminMigration).not.toMatch(/drop\s+(table|type|schema)/i)
  })

  test('tracks the applied business upgrade migration without losing booking history', () => {
    const checksum = createHash('sha256')
      .update(businessUpgradeMigration)
      .digest('hex')

    expect(checksum).toBe(
      '1739aee3350d1b6d80f73bda13860fc4049303093f265e3e649682d9edfbdbb3',
    )
    expect(businessUpgradeMigration).toContain(
      'alter table public.booking_items drop constraint if exists booking_items_trip_seat_id_key',
    )
    expect(businessUpgradeMigration).toContain(
      'create index if not exists booking_items_trip_seat_id_idx',
    )
    expect(businessUpgradeMigration).toContain(
      'create unique index if not exists booking_items_booking_id_trip_seat_id_key',
    )
    expect(businessUpgradeMigration).not.toMatch(
      /drop\s+(table|type|schema)|truncate/i,
    )
  })
})
