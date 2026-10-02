# Profiles and private photos (Prompt 3)

## Run and choices

Apply migrations with scripts/dev.ps1 migrate, start scripts/dev.ps1 api, then start the mobile app. Sign in to a verified account and open Profile. Text changes are saved only after server confirmation. DOB remains the private registration value, immutable through profile editing; only computed age is returned.

Explicit supported genders: woman, man, nonbinary. The user selects one gender and one or more desired genders; no inferred/default partner preference. Relationship goals: long_term, short_term, open_to_either, figuring_out. Interests: music, books, travel, cooking, sport, art, gaming, nature, film, technology (select 1-5). GET /api/profile/choices is authoritative. Display name 2-50 trimmed characters, bio 10-500, city 2-80; explicit visibility. Profile completion requires all fields and at least one approved photo. City is free text at this stage; discovery city normalization is part of Prompt 4.

## Photo protocol

All routes require a valid bearer session. No client-selected storage key or remote upload URL is accepted.
- POST /api/profile/photos/uploads with a UUID requestId reserves one of six slots and returns PhotoDto. Retrying the same ID returns the same slot. Deleted/expired request IDs cannot be reused.
- POST /api/profile/photos/{id}/finalize sends raw application/octet-stream bytes. Ownership is checked; server decoding, re-encoding and both object writes must complete before pending/approved is returned. A successful retry returns the existing result without changing its content.
- GET /api/profile returns owner fields, revision, completion and ordered photo IDs/states/dimensions. No storage keys, DOB or email.
- POST /api/profile saves ProfileUpdate with expected revision; POST /api/profile/photos/reorder accepts the exact permutation of all active photo IDs and expected revision. Stale mutations return 409. Per-user PostgreSQL row locks and a unique active (UserId, Position) index serialize edits/reordering. A temporary negative ordering exists only inside the transaction.
- DELETE /api/profile/photos/{id} is owner-only and idempotent. Remaining photos compact to 0..N-1; deleting first promotes the next. Discovery's primary is the first approved photo by that order. Deleting the last approved photo removes completion.
- Reserved uploads expire in one hour. A persisted tombstone retains request identity; a minute worker deletes both known keys for deleted/expired uploads and marks cleanup complete. Object-write crashes remain recoverable because keys were committed before writes. Storage failure retries on a later sweep; no untracked random objects are created.

Limits: 8 MiB encoded input, 320-pixel minimum side, 6000-pixel maximum side, at most 12 million decoded pixels, nonanimated JPEG/PNG/WebP. The claimed MIME/extension is not trusted. Two concurrent decoders bound memory; busy returns 429. SkiaSharp decodes actual content, honors EXIF orientation, flattens transparency onto white, creates fresh JPEG pixels without EXIF/GPS metadata, limits full image to 1600 pixels on its longest side and thumbnail to 400. Aspect ratio is preserved.

Expo ImagePicker selects one image; ImageManipulator uses the OS-supported decoder and converts it to JPEG, including supported iPhone HEIC inputs. Generated conversion cache files are removed after reading upload bytes. Direct server HEIC/AVIF/GIF/SVG uploads are rejected. Unsupported/corrupt native conversion reports failure, never renames an extension as a conversion. Physical iPhone HEIC/Live Photo/iCloud and Android permission/limited-library behavior remain NOT RUN. This is documented rather than claimed from mocked tests.

Network retries preserve requestId and the in-memory prepared image until success/cancel. After process death, the server displays the incomplete slot; remove it and reselect, or wait for expiry. Private local source bytes are not persisted as a resumable app cache. Save text before changing photos because server revision refresh reloads the form.

## Moderation and access

New photos are pending by default. POST /api/moderation/photos/{id} accepts approved/rejected, and GET /api/moderation/photos returns up to 50 pending photos. Every call checks the server-side Identity MODERATOR role, never client role claims; no public role-assignment endpoint exists. Role assignment is an operator-controlled database/Identity operation, not a default user credential. The Angular moderator UI, dedicated cookie/MFA/CSRF sessions and bootstrap UX remain stage 9. This minimal API is not a claim of a released moderator console.

For explicit LOCAL testing only, scripts/dev.ps1 api -AutoApprovePhotos approves new uploads. Default is false. Compose accepts DEV_AUTO_APPROVE_PHOTOS=true only with Development. Production rejects AutoApprove=true and local storage through startup validation.

POST /api/profile/photos/{id}/access issues an encrypted/authenticated two-minute ticket tied to viewer and photo. GET /api/profile/photos/{id}/content?ticket=...&thumbnail=true still requires the viewer's bearer session and rechecks current authorization, deletion and state; sharing the URL alone grants nothing. Responses are no-store and image/jpeg with nosniff. Request URLs are not logged. Mobile fetches into the account-scoped cache and renders data URIs with contain/aspect dimensions; logout/switch clears that cache. Bytes already delivered or saved cannot be recalled.

At the Prompt 3 boundary, only owner/moderator can fetch photos; all other-account access is denied. Prompt 4 now adds reciprocal discovery eligibility and both block directions for approved-photo access to others; see DISCOVERY.md. A minimal UserBlock record exists to share that exclusion policy; no user block actions were started.

## Storage and deployment

IPrivateStorage has local and S3 implementations. Development files live under ignored .tools/media, outside wwwroot; no static file middleware serves them. Container storage is a private persisted volume. Use local disk permissions appropriate to the service user.

Production Media__Mode=S3 requires HTTPS Media__Endpoint, Media__Region, Media__Bucket, Media__AccessKey, Media__SecretKey from secret management. AWSSDK.S3 V4 signs requests; path-style supports compatible providers. Provision a private bucket with public access disabled, encryption/backups/retention appropriate to the deployment, and service credentials limited to object Get/Put/Delete in that bucket. Never put credentials in EXPO_PUBLIC variables. No public ACL or permanent object URL is produced. No provider has been purchased/configured, and real S3 integration remains NOT RUN without owner credentials.

SkiaSharp 4.153.1 and matching Linux.NoDependencies native assets were selected from official stable package listings; SkiaSharp is MIT, upstream Skia uses its BSD-style license, included notices must be retained. No ImageSharp commercial-license assumption and no unverified server HEIC codec. Deployment image decoder compatibility is separately checked, not inferred from TypeScript.
