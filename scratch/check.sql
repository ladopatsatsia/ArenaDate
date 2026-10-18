SELECT "Id", "RoomId", "UserId", "Status", "JoinedAtUtc" FROM "GameMemberships" WHERE "Status" = 'Active';
SELECT "Id", "Title", "State", "Capacity", "FemaleQuota", "MaleQuota" FROM "GameRooms" WHERE "State" != 'Ended';
