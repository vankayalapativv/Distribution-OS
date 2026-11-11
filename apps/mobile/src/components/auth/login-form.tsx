import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { usePlaceholderColor } from "../../lib/theme";
import type { FriendlyError } from "../../lib/humanize-error";
import { FeedbackBanner } from "../feedback-banner";
import { Icon } from "../icon";

/** Email + password fields and the sign-in button for the login screen. */
export function LoginForm({
  email,
  onEmail,
  password,
  onPassword,
  showPassword,
  onToggleShow,
  fieldErrors,
  feedback,
  busy,
  onSubmit,
}: {
  readonly email: string;
  readonly onEmail: (t: string) => void;
  readonly password: string;
  readonly onPassword: (t: string) => void;
  readonly showPassword: boolean;
  readonly onToggleShow: () => void;
  readonly fieldErrors: { email?: string; password?: string };
  readonly feedback: FriendlyError | null;
  readonly busy: boolean;
  readonly onSubmit: () => void;
}) {
  const placeholder = usePlaceholderColor();
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Email or phone number</Text>
        <TextInput
          className={`rounded-lg border bg-background px-4 py-3 text-base text-foreground ${
            fieldErrors.email ? "border-destructive" : "border-border"
          }`}
          autoCapitalize="none"
          autoComplete="username"
          keyboardType="default"
          value={email}
          onChangeText={onEmail}
          editable={!busy}
        />
        {fieldErrors.email ? (
          <Text className="text-xs text-destructive">{fieldErrors.email}</Text>
        ) : null}
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Password</Text>
        <View
          className={`flex-row items-center rounded-lg border bg-background px-4 ${
            fieldErrors.password ? "border-destructive" : "border-border"
          }`}
        >
          <TextInput
            className="flex-1 py-3 text-base text-foreground"
            secureTextEntry={!showPassword}
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={placeholder}
            value={password}
            onChangeText={onPassword}
            onSubmitEditing={onSubmit}
            editable={!busy}
          />
          <Pressable
            onPress={onToggleShow}
            hitSlop={10}
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            className="pl-2"
          >
            <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={placeholder} />
          </Pressable>
        </View>
        {fieldErrors.password ? (
          <Text className="text-xs text-destructive">{fieldErrors.password}</Text>
        ) : null}
      </View>

      {feedback ? (
        <FeedbackBanner variant={feedback.severity} title={feedback.title} message={feedback.message} />
      ) : null}

      <Pressable
        className={`mt-2 items-center rounded-lg bg-primary py-3.5 ${busy ? "opacity-50" : ""}`}
        onPress={onSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-base font-semibold text-primary-foreground">Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}
