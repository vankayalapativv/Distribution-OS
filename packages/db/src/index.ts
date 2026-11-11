import postgres from "postgres";

type PostgresOptions = postgres.Options<Record<string, never>>;

export type DbClient = postgres.Sql;

export type DatabaseSslMode = NonNullable<PostgresOptions["ssl"]>;

export interface CreateDatabaseClientOptions {
  databaseUrl?: string;
  maxConnections?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
  ssl?: DatabaseSslMode;
  prepare?: boolean;
  debug?: PostgresOptions["debug"];
}

export interface DatabaseHealth {
  ok: true;
  checkedAt: Date;
}

interface DatabaseHealthRow {
  ok: number;
  checkedAt: Date;
}

const DEFAULT_MAX_CONNECTIONS = 5;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 20;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;

let dbClient: DbClient | undefined;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is required to connect to PostgreSQL.",
    );
  }

  return databaseUrl;
}

export function createDatabaseClient(
  options: CreateDatabaseClientOptions = {},
): DbClient {
  return postgres(options.databaseUrl ?? getDatabaseUrl(), {
    max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
    idle_timeout: options.idleTimeoutSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS,
    connect_timeout:
      options.connectTimeoutSeconds ?? DEFAULT_CONNECT_TIMEOUT_SECONDS,
    ssl: options.ssl ?? "require",
    prepare: options.prepare ?? false,
    debug: options.debug,
  });
}

export function getDatabaseClient(): DbClient {
  dbClient ??= createDatabaseClient();

  return dbClient;
}

export async function closeDatabaseClient(): Promise<void> {
  if (!dbClient) {
    return;
  }

  const client = dbClient;
  dbClient = undefined;
  await client.end();
}

export async function checkDatabaseHealth(
  client: DbClient = getDatabaseClient(),
): Promise<DatabaseHealth> {
  const [row] = await client<[DatabaseHealthRow]>`
    select 1 as ok, now() as "checkedAt"
  `;

  if (!row || row.ok !== 1) {
    throw new Error("PostgreSQL health check failed.");
  }

  return {
    ok: true,
    checkedAt: row.checkedAt,
  };
}
