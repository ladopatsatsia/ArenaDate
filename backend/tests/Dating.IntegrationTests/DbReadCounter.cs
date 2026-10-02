using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
namespace Dating.IntegrationTests;
internal sealed class DbReadCounter : DbCommandInterceptor
{
    private int count;
    public int Count => Volatile.Read(ref count);
    public void Reset() => Interlocked.Exchange(ref count, 0);
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    { Interlocked.Increment(ref count); return ValueTask.FromResult(result); }
}
