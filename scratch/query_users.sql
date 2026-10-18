SELECT u."Id", u."Email", u."EmailConfirmed", u."DateOfBirth", p."DisplayName", p."Gender", p."DesiredGenders", p."City", p."CityKey", p."LocationMode", p."Visible"
FROM "AspNetUsers" u
LEFT JOIN "DatingProfile" p ON u."Id" = p."UserId";
