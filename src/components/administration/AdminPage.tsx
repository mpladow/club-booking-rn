// File: src/components/administration/AdminPage.tsx
import { router } from "expo-router";
import { type ReactElement, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
import { useAdministration } from "@/hooks/use-administration";
import { useAuth } from "@/hooks/use-auth";
import { useAuthDialog } from "@/hooks/use-auth-dialog";
import { useConfirmation } from "@/hooks/use-confirmation";

interface AdminPageProps {
  title: string; allowed: boolean; children: ReactNode; loading?: boolean;
  error?: string | null; refreshing?: boolean; refresh?: () => Promise<void>;
  back?: "/admin" | "/admin/tables";
}
export const AdminPage = ({ title, allowed, children, loading = false, error, refreshing = false, refresh, back }: AdminPageProps): ReactElement => {
  const wide: boolean = useWideNavigation();
  const onScroll = useScreenScroll();
  const administration = useAdministration();
  const { user } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { navigate } = useConfirmation();
  const retry = async (): Promise<void> => { await administration.refresh(); await refresh?.(); };
  return (
    <SafeAreaView edges={["left", "right"]} className="min-h-0 flex-1 bg-neutral-50">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="min-h-0 flex-1">
        <ScrollView className="min-h-0 flex-1" onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
          refreshControl={refresh && allowed ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined}>
          <View className={`w-full px-5 ${Platform.OS === "web" && wide ? "mx-auto max-w-6xl" : ""}`}>
            <HeaderScrollInset />
            <ScreenHeading title={title} />
            <View className="gap-5 pt-4">
              {back && <View className="self-start"><Button variant="text" onPress={(): Promise<void> => navigate((): void => router.dismissTo(back))}>
                {back === "/admin" ? "‹ Back to Administration" : "‹ Back to Tables"}
              </Button></View>}
              {administration.loading || (loading && allowed) ? <View accessibilityLabel="Loading administration" className="gap-4"><ActivityIndicator /><View className="h-32 rounded-xl bg-neutral-200" /></View>
                : !user ? <><Text className="text-base text-neutral-900">Sign in to access administration.</Text><Button onPress={(): void => openAuthDialog()}>Sign In</Button></>
                : !administration.clubId ? <Text accessibilityRole="alert" className="text-base text-neutral-900">No club is selected. Sign in again to access administration.</Text>
                : administration.error ? <><Message error>{administration.error}</Message><Button onPress={retry}>Try again</Button></>
                : !allowed ? <Text accessibilityRole="alert" className="text-base text-neutral-900">You do not have permission to view this screen.</Text>
                : <>{error && <><Message error>{error}</Message>{refresh && <Button variant="outlined" onPress={refresh}>Try again</Button>}</>}{children}</>}
            </View>
            <View className={wide ? "h-10" : "h-32"} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
export const Message = ({ children, error = false }: { children: ReactNode; error?: boolean }): ReactElement => (
  <Text accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite"
    className={`rounded-xl border p-4 text-sm ${error ? "border-amber-200 bg-amber-50 text-amber-800" : "border-indigo-200 bg-indigo-50 text-indigo-700"}`}>{children}</Text>
);
export const AdministrationNotice = (): ReactElement | null => {
  const { notice, clearNotice, error, refresh } = useAdministration();
  if (!notice && !error) return null;
  return <View className="mb-5 gap-2"><Message error>{notice ?? `Administration access could not be checked. ${error}`}</Message>
    <Button variant="text" onPress={notice ? clearNotice : refresh}>{notice ? "Dismiss" : "Retry administration access"}</Button></View>;
};
