# Account creation and management screens

Ticket: https://trello.com/c/J51ywJjk

## Agreed scope

- Use the real authentication API from the connected `ClubBooking` repository. Local desktop API base URL: `https://localhost:7145`.
- Authentication supports browser storage and native SecureStore, including Expo Go. Confirmation links open in the user's browser; mobile link opening is deferred.
- Widescreen web shows Sign In (guest) or Sign Out (authenticated) directly in the right header, replacing the overflow dropdown. Smaller screens retain the overflow menu.
- Sign In and Register share one centered popup over the current page, using the app's white/indigo theme and a blurred, dimmed background. No Google sign-in is included.
- Use a centered card with margins on web and native, with a fixed title/tab header, a scrollable form, safe-area spacing and keyboard avoidance.
- Close with the × button, outside click/tap, Escape on web, or native Back. Closing discards the form. Switching Sign In/Register tabs preserves email and name fields but clears passwords, errors and notices.
- The header and guest Bookings actions open the popup without changing the current route. Old account URLs redirect to Bookings and open the appropriate popup tab, so existing links remain usable without separate authentication pages.
- Guests cannot view or create bookings. Guest Create Booking opens the Sign In popup.
- Successful sign-in closes the popup and returns to Bookings.
- Persist sign-in across restarts/reloads. Sign-out is immediate and returns to Bookings.
- Five failed password attempts require a password reset; there is no timed unlock.
- The frontend does not show attempts remaining. The current API returns a generic 401 for incorrect credentials and locked accounts.
- Passwords have 12–128 characters, an uppercase letter, a lowercase letter, a number and a symbol.
- Collect First Name, Surname and a separate Display Name. Submit all three name fields; do not derive displayName from the other names. First Name and Surname are each limited to 100 characters; Display Name is required and limited to 200 characters after trimming.
- Register keeps all current registration fields. After the API accepts registration, clear passwords, switch to Sign In and show "Check your email" with a Resend confirmation action inside the popup.
- Email confirmation is optional before first sign-in.
- Confirmation success offers Sign In. Expired/used links offer resending.
- Reset password submits the email from the Sign In form without navigating. An empty/whitespace email shows "Please enter your Email address."; malformed email uses normal email validation. After the API accepts the request, show "An password reset has been sent to the email provided." directly above Sign In, identically for known/unknown accounts. Changing the email clears this acknowledgement. Failed requests show an error, and duplicate/concurrent sign-in/reset submissions are prevented. Requesting a reset does not unlock an account.
- Reset completion includes New Password, Confirm Password, invalid/expired-link states and a success screen returning to Sign In.
- Profile editing, signed-in email/password changes and account deletion are separate work.

## Blocking dependency: email-link contract

The user explicitly requested that work stop at email-link handling until they provide the link. No link domain, paths, token parameters or fallback behavior are to be invented.

Blocked work: confirmation-link handling and its success/expired/used states; the new-password route, token validation and reset success flow. A reset request alone must not unlock an account.

Browser opening behavior is confirmed. Needed to resume: representative confirmation and password-reset links, including the configured website host, path and query/token structure. Mobile link handling is deferred.

## API integration status

`src/data/auth-service.ts` now supplies the real API adapter to the provider. Registration submits email, password, firstName, surname and displayName; password confirmation stays on the client. Sign-in obtains opaque bearer tokens and reads `/auth/me`, mapping `userId` to the frontend user's `id`. The adapter also implements `/auth/forgot-password` and `/auth/resend-confirmation`.

Browser sessions persist access/refresh tokens and access expiry in localStorage; iOS and Android use Expo SecureStore via a platform-specific adapter. Both are scoped to the API URL. Passwords and account profiles are not stored. Empty storage returns a guest without contacting the API. Native reads, writes and deletes are asynchronous and serialized, so sign-out waits for deletion and an outstanding write cannot reinstate tokens. Genuine storage failures remain retryable errors. Expired access tokens are refreshed during session restoration, with one refresh/retry after a profile 401. Rejected refresh tokens clear the session; network/server failures retain it for Retry. The API issues opaque bearer tokens with 15-minute access and seven-day refresh lifetimes.

`EXPO_PUBLIC_API_BASE_URL` overrides the local default `https://localhost:7145`; `.env.example` documents it. The browser must trust the API's local HTTPS certificate, and the API must allow the frontend origin through CORS (including JSON POSTs and the Authorization header). No CORS policy was present in the inspected API startup code. Live integration testing requires the API to be running.

Physical devices need a reachable API URL instead of `localhost`, with HTTPS trusted by the device. SecureStore is bundled in Expo Go without biometric authentication; existing custom development builds need rebuilding after adding the module. Its config plugin excludes encrypted entries from Android backup. Physical-device persistence still requires device verification.

`node scripts/verify-api-auth.cjs` exercises the adapter with contract-shaped HTTP responses without creating backend accounts. The retained mock factory is used by `node scripts/verify-auth.cjs` only; persisted mock accounts and Expo Crypto are no longer needed.

Bookings remain in the existing local booking database, scoped to the signed-in API user's identifier. Booking API integration is separate work. Legacy demo rows are not assigned to new accounts.

The inspected API accepts email, password, firstName, surname and displayName at registration. It enforces uppercase/lowercase password rules and requires password reset after five failed attempts. Unconfirmed accounts can sign in. These requirements now match the frontend decisions above.
