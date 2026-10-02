# Discovery and preferences (Prompt 4)

## Run

Apply migrations with scripts/dev.ps1 migrate, run scripts/dev.ps1 api, then npm.cmd run mobile:start. Use a verified account with a completed, visible profile and at least one approved photo. For local-only testing, scripts/dev.ps1 api -AutoApprovePhotos explicitly approves NEW uploads; normal mode requires moderator approval. Existing pending photos are not silently approved.

Discover offers minimum/maximum age, explicitly selected desired genders, same-city or approximate-distance mode and fixed radii 10/25/50/100 km. City can be entered manually without device permission. The same city and desired-gender values belong to the profile, so editing them changes reciprocal visibility. Both participants must independently satisfy the other's settings.

## Eligibility

The database query requires BOTH users to be active, verified, adults, visible and complete with at least one approved nondeleted photo. Minimum/maximum ages are inclusive calendar ages at the UTC date, with the same conservative leap-day rule as registration. Desired genders must match in both directions.

Exclude self, blocks in either direction, the viewer's prior directed decisions and previously unmatched pairs in either order. An incoming like is NOT excluded solely for being incoming; the viewer must remain able to make a later mutual decision. Decision/unmatch records are durable inputs with composite keys; their mutation APIs, matching and block/unmatch UX remain later stages. Decisions are final in MVP; no rewind or automatic rematch is introduced.

City mode compares normalized NFKC/whitespace-collapsed/case-folded city strings. There is no geocoding provider or inference that spelling/translations refer to the same city. Both city-mode users need matching city keys. For distance-mode users, both saved approximate locations must exist and the distance must satisfy that user's radius. Mixed mode must satisfy BOTH the city condition and the distance condition; missing location never silently becomes an invented coordinate. Distance is not used to reveal precise ordering.

GET /api/discovery/{id} rechecks the full policy before returning a current card. Private media grant AND redemption also recheck it, including new blocks, hidden/disabled accounts, decisions, unmatches and photo moderation/deletion. A previously fetched card is never an authorization credential. DiscoveryEligibility.RequireCurrent is the shared server entry point that Prompt 5's swipe handler must call after acquiring its transaction/pair locks. No swipe mutation endpoint was started in this stage.

## Location privacy

Location is optional and requested only from an explicit button with a consent explanation, using requestForegroundPermissionsAsync and one getCurrentPositionAsync call. No background permission, service, subscription, live map, automatic startup or resume tracking is used. Denial/timeouts keep manual city mode available. The user can delete the saved location and return to city mode.

POST location requires consent=true and finite latitude/longitude within geographic bounds. The server rounds the source to an approximately two-kilometer grid BEFORE storing a geography(Point,4326). The original precise coordinates are discarded and never logged or returned, even in the owner's settings response. Grid cells are approximate, particularly near the poles, and results near radius boundaries can differ from actual device distance.

Clients cannot submit an arbitrary query center, radius, page limit or sort. Centers come only from the authenticated user's saved coarse point. Fixed radii, broad distance buckets (under 10, 10-25, 25-50, 50-100 km), no distance sorting, per-account update limits and discarding source precision reduce repeated precision probing. This is not a claim that public city/distance bands provide anonymity; never promise that voluntarily shared profile text/photos reveal no location clues.

Settings edits: 6/account/hour. Location updates: 2/account/hour (including rejected attempts). Discovery requests: 60/account/minute. Signed bearer identity is validated before user-keyed throttling; unauthenticated fallback uses IP. 429 has Retry-After. Removing location uses the separate discovery budget, so the update limit does not prevent removal. Limits are process-local for the current single-instance architecture.

## Query and pagination

Npgsql NetTopologySuite maps private location to PostGIS geography(Point,4326); distance and ST_DWithin run in PostgreSQL in meters, with a GiST location index. City and immutable discovery sequence also have indexes. The viewer's radius predicate supports the spatial index; the candidate's own radius is an additional reciprocal condition. The planner may choose a sequential scan on tiny test tables.

Pages contain at most 20 cards, ordered by a database-generated immutable sequence, not distance or offset. A data-protection authenticated/encrypted cursor binds viewer, profile revision, last sequence, UTC date and a 15-minute expiry. Tampering is 400; changed/expired context is 409 and requires a fresh first page. Arbitrary extra query parameters are rejected.

The candidate query selects up to 21 rows to detect a next page, followed by ONE batch query for approved photos across the 20 returned IDs. PostgreSQL tests assert no more than five reader commands for each page including bearer validation and viewer lookup, independent of card count. There is no per-card photo query.

This is a live keyset view, not a database snapshot held across requests. New higher-sequence eligible profiles may appear later; newly eligible earlier profiles appear after Refresh. Hidden/blocked/deleted candidates are removed on subsequent queries; sequence ordering avoids duplicate offset pages. Mobile keeps at most five pages per account and resets paging on filter changes, invalid cursors or explicit refresh.

Public cards contain only ID, display name, integer age, bio, gender, city, interests, relationship goal, optional coarse distance bucket and approved photo IDs/dimensions/order. No DOB/email/coordinates/moderator flags/storage keys are serialized. Owner settings disclose only hasLocation, not the point.

## Validation and limits

Real PostgreSQL tests cover reciprocal gender/age, inclusive age boundaries, manual city matching, both block directions, hidden/incomplete/inactive/deleted/pending-photo exclusions, prior decisions and unmatches, meter radius edges and reciprocal radii, GiST index presence, stable/viewer-bound/invalidated cursors, rejected arbitrary query parameters, bounded query counts, stale card/media denial, consent, precision reduction and location deletion. An upgrade test migrates an isolated database back to Prompt 3 and forward with existing profiles, verifying data and conservative defaults are preserved.

Jest tests cover explicit consent, denied location without invented coordinates, one foreground fix, and a late picker/location callback from A being unable to write to newly signed-in B. Native location behavior is not proven by mocks. Separate physical iOS/Android permission, approximate-location, settings, offline, lifecycle and accessibility checks remain in TESTING.md.

No fake discovery profiles are seeded into the app database. With only one eligible account, the correct result is empty. No paid geocoding/storage/location service was bought and no deployment occurred.
