import postgres from "postgres";
const DEFAULT_MAX_CONNECTIONS = 5;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 20;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;
let dbClient;
export class DatabaseConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "DatabaseConfigurationError";
    }
}
export function getDatabaseUrl(env = process.env) {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        throw new DatabaseConfigurationError("DATABASE_URL is required to connect to PostgreSQL.");
    }
    return databaseUrl;
}
export function createDatabaseClient(options = {}) {
    return postgres(options.databaseUrl ?? getDatabaseUrl(), {
        max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
        idle_timeout: options.idleTimeoutSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS,
        connect_timeout: options.connectTimeoutSeconds ?? DEFAULT_CONNECT_TIMEOUT_SECONDS,
        ssl: options.ssl ?? "require",
        prepare: options.prepare ?? false,
        debug: options.debug,
    });
}
export function getDatabaseClient() {
    dbClient ??= createDatabaseClient();
    return dbClient;
}
export async function closeDatabaseClient() {
    if (!dbClient) {
        return;
    }
    const client = dbClient;
    dbClient = undefined;
    await client.end();
}
export async function checkDatabaseHealth(client = getDatabaseClient()) {
    const [row] = await client `
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
//# sourceMappingURL=index.js.map