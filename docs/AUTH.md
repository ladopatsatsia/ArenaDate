# Authentication (Prompt 2)

## Local run

Start the database and Mailpit per README, install dependencies and run `scripts/dev.ps1 migrate`, then `scripts/dev.ps1 api`. The helper creates a development-only RSA private key and persisted data-protection key ring under ignored .tools/auth. It does not print keys. Do not copy that configuration into production.

On other shells run `node scripts/auth-env.mjs --write`, then supply Auth__SigningKeyPem from .tools/auth/signing.pem, Auth__KeyRingPath as an absolute private directory, and the Capture settings from backend/.env.example using environment variables or .NET user secrets. ASPNETCORE_ENVIRONMENT must be Development. .NET does not automatically read .env files.

Register an adult with an email address and a 12-128 character password. Open http://localhost:8025, copy the entire code from the verification email into the app's Verify screen, then sign in. Password recovery similarly sends a code for the Reset screen. No token is passed in a URL. Local mail is captured, not sent to the internet. Accepted responses deliberately do not promise an account exists or mail was delivered. Worker delivery may take five seconds and retries transient failures.

## Protocol and policies

- Identity V3 password hashes use the framework PBKDF2 implementation (210,000 iterations); Identity performs password validation and rehashing. Email/user name normalization plus database uniqueness prevent concurrent duplicates.
- DOB is private. Eligibility uses the current UTC calendar date minus 18 years, rejects future dates and ages over 120. A February 29 birthday reaches the boundary on March 1 in a non-leap year. This is a self-reported age gate, not identity/age verification.
- Only verified, active users can sign in. Unknown/wrong/unverified/locked accounts share a generic 401. Register, verification-email and forgot-password return the same generic 202 for eligible and unknown/duplicate accounts; delivery runs off the request path.
- Five failed passwords lock the account for 15 minutes. Per-IP fixed windows permit 20 auth requests/minute and 120 refresh/logout/me requests/minute, with no queue, 429 and Retry-After: 60. Limits are process-local for the documented single-instance deployment. Before a trusted reverse proxy is introduced, explicitly configure known proxies; client-supplied forwarded IPs are not trusted.
- Access JWTs are RS256, five minutes, with issuer/audience/signature/lifetime validation and 15-second skew. Only sub, sid, jti and iat identity metadata are included. Every authorized request also checks the session and active verified account in PostgreSQL, so revocation affects existing JWTs.
- Refresh secrets are 48 random bytes, base64url encoded. Only SHA-256 hashes are used as database credentials. Families expire absolutely 30 days after login; rotation does not extend that deadline.
- All account/session mutations serialize on the same PostgreSQL user-row lock. The mobile client shares one in-flight refresh among pending requests and saves a random requestId before sending. Rotation is atomic.
- A duplicate refresh with the same requestId within 30 seconds returns the same result if its successor is unused. That short retry response is data-protection encrypted, never plaintext, and removed on the next rotation or by cleanup after the grace period. Thus there is a temporary encrypted copy of the successor secret, separate from the credential hash.
- Different request IDs racing within 30 seconds receive 409 without revoking the family. The mobile client fails closed on 409 and requires sign-in. A consumed credential reused after 30 seconds revokes its family and returns 401. A lost response retried after that window also requires sign-in; this deliberately limits replay tolerance.
- Logout accepts the family's opaque refresh token (even a previously consumed one), is idempotent, and revokes that family. Authenticated logout-all revokes every session for the server-resolved user. There is no client-supplied account ID.
- Identity email/reset codes expire in one hour. Successful password reset changes the Identity security stamp, making the code single-use, and revokes all sessions in the same transaction. Concurrent reset calls permit one success.
- Public account responses contain only the account ID; no email, DOB, roles, password or token hashes. Login/refresh token responses are deliberately private and no-store.

## Mobile storage and cache ownership

Access tokens exist only in memory. SecureStore holds only the refresh secret, API origin and pending refresh request ID; iOS uses WHEN_UNLOCKED_THIS_DEVICE_ONLY. The plugin configures Android backup exclusion. No tokens use AsyncStorage, navigation parameters or logs. Server validation on every cold start prevents an old Keychain entry from bypassing expiry/revocation.

Logout, switching accounts and invalid refresh immediately invalidate the session generation and clear all query/mutation caches, then serialize secure-store removal. Late requests and pending secure writes cannot restore account A after B signs in. Offline refresh hides all private screens and caches but retains the secure retry credential so a retry is possible. Offline logout removes local credentials and explicitly warns that remote revocation is unconfirmed; after connectivity returns, sign in and use logout-all to revoke remaining sessions. SecureStore failures are visible and do not grant private navigation.

Account deletion is reserved for the lifecycle stage. Its future handler must call the same manager.clear path after server deletion; disabled/deleted accounts already fail refresh/authorized session checks. No deletion endpoint or profile editing was invented in Prompt 2.

## Email and production configuration

IAuthEmailSender separates transport from the encrypted PostgreSQL mail queue. The MailKit implementation uses local plaintext Capture only in Development/Testing on localhost/127.0.0.1/mailpit. Production requires Mode=Smtp, host, port, sender and credentials; StartTLS is mandatory and certificate validation is not disabled.

The queue leases rows using FOR UPDATE SKIP LOCKED, sends with a 30-second timeout, retries up to six attempts with bounded backoff, and expires/deletes payloads after an hour. Delivery is at-least-once: a process crash can duplicate an email, not the reset's effect. Warnings contain attempt counts, never payloads. Expired session families and old encrypted refresh retry envelopes are pruned by the worker.

Production requires:
- Auth__SigningKeyPem: private RSA >=2048 bits from secret management, never committed or bundled.
- Auth__Issuer / Auth__Audience: stable matching values (defaults DatingMVP / DatingMVP.Mobile).
- Auth__KeyRingPath: persistent, private writable storage; retain across restarts.
- Auth__KeyCertificatePath / Auth__KeyCertificatePassword: existing private PFX protecting the key ring at rest. Missing certificate configuration fails startup. Retain protected keys/certificates for outstanding code/queue lifetimes.
- Email__Mode=Smtp, Email__Host, Email__Port, Email__Sender, Email__Username, Email__Password.
- ConnectionStrings__Database and HTTPS termination. No plaintext production mobile API URL is accepted.

Development key-ring files rely on local filesystem permissions; production uses certificate protection. Key/certificate rotation and multi-instance deployment require a separate operational rollout; this task neither configures an external provider nor publishes a service. Angular moderation authentication remains a separate later-stage cookie/MFA/CSRF design.
