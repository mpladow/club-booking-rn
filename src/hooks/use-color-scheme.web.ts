// File: src/hooks/use-color-scheme.web.ts
import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme, type ColorSchemeName } from 'react-native';

const subscribe = (): (() => void) => (): void => {};
const clientSnapshot = (): boolean => true;
const serverSnapshot = (): boolean => false;

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export const useColorScheme = (): ColorSchemeName | null => {
  const hasHydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
};
