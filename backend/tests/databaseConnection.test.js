import {
  getPrismaCliDatabaseUrl,
  getPrismaPgAdapterOptions,
  isSupabasePoolerUrl,
} from '../src/config/databaseConnection.js'

const supabaseUrl =
  'postgresql://postgres.project-ref:password@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'

describe('database connection configuration', () => {
  test('recognizes only PostgreSQL Supabase pooler URLs', () => {
    expect(isSupabasePoolerUrl(supabaseUrl)).toBe(true)
    expect(isSupabasePoolerUrl('postgresql://localhost:5432/postgres')).toBe(
      false,
    )
    expect(isSupabasePoolerUrl('not-a-url')).toBe(false)
  })

  test('adds Prisma CLI TLS compatibility and timeout without replacing existing values', () => {
    const configuredUrl = new URL(getPrismaCliDatabaseUrl(supabaseUrl))

    expect(configuredUrl.searchParams.get('sslmode')).toBe('no-verify')
    expect(configuredUrl.searchParams.get('connect_timeout')).toBe('30')

    const customUrl = `${supabaseUrl}?sslmode=verify-full&connect_timeout=45`
    const configuredCustomUrl = new URL(getPrismaCliDatabaseUrl(customUrl))

    expect(configuredCustomUrl.searchParams.get('sslmode')).toBe('verify-full')
    expect(configuredCustomUrl.searchParams.get('connect_timeout')).toBe('45')
  })

  test('forces encrypted runtime connections for a Supabase pooler', () => {
    const options = getPrismaPgAdapterOptions(
      `${supabaseUrl}?application_name=thanh-nhan&sslmode=no-verify`,
    )
    const configuredUrl = new URL(options.connectionString)

    expect(options.ssl).toEqual({ rejectUnauthorized: false })
    expect(options.connectionTimeoutMillis).toBe(30_000)
    expect(configuredUrl.searchParams.get('sslmode')).toBeNull()
    expect(configuredUrl.searchParams.get('application_name')).toBe('thanh-nhan')
  })

  test('does not alter a non-Supabase database configuration', () => {
    const localUrl = 'postgresql://localhost:5432/postgres'

    expect(getPrismaCliDatabaseUrl(localUrl)).toBe(localUrl)
    expect(getPrismaPgAdapterOptions(localUrl)).toEqual({
      connectionString: localUrl,
    })
  })
})
