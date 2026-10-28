// File: src/app/(tabs)/index.tsx
import { router } from "expo-router";
import { type ReactElement } from "react";
import { AdministrationNotice } from "@/components/administration/AdminPage";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";
import { bookingDate, dateLabel, processingBooking, sessionLabel, type Booking } from "@/data/bookings";
import { useBookings } from "@/hooks/use-bookings";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAuthDialog } from "@/hooks/use-auth-dialog";
import { AuthScreen } from "@/components/auth/AuthScreen";
const BookingCard = ({ booking, timeZone }: { booking: Booking; timeZone: string }): ReactElement => (
  <View className="mb-3 gap-3 rounded-xl border border-neutral-200 bg-white p-4">
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-semibold text-neutral-900">
        {booking.tableName}
      </Text>
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center gap-2"
      >
        {processingBooking(booking) && (
          <ActivityIndicator accessibilityLabel="Booking pending" />
        )}
        <Text
          className={`text-sm ${booking.status === "Rejected" ? "text-amber-700" : "text-neutral-500"}`}
        >
          {booking.status === "Confirmed"
            ? "✓ Confirmed"
            : booking.status === "Rejected"
              ? "⚠ Failed"
              : booking.status === "CancellationPending" ? "Cancelling" : booking.status}
        </Text>
      </View>
    </View>
    <Text className="text-base font-medium text-neutral-900">
      {dateLabel(bookingDate(booking, timeZone))}
    </Text>
    <Text className="text-sm text-neutral-500">
      {sessionLabel(booking, timeZone)} · {booking.gameName || "Game not specified"}
    </Text>
    {(booking.spectators || booking.demoGame) && (
      <Text className="text-sm text-neutral-500">
        {[
          booking.spectators ? "Spectators encouraged" : "",
          booking.demoGame ? "Demo game" : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    )}
    {booking.status === "Rejected" && (
      <Text className="text-sm text-amber-700">
        {booking.failureCode === "ProcessingTimeout" ? "Confirmation timed out. The table has been released." : "Booking was rejected and the table has been released."}
      </Text>
    )}
  </View>
);
const SignedInBookingsScreen = (): ReactElement => {
  const onScroll = useScreenScroll();
  const wide = useWideNavigation();
  const constrainContent: boolean = Platform.OS === "web" && wide;
  const { bookings, club, loading, refreshing, error, refresh } = useBookings();
  const { user } = useAuth();
  const header: ReactElement = (
    <View>
      <HeaderScrollInset />
      <ScreenHeading title="Your bookings" />
      <AdministrationNotice />
      <View className="mb-6">
        <Button disabled={!user?.clubId || !club} onPress={(): void => router.push("/create-booking")}>
          ＋ Create Booking
        </Button>
      </View>
      {!user?.clubId && <Text accessibilityRole="alert" className="mb-4 text-sm text-amber-700">No club is selected for your account. Sign in again with a club membership to book.</Text>}
      {error && (
        <Text accessibilityRole="alert" className="mb-4 text-sm text-amber-700">
          {error}
        </Text>
      )}
    </View>
  );
  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="min-h-0 flex-1 bg-neutral-50"
    >
      <View className={`min-h-0 flex-1 px-5 ${constrainContent ? "mx-auto w-full max-w-6xl" : ""}`}>
        {loading ? (
          <View accessibilityLabel="Loading bookings" className="gap-3">
            {header}
            <ActivityIndicator />
            <View className="h-36 rounded-xl bg-neutral-200" />
            <View className="h-36 rounded-xl bg-neutral-200" />
          </View>
        ) : (
          <FlatList
            className="min-h-0 flex-1"
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            ListHeaderComponent={header}
            data={bookings}
            keyExtractor={(booking: Booking): string => booking.id}
            renderItem={({ item }: { item: Booking }): ReactElement => (
              <BookingCard booking={item} timeZone={club?.timeZoneId ?? "UTC"} />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} />
            }
            ListEmptyComponent={
              <View className="gap-3 py-16">
                <Text className="text-lg font-semibold text-neutral-900">
                  Your next game starts here
                </Text>
                <Text className="text-sm text-neutral-500">
                  No upcoming bookings. Choose a date and reserve a table.
                </Text>
              </View>
            }
            ListFooterComponent={<View className={wide ? "h-8" : "h-28"} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const BookingsScreen = (): ReactElement => {
  const { user } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  if (user) return <SignedInBookingsScreen />;
  return (
    <AuthScreen title="Your bookings">
      <AdministrationNotice />
      <Text className="text-lg font-semibold text-neutral-900">Sign in to book a table</Text>
      <Text className="text-sm text-neutral-500">Your bookings will be available after you sign in.</Text>
      <Button onPress={(): void => openAuthDialog()}>＋ Create Booking</Button>
      <Button variant="outlined" onPress={(): void => openAuthDialog()}>Sign In</Button>
    </AuthScreen>
  );
};

export default BookingsScreen;
