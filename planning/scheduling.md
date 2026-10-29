# Schedule administration

Approved scope: [Trello #16 Frontend agreement](https://trello.com/c/DZHCOuUb/16-api-admin-screens#comment-6ae2da1b05a4834aedc8e556).
Wire shapes follow `ClubBooking/docs/contracts/scheduling.ts` and `docs/scheduling-api-contract.md` in the API repository.

The monthly calendar reads persisted management timeslots for its inclusive date range. It does not project occurrences. A day popup contains each session independently; empty future dates prefill the one-off form. The recurring list defaults to active/upcoming rules, with an expired toggle.

Single and recurring routes share an editor and reusable date/time controls. Save validates and opens a read-only review. Confirm performs the request; the saved summary offers navigation or a fresh edit using the returned ID and ETag. Blank titles are display fallbacks only, with null sent for blank metadata. All local date/time validation uses the club timezone. Started/completed/closed sessions are read-only; generated occurrence dates stay fixed.

Updates and deletion use quoted ETags through the existing authenticated transport, including refresh retries. A 409 preserves the draft. A 412 blocks further writes until the user reloads, compares and explicitly reconciles against the latest version. Deletion fetches fresh details and shows date/time and consequences before confirmation. The frontend never cancels bookings; the API enforces booking protection, overlaps, DST and transactional recurring changes.

`SurfaceTile` standardizes content surfaces; `MenuTile` remains the action-navigation component. Scheduling uses the existing administration permission, session recovery and discard-navigation guards.

Verification commands:

- `node node_modules/expo/bin/cli lint`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node scripts/verify-scheduling.cjs`
- `node scripts/verify-api-auth.cjs`
- `node scripts/verify-administration.cjs`

The scheduling script checks production serialization/transport and editor behavior with controlled responses. These checks do not prove live persistence or device rendering. Live verification requires the updated API, applied migrations, a running generation worker and a signed-in administrator. Physical iOS/Android verification is separate from Metro bundle exports.
