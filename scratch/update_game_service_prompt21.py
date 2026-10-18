import re

file_path = r'backend/Dating.Api/Features/Game/GameService.cs'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update StartingCountdown, TurnPending, Spinning, and add TargetSelection in CheckTimeoutsAndProgressAsync
old_block_1 = """                else if (lockedRoom.DeadlineType == "StartingCountdown")
                {
                    lockedRoom.State = GameRoomState.Playing;
                    var firstTurn = await db.Set<GameMembership>()
                        .Where(m => m.RoomId == lockedRoom.Id && m.Status == GameMembershipStatus.Active)
                        .OrderBy(m => m.JoinedAtUtc)
                        .Select(m => m.UserId)
                        .FirstOrDefaultAsync(ct);

                    lockedRoom.CurrentTurnUserId = firstTurn;
                    lockedRoom.DeadlineUtc = now.AddSeconds(15);
                    lockedRoom.DeadlineType = "TurnPending";
                    lockedRoom.StateVersion++;

                    await EmitOutboxEventAsync(lockedRoom, "TurnStarted", new
                    {
                        RoomId = lockedRoom.Id,
                        TurnUserId = firstTurn,
                        DeadlineUtc = lockedRoom.DeadlineUtc,
                        TimestampUtc = now
                    }, ct);
                }
                else if (lockedRoom.DeadlineType == "TurnPending")
                {
                    var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, lockedRoom.CurrentTurnUserId ?? Guid.Empty, ct);
                    lockedRoom.CurrentTurnUserId = nextTurn;
                    lockedRoom.DeadlineUtc = now.AddSeconds(15);
                    lockedRoom.DeadlineType = "TurnPending";
                    lockedRoom.StateVersion++;

                    await EmitOutboxEventAsync(lockedRoom, "TurnStarted", new
                    {
                        RoomId = lockedRoom.Id,
                        TurnUserId = nextTurn,
                        DeadlineUtc = lockedRoom.DeadlineUtc,
                        TimestampUtc = now
                    }, ct);
                }
                else if (lockedRoom.DeadlineType == "Spinning")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "Spinning")
                        {
                            round.State = "QuestionAnswering";
                            round.CurrentQuestionIndex = 0;
                            lockedRoom.DeadlineUtc = now.AddSeconds(20);
                            lockedRoom.DeadlineType = "QuestionAnswering";
                            lockedRoom.StateVersion++;

                            await EmitOutboxEventAsync(lockedRoom, "QuestionStarted", new
                            {
                                RoomId = lockedRoom.Id,
                                RoundId = round.Id,
                                QuestionIndex = 0,
                                SpinnerUserId = round.SpinnerUserId,
                                TargetUserId = round.TargetUserId,
                                DeadlineUtc = lockedRoom.DeadlineUtc,
                                TimestampUtc = now
                            }, ct);
                        }
                    }
                }"""

new_block_1 = """                else if (lockedRoom.DeadlineType == "StartingCountdown")
                {
                    lockedRoom.State = GameRoomState.Playing;
                    var firstTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, Guid.Empty, ct);
                    if (firstTurn.HasValue)
                    {
                        await StartNextRoundAsync(lockedRoom, firstTurn.Value, now, ct);
                    }
                    else
                    {
                        lockedRoom.CurrentTurnUserId = null;
                        lockedRoom.DeadlineUtc = now.AddSeconds(15);
                        lockedRoom.DeadlineType = "TurnPending";
                        lockedRoom.StateVersion++;
                    }
                }
                else if (lockedRoom.DeadlineType == "TurnPending")
                {
                    var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, lockedRoom.CurrentTurnUserId ?? Guid.Empty, ct);
                    if (nextTurn.HasValue)
                    {
                        await StartNextRoundAsync(lockedRoom, nextTurn.Value, now, ct);
                    }
                }
                else if (lockedRoom.DeadlineType == "Spinning")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "Spinning")
                        {
                            if (round.TargetUserId != Guid.Empty)
                            {
                                round.State = "QuestionAnswering";
                                round.CurrentQuestionIndex = 0;
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "QuestionAnswering";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "QuestionStarted", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    QuestionIndex = 0,
                                    SpinnerUserId = round.SpinnerUserId,
                                    TargetUserId = round.TargetUserId,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                            else
                            {
                                round.State = "SelectingTarget";
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "TargetSelection";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "TargetSelectionStarted", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    SpinnerUserId = round.SpinnerUserId,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                        }
                    }
                }
                else if (lockedRoom.DeadlineType == "TargetSelection")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "SelectingTarget")
                        {
                            var fallbackTarget = await PickFallbackTargetUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                            if (fallbackTarget.HasValue)
                            {
                                await TransitionToQuestionPhaseAsync(lockedRoom, round, fallbackTarget.Value, now, ct);
                            }
                            else
                            {
                                round.State = "EndedEarly";
                                round.CompletedAtUtc = now;
                                var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                                if (totalRounds >= 18)
                                {
                                    await EndGameAsync(lockedRoom, totalRounds, now, ct);
                                }
                                else
                                {
                                    var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                    if (nextTurn.HasValue)
                                    {
                                        await StartNextRoundAsync(lockedRoom, nextTurn.Value, now, ct);
                                    }
                                }
                            }
                        }
                    }
                }"""

assert old_block_1 in code, "old_block_1 not found in GameService.cs"
code = code.replace(old_block_1, new_block_1, 1)

# 2. Update RoundEndedEarly in QuestionRevealing
old_block_2 = """                            else if (round.ConsecutiveIncompleteQuestions >= 2)
                            {
                                round.State = "EndedEarly";
                                round.CompletedAtUtc = now;
                                round.SummaryCommentary = await GenerateRoundSummaryCommentaryAsync(round, ct);
                                var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                lockedRoom.CurrentTurnUserId = nextTurn;
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "TurnPending";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "RoundEndedEarly", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    Reason = "consecutive_incomplete_questions",
                                    SummaryCommentary = round.SummaryCommentary,
                                    NextTurnUserId = nextTurn,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }"""

new_block_2 = """                            else if (round.ConsecutiveIncompleteQuestions >= 2)
                            {
                                round.State = "EndedEarly";
                                round.CompletedAtUtc = now;
                                round.SummaryCommentary = await GenerateRoundSummaryCommentaryAsync(round, ct);
                                var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                                if (totalRounds >= 18)
                                {
                                    await EndGameAsync(lockedRoom, totalRounds, now, ct);
                                }
                                else
                                {
                                    var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                    if (nextTurn.HasValue)
                                    {
                                        await StartNextRoundAsync(lockedRoom, nextTurn.Value, now, ct);
                                    }
                                }

                                await EmitOutboxEventAsync(lockedRoom, "RoundEndedEarly", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    Reason = "consecutive_incomplete_questions",
                                    SummaryCommentary = round.SummaryCommentary,
                                    NextTurnUserId = lockedRoom.CurrentTurnUserId,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }"""

assert old_block_2 in code, "old_block_2 not found in GameService.cs"
code = code.replace(old_block_2, new_block_2, 1)

# 3. Update KissChoice timeout in CheckTimeoutsAndProgressAsync
old_block_3 = """                else if (lockedRoom.DeadlineType == "KissChoice")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "KissChoice")
                        {
                            round.KissSkipped = true;
                            round.State = "Completed";
                            round.CompletedAtUtc = now;

                            var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                            lockedRoom.CurrentTurnUserId = nextTurn;
                            lockedRoom.DeadlineUtc = now.AddSeconds(15);
                            lockedRoom.DeadlineType = "TurnPending";
                            lockedRoom.StateVersion++;

                            await EmitOutboxEventAsync(lockedRoom, "RoundCompleted", new
                            {
                                RoomId = lockedRoom.Id,
                                RoundId = round.Id,
                                NextTurnUserId = nextTurn,
                                DeadlineUtc = lockedRoom.DeadlineUtc,
                                TimestampUtc = now
                            }, ct);
                        }
                    }
                }"""

new_block_3 = """                else if (lockedRoom.DeadlineType == "KissChoice")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "KissChoice")
                        {
                            round.KissSkipped = true;
                            round.State = "Completed";
                            round.CompletedAtUtc = now;

                            var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                            if (totalRounds >= 18)
                            {
                                await EndGameAsync(lockedRoom, totalRounds, now, ct);
                            }
                            else
                            {
                                var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                if (nextTurn.HasValue)
                                {
                                    await StartNextRoundAsync(lockedRoom, nextTurn.Value, now, ct);
                                }
                            }

                            await EmitOutboxEventAsync(lockedRoom, "RoundCompleted", new
                            {
                                RoomId = lockedRoom.Id,
                                RoundId = round.Id,
                                NextTurnUserId = lockedRoom.CurrentTurnUserId,
                                DeadlineUtc = lockedRoom.DeadlineUtc,
                                TimestampUtc = now
                            }, ct);
                        }
                    }
                }"""

assert old_block_3 in code, "old_block_3 not found in GameService.cs"
code = code.replace(old_block_3, new_block_3, 1)

# 4. Update SelectNextTurnUserIdAsync and helper methods, and SpinBottle
old_block_4 = """    public async Task<Guid?> SelectNextTurnUserIdAsync(Guid roomId, Guid currentUserId, CancellationToken ct)
    {
        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .OrderBy(m => m.JoinedAtUtc)
            .Select(m => m.UserId)
            .ToListAsync(ct);

        if (activeMembers.Count == 0) return null;

        var currentIndex = activeMembers.IndexOf(currentUserId);
        if (currentIndex < 0) return activeMembers[0];

        var nextIndex = (currentIndex + 1) % activeMembers.Count;
        return activeMembers[nextIndex];
    }

    public async Task<SpinResult> SpinBottle(Guid roomId, Guid userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \\"GameRooms\\" WHERE \\"Id\\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing && room.State != GameRoomState.Starting)
            throw new AuthFailure(400, "room_not_playing");

        if (room.CurrentTurnUserId != null && room.CurrentTurnUserId != userId)
            throw new AuthFailure(403, "not_your_turn");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_active_member");

        if (room.CurrentRoundId.HasValue)
        {
            var activeRound = await db.Set<GameRound>().SingleOrDefaultAsync(r => r.Id == room.CurrentRoundId.Value, ct);
            if (activeRound != null && activeRound.State != "Completed" && activeRound.State != "EndedEarly")
            {
                throw new AuthFailure(409, "round_in_progress");
            }
        }

        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .ToListAsync(ct);

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        var candidateMembers = activeMembers.Where(m => m.UserId != userId && m.Gender == oppositeGender).ToList();

        var eligible = new List<GameMembership>();
        foreach (var candidate in candidateMembers)
        {
            var incomp = await CheckIncompatible(userId, [candidate.UserId], ct);
            if (!incomp)
            {
                eligible.Add(candidate);
            }
        }

        if (eligible.Count == 0)
            throw new AuthFailure(400, "no_eligible_partners");

        var targetIndex = RandomNumberGenerator.GetInt32(eligible.Count);
        var target = eligible[targetIndex];

        var angle = RandomNumberGenerator.GetInt32(0, 360);

        await EnsureSeededQuestionsAsync(ct);

        var allQuestions = await db.Set<GameQuestion>()
            .Where(q => q.IsActive)
            .ToListAsync(ct);

        var shuffled = allQuestions.OrderBy(_ => RandomNumberGenerator.GetInt32(10000)).Take(1).ToList();
        var frozen = shuffled.Select(q => new FrozenQuestionDto(
            q.Id,
            q.QuestionText,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
            q.Category
        )).ToList();

        var now = clock.GetUtcNow();
        var roundNumber = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct) + 1;

        var round = new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundNumber = roundNumber,
            SpinnerUserId = userId,
            TargetUserId = target.UserId,
            AngleDegrees = angle,
            State = "Spinning",
            CurrentQuestionIndex = 0,
            ConsecutiveIncompleteQuestions = 0,
            QuestionsJson = JsonSerializer.Serialize(frozen),
            RevealedSelectionsJson = "[]",
            StartedAtUtc = now
        };
        db.Set<GameRound>().Add(round);

        room.CurrentRoundId = round.Id;
        room.CurrentTurnUserId = userId;
        room.DeadlineUtc = now.AddSeconds(4);
        room.DeadlineType = "Spinning";
        room.State = GameRoomState.Playing;
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "BottleSpun", new
        {
            RoomId = roomId,
            RoundId = round.Id,
            SpinnerUserId = userId,
            TargetUserId = target.UserId,
            AngleDegrees = angle,
            SpinDurationMs = 4000,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SpinResult(round.Id, userId, target.UserId, angle, 4000, room.DeadlineUtc.Value);
    }"""

new_block_4 = """    public async Task<Guid?> SelectNextTurnUserIdAsync(Guid roomId, Guid currentUserId, CancellationToken ct)
    {
        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .OrderBy(m => m.JoinedAtUtc)
            .ToListAsync(ct);

        if (activeMembers.Count == 0) return null;

        var women = activeMembers.Where(m => m.Gender == "woman").OrderBy(m => m.JoinedAtUtc).ToList();
        var men = activeMembers.Where(m => m.Gender == "man").OrderBy(m => m.JoinedAtUtc).ToList();

        var interleaved = new List<Guid>();
        var maxCount = Math.Max(women.Count, men.Count);
        for (var i = 0; i < maxCount; i++)
        {
            if (i < women.Count) interleaved.Add(women[i].UserId);
            if (i < men.Count) interleaved.Add(men[i].UserId);
        }

        if (interleaved.Count == 0) return activeMembers[0].UserId;

        var currentIndex = interleaved.IndexOf(currentUserId);
        if (currentIndex < 0) return interleaved[0];

        var nextIndex = (currentIndex + 1) % interleaved.Count;
        return interleaved[nextIndex];
    }

    public async Task StartNextRoundAsync(GameRoom room, Guid spinnerUserId, DateTimeOffset now, CancellationToken ct)
    {
        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == room.Id && m.Status == GameMembershipStatus.Active)
            .OrderBy(m => m.JoinedAtUtc)
            .ToListAsync(ct);

        var index = activeMembers.FindIndex(m => m.UserId == spinnerUserId);
        var total = activeMembers.Count > 0 ? activeMembers.Count : 6;
        var angle = index >= 0 ? (int)((index / (double)total) * 360) : RandomNumberGenerator.GetInt32(0, 360);

        var roundNumber = await db.Set<GameRound>().CountAsync(r => r.RoomId == room.Id, ct) + 1;

        var round = new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            RoundNumber = roundNumber,
            SpinnerUserId = spinnerUserId,
            TargetUserId = Guid.Empty,
            AngleDegrees = angle,
            State = "Spinning",
            CurrentQuestionIndex = 0,
            ConsecutiveIncompleteQuestions = 0,
            QuestionsJson = "[]",
            RevealedSelectionsJson = "[]",
            StartedAtUtc = now
        };
        db.Set<GameRound>().Add(round);

        room.CurrentRoundId = round.Id;
        room.CurrentTurnUserId = spinnerUserId;
        room.DeadlineUtc = now.AddSeconds(4);
        room.DeadlineType = "Spinning";
        room.State = GameRoomState.Playing;
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "BottleSpun", new
        {
            RoomId = room.Id,
            RoundId = round.Id,
            SpinnerUserId = spinnerUserId,
            TargetUserId = Guid.Empty,
            AngleDegrees = angle,
            SpinDurationMs = 4000,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);
    }

    public async Task<Guid?> PickFallbackTargetUserIdAsync(Guid roomId, Guid spinnerUserId, CancellationToken ct)
    {
        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == spinnerUserId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) return null;

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        var candidateMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active && m.Gender == oppositeGender && m.UserId != spinnerUserId)
            .ToListAsync(ct);

        var eligible = new List<GameMembership>();
        foreach (var c in candidateMembers)
        {
            if (!await CheckIncompatible(spinnerUserId, [c.UserId], ct))
                eligible.Add(c);
        }

        if (eligible.Count == 0) return null;
        var idx = RandomNumberGenerator.GetInt32(eligible.Count);
        return eligible[idx].UserId;
    }

    private async Task<FrozenQuestionDto> TransitionToQuestionPhaseAsync(
        GameRoom room,
        GameRound round,
        Guid targetUserId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        round.TargetUserId = targetUserId;

        await EnsureSeededQuestionsAsync(ct);
        var allQuestions = await db.Set<GameQuestion>()
            .Where(q => q.IsActive)
            .ToListAsync(ct);

        var shuffled = allQuestions.OrderBy(_ => RandomNumberGenerator.GetInt32(10000)).Take(1).ToList();
        var frozen = shuffled.Select(q => new FrozenQuestionDto(
            q.Id,
            q.QuestionText,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
            q.Category
        )).ToList();

        round.QuestionsJson = JsonSerializer.Serialize(frozen);
        round.State = "QuestionAnswering";
        round.CurrentQuestionIndex = 0;

        room.DeadlineUtc = now.AddSeconds(15);
        room.DeadlineType = "QuestionAnswering";
        room.StateVersion++;

        var currentQ = frozen.First();

        await EmitOutboxEventAsync(room, "QuestionStarted", new
        {
            RoomId = room.Id,
            RoundId = round.Id,
            QuestionIndex = 0,
            SpinnerUserId = round.SpinnerUserId,
            TargetUserId = targetUserId,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);

        return currentQ;
    }

    private async Task EndGameAsync(GameRoom room, int totalRounds, DateTimeOffset now, CancellationToken ct)
    {
        room.State = GameRoomState.Ended;
        room.DeadlineType = "GameEnded";
        room.DeadlineUtc = null;
        room.CurrentRoundId = null;
        room.CurrentTurnUserId = null;
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "GameEnded", new
        {
            RoomId = room.Id,
            TotalRounds = totalRounds,
            TimestampUtc = now
        }, ct);
    }

    public async Task<SelectTargetResult> SelectTarget(Guid roomId, Guid roundId, Guid userId, Guid targetUserId, CancellationToken ct)
    {
        if (userId == targetUserId)
            throw new AuthFailure(400, "cannot_target_self");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \\"GameRooms\\" WHERE \\"Id\\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing) throw new AuthFailure(400, "room_not_playing");

        var round = await db.Set<GameRound>()
            .FromSqlInterpolated($"SELECT * FROM \\"GameRounds\\" WHERE \\"Id\\" = {roundId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (round is null || round.RoomId != roomId) throw new AuthFailure(404, "round_not_found");
        if (round.SpinnerUserId != userId) throw new AuthFailure(403, "not_spinner");
        if (round.State != "SelectingTarget") throw new AuthFailure(400, "round_not_selecting_target");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_active_member");

        var targetMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == targetUserId && m.Status == GameMembershipStatus.Active, ct);
        if (targetMembership is null) throw new AuthFailure(404, "target_not_active_member");

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        if (targetMembership.Gender != oppositeGender)
            throw new AuthFailure(400, "target_not_opposite_gender");

        var incomp = await CheckIncompatible(userId, [targetUserId], ct);
        if (incomp) throw new AuthFailure(403, "target_incompatible");

        var now = clock.GetUtcNow();
        var q = await TransitionToQuestionPhaseAsync(room, round, targetUserId, now, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SelectTargetResult(round.Id, userId, targetUserId, q, room.DeadlineUtc!.Value);
    }

    public async Task<PostGameKissResult> PostGameKiss(Guid roomId, Guid userId, PostGameKissRequest req, CancellationToken ct)
    {
        if (req.RecipientUserId == userId)
            throw new AuthFailure(400, "cannot_kiss_self");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \\"GameRooms\\" WHERE \\"Id\\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Ended)
            throw new AuthFailure(400, "room_not_ended");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_room_member");

        var recipientMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == req.RecipientUserId, ct);
        if (recipientMembership is null) throw new AuthFailure(404, "recipient_not_member");

        var incomp = await CheckIncompatible(userId, [req.RecipientUserId], ct);
        if (incomp) throw new AuthFailure(403, "incompatible_user");

        var lastRound = await db.Set<GameRound>()
            .Where(r => r.RoomId == roomId)
            .OrderByDescending(r => r.RoundNumber)
            .FirstOrDefaultAsync(ct);
        var roundId = lastRound?.Id ?? Guid.Empty;

        var existingKiss = await db.Set<GameKiss>()
            .SingleOrDefaultAsync(k => k.RoomId == roomId && k.SenderUserId == userId && k.RecipientUserId == req.RecipientUserId, ct);

        if (existingKiss != null)
        {
            return new PostGameKissResult(existingKiss.Id, userId, req.RecipientUserId, existingKiss.Status, existingKiss.Status == "Matched");
        }

        var now = clock.GetUtcNow();

        var reciprocalKiss = await db.Set<GameKiss>()
            .SingleOrDefaultAsync(k => k.RoomId == roomId && k.SenderUserId == req.RecipientUserId && k.RecipientUserId == userId && k.Status == "Pending", ct);

        var isMutualMatch = reciprocalKiss != null;
        Guid? createdMatchId = null;
        Guid? createdConvId = null;

        var kiss = new GameKiss
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundId = roundId,
            SenderUserId = userId,
            RecipientUserId = req.RecipientUserId,
            SenderGeneration = callerMembership.Generation,
            RecipientGeneration = recipientMembership.Generation,
            Status = isMutualMatch ? "Matched" : "Pending",
            IdempotencyKey = req.IdempotencyKey,
            CreatedAtUtc = now,
            MatchedAtUtc = isMutualMatch ? now : null
        };
        db.Set<GameKiss>().Add(kiss);

        if (isMutualMatch && matchService != null)
        {
            reciprocalKiss!.Status = "Matched";
            reciprocalKiss.MatchedAtUtc = now;

            var (match, conversation, _) = await matchService.CreateOrUnlockGameMatchAsync(userId, req.RecipientUserId, ct);
            createdMatchId = match.Id;
            createdConvId = conversation.Id;

            var decA = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (decA == null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = userId, TargetId = req.RecipientUserId, Kind = "like" });
            else decA.Kind = "like";

            var decB = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == req.RecipientUserId && d.TargetId == userId, ct);
            if (decB == null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = req.RecipientUserId, TargetId = userId, Kind = "like" });
            else decB.Kind = "like";

            await EmitOutboxEventAsync(room, "GameMatchCreated", new
            {
                RoomId = roomId,
                MatchId = match.Id,
                UserA = userId,
                UserB = req.RecipientUserId,
                Origin = "GameArena",
                HasChatEntitlement = false,
                TimestampUtc = now
            }, ct);
        }
        else
        {
            var dec = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (dec is null)
            {
                db.Set<DiscoveryDecision>().Add(new DiscoveryDecision
                {
                    UserId = userId,
                    TargetId = req.RecipientUserId,
                    Kind = "like",
                    CreatedAt = now
                });
            }
            else if (dec.Kind != "like")
            {
                dec.Kind = "like";
                dec.CreatedAt = now;
            }
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new PostGameKissResult(kiss.Id, userId, req.RecipientUserId, kiss.Status, isMutualMatch, createdMatchId, createdConvId);
    }

    public async Task<SpinResult> SpinBottle(Guid roomId, Guid userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \\"GameRooms\\" WHERE \\"Id\\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing && room.State != GameRoomState.Starting)
            throw new AuthFailure(400, "room_not_playing");

        if (room.CurrentTurnUserId != null && room.CurrentTurnUserId != userId)
            throw new AuthFailure(403, "not_your_turn");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_active_member");

        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .ToListAsync(ct);

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        var candidateMembers = activeMembers.Where(m => m.UserId != userId && m.Gender == oppositeGender).ToList();

        var eligible = new List<GameMembership>();
        foreach (var candidate in candidateMembers)
        {
            var incomp = await CheckIncompatible(userId, [candidate.UserId], ct);
            if (!incomp)
            {
                eligible.Add(candidate);
            }
        }

        if (eligible.Count == 0)
            throw new AuthFailure(400, "no_eligible_partners");

        var now = clock.GetUtcNow();

        if (room.CurrentRoundId.HasValue)
        {
            var activeRound = await db.Set<GameRound>().SingleOrDefaultAsync(r => r.Id == room.CurrentRoundId.Value, ct);
            if (activeRound != null && activeRound.State == "SelectingTarget" && activeRound.SpinnerUserId == userId)
            {
                var fallbackTarget = eligible[RandomNumberGenerator.GetInt32(eligible.Count)];
                await TransitionToQuestionPhaseAsync(room, activeRound, fallbackTarget.UserId, now, ct);
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                return new SpinResult(activeRound.Id, userId, fallbackTarget.UserId, activeRound.AngleDegrees, 4000, room.DeadlineUtc!.Value);
            }
            if (activeRound != null && activeRound.State != "Completed" && activeRound.State != "EndedEarly")
            {
                throw new AuthFailure(409, "round_in_progress");
            }
        }

        var targetIndex = RandomNumberGenerator.GetInt32(eligible.Count);
        var target = eligible[targetIndex];

        var index = activeMembers.FindIndex(m => m.UserId == userId);
        var total = activeMembers.Count > 0 ? activeMembers.Count : 6;
        var angle = index >= 0 ? (int)((index / (double)total) * 360) : RandomNumberGenerator.GetInt32(0, 360);

        await EnsureSeededQuestionsAsync(ct);

        var allQuestions = await db.Set<GameQuestion>()
            .Where(q => q.IsActive)
            .ToListAsync(ct);

        var shuffled = allQuestions.OrderBy(_ => RandomNumberGenerator.GetInt32(10000)).Take(1).ToList();
        var frozen = shuffled.Select(q => new FrozenQuestionDto(
            q.Id,
            q.QuestionText,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
            q.Category
        )).ToList();

        var roundNumber = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct) + 1;

        var round = new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundNumber = roundNumber,
            SpinnerUserId = userId,
            TargetUserId = target.UserId,
            AngleDegrees = angle,
            State = "Spinning",
            CurrentQuestionIndex = 0,
            ConsecutiveIncompleteQuestions = 0,
            QuestionsJson = JsonSerializer.Serialize(frozen),
            RevealedSelectionsJson = "[]",
            StartedAtUtc = now
        };
        db.Set<GameRound>().Add(round);

        room.CurrentRoundId = round.Id;
        room.CurrentTurnUserId = userId;
        room.DeadlineUtc = now.AddSeconds(4);
        room.DeadlineType = "Spinning";
        room.State = GameRoomState.Playing;
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "BottleSpun", new
        {
            RoomId = roomId,
            RoundId = round.Id,
            SpinnerUserId = userId,
            TargetUserId = target.UserId,
            AngleDegrees = angle,
            SpinDurationMs = 4000,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SpinResult(round.Id, userId, target.UserId, angle, 4000, room.DeadlineUtc.Value);
    }"""

assert old_block_4 in code, "old_block_4 not found in GameService.cs"
code = code.replace(old_block_4, new_block_4, 1)

# 5. Update SendKiss and SkipKiss completion to check 18 rounds
old_block_5 = """        var nextTurn = await SelectNextTurnUserIdAsync(roomId, userId, ct);
        room.CurrentTurnUserId = nextTurn;
        room.DeadlineUtc = now.AddSeconds(15);
        room.DeadlineType = "TurnPending";
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "RoundCompleted", new
        {
            RoomId = roomId,
            RoundId = roundId,
            NextTurnUserId = nextTurn,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);"""

new_block_5 = """        var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct);
        if (totalRounds >= 18)
        {
            await EndGameAsync(room, totalRounds, now, ct);
        }
        else
        {
            var nextTurn = await SelectNextTurnUserIdAsync(roomId, userId, ct);
            if (nextTurn.HasValue)
            {
                await StartNextRoundAsync(room, nextTurn.Value, now, ct);
            }
        }

        await EmitOutboxEventAsync(room, "RoundCompleted", new
        {
            RoomId = roomId,
            RoundId = roundId,
            NextTurnUserId = room.CurrentTurnUserId,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);"""

assert old_block_5 in code, "old_block_5 not found in GameService.cs"
code = code.replace(old_block_5, new_block_5, 1)

old_block_6 = """        var nextTurn = await SelectNextTurnUserIdAsync(roomId, userId, ct);
        room.CurrentTurnUserId = nextTurn;
        room.DeadlineUtc = now.AddSeconds(15);
        room.DeadlineType = "TurnPending";
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "RoundCompleted", new
        {
            RoomId = roomId,
            RoundId = roundId,
            NextTurnUserId = nextTurn,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);"""

assert old_block_6 in code, "old_block_6 not found in GameService.cs (for SkipKiss)"
code = code.replace(old_block_6, new_block_5, 1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("GameService.cs successfully updated!")
