const SUPABASE_POOLER_HOST_PATTERN = /\.pooler\.supabase\.com$/i

const parseDatabaseUrl = (databaseUrl) => {
  try {
    return new URL(databaseUrl)
  } catch {
    return null
  }
}

const isSupabasePoolerUrl = (databaseUrl) => {
  const parsedUrl = parseDatabaseUrl(databaseUrl)

  return Boolean(
    parsedUrl &&
      ['postgres:', 'postgresql:'].includes(parsedUrl.protocol) &&
      SUPABASE_POOLER_HOST_PATTERN.test(parsedUrl.hostname),
  )
}

const getPrismaCliDatabaseUrl = (databaseUrl) => {
  const parsedUrl = parseDatabaseUrl(databaseUrl)

  if (!parsedUrl || !isSupabasePoolerUrl(databaseUrl)) {
    return databaseUrl
  }

  if (!parsedUrl.searchParams.has('sslmode')) {
    // Supabase uses a private CA. Prisma's no-verify mode still encrypts the
    // connection and avoids the misleading P1001 caused by an untrusted CA.
    parsedUrl.searchParams.set('sslmode', 'no-verify')
  }

  if (!parsedUrl.searchParams.has('connect_timeout')) {
    parsedUrl.searchParams.set('connect_timeout', '30')
  }

  return parsedUrl.toString()
}

const getPrismaPgAdapterOptions = (databaseUrl) => {
  const parsedUrl = parseDatabaseUrl(databaseUrl)

  if (!parsedUrl || !isSupabasePoolerUrl(databaseUrl)) {
    return { connectionString: databaseUrl }
  }

  // node-postgres may let sslmode from a connection URL override an explicit
  // TLS object. Keep TLS configuration in one place for the runtime adapter.
  for (const parameter of [
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
  ]) {
    parsedUrl.searchParams.delete(parameter)
  }

  return {
    connectionString: parsedUrl.toString(),
    connectionTimeoutMillis: 30_000,
    ssl: {
      rejectUnauthorized: false,
    },
  }
}

export {
  getPrismaCliDatabaseUrl,
  getPrismaPgAdapterOptions,
  isSupabasePoolerUrl,
}
