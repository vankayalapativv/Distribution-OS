import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/features/orders/search-select";
import { DialogSection } from "@/components/ui/dialog";
import { TextField } from "@/components/form/text-field";
import { PhoneField } from "@/components/form/phone-field";
import { CodeField } from "@/components/form/code-field";
import {
  CustomerSegmentPicker,
  CUSTOMER_TYPE_OPTIONS,
  onTypeChange,
} from "./customer-segment-picker";

// Re-exported so existing `./customers-form-fields` imports keep resolving.
export { CUSTOMER_SEGMENTS } from "./customer-segment-picker";

/** Add-Customer fields grouped into labeled <DialogSection>s; render inside a
 *  <DialogBody className="space-y-6">. Type + segments are dialog-controlled. */
export function CustomerFormFields({
  customerType,
  setCustomerType,
  segments,
  setSegments,
}: {
  readonly customerType: string;
  readonly setCustomerType: (v: string) => void;
  readonly segments: string[];
  readonly setSegments: (fn: (cur: string[]) => string[]) => void;
}) {
  return (
    <>
      <DialogSection label="Identity">
        <div className="grid grid-cols-2 gap-4">
          <TextField containerClassName="col-span-2" label="Legal Name" name="legalName" placeholder="Raj Motors Pvt Ltd" required />
          <TextField containerClassName="col-span-2" label="Trade Name" name="tradeName" placeholder="Raj Motors" />
          <TextField containerClassName="col-span-2" label="Customer Name (Contact Person)" name="customerName" placeholder="Rajesh Kumar" />
        </div>
      </DialogSection>

      <DialogSection label="Contact">
        <div className="grid grid-cols-2 gap-4">
          <PhoneField label="Phone Number" name="phone" required />
          <PhoneField label="Alternative Phone" name="alternativePhone" placeholder="9876543211" />
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

          <div className="flex flex-col gap-1.5">
            <Label>Segment * (pick all that apply)</Label>
            <CustomerSegmentPicker segments={segments} setSegments={setSegments} />
          </div>
        </div>
      </DialogSection>

      <DialogSection label="Tax IDs">
        <div className="grid grid-cols-2 gap-4">
          <CodeField label="GST Number" name="gstNumber" length={15} placeholder="29AAACR5055K1Z5" />
          <CodeField label="PAN Number" name="panNumber" length={10} placeholder="AAACR5055K" />
          <CodeField containerClassName="col-span-2" label="Udyam Aadhar Number" name="aadharNumber" length={19} allowDash placeholder="UDYAM-TS-00-0000000" />
        </div>
      </DialogSection>

      <DialogSection label="Address">
        <div className="grid grid-cols-2 gap-4">
          <TextField containerClassName="col-span-2" label="Street / Area" name="addressStreet" placeholder="123, MG Road" required />
          <TextField label="City" name="addressCity" placeholder="Bengaluru" required />
          <TextField label="State" name="addressState" placeholder="Karnataka" />
          <TextField label="Pincode" name="addressPincode" placeholder="560001" required />
        </div>
      </DialogSection>

      <DialogSection label="Credit">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Credit Limit (₹)" name="creditLimit" type="number" min="0" placeholder="50000" required />
          <TextField label="Credit Days" name="creditDays" type="number" min="0" placeholder="30" required />
          <TextField containerClassName="col-span-2" label="Email" name="email" type="email" placeholder="contact@rajmotors.com" />
        </div>
      </DialogSection>
    </>
  );
}
