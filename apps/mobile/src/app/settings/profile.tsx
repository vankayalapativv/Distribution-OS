import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState } from "../../components/error-state";
import { ProfileForm } from "../../components/settings/profile-form";
import { SaveBar } from "../../components/settings/save-bar";
import { SettingsHeader } from "../../components/settings/settings-header";
import { FormFieldSkeleton, SkeletonTheme } from "../../components/skeleton";
import { useEditProfile } from "../../lib/use-edit-profile";

/** Edit own name + phone (email is the login identity and stays fixed). */
export default function EditProfileScreen() {
  const f = useEditProfile();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SettingsHeader title="Edit profile" />

      {(() => {
        if (f.profileQuery.isPending) {
          return (
            <SkeletonTheme>
              <View className="gap-4 px-5 py-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <FormFieldSkeleton key={i} />
                ))}
              </View>
            </SkeletonTheme>
          );
        }
        if (f.profileQuery.isError) {
          return (
            <ErrorState error={f.profileQuery.error} onRetry={() => void f.profileQuery.refetch()} />
          );
        }
        return (
          <ProfileForm
            name={f.name}
            onName={f.onNameChange}
            phone={f.phone}
            onPhone={f.onPhoneChange}
            email={f.profileQuery.data?.email ?? null}
            error={f.error}
            saved={f.saved}
            phoneConflict={f.phoneConflict}
            busy={f.busy}
          />
        );
      })()}

      <SaveBar label="Save changes" busy={f.busy} canSave={f.canSave} onPress={f.onSave} />
    </SafeAreaView>
  );
}
