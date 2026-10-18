with open('backend/Dating.Api/Features/Matching/MatchService.cs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = [
    '   Profile=db.Set<DatingProfile>().Where(p=>p.UserId==(m.FirstId==user?m.SecondId:m.FirstId))\n',
    '    .Select(p=>new {\n',
    '     p.UserId,p.DisplayName,p.City,p.Bio,p.Gender,p.RelationshipGoal,p.Interests,p.User.DateOfBirth\n',
    '    }).Single()\n',
    '  }).ToArrayAsync(ct);\n',
    '  var ids = rows.Select(r => r.Profile.UserId).ToArray();\n',
    '  var photos = await db.Set<ProfilePhoto>().AsNoTracking()\n',
    '      .Where(f => ids.Contains(f.UserId) && !f.Deleted && f.State == "approved")\n',
    '      .OrderBy(f => f.Position)\n',
    '      .Select(f => new { f.UserId, Photo = new PhotoDto(f.Id, f.State, f.Position, f.Width, f.Height) })\n',
    '      .ToListAsync(ct);\n',
    '  var items=rows.Take(20).Select(r=>{\n',
    '   var userPhotos = photos.Where(f => f.UserId == r.Profile.UserId).Select(f => f.Photo).ToArray();\n',
    '   return new MatchSummary(\n',
    '    r.Id,\n',
    '    r.Profile.DisplayName,\n',
    '    ProfileRules.Age(r.Profile.DateOfBirth,clock.GetUtcNow()),\n',
    '    r.Profile.City,\n',
    '    r.ConversationId,\n',
    '    r.LastMessage==null?null:r.LastMessage.Substring(0,Math.Min(120,r.LastMessage.Length)),\n',
    '    r.Unread,\n',
    '    userPhotos.FirstOrDefault(),\n',
    '    r.Profile.Bio ?? "",\n',
    '    r.Profile.Gender ?? "",\n',
    '    r.Profile.RelationshipGoal ?? "",\n',
    '    r.Profile.Interests ?? [],\n',
    '    userPhotos,\n',
    '    r.Profile.UserId);\n',
    '  }).ToArray();\n',
    '  return new(items,rows.Length>20?items[^1].Id:null);\n',
]

result = lines[:29] + new_lines + lines[38:]
with open('backend/Dating.Api/Features/Matching/MatchService.cs', 'w', encoding='utf-8') as f:
    f.writelines(result)
print("UPDATED SUCCESSFULLY")
