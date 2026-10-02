using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Matching;
// All pair writers acquire both user rows in PostgreSQL UUID order BEFORE reading domain state.
// Profile/auth writers already lock their one user row. No application-memory locks.
public sealed class PairSynchronization(AppDbContext db) {
 public static (Guid First, Guid Second) Order(Guid a, Guid b) =>
  string.CompareOrdinal(a.ToString("N"), b.ToString("N")) < 0 ? (a,b) : (b,a);
 public async Task Lock(Guid a, Guid b, CancellationToken ct) {
  if (a == b || a == Guid.Empty || b == Guid.Empty) throw new AuthFailure(400, "invalid_pair");
  if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Transaction required.");
  await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);
  var users = await db.Users.FromSqlInterpolated(
   $"SELECT * FROM \"AspNetUsers\" WHERE \"Id\" IN ({a}, {b}) ORDER BY \"Id\" FOR UPDATE").ToListAsync(ct);
  if (users.Count != 2) throw new AuthFailure(404, "profile_unavailable");
 }
}
