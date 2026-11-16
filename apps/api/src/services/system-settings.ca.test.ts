import { describe, expect, it } from "vitest";
import { getSystemSettings, setCompanyProfile } from "./system-settings";
import { makeSql } from "../test/sql-mock";

describe("system-settings — CA contact", () => {
  it("maps company_ca_email / company_ca_name into the company profile", async () => {
    const sql = makeSql({
      system_settings_list: [
        { key: "company_legal_name", value: "VKR Sales" },
        { key: "company_ca_name", value: "R. Rao & Co" },
        { key: "company_ca_email", value: "ca@firm.in" },
      ],
    });
    const out = await getSystemSettings(sql);
    expect(out.company.caName).toBe("R. Rao & Co");
    expect(out.company.caEmail).toBe("ca@firm.in");
  });

  it("defaults the CA fields to empty strings when unset", async () => {
    const out = await getSystemSettings(makeSql({ system_settings_list: [] }));
    expect(out.company.caName).toBe("");
    expect(out.company.caEmail).toBe("");
  });

  it("upserts only the CA keys that are provided", async () => {
    const sql = makeSql({ upsert_company_profile: [] });
    await setCompanyProfile(sql, { caEmail: "ca@firm.in" });
    const call = sql.calls.find((c) => c.tag === "upsert_company_profile");
    expect(call?.params[0]).toEqual(["company_ca_email"]);
    expect(call?.params[1]).toEqual(["ca@firm.in"]);
  });
});
