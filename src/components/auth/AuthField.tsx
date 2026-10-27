// File: src/components/auth/AuthField.tsx
import { useId, useState, type ReactElement } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

interface AuthFieldProps extends Omit<TextInputProps, "style" | "className" | "secureTextEntry"> {
  label: string;
  error?: string;
  password?: boolean;
  hint?: string;
}

export const AuthField = ({ label, error, password = false, hint, editable = true, ...props }: AuthFieldProps): ReactElement => {
  const id: string = useId();
  const [visible, setVisible] = useState<boolean>(false);
  return (
    <View className="gap-2">
      <Text nativeID={`${id}-label`} className="text-base font-medium text-neutral-900">{label}</Text>
      <View className="flex-row items-center gap-2">
        <TextInput
          {...props}
          editable={editable}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${id}-label`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          secureTextEntry={password && !visible}
          autoCapitalize={props.autoCapitalize ?? "none"}
          autoCorrect={false}
          className={`h-12 min-w-0 flex-1 rounded-xl border bg-white px-4 text-base text-neutral-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 ${error ? "border-red-600" : "border-neutral-200"} ${editable ? "" : "opacity-50"}`}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: !editable, expanded: visible }}
            disabled={!editable}
            onPress={(): void => setVisible(!visible)}
            className="h-12 items-center justify-center rounded-xl px-3 active:opacity-75"
          >
            <Text className="text-base font-medium text-indigo-600">{visible ? "Hide" : "Show"}</Text>
          </Pressable>
        )}
      </View>
      {hint && <Text nativeID={`${id}-hint`} className="text-sm text-neutral-500">{hint}</Text>}
      {error && <Text nativeID={`${id}-error`} accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
    </View>
  );
};
