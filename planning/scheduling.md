# Schedule administration

## Table assignments

[Approved Frontend extension](https://trello.com/c/DZHCOuUb/16-api-admin-screens#comment-6ae32a4fe7902be711971fb0).
Wire additions follow `ClubBooking/docs/table-assignment-api-contract.md` and the updated shared TypeScript contract. Every full PUT includes `tableIds`: generated sessions preserve null for inheritance, while arrays (including empty arrays) are explicit selections. `effectiveTableIds` is read-only and is never sent on writes.

Configure Tables uses isolated provisional state. Confirm applies only to the form draft; Cancel/Close/native Back discards picker changes. Existing form navigation guards protect confirmed draft changes. Active tables include future availability dates. Assigned disabled/unavailable IDs stay visible and are never silently pruned. The picker can retain disabled assignments or explicitly remove them. A removed/newly disabled selection must be corrected before confirming. New catalogue entries are never automatically selected.

Generated occurrences offer Use recurring schedule tables, with separate independent selections. Retired parents may not be readable through schedule GET; restoring inheritance remains supported and clearly indicates when its resolved selection cannot be previewed. Form/review/saved/stale comparison summaries distinguish inherited, empty and explicit selections. Started/completed/closed sessions remain read-only. Session-specific booking table reads already enforce the updated eligibility contract; no catalogue-wide fallback is used.

Catalogue removal confirmation describes future assignment cleanup and durable cancellation, preserving started sessions and history. Disabling keeps the API's existing booking guard and retained assignments. Configuration edits never issue cancellation requests.

### API effective-date dependency

The verified API `PropagateTables` query currently filters only `StartsAtUtc > now`, without the agreed `scheduleStartDate` lower bound. This is recorded in the Frontend comment. The client sends the published date field and does not attempt multi-request propagation. Until the API is corrected, the editor blocks changed table selections on an existing recurring rule when Apply changes from is in the future. Today-effective changes, future new rules, occurrence overrides, and unrelated edits remain available. Remove this temporary validation after the server enforces the date boundary. No backend files are changed by this frontend extension.

`scripts/verify-scheduling.cjs` exercises the real picker handlers, inheritance/reset, zero selections, disabled/deleted metadata changes, no automatic assignment, exact wire shapes, ETags and conflict recovery using controlled responses. Live persistence/cancellation and physical-device layout require separate verification.

## Original scheduling flow

Approved scope: [Trello #16 Frontend agreement](https://trello.com/c/DZHCOuUb/16-api-admin-screens#comment-6ae2da1b05a4834aedc8e556).
Wire shapes follow `ClubBooking/docs/contracts/scheduling.ts` and `docs/scheduling-api-contract.md` in the API repository.

The monthly calendar reads persisted management timeslots for its inclusive date range. Following the [approved 30 October clarification](https://trello.com/c/DZHCOuUb/16-api-admin-screens#comment-6ae42cd9110acfdffdec5cc7), it also previews weekly dates beyond the club's rolling booking window. Solid highlights represent open persisted sessions; dashed highlights represent previews and show a separate count. The legend states the current club-local booking-window end. Previews respect commencement/start/end dates and never fill gaps within the generation window. The management read includes closed occurrences to suppress previews for closed/customised/persisted exceptions; closed sessions remain hidden. Previews never create API timeslots or become bookable.

A day popup contains each persisted session and preview independently. Preview details are read-only and offer Edit Recurring Timeslot only when permitted; they have no individual edit/delete action or invented occurrence ID. Empty future dates prefill the one-off form. Focus refresh continues to reload both rules and persisted occurrences after saves. The recurring list defaults to active/upcoming rules, with an expired toggle.

Single and recurring routes share an editor and reusable date/time controls. Save validates and opens a read-only review. Confirm performs the request; the saved summary offers navigation or a fresh edit using the returned ID and ETag. Blank titles are display fallbacks only, with null sent for blank metadata. All local date/time validation uses the club timezone. Started/completed/closed sessions are read-only; generated occurrence dates stay fixed.

Updates and deletion use quoted ETags through the existing authenticated transport, including refresh retries. A 409 preserves the draft. A 412 blocks further writes until the user reloads, compares and explicitly reconciles against the latest version. Deletion fetches fresh details and shows date/time and consequences before confirmation. The frontend never cancels bookings; the API enforces booking protection, overlaps, DST and transactional recurring changes.

`SurfaceTile` standardizes content surfaces; `MenuTile` remains the action-navigation component. Scheduling uses the existing administration permission, session recovery and discard-navigation guards.

Verification commands:

- `node node_modules/expo/bin/cli lint`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node scripts/verify-scheduling.cjs`
- `node scripts/verify-schedule-calendar.cjs`
- `node scripts/verify-api-auth.cjs`
- `node scripts/verify-administration.cjs`

The scheduling script checks production serialization/transport and editor behavior with controlled responses. These checks do not prove live persistence or device rendering. Live verification requires the updated API, applied migrations, a running generation worker and a signed-in administrator. Physical iOS/Android verification is separate from Metro bundle exports.
