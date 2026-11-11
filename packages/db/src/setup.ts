import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import postgres from "postgres";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const ROLES = [
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Full system access" },
  { code: "MANAGER", name: "Manager", description: "Team and territory management" },
  { code: "ACCOUNTANT", name: "Accountant", description: "Collections and finance" },
  { code: "SALES_EXECUTIVE", name: "Sales Executive", description: "Field sales operations" },
  { code: "LOGISTICS", name: "Logistics", description: "Delivery and logistics" },
] as const;

function hr() {
  console.log("─".repeat(60));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set in .env");
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  console.log("\nSri Aparajita Distribution — First-Time Setup");
  hr();
  console.log("Creates the Super Admin account, linked to Neon Managed Auth.");
  console.log("FIRST create the admin in Neon Auth (sign up) to obtain their user id");
  console.log("(the JWT `sub`). This script links that id to a SUPER_ADMIN users row.");
  console.log("Run once on a fresh database; it aborts if any user exists.\n");

  // Guard: abort if any user already exists
  const existing = await sql`select id from users limit 1`;
  if (existing.length > 0) {
    console.error("ERROR: A user already exists in the database.");
    console.error("       To reset, clear the database first.");
    await sql.end();
    process.exit(1);
  }

  const rl = createInterface({ input, output });

  try {
    const adminName = (await rl.question("Super Admin name:      ")).trim();
    if (!adminName) throw new Error("Super Admin name is required.");

    const adminEmail = (await rl.question("Super Admin email:     ")).trim();
    if (!adminEmail || !adminEmail.includes("@")) throw new Error("Valid email is required.");

    const adminPhone = (await rl.question("Super Admin phone:     ")).trim() || null;

    const appLoginId = (await rl.question("Neon Auth user id (JWT sub): ")).trim();
    if (!appLoginId) {
      throw new Error("The Neon Auth user id is required. Create the admin in Neon Auth first.");
    }

    hr();
    console.log("\nCreating Super Admin...\n");

    await sql.begin(async (tx) => {
      // 1. Roles (idempotent)
      for (const role of ROLES) {
        await tx`
          insert into roles (code, name, description)
          values (${role.code}, ${role.name}, ${role.description})
          on conflict (code) do nothing
        `;
      }

      const [superAdminRole] = await tx`
        select id from roles where code = 'SUPER_ADMIN' limit 1
      `;

      // 2. Super Admin user — linked to Neon Auth via app_login_id (the JWT sub).
      const [user] = await tx`
        insert into users (name, email, phone, app_login_id, status)
        values (
          ${adminName},
          ${adminEmail},
          ${adminPhone},
          ${appLoginId},
          'active'
        )
        returning id
      `;

      // 3. Link user to SUPER_ADMIN role
      await tx`
        insert into user_roles (user_id, role_id, assigned_by)
        values (${user.id}, ${superAdminRole.id}, ${user.id})
        on conflict (user_id, role_id) do nothing
      `;

      console.log(`  User : ${user.id}`);
    });

    hr();
    console.log("\n✓ Setup complete!\n");
    console.log(`  The Super Admin can now sign in via Neon Auth with ${adminEmail}`);
    console.log("  and create all other users from Users & Teams.\n");
    hr();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nERROR: ${message}\n`);
    process.exit(1);
  } finally {
    rl.close();
    await sql.end();
  }
}

void main();
