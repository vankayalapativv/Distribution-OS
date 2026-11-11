import { Image } from "expo-image";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { LoginForm } from "../components/auth/login-form";
import { useLoginForm } from "../lib/use-login-form";

/** S2 — login: email + password, SALES_EXECUTIVE role guard. */
export default function LoginScreen() {
  const f = useLoginForm();

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Image
          source={require("../../assets/images/sri-aparajita-logo.png")}
          // Native aspect ratio of the wordmark (726×344) — height must match
          // or expo-image letterboxes it small inside the box.
          style={{ width: 280, height: 133, alignSelf: "center" }}
          contentFit="contain"
          accessibilityLabel="Sri Aparajitha — Automobile & Lubricants"
        />
        {/* <Text className="mt-3 text-base text-muted-foreground">Field team sign in</Text> */}

        <LoginForm
          email={f.email}
          onEmail={f.onEmailChange}
          password={f.password}
          onPassword={f.onPasswordChange}
          showPassword={f.showPassword}
          onToggleShow={f.toggleShow}
          fieldErrors={f.fieldErrors}
          feedback={f.feedback}
          busy={f.busy}
          onSubmit={f.onSubmit}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}
