import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { checkDatabaseHealth, closeDatabaseClient } from "./index.js";
config({
    path: fileURLToPath(new URL("../../../.env", import.meta.url)),
    quiet: true,
});
try {
    const health = await checkDatabaseHealth();
    console.log(`PostgreSQL OK at ${health.checkedAt.toISOString()}`);
}
finally {
    await closeDatabaseClient();
}
//# sourceMappingURL=health.js.map