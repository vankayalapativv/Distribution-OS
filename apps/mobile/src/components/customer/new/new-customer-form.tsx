import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { PhoneField } from "../../phone-field";
import { SalesExecSelect } from "../../customers/sales-exec-select";
import { ChipSelect } from "../chip-select";
import { Field } from "../field";
import { LocationCaptureField } from "../location-capture-field";
import { CUSTOMER_SEGMENTS, CUSTOMER_TYPES } from "../../../lib/customer/new-customer";
import type { useNewCustomerForm } from "../../../lib/customer/use-new-customer-form";
import { CustomerPhotosField } from "./customer-photos-field";

const SEGMENT_OPTIONS = CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: s }));

/** The scrollable body of the New Customer form. */
export function NewCustomerForm({ form }: { readonly form: ReturnType<typeof useNewCustomerForm> }) {
  const { v, set, isSuperAdmin, salesExecutiveName, onSelectSalesExec, fieldErrors, geo, geoBusy, onCaptureLocation, photo, busy } = form;
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bottomOffset={24}
    >
      <Field label="Business name" value={v.legalName} onChange={set("legalName")} required error={fieldErrors.legalName} />
      <Field label="Customer name" value={v.customerName} onChange={set("customerName")} />

      {isSuperAdmin ? (
        <SalesExecSelect value={v.salesExecutiveId} valueName={salesExecutiveName} onSelect={onSelectSalesExec} required error={fieldErrors.salesExecutiveId} />
      ) : null}

      <ChipSelect label="Customer type" required options={CUSTOMER_TYPES} isOn={(t) => v.customerType === t} onToggle={set("customerType")} error={fieldErrors.customerType} />
      <ChipSelect
        label="Segment"
        required
        options={SEGMENT_OPTIONS}
        isOn={(s) => v.segments.includes(s)}
        onToggle={(s) => set("segments")(v.segments.includes(s) ? v.segments.filter((x) => x !== s) : [...v.segments, s])}
        error={fieldErrors.segments}
      />

      <PhoneField label="Phone" value={v.phone} onChange={set("phone")} required error={fieldErrors.phone} placeholder="" />
      <PhoneField label="Alternative phone" value={v.alternativePhone} onChange={set("alternativePhone")} error={fieldErrors.alternativePhone} placeholder="" />
      <Field label="Email" value={v.email} onChange={set("email")} keyboardType="email-address" error={fieldErrors.email} />
      <Field label="GST number" value={v.gstNumber} onChange={(t) => set("gstNumber")(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))} maxLength={15} error={fieldErrors.gstNumber} />
      <Field label="PAN number" value={v.panNumber} onChange={(t) => set("panNumber")(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} maxLength={10} error={fieldErrors.panNumber} />
      <Field label="Udyam Aadhar number" value={v.aadharNumber} onChange={(t) => set("aadharNumber")(t.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 19))} maxLength={19} error={fieldErrors.aadharNumber} />

      {/* Geo-location first: capturing it auto-fills + unlocks the address below. */}
      <LocationCaptureField
        geo={geo}
        busy={geoBusy}
        onPress={onCaptureLocation}
        idleLabel="Capture current location"
        capturedText={geo ? `Captured (${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}) — tap to retake` : ""}
        hint={geo ? "City, state and pincode fill in automatically — adjust if needed." : "Capture the location to fill in and edit the address."}
        required
        error={fieldErrors.geo}
      />

      {/* Address stays read-only until a location is captured (then editable). */}
      <Field label="Street" value={v.addressStreet} onChange={set("addressStreet")} required error={fieldErrors.addressStreet} editable={geo != null} />
      <Field label="Landmark" value={v.addressLandmark} onChange={set("addressLandmark")} multiline editable={geo != null} />
      <Field label="City" value={v.addressCity} onChange={set("addressCity")} required error={fieldErrors.addressCity} editable={geo != null} />
      <Field label="State" value={v.addressState} onChange={set("addressState")} editable={geo != null} />
      <Field label="Pincode" value={v.addressPincode} onChange={set("addressPincode")} keyboardType="numeric" required error={fieldErrors.addressPincode} editable={geo != null} />
      <Field label="Credit limit (₹)" value={v.creditLimit} onChange={set("creditLimit")} keyboardType="numeric" required error={fieldErrors.creditLimit} />
      <Field label="Credit days" value={v.creditDays} onChange={set("creditDays")} keyboardType="numeric" required error={fieldErrors.creditDays} />

      <CustomerPhotosField photo={photo} busy={busy} error={fieldErrors.photos} />
    </KeyboardAwareScrollView>
  );
}
