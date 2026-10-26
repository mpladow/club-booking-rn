// File: src/components/ui/SafeAreaView.tsx
import { styled } from "nativewind";
import { SafeAreaView as NativeSafeAreaView } from "react-native-safe-area-context";

// Native safe-area views need className translated into their style prop.
export const SafeAreaView = styled(NativeSafeAreaView, { className: "style" });
