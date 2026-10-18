UPDATE "GameMemberships"
SET "Status" = 'Left', "LeftAtUtc" = NOW()
WHERE "Status" = 'Active'
  AND "RoomId" IN (SELECT "Id" FROM "GameRooms" WHERE "State" = 'Lobby')
  AND "LastHeartbeatUtc" < NOW() - INTERVAL '15 seconds';

UPDATE "GameRooms" r
SET "State" = 'Ended'
WHERE r."State" = 'Lobby'
  AND NOT EXISTS (
    SELECT 1 FROM "GameMemberships" m
    WHERE m."RoomId" = r."Id" AND m."Status" = 'Active'
  );

SELECT m."Id", m."RoomId", m."UserId", m."Status", r."State", r."Title"
FROM "GameMemberships" m
JOIN "GameRooms" r ON m."RoomId" = r."Id"
WHERE r."State" = 'Lobby';
