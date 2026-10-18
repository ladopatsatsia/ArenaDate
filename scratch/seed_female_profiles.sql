BEGIN;

-- 1. Create a temporary table of users to keep
CREATE TEMP TABLE kept_users AS
SELECT "Id" FROM "AspNetUsers"
WHERE "Id" IN (
    '6ba34e3f-d852-467c-8b4e-bf351a7de75a', -- Lado (tg_8233503382@dating.local)
    '0006afce-4a5d-4b94-9bd5-67e38c3bbfc4', -- Luka (tg_8270750378@dating.local)
    '61c741b2-61e2-44e9-8787-a25eff205c6d', -- tg_6338972277@dating.local
    '689d971e-74b2-4487-9522-357494e07dbb', -- facacialado@gmail.com
    'da2525b0-11ed-41bb-9445-f4a2f5c2d1bc', -- facacialado@gmil.com
    '01a11600-f8c6-726c-b78e-61e35725741b', -- admin@appdate.ge
    '19245db3-3272-4053-a4a1-f46bd443c656'  -- stars_test@dating.local
);

-- 2. Clear old discovery decisions and swipe receipts so discovery deck is fresh
DELETE FROM "DiscoveryDecision";
DELETE FROM "SwipeReceipt";
DELETE FROM "DiscoverySuperLikes";
DELETE FROM "DatingMatch";
DELETE FROM "MatchNotice";
DELETE FROM "ChatMessage";
DELETE FROM "ChatRead";
DELETE FROM "Conversation";
DELETE FROM "GameRoundAnswers";
DELETE FROM "GameKisses";
DELETE FROM "GameDirectMatchRequests";
DELETE FROM "GameProfileUnlocks";
DELETE FROM "GameProfileViewNotices";
DELETE FROM "GameGifts";
DELETE FROM "UserProfileViews";
DELETE FROM "UnmatchedPair";
DELETE FROM "UserBlock";

-- 3. Delete foreign key records for users not in kept_users
DELETE FROM "GameMemberships" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "CrystalTransactions" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "UserWallets" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "StorePurchases" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "UserSubscriptions" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "UserGameSettings" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "PushDelivery" WHERE "DeviceId" IN (SELECT "Id" FROM "PushDevice" WHERE "SessionId" IN (SELECT "Id" FROM "Sessions" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users)));
DELETE FROM "PushDevice" WHERE "SessionId" IN (SELECT "Id" FROM "Sessions" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users));
DELETE FROM "PushPreference" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "RefreshCredentials" WHERE "SessionId" IN (SELECT "Id" FROM "Sessions" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users));
DELETE FROM "Sessions" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AdminSession" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AdminMfaUse" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "StaffAccount" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "ProfilePhoto" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "DatingProfile" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AspNetUserRoles" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AspNetUserClaims" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AspNetUserLogins" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AspNetUserTokens" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "AccountDeletionJobs" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "DeletionTombstones" WHERE "UserId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "SafetyReport" WHERE "ReporterId" NOT IN (SELECT "Id" FROM kept_users) OR "SubjectId" NOT IN (SELECT "Id" FROM kept_users);
DELETE FROM "SafetyReceipt" WHERE "ActorId" NOT IN (SELECT "Id" FROM kept_users);

-- Delete all test users from AspNetUsers
DELETE FROM "AspNetUsers" WHERE "Id" NOT IN (SELECT "Id" FROM kept_users);

-- 4. Insert 8 new rich, realistic female profiles
-- User 1: მარიამი (Mariam)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000001', 'mariam.georgia@appdate.ge', 'MARIAM.GEORGIA@APPDATE.GE', 'mariam.georgia@appdate.ge', 'MARIAM.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP1', 'STAMP1', false, false, false, 0, true, '2004-03-12', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000001', 'მარიამი', 'თსუ-ს სტუდენტი, მიყვარს მოგზაურობა და ცოცხალი მუსიკა ☕🎧 თავისუფალ დროს ვხატავ ან ძველ თბილისში ვსეირნობ. ვეძებ ადამიანს, ვისთანაც საინტერესო საუბრები არასდროს დასრულდება.', 'woman', ARRAY['man'], 'თბილისი', 'TBILISI', ARRAY['travel', 'music', 'sport', 'art'], 'long_term', ARRAY['ქართული', 'English'], true, 1, 1001, 18, 99, 50, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000001', 'c0010001-0000-4000-8000-000000000001', gen_random_uuid(), 'd0010001000040008000000000000001.jpg', 'd0010001000040008000000000000001.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000001', 500, 0, NOW());

-- User 2: ნინო (Nino)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000002', 'nino.georgia@appdate.ge', 'NINO.GEORGIA@APPDATE.GE', 'nino.georgia@appdate.ge', 'NINO.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP2', 'STAMP2', false, false, false, 0, true, '2002-07-25', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000002', 'ნინო', 'ზღვა, მზის ჩასვლა და კარგი წიგნი ჩემი კომფორტის ზონაა 🌊📖 არქიტექტურის დიზაინერი. თუ გიყვარს სპონტანური გასვლები და ღამის ბათუმში გასეირნება, მოგეწონება აქ.', 'woman', ARRAY['man'], 'ბათუმი', 'BATUMI', ARRAY['nature', 'travel', 'books', 'art'], 'open_to_either', ARRAY['ქართული', 'English', 'Русский'], true, 1, 1002, 18, 99, 100, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000002', 'c0010001-0000-4000-8000-000000000002', gen_random_uuid(), 'd0010001000040008000000000000002.jpg', 'd0010001000040008000000000000002.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000002', 350, 0, NOW());

-- User 3: ანა (Ana)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000003', 'ana.georgia@appdate.ge', 'ANA.GEORGIA@APPDATE.GE', 'ana.georgia@appdate.ge', 'ANA.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP3', 'STAMP3', false, false, false, 0, true, '2005-02-18', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000003', 'ანა', 'UI/UX დიზაინერი, გეიმერი და ყავის ენთუზიასტი 🎮☕ მიყვარს ინდი მუსიკა და საინტერესო პროექტებზე მუშაობა. იუმორი ჩემთვის ყველაზე მნიშვნელოვანია!', 'woman', ARRAY['man'], 'თბილისი', 'TBILISI', ARRAY['technology', 'gaming', 'music', 'art'], 'long_term', ARRAY['ქართული', 'English'], true, 1, 1003, 18, 99, 50, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000003', 'c0010001-0000-4000-8000-000000000003', gen_random_uuid(), 'd0010001000040008000000000000003.jpg', 'd0010001000040008000000000000003.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000003', 420, 0, NOW());

-- User 4: თაკო (Tako)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000004', 'tako.georgia@appdate.ge', 'TAKO.GEORGIA@APPDATE.GE', 'tako.georgia@appdate.ge', 'TAKO.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP4', 'STAMP4', false, false, false, 0, true, '2003-09-14', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000004', 'თაკო', 'ფიტნეს ინსტრუქტორი და აქტიური ცხოვრების წესის მოყვარული 🏋️‍♀️✨ მიყვარს ჯანსაღი კერძების მომზადება და მთაში ლაშქრობები. ვეძებ ენერგიულ და პოზიტიურ ადამიანს.', 'woman', ARRAY['man'], 'თბილისი', 'TBILISI', ARRAY['sport', 'cooking', 'travel', 'nature'], 'short_term', ARRAY['ქართული', 'English'], true, 1, 1004, 18, 99, 50, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000004', 'c0010001-0000-4000-8000-000000000004', gen_random_uuid(), 'd0010001000040008000000000000004.jpg', 'd0010001000040008000000000000004.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000004', 300, 0, NOW());

-- User 5: სალომე (Salome)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000005', 'salome.georgia@appdate.ge', 'SALOME.GEORGIA@APPDATE.GE', 'salome.georgia@appdate.ge', 'SALOME.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP5', 'STAMP5', false, false, false, 0, true, '2001-11-08', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000005', 'სალომე', 'ლიტერატურის და კინოს მოყვარული 🎬📚 ფრანგული ენის სპეციალისტი. მიყვარს ვინტაჟური კაფეები, მყუდრო საღამოები და გემრიელი დესერტების ცხობა.', 'woman', ARRAY['man'], 'ქუთაისი', 'KUTAISI', ARRAY['books', 'film', 'art', 'cooking'], 'long_term', ARRAY['ქართული', 'English', 'Français'], true, 1, 1005, 18, 99, 100, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000005', 'c0010001-0000-4000-8000-000000000005', gen_random_uuid(), 'd0010001000040008000000000000005.jpg', 'd0010001000040008000000000000005.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000005', 600, 0, NOW());

-- User 6: ელენე (Elene)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000006', 'elene.georgia@appdate.ge', 'ELENE.GEORGIA@APPDATE.GE', 'elene.georgia@appdate.ge', 'ELENE.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP6', 'STAMP6', false, false, false, 0, true, '2004-06-20', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000006', 'ელენე', 'მუსიკა ჩემი ცხოვრების მთავარი ნაწილია 🎸🎶 ვუკრავ აკუსტიკურ გიტარაზე და ვწერ სიმღერებს. მიყვარს ბუნებაში გასვლა, ვარსკვლავების ყურება და გულწრფელი ემოციები.', 'woman', ARRAY['man'], 'თბილისი', 'TBILISI', ARRAY['music', 'travel', 'nature', 'film'], 'open_to_either', ARRAY['ქართული', 'English'], true, 1, 1006, 18, 99, 50, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000006', 'c0010001-0000-4000-8000-000000000006', gen_random_uuid(), 'd0010001000040008000000000000006.jpg', 'd0010001000040008000000000000006.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000006', 450, 0, NOW());

-- User 7: ლიკა (Lika)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000007', 'lika.georgia@appdate.ge', 'LIKA.GEORGIA@APPDATE.GE', 'lika.georgia@appdate.ge', 'LIKA.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP7', 'STAMP7', false, false, false, 0, true, '2006-01-30', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000007', 'ლიკა', 'სამედიცინოს სტუდენტი 🩺✨ თავისუფალ დროს ვცურავ ან ფერწერით ვარ დაკავებული. ვაფასებ ერთგულებას, ყურადღებას და პატივისცემას.', 'woman', ARRAY['man'], 'ბათუმი', 'BATUMI', ARRAY['art', 'nature', 'travel', 'sport'], 'long_term', ARRAY['ქართული', 'English', 'Türkçe'], true, 1, 1007, 18, 99, 100, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000007', 'c0010001-0000-4000-8000-000000000007', gen_random_uuid(), 'd0010001000040008000000000000007.jpg', 'd0010001000040008000000000000007.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000007', 280, 0, NOW());

-- User 8: თინათინი (Tinatin)
INSERT INTO "AspNetUsers" ("Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount", "IsActive", "DateOfBirth", "IsDeleted")
VALUES ('c0010001-0000-4000-8000-000000000008', 'tinatin.georgia@appdate.ge', 'TINATIN.GEORGIA@APPDATE.GE', 'tinatin.georgia@appdate.ge', 'TINATIN.GEORGIA@APPDATE.GE', true, 'AQAAAAIAAYagAAAAENoPasswordHashNeededForTestProfiles1234567890=', 'STAMP8', 'STAMP8', false, false, false, 0, true, '2000-08-16', false);

INSERT INTO "DatingProfile" ("UserId", "DisplayName", "Bio", "Gender", "DesiredGenders", "City", "CityKey", "Interests", "RelationshipGoal", "Languages", "Visible", "Revision", "DiscoverySequence", "MinAge", "MaxAge", "RadiusKm", "LocationMode")
VALUES ('c0010001-0000-4000-8000-000000000008', 'თინათინი', 'მარკეტინგის მენეჯერი საერთაშორისო კომპანიაში 💼✈️ ვმოგზაურობ ბევრს, მიყვარს ახალი კულტურების და სამზარეულოების გაცნობა. იდეალური დეითი = გემრიელი ვახშამი + კარგი იუმორი.', 'woman', ARRAY['man'], 'თბილისი', 'TBILISI', ARRAY['technology', 'travel', 'books', 'cooking'], 'figuring_out', ARRAY['ქართული', 'English', 'Deutsch'], true, 1, 1008, 18, 99, 50, 'city');

INSERT INTO "ProfilePhoto" ("Id", "UserId", "RequestId", "ObjectKey", "ThumbnailKey", "State", "Position", "Width", "Height", "CreatedAt", "Deleted", "ObjectsDeleted")
VALUES ('d0010001-0000-4000-8000-000000000008', 'c0010001-0000-4000-8000-000000000008', gen_random_uuid(), 'd0010001000040008000000000000008.jpg', 'd0010001000040008000000000000008.jpg', 'approved', 0, 1024, 1365, NOW(), false, false);

INSERT INTO "UserWallets" ("UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc")
VALUES ('c0010001-0000-4000-8000-000000000008', 550, 0, NOW());

COMMIT;
