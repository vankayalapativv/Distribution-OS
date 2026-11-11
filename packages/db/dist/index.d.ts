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
export declare class DatabaseConfigurationError extends Error {
    constructor(message: string);
}
export declare function getDatabaseUrl(env?: NodeJS.ProcessEnv): string;
export declare function createDatabaseClient(options?: CreateDatabaseClientOptions): DbClient;
export declare function getDatabaseClient(): DbClient;
export declare function closeDatabaseClient(): Promise<void>;
export declare function checkDatabaseHealth(client?: DbClient): Promise<DatabaseHealth>;
export {};
//# sourceMappingURL=index.d.ts.map