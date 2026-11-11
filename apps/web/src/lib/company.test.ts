import { describe, expect, it } from "vitest";
import {
  companyAddressLines,
  companyLetterheadLines,
  EMPTY_COMPANY,
  type CompanyProfile,
} from "./company";

const full: CompanyProfile = {
  legalName: "Sri Aparajita Enterprises",
  gstin: "36ABCDE1234F1Z5",
  addressLine1: "Door 5, MG Road",
  addressLine2: "Near Clock Tower",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
  phone: "",
  email: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
  termsAndConditions: "",
};

describe("companyAddressLines", () => {
  it("composes street + locality lines", () => {
    expect(companyAddressLines(full)).toEqual([
      "Door 5, MG Road, Near Clock Tower",
      "Hyderabad, Telangana 500001",
    ]);
  });

  it("omits empty pieces (no line 2, no pincode)", () => {
    expect(
      companyAddressLines({ ...full, addressLine2: "", pincode: "" }),
    ).toEqual(["Door 5, MG Road", "Hyderabad, Telangana"]);
  });

  it("is empty for a blank profile", () => {
    expect(companyAddressLines(EMPTY_COMPANY)).toEqual([]);
  });
});

describe("companyLetterheadLines", () => {
  it("appends a GSTIN line after the address", () => {
    expect(companyLetterheadLines(full)).toEqual([
      "Door 5, MG Road, Near Clock Tower",
      "Hyderabad, Telangana 500001",
      "GSTIN : 36ABCDE1234F1Z5",
    ]);
  });

  it("drops the GSTIN line when blank", () => {
    expect(companyLetterheadLines({ ...full, gstin: "" })).toEqual([
      "Door 5, MG Road, Near Clock Tower",
      "Hyderabad, Telangana 500001",
    ]);
  });

  it("is fully empty for a blank profile (no letterhead at all)", () => {
    expect(companyLetterheadLines(EMPTY_COMPANY)).toEqual([]);
  });
});
