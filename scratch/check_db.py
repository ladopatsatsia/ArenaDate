import psycopg2

conn = psycopg2.connect("host=127.0.0.1 port=55432 dbname=dating user=dating password=postgres")
cur = conn.cursor()
cur.execute('SELECT "Id", "RoomId", "UserId", "Status", "JoinedAtUtc" FROM "GameMemberships" WHERE "Status" = \'Active\';')
rows = cur.fetchall()
print(f"Active memberships: {len(rows)}")
for r in rows:
    print(r)

cur.execute('SELECT "Id", "Title", "State", "Capacity", "FemaleQuota", "MaleQuota" FROM "GameRooms" WHERE "State" != \'Ended\';')
rooms = cur.fetchall()
print(f"Open rooms: {len(rooms)}")
for rm in rooms:
    print(rm)
