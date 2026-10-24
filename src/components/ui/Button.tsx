// File: src/components/ui/Button.tsx
import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactElement } from 'react';
import { Platform, Pressable, Text, type GestureResponderEvent, type PressableProps } from 'react-native';

export type ButtonVariant = 'contained' | 'outlined' | 'text' | 'toggle-active' | 'toggle-inactive';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'onPress' | 'style' | 'className'> {
  children: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Return false when validation prevents the action from succeeding. */
  onPress: (event: GestureResponderEvent) => void | boolean | Promise<void | boolean>;
  onError?: (error: unknown) => void;
}

interface ButtonVariantClasses {
  container: string;
  label: string;
}

const variantClasses: Record<ButtonVariant, ButtonVariantClasses> = {
  contained: {
    container: 'h-12 bg-indigo-600 rounded-xl flex flex-row items-center justify-center px-4 active:opacity-80',
    label: 'text-base font-semibold text-white',
  },
  outlined: {
    container: 'h-12 bg-transparent border border-neutral-200 rounded-xl flex flex-row items-center justify-center px-4 active:opacity-70',
    label: 'text-base font-semibold text-neutral-900',
  },
  text: {
    container: 'h-12 bg-transparent flex flex-row items-center justify-center px-4 active:opacity-60',
    label: 'text-base font-medium text-indigo-600',
  },
  'toggle-active': {
    container: 'h-12 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-row items-center justify-center px-4',
    label: 'text-base font-semibold text-indigo-600',
  },
  'toggle-inactive': {
    container: 'h-12 bg-white border border-neutral-200 rounded-xl flex flex-row items-center justify-center px-4 active:opacity-80',
    label: 'text-base font-normal text-neutral-600',
  },
};

export const Button = ({
  children,
  variant = 'contained',
  disabled = false,
  loading = false,
  accessibilityRole = 'button',
  accessibilityState,
  onPress,
  onError,
  ...pressableProps
}: ButtonProps): ReactElement => {
  const [pending, setPending] = useState<boolean>(false);
  const executing = useRef<boolean>(false);
  const busy: boolean = loading || pending;
  const unavailable: boolean = disabled || busy;
  const classes: ButtonVariantClasses = variantClasses[variant];
  const selected: boolean | undefined = variant === 'toggle-active'
    ? true
    : variant === 'toggle-inactive' ? false : accessibilityState?.selected;

  const handlePress = async (event: GestureResponderEvent): Promise<void> => {
    if (unavailable || executing.current) return;

    executing.current = true;
    setPending(true);

    try {
      const result: void | boolean = await onPress(event);

      if (result !== false && Platform.OS !== 'web') {
        // Haptic availability must not turn a completed action into a failure.
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error: unknown) {
          console.warn('Button haptic feedback unavailable.', error);
        }
      }
    } catch (error: unknown) {
      if (onError) {
        onError(error);
      } else {
        console.error('Button action failed.', error);
      }
    } finally {
      executing.current = false;
      setPending(false);
    }
  };

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: unavailable, busy, selected }}
      className={`${classes.container}${unavailable ? ' opacity-50' : ''}`}
      disabled={unavailable}
      onPress={handlePress}>
      <Text className={classes.label}>{children}</Text>
    </Pressable>
  );
};
