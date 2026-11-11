import type { ReactNode } from "react";
import { rupees } from "@/lib/format";
import type { Customer } from "./customers-api";
import { Field, InfoCard } from "./customer-detail-cards";

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  mechanic: "Mechanic",
  retail: "Retail",
  lof: "LOF",
  industrial: "Industrial",
};

/** Status pill palette, shared with the detail header. */
export const STATUS_TONES: Record<string, string> = {
  active: "bg-green-50 text-green-700 ring-1 ring-green-600/20",
  inactive: "bg-slate-100 text-slate-600",
  suspended: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
};

/**
 * The read-only profile is a SINGLE "Details" tab that stacks every section
 * (Business, Contact, Address, Compliance, Credit Terms) so the client sees the
 * whole profile at once instead of clicking through five separate tabs.
 * (`customer-detail.tsx` iterates INFO_TABS generically, so one entry = one tab.)
 */
export const INFO_TABS: {
  key: string;
  label: string;
  render: (customer: Customer) => ReactNode;
}[] = [
  {
    key: "details",
    label: "Details",
    render: (customer) => (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start">
        <InfoCard title="Business">
          <Field label="Legal Name" value={customer.legalName} />
          <Field label="Trade Name" value={customer.tradeName} />
          <Field
            label="Customer Type"
            value={CUSTOMER_TYPE_LABELS[customer.customerType] ?? customer.customerType}
          />
          <Field label="Segment" value={customer.segment} />
        </InfoCard>

        <InfoCard title="Contact">
          <Field label="Contact Person" value={customer.customerName} />
          <Field label="Phone" value={customer.phone} />
          <Field label="Alternative Phone" value={customer.alternativePhone} />
          <Field label="Email" value={customer.email} />
        </InfoCard>

        <InfoCard title="Address">
          <Field label="Street / Area" value={customer.addressStreet} />
          <Field label="City" value={customer.addressCity} />
          <Field label="State" value={customer.addressState} />
          <Field label="Pincode" value={customer.addressPincode} />
          <Field label="Landmark" value={customer.addressLandmark} />
        </InfoCard>

        <InfoCard title="Compliance">
          <Field label="GST Number" value={customer.gstNumber} />
          <Field label="PAN Number" value={customer.panNumber} />
          <Field label="Aadhar / Udyam" value={customer.aadharNumber} />
        </InfoCard>

        <InfoCard title="Credit Terms">
          <Field
            label="Credit Limit"
            value={customer.creditLimit > 0 ? rupees(customer.creditLimit) : null}
          />
          <Field
            label="Credit Days"
            value={customer.creditDays > 0 ? `${customer.creditDays} days` : null}
          />
        </InfoCard>
      </div>
    ),
  },
];
