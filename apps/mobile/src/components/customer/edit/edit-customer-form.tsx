import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useBottomInset } from "../../../lib/use-bottom-inset";
import { FeedbackBanner } from "../../feedback-banner";
import { PhoneField } from "../../phone-field";
import { ChipSelect } from "../chip-select";
import { Field } from "../field";
import { LocationCaptureField } from "../location-capture-field";
import { CUSTOMER_SEGMENTS } from "../../../lib/customer/new-customer";
import { useEditCustomerForm, type CustomerDetail } from "../../../lib/customer/use-edit-customer-form";
import { CustomerPhotosEditor } from "./customer-photos-editor";

const SEGMENT_OPTIONS = CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: s }));

/** The scrollable body + save footer of the customer edit form. */
export function EditForm({
  id,
  token,
  initial,
}: {
  readonly id: string;
  readonly token: string | null;
  readonly initial: CustomerDetail;
}) {
  const f = useEditCustomerForm(id, token, initial);
  const bottomPad = useBottomInset();
  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={24}
      >
        <PhoneField
          label="Phone"
          value={f.phone}
          onChange={(d) => {
            f.setPhone(d);
            if (f.error) f.setError(null);
          }}
          placeholder=""
        />

        <ChipSelect
          label="Segment"
          required
          options={SEGMENT_OPTIONS}
          isOn={(s) => f.segments.includes(s)}
          onToggle={(s) => {
            f.setSegments(f.segments.includes(s) ? f.segments.filter((x) => x !== s) : [...f.segments, s]);
            if (f.error) f.setError(null);
          }}
        />

        <LocationCaptureField
          geo={f.geo}
          busy={f.geoBusy}
          onPress={() => void f.onCaptureLocation()}
          idleLabel="Re-capture current location"
          capturedText={f.geo ? `New location captured (${f.geo.latitude.toFixed(4)}, ${f.geo.longitude.toFixed(4)})` : ""}
          hint={f.geo ? "City, state and pincode refreshed from the new location — adjust if needed." : "Re-capture the location to change the address; leave it to keep the existing address and coordinates."}
        />

        {/* Address stays read-only until the location is re-captured (then editable). */}
        <Field label="Street" value={f.addressStreet} onChange={(t) => { f.setAddressStreet(t); f.clearFieldError("street"); }} required error={f.fieldErrors.street} editable={f.geo != null} />
        <Field label="Landmark" value={f.addressLandmark} onChange={f.setAddressLandmark} multiline editable={f.geo != null} />
        <Field label="City" value={f.addressCity} onChange={(t) => { f.setAddressCity(t); f.clearFieldError("city"); }} required error={f.fieldErrors.city} editable={f.geo != null} />
        <Field label="State" value={f.addressState} onChange={f.setAddressState} editable={f.geo != null} />
        <Field label="Pincode" value={f.addressPincode} onChange={(t) => { f.setAddressPincode(t); f.clearFieldError("pincode"); }} keyboardType="numeric" required error={f.fieldErrors.pincode} editable={f.geo != null} />

        <CustomerPhotosEditor photos={f.photos} token={f.token} />
      </KeyboardAwareScrollView>

      <View className="border-t border-border px-5 pt-3" style={{ paddingBottom: bottomPad }}>
        {f.error ? <FeedbackBanner variant="error" message={f.error} className="mb-2" /> : null}
        {f.saved ? <FeedbackBanner variant="success" message="Customer updated." className="mb-2" /> : null}
        <Pressable
          className={`items-center rounded-lg bg-primary py-3.5 ${f.busy ? "opacity-50" : ""}`}
          onPress={() => void f.onSave()}
          disabled={f.busy}
        >
          {f.busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">Save changes</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
