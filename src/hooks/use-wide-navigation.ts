// File: src/hooks/use-wide-navigation.ts
import { deviceType, DeviceType } from "expo-device";
import { useSyncExternalStore } from "react";
import { Platform, useWindowDimensions } from "react-native";

import { WIDE_NAVIGATION_MIN_WIDTH } from "@/constants/navigation";

const subscribe = (): (() => void) => (): void => {};
const clientSnapshot = (): boolean => true;
const serverSnapshot = (): boolean => false;

export const useWideNavigation = (): boolean => {
  // The server and the first client render must use the same compact layout.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { width, height } = useWindowDimensions();
  const mobile: boolean =
    Platform.OS !== "web" ||
    deviceType === DeviceType.PHONE ||
    deviceType === DeviceType.TABLET;

  return hydrated && width >= WIDE_NAVIGATION_MIN_WIDTH && (!mobile || width > height);
};
