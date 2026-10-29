// File: src/components/ui/SurfaceTile.tsx
import { type ReactElement, type ReactNode } from "react";
import { Text, View } from "react-native";
export const SurfaceTile = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }): ReactElement => (
  <View className="gap-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
    <View className="flex-row flex-wrap items-center justify-between gap-3"><Text accessibilityRole="header" className="text-lg font-semibold text-neutral-900">{title}</Text>{action}</View>
    {children}
  </View>
);
