export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CUSTOMER_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "mechanic", label: "Mechanic" },
  { value: "lof", label: "LOF" },
  { value: "industrial", label: "Industrial" },
] as const;

/** Customer segments — multi-select, stored comma-separated (2026-07-17). */
export const CUSTOMER_SEGMENTS = ["2W", "3W", "Car", "Commercial", "Agri"] as const;

export interface CreatedCustomer {
  id: string;
  customerCode: string;
  legalName: string;
}

/** Every editable field of the New Customer form (geo is tracked separately). */
export interface NewCustomerFields {
  legalName: string;
  customerName: string;
  customerType: string;
  segments: string[];
  phone: string;
  alternativePhone: string;
  email: string;
  gstNumber: string;
  panNumber: string;
  aadharNumber: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  addressLandmark: string;
  creditLimit: string;
  creditDays: string;
  salesExecutiveId: string | null;
}

export const EMPTY_CUSTOMER: NewCustomerFields = {
  legalName: "",
  customerName: "",
  customerType: "",
  segments: [],
  phone: "",
  alternativePhone: "",
  email: "",
  gstNumber: "",
  panNumber: "",
  aadharNumber: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressPincode: "",
  addressLandmark: "",
  creditLimit: "",
  creditDays: "",
  salesExecutiveId: null,
};
