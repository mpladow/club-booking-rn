# Account creation and management screens

Ticket: https://trello.com/c/J51ywJjk

## Agreed scope

- Use a replaceable asynchronous mock authentication service.
- Keep authentication screens within the bottom-tab layout.
- Guests cannot view or create bookings. Create Booking sends guests to Sign In.
- Successful sign-in returns to Bookings and removes auth screens from navigation history.
- Persist sign-in across restarts/reloads. Sign-out is immediate and returns to Bookings.
- Five failed password attempts require a password reset; there is no timed unlock.
- Passwords have 12–128 characters, a number and a symbol. Neither uppercase nor lowercase letters are required.
- Collect First Name and Surname, temporarily combine them into displayName.
- Sign-up ends at Check your email, offering Resend confirmation and Back to Sign In.
- Email confirmation is optional before first sign-in.
- Confirmation success offers Sign In. Expired/used links offer resending.
- Password reset requests prefill the sign-in email and give the same acknowledgement for known/unknown accounts.
- Reset completion includes New Password, Confirm Password, invalid/expired-link states and a success screen returning to Sign In.
- Profile editing, signed-in email/password changes and account deletion are separate work.

## Blocking dependency: email-link contract

The user explicitly requested that work stop at email-link handling until they provide the link. No link domain, paths, token parameters or fallback behavior are to be invented.

Blocked work: confirmation-link handling and its success/expired/used states; the new-password route, token validation and reset success flow. A reset request alone must not unlock an account.

Needed to resume: representative confirmation and password-reset links, including host, path and query/token structure, plus intended mobile/web opening behavior.

## Mock implementation notes

The mock factory and screens are drafted. The app storage adapter is pending the user's package choice: add Expo Crypto for persisted mock password hashes, or retain accounts only in memory and persist the signed-in session. Until this choice is resolved, the auth-service module referenced by the provider is not yet implemented.

No real emails or API calls are sent. Mock sessions last seven days, matching the existing API refresh lifetime. Mock storage is isolated from future real-token storage; production authentication must replace the mock adapter.

Bookings are scoped to the signed-in mock user's identifier. Legacy demo rows remain in the existing booking database and are not assigned to new accounts.

The real backend currently requires upper/lowercase letters, accepts one displayName, and has a timed lockout. Connecting the real adapter requires aligning that contract with the decisions above.
