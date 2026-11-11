# Migrations

## Current Migration Location

Place migration files in:

```text
packages/db/migrations/
```

Example:

```text
packages/db/migrations/0001_initial_schema.sql
```

## Migration Rules

1. Never manually edit production database tables directly.
2. Every schema change should be represented as a migration.
3. Migrations should be committed to Git.
4. Migration names should be sequential and descriptive.

Example:

```text
0001_initial_schema.sql
0002_add_logistics_fulfilment_tables.sql
0003_add_rule_engine_config.sql
0004_add_gps_session_indexes.sql
```

## Recommended Migration Package Responsibilities

`packages/db` should own:

- migrations
- database connection helper
- migration execution script
- schema documentation
- seed scripts for roles/rules
- test data scripts for local development

## V1 Note

The user confirmed the migration has been pasted into `db/migrations`.
The documentation should follow the actual migration and must not drift from it.
