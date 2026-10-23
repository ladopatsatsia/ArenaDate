async function testGame() {
  // 1. Authenticate with a test user without any photo
  const authRes = await fetch('https://arenadate-production.up.railway.app/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: 'hash=dev_mock&user=%7B%22id%22%3A999888777%2C%22first_name%22%3A%22NoPhotoPlayer%22%7D' })
  });
  const authData = await authRes.json();
  const token = authData.tokens.accessToken;

  // 2. Fetch current profile to get current revision
  const profRes = await fetch('https://arenadate-production.up.railway.app/api/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const currentProf = await profRes.json();

  // 3. Update profile with complete fields (POST /api/profile)
  const updateRes = await fetch('https://arenadate-production.up.railway.app/api/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      revision: currentProf.revision,
      displayName: 'NoPhotoPlayer',
      gender: 'man',
      desiredGenders: ['woman'],
      city: 'თბილისი',
      bio: 'Testing bottle game without photo long bio for test',
      interests: ['music'],
      relationshipGoal: 'long_term',
      visible: true
    })
  });
  console.log('Update profile status:', updateRes.status);

  // 4. Try to join game queue
  const queueRes = await fetch('https://arenadate-production.up.railway.app/api/game/queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ format: 'Standard5F5M' })
  });
  console.log('Queue Status:', queueRes.status, await queueRes.text());
}
testGame();
