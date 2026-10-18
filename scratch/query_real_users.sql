SELECT u."Id", u."Email", u."EmailConfirmed", u."DateOfBirth", p."DisplayName", p."Gender", p."DesiredGenders", p."City", p."CityKey", p."LocationMode", p."Visible", p."MinAge", p."MaxAge", p."Interests", p."RelationshipGoal"
FROM "AspNetUsers" u
LEFT JOIN "DatingProfile" p ON u."Id" = p."UserId"
WHERE u."Email" NOT LIKE 'fixture%' AND u."Email" NOT LIKE 'smoke%';
