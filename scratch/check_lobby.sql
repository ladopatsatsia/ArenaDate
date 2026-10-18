SELECT m."Id", m."RoomId", m."UserId", m."Status", m."JoinedAtUtc", m."LastHeartbeatUtc", r."State", r."Title"
FROM "GameMemberships" m
JOIN "GameRooms" r ON m."RoomId" = r."Id"
WHERE r."State" = 'Lobby';
