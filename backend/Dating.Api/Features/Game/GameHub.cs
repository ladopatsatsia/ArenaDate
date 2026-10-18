using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Dating.Api.Features.Game;

[Authorize]
public sealed class GameHub(GameService service, GameConnections connections, TimeProvider clock) : Hub
{
    private Guid UserId => Guid.TryParse(Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

    public async Task Subscribe(Guid roomId)
    {
        var userId = UserId;
        await service.AuthorizeRoomSubscription(roomId, userId, Context.ConnectionAborted);
        connections.AddConnection(Context.ConnectionId, userId, roomId, clock.GetUtcNow());
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(roomId), Context.ConnectionAborted);
        await service.HandleMemberConnected(roomId, userId, Context.ConnectionAborted);
    }

    public async Task Unsubscribe(Guid roomId)
    {
        var info = connections.RemoveConnection(Context.ConnectionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomId), Context.ConnectionAborted);
        if (info != null)
        {
            var remaining = connections.GetActiveConnectionsCountForUserInRoom(info.UserId, roomId);
            if (remaining == 0)
            {
                await service.HandleTransientDisconnect(info.UserId, roomId, Context.ConnectionAborted);
            }
        }
    }

    public async Task Heartbeat(Guid roomId)
    {
        var userId = UserId;
        await service.Heartbeat(roomId, userId, Context.ConnectionAborted);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var info = connections.RemoveConnection(Context.ConnectionId);
        if (info != null)
        {
            var remaining = connections.GetActiveConnectionsCountForUserInRoom(info.UserId, info.RoomId);
            if (remaining == 0)
            {
                await service.HandleTransientDisconnect(info.UserId, info.RoomId, CancellationToken.None);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }

    public static string RoomGroup(Guid roomId) => $"game_room_{roomId:N}";
}
