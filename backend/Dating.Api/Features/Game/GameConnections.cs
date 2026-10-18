using System.Collections.Concurrent;

namespace Dating.Api.Features.Game;

public sealed record GameConnectionInfo(string ConnectionId, Guid UserId, Guid RoomId, DateTimeOffset ConnectedAtUtc);

public sealed class GameConnections
{
    private readonly ConcurrentDictionary<string, GameConnectionInfo> _connections = new();

    public void AddConnection(string connectionId, Guid userId, Guid roomId, DateTimeOffset now)
    {
        _connections[connectionId] = new GameConnectionInfo(connectionId, userId, roomId, now);
    }

    public GameConnectionInfo? RemoveConnection(string connectionId)
    {
        _connections.TryRemove(connectionId, out var info);
        return info;
    }

    public int GetActiveConnectionsCountForUserInRoom(Guid userId, Guid roomId)
    {
        return _connections.Values.Count(c => c.UserId == userId && c.RoomId == roomId);
    }

    public bool IsUserConnectedInRoom(Guid userId, Guid roomId)
    {
        return _connections.Values.Any(c => c.UserId == userId && c.RoomId == roomId);
    }

    public string[] GetConnectionsForRoom(Guid roomId)
    {
        return _connections.Values.Where(c => c.RoomId == roomId).Select(c => c.ConnectionId).ToArray();
    }
}
