SELECT m."Id" AS "MatchId", m."Active", m."HasChatEntitlement", c."Id" AS "ConvId"
FROM "DatingMatch" m
JOIN "Conversation" c ON c."MatchId" = m."Id"
WHERE c."Id" = '4c820ef4-5c60-4c22-8b89-bb1f2ec81375'
  AND (m."FirstId" = '689d971e-74b2-4487-9522-357494e07dbb' OR m."SecondId" = '689d971e-74b2-4487-9522-357494e07dbb')
  AND m."Active" = true
  AND EXISTS (SELECT 1 FROM "AspNetUsers" u WHERE u."Id" = m."FirstId" AND u."IsActive" = true AND u."EmailConfirmed" = true)
  AND EXISTS (SELECT 1 FROM "AspNetUsers" u WHERE u."Id" = m."SecondId" AND u."IsActive" = true AND u."EmailConfirmed" = true)
  AND NOT EXISTS (SELECT 1 FROM "UserBlock" b WHERE (b."BlockerId" = m."FirstId" AND b."BlockedId" = m."SecondId") OR (b."BlockerId" = m."SecondId" AND b."BlockedId" = m."FirstId"))
  AND NOT EXISTS (SELECT 1 FROM "UnmatchedPair" p WHERE (p."FirstId" = m."FirstId" AND p."SecondId" = m."SecondId") OR (p."SecondId" = m."FirstId" AND p."FirstId" = m."SecondId"));
