// File: src/app/(tabs)/index.tsx
import { router } from "expo-router";
import { type ReactElement } from "react";
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
import { dateLabel, type Booking } from "@/data/bookings";
import { useBookings } from "@/hooks/use-bookings";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
const BookingCard = ({ booking }: { booking: Booking }): ReactElement => (
  <View className="mb-3 gap-3 rounded-xl border border-neutral-200 bg-white p-4">
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-semibold text-neutral-900">
        Table {booking.table}
      </Text>
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center gap-2"
      >
        {booking.status === "pending" && (
          <ActivityIndicator accessibilityLabel="Booking pending" />
        )}
        <Text
          className={`text-sm ${booking.status === "failed" ? "text-amber-700" : "text-neutral-500"}`}
        >
          {booking.status === "confirmed"
            ? "✓ Confirmed"
            : booking.status === "failed"
              ? "⚠ Failed"
              : "Pending"}
        </Text>
      </View>
    </View>
    <Text className="text-base font-medium text-neutral-900">
      {dateLabel(booking.date)}
    </Text>
    <Text className="text-sm text-neutral-500">
      All day · {booking.game || "Game not specified"}
    </Text>
    {(booking.spectators || booking.demo) && (
      <Text className="text-sm text-neutral-500">
        {[
          booking.spectators ? "Spectators encouraged" : "",
          booking.demo ? "Demo game" : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    )}
    {booking.status === "failed" && (
      <Text className="text-sm text-amber-700">
        Booking could not be saved.
      </Text>
    )}
  </View>
);
const BookingsScreen = (): ReactElement => {
  const onScroll = useScreenScroll();
  const wide = useWideNavigation();
  const constrainContent: boolean = Platform.OS === "web" && wide;
  const { bookings, loading, refreshing, error, refresh } = useBookings();
  const header: ReactElement = (
    <View>
      <HeaderScrollInset />
      <ScreenHeading title="Your bookings" />
      <View className="mb-6">
        <Button onPress={(): void => router.push("/create-booking")}>
          ＋ Create Booking
        </Button>
      </View>
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
              <BookingCard booking={item} />
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

export default BookingsScreen;
