SELECT u."Id", u."Email", p."DisplayName", p."Gender"
FROM "AspNetUsers" u
JOIN "DatingProfile" p ON u."Id" = p."UserId"
WHERE u."Id" IN ('1c368b87-3cb8-4aa5-aa83-25779d4e8a9d', '6ba34e3f-d852-467c-8b4e-bf351a7de75a');
