// File: src/components/ui/Blur.tsx
import { BlurTargetView as NativeBlurTargetView, BlurView as NativeBlurView, type BlurTargetViewProps, type BlurViewProps } from "expo-blur";
import { styled } from "nativewind";
import { type ComponentType, type ReactElement } from "react";

// Expo's wrappers receive NativeWind classes through their style props.
// Limit styled's property-path inference: blurTarget contains recursive native ref types.
const StyledBlurView = styled(NativeBlurView as ComponentType<Pick<BlurViewProps, "style">>, { className: "style" });
export const BlurView = (props: Omit<BlurViewProps, "ref"> & { className?: string }): ReactElement => <StyledBlurView {...props} />;
const StyledBlurTargetView = styled(NativeBlurTargetView as (props: Pick<BlurTargetViewProps, "style">) => ReactElement, { className: "style" });
export const BlurTargetView = (props: BlurTargetViewProps & { className?: string }): ReactElement => <StyledBlurTargetView {...props} />;
