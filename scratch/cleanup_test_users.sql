BEGIN;

-- 1. Identify all test users
CREATE TEMP TABLE test_users_to_delete AS
SELECT "Id" FROM "AspNetUsers"
WHERE "Email" LIKE 'fixture_%'
   OR "Email" LIKE 'deleted_%'
   OR "Email" LIKE '%@test.%'
   OR "Email" LIKE '%@deleted.local'
   OR "Email" LIKE 'testuser%'
   OR "Email" LIKE 'stars_test%'
   OR "Email" LIKE 'admin_created_%'
   OR "Email" = 'asd@gmial.com';

-- 2. Clean up child records referencing these test users
DELETE FROM "AdminSession" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "AspNetUserClaims" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "AspNetUserLogins" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "AspNetUserRoles" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "AspNetUserTokens" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "Sessions" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "ProfilePhoto" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "DatingProfile" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "DatingMatch" WHERE "FirstId" IN (SELECT "Id" FROM test_users_to_delete) OR "SecondId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "MatchNotice" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "SwipeReceipt" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "DiscoveryDecision" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete) OR "TargetId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "DiscoverySuperLikes" WHERE "SenderUserId" IN (SELECT "Id" FROM test_users_to_delete) OR "TargetUserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "ChatMessage" WHERE "SenderId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "ChatRead" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "PushDelivery" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "PushDevice" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "PushPreference" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "GameMemberships" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "UserGameSettings" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "CrystalTransactions" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "GameProfileViewNotices" WHERE "TargetUserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "UserWallets" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "GameProfileUnlocks" WHERE "TargetUserId" IN (SELECT "Id" FROM test_users_to_delete) OR "ViewerUserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "StorePurchases" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "GameGifts" WHERE "SenderUserId" IN (SELECT "Id" FROM test_users_to_delete) OR "RecipientUserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "UserSubscriptions" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "TodayPlanResponses" WHERE "ApplicantUserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "TodayPlans" WHERE "AuthorUserId" IN (SELECT "Id" FROM test_users_to_delete) OR "SelectedCompanionUserId" IN (SELECT "Id" FROM test_users_to_delete);

DELETE FROM "UserProfileViews" WHERE "ViewerUserId" IN (SELECT "Id" FROM test_users_to_delete) OR "TargetUserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "UnmatchedPair" WHERE "FirstId" IN (SELECT "Id" FROM test_users_to_delete) OR "SecondId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "UserBlock" WHERE "BlockerId" IN (SELECT "Id" FROM test_users_to_delete) OR "BlockedId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "SafetyReport" WHERE "ReporterId" IN (SELECT "Id" FROM test_users_to_delete) OR "SubjectId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "SafetyReceipt" WHERE "ActorId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "AccountDeletionJobs" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
DELETE FROM "DeletionTombstones" WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);
UPDATE "TelegramSubscribers" SET "UserId" = NULL WHERE "UserId" IN (SELECT "Id" FROM test_users_to_delete);

-- 3. Delete from AspNetUsers
DELETE FROM "AspNetUsers" WHERE "Id" IN (SELECT "Id" FROM test_users_to_delete);

SELECT count(*) AS deleted_users_count FROM test_users_to_delete;

COMMIT;
