import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { readJsonObject } from "../lib/request-body";
import { validate } from "../lib/validate";
import { actorOf, logAudit } from "../services/audit";
import { getSystemSettings, setCompanyProfile, setCreditOverdueDays } from "../services/system-settings";
import { getInvoiceNumberConfig, setInvoiceNumberConfig } from "../services/invoicing";
import type { ApiEnv } from "../types";

// The invoice-number series the generator uses: a prefix + the next sequence
// to issue this financial year (number = `<prefix><fin-year>/<padded seq>`).
const InvoiceNumberSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, "A prefix is required.")
    .max(20)
    .regex(/^[A-Za-z0-9/-]+$/, "Prefix can use letters, digits, / and -."),
  nextNumber: z.coerce.number().int().min(1).max(9_999_999),
});

// Boundary schema (audit G-0602): declarative, self-documenting validation that
// replaces the manual Number()/range checks and yields a uniform 422 on bad input.
// Legal name + GSTIN + Address Line 2 are optional (may be blank); the postal
// address (Line 1 / City / State / Pincode) is required. The whole object is
// submitted on every save, so no `.partial()`.
const CompanySchema = z.object({
  legalName: z.string().trim().max(200),
  // GSTIN is 15 chars. Allow blank (not yet filled) or a valid value.
  gstin: z
    .string()
    .trim()
    .max(15)
    .refine((v) => v === "" || /^[0-9A-Z]{15}$/.test(v.toUpperCase()), "GSTIN must be 15 characters.")
    .transform((v) => v.toUpperCase()),
  addressLine1: z.string().trim().min(1, "Address Line 1 is required.").max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().min(1, "City is required.").max(100),
  state: z.string().trim().min(1, "State is required.").max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be a 6-digit number."),
  // Contact line in the invoice header. Optional — blank allowed.
  phone: z.string().trim().max(40),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  // Payment-collection details (printed on invoices). Optional — blank allowed.
  bankAccountName: z.string().trim().max(120),
  bankAccountNumber: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^\d{5,20}$/.test(v), "Account number must be 5–20 digits."),
  bankIfsc: z
    .string()
    .trim()
    .max(11)
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "IFSC must be 11 characters (e.g. HDFC0001234)."),
  upiId: z
    .string()
    .trim()
    .max(100)
    .refine((v) => v === "" || /^[\w.\-]{2,}@[\w.\-]{2,}$/.test(v), "Enter a valid UPI ID (e.g. name@bank)."),
  // Terms & Conditions printed in the invoice footer. Free text, blank allowed.
  termsAndConditions: z.string().max(5000),
});

// `.partial()` so a panel can save just its own slice (e.g. only the bank
// details, or only the address) — setCompanyProfile writes only the keys given,
// and each provided field is still validated by the rules above.
const SystemSettingsPatchSchema = z.object({
  creditOverdueDays: z.coerce.number().int().min(1).max(365).optional(),
  company: CompanySchema.partial().optional(),
});

export const systemSettingsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    return c.json(success(c, await getSystemSettings(getSqlClient(c))));
  })
  // Just the company profile — the letterhead printed on reports/documents.
  // Any office role may read it (they can download those documents).
  .get("/company", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const settings = await getSystemSettings(getSqlClient(c));
    return c.json(success(c, { company: settings.company }));
  })
  // Invoice-number series config (prefix + next number) used by the generator.
  .get("/invoice-number", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    return c.json(success(c, await getInvoiceNumberConfig(getSqlClient(c))));
  })
  .put("/invoice-number", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const input = validate(InvoiceNumberSchema, await readJsonObject(c));
    const sql = getSqlClient(c);
    await setInvoiceNumberConfig(sql, input);
    await logAudit(sql, actorOf(auth), {
      action: "system_settings.update",
      entityType: "system_settings",
      summary: `Set invoice numbering to ${input.prefix}…/${input.nextNumber}`,
      metadata: { prefix: input.prefix, nextNumber: input.nextNumber },
    });
    return c.json(success(c, await getInvoiceNumberConfig(sql)));
  })
  .patch("/", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const input = validate(SystemSettingsPatchSchema, await readJsonObject(c));
    const sql = getSqlClient(c);

    if (input.creditOverdueDays !== undefined) {
      await setCreditOverdueDays(sql, input.creditOverdueDays);
      await logAudit(sql, actorOf(auth), {
        action: "system_settings.update",
        entityType: "system_settings",
        summary: `Set credit overdue days to ${input.creditOverdueDays}`,
        metadata: { creditOverdueDays: input.creditOverdueDays },
      });
    }

    if (input.company !== undefined && Object.keys(input.company).length > 0) {
      await setCompanyProfile(sql, input.company);
      await logAudit(sql, actorOf(auth), {
        action: "system_settings.update",
        entityType: "system_settings",
        summary: "Updated company profile",
        metadata: { company: input.company },
      });
    }

    return c.json(success(c, { updated: true }));
  });
