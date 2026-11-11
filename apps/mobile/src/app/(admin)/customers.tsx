// All-customers directory for the Super Admin. Reuses the SE customers screen —
// the `/customers` API is role-scoped server-side, so a SUPER_ADMIN gets EVERY
// customer (not just their own). Tapping a row opens the shared customer detail.
export { default } from "../(tabs)/customers";
