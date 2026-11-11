import { SafeAreaView } from "react-native-safe-area-context";
import { PasswordForm } from "../../components/settings/password-form";
import { SaveBar } from "../../components/settings/save-bar";
import { SettingsHeader } from "../../components/settings/settings-header";
import { useChangePassword } from "../../lib/use-change-password";

/** Change own password: current + new (min 8) + confirm. */
export default function ChangePasswordScreen() {
  const f = useChangePassword();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SettingsHeader title="Change password" />

      <PasswordForm
        current={f.current}
        onCurrent={f.setCurrent}
        next={f.next}
        onNext={f.setNext}
        confirm={f.confirm}
        onConfirm={f.setConfirm}
        tooShort={f.tooShort}
        mismatch={f.mismatch}
        error={f.error}
        saved={f.saved}
        busy={f.busy}
      />

      <SaveBar label="Update password" busy={f.busy} canSave={f.canSave} onPress={f.onSave} />
    </SafeAreaView>
  );
}
