// File: src/components/screen-heading.tsx
import { type ReactElement } from "react";
import { Text, View } from "react-native";

import { PAGE_SUBTITLES } from "@/constants/navigation";
import { useWideNavigation } from "@/hooks/use-wide-navigation";

interface ScreenHeadingProps {
  title: string;
}

export const ScreenHeading = ({
  title,
}: ScreenHeadingProps): ReactElement | null => {
  const wide = useWideNavigation();
  if (!wide) return null;

  return (
    <View testID="screen-heading" className="mb-6 gap-1 pt-4">
      <Text
        accessibilityRole="header"
        className="text-2xl font-bold tracking-tight text-neutral-900"
      >
        {title}
      </Text>
      {PAGE_SUBTITLES[title] && (
        <Text className="text-sm text-neutral-500">
          {PAGE_SUBTITLES[title]}
        </Text>
      )}
    </View>
  );
};
