import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";
import { DialogSection } from "@/components/ui/dialog";
import { TextField } from "@/components/form/text-field";
import { CodeEditField, PhoneEditField, SegmentPicker, last10 } from "./customer-edit-fields";
import { CUSTOMER_TYPE_OPTIONS, onTypeChange } from "./customer-segment-picker";
import type { Customer } from "./customers-api";

/** The Edit-Customer fields, prefilled from `customer` and grouped into sections.
 *  Type + segments are controlled by the parent form. */
export function CustomerEditFormFields({
  customer,
  customerType,
  setCustomerType,
  segments,
  setSegments,
}: {
  readonly customer: Customer;
  readonly customerType: string;
  readonly setCustomerType: (v: string) => void;
  readonly segments: string[];
  readonly setSegments: (fn: (cur: string[]) => string[]) => void;
}) {
  return (
    <>
      <DialogSection label="Identity">
        <div className="grid grid-cols-2 gap-4">
          <TextField containerClassName="col-span-2" label="Legal Name" name="legalName" defaultValue={customer.legalName} required />
          <TextField containerClassName="col-span-2" label="Trade Name" name="tradeName" defaultValue={customer.tradeName ?? ""} />
          <TextField containerClassName="col-span-2" label="Customer Name (Contact Person)" name="customerName" defaultValue={customer.customerName ?? ""} />
        </div>
      </DialogSection>

      <DialogSection label="Contact">
        <div className="grid grid-cols-2 gap-4">
          <PhoneEditField label="Phone Number" name="phone" defaultValue={last10(customer.phone)} />
          <PhoneEditField label="Alternative Phone" name="alternativePhone" defaultValue={last10(customer.alternativePhone)} />
        </div>
      </DialogSection>

      <DialogSection label="Classification">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Customer Type *</Label>
            <SearchSelect
              items={CUSTOMER_TYPE_OPTIONS}
              valueKey={customerType}
              getKey={(o) => o.value}
              getLabel={(o) => o.label}
              onSelect={onTypeChange(setCustomerType)}
              placeholder="Select type"
              searchPlaceholder="Search type…"
              emptyText="No type found"
              contentClassName="w-(--anchor-width) p-0"
            />
          </div>

          <SegmentPicker segments={segments} setSegments={setSegments} />
        </div>
      </DialogSection>

      <DialogSection label="Tax IDs">
        <div className="grid grid-cols-2 gap-4">
          <CodeEditField label="GST Number" name="gstNumber" length={15} defaultValue={customer.gstNumber ?? ""} />
          <CodeEditField label="PAN Number" name="panNumber" length={10} defaultValue={customer.panNumber ?? ""} />
          <CodeEditField containerClassName="col-span-2" label="Udyam Aadhar Number" name="aadharNumber" length={19} allowDash defaultValue={customer.aadharNumber ?? ""} />
        </div>
      </DialogSection>

      <DialogSection label="Address">
        <div className="grid grid-cols-2 gap-4">
          <TextField containerClassName="col-span-2" label="Street / Area" name="addressStreet" defaultValue={customer.addressStreet ?? ""} />
          <TextField label="City" name="addressCity" defaultValue={customer.addressCity ?? ""} />
          <TextField label="State" name="addressState" defaultValue={customer.addressState ?? ""} />
          <TextField label="Pincode" name="addressPincode" defaultValue={customer.addressPincode ?? ""} />
          <TextField containerClassName="col-span-2" label="Landmark" name="addressLandmark" defaultValue={customer.addressLandmark ?? ""} />
        </div>
      </DialogSection>

      <DialogSection label="Credit">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Credit Limit (₹)" name="creditLimit" type="number" min="0" defaultValue={customer.creditLimit > 0 ? String(customer.creditLimit) : ""} />
          <TextField label="Credit Days" name="creditDays" type="number" min="0" defaultValue={customer.creditDays > 0 ? String(customer.creditDays) : ""} />
          <TextField containerClassName="col-span-2" label="Email" name="email" type="email" defaultValue={customer.email ?? ""} />
        </div>
      </DialogSection>
    </>
  );
}
