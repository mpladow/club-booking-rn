# App Requirements Specification

## 1. Application Scope & Constraints

- **Value Prop:** [A cross platform web app that allows users to create club bookings, manage memberships, purchase items, borrow books.]
- **Target Audience:** iOS and Android mobile users. Web users also, but some features will be limited.
- **Out of Scope (Phase 1):** No user authentication, no cloud sync, no social sharing.

## 2. Technical Stack Matrix

- **Framework:** Expo (SDK 52+ / Latest) via Expo Router (File-based)
- **Language:** TypeScript (Strict Mode)
- **Styling:** NativeWind (Tailwind CSS v4 conventions)
- **State & Data:** Expo SQLite + TanStack Query (for local caching wrapper)
- **Device Native:** `expo-haptics`, `expo-notifications`

## 3. Navigation Architecture

- **MVP Stack:** `app/(tabs)/bookings/` (Main Booking Management)
- **Future Expansion Stacks (Placeholders):**
     - `app/(tabs)/profile/`
     - `app/(tabs)/settings/`

## 4. Core Data Models (TypeScript Contracts)

```typescript
interface UserProfile {
	id: string;
	dailyGoalMl: number;
	createdAt: string;
}

interface WaterLog {
	id: string;
	amountMl: number;
	timestamp: string; // ISO 8601
}
```

## 5. Feature Matrix & Implementation Phases

### Phase 1: Initial Booking (MVP)

- **[FEAT-1.1] Main Screen (`app/(tabs)/bookings/index.tsx`)**
- Displays a list of active bookings.
     - Features a prominent "Create Booking" floating action action button.
- **Booking Creation Form**
- Triggered via the Create Booking action button.
- Will open up a new navigation stack. Will be a multi-page state machine that will track form progress across three different views.
  | Page / State | Objective | Input Fields |
  | **Page 1: Select Date** | Select date | Select date of the booking from available booking dates, Calendar picker |
  | **Page 2: Select Table** | Select table | Select an available table. For now, use dummy data to select from 4 tables. User cannot select more than one. Selectable buttons |
  | **Page 3: Additional Information** | Provide additional information for booking | One Free text field asking "What game are you playing?" One toggle switch component asking "Spectators encouraged?" and one more asking "Demo Game". |
  | **Page 4: Confirm** | Finalise booking | Immutable summary layout with "Confirm Booking" button. User can click each detail of the immutable summary layout to navigate back to that respective page in the form |
  | **Page 5: Booking Pending** | Shows confirmation page with details.| Immutable summary layout with a close button. indicate that User cannot navigate back to previous form pages.|
     - **Behavior:** Clicking "Confirm Booking" the form will validate. If successful will fire an asynchronous API call, then close the form. The user will be taken to the Main Screen and the booking will appear at the top of the screen as Pending (with a loading spinner). Once the asynchronous api call is complete it will change to a checkmark. If unsuccessful it will change to a warning icon. For now, we will only mock this functionality but create the hooks to connect to a crud api.

## 5. Mobile Native Mechanics

- **Permissions:** No system permissions required for Phase 1.
