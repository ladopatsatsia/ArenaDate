SELECT u."Id", u."Email", p."DisplayName", p."Gender", p."CityKey", p."Bio",
       COUNT(ph."Id") AS photo_count,
       COUNT(CASE WHEN ph."State" = 'approved' AND NOT ph."Deleted" THEN 1 END) AS approved_photos
FROM "AspNetUsers" u
JOIN "DatingProfile" p ON u."Id" = p."UserId"
LEFT JOIN "ProfilePhoto" ph ON u."Id" = ph."UserId"
WHERE u."Email" NOT LIKE 'fixture%'
GROUP BY u."Id", u."Email", p."DisplayName", p."Gender", p."CityKey", p."Bio";
