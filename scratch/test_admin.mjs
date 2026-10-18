process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const cookieJar = {};
  function parseCookies(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    for (const c of raw) {
      const part = c.split(';')[0];
      const [k, v] = part.split('=');
      if (k && v) cookieJar[k.trim()] = v.trim();
    }
  }
  function cookieHeader() {
    return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // 1. CSRF
  const r0 = await fetch('https://localhost:5181/api/moderation/csrf');
  parseCookies(r0);
  console.log('CSRF status:', r0.status, cookieJar);

  // 2. Login
  const r1 = await fetch('https://localhost:5181/api/moderation/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    },
    body: JSON.stringify({ email: 'admin@appdate.ge', password: 'AdminPassword123!' })
  });
  parseCookies(r1);
  console.log('Login status:', r1.status);

  // Renew CSRF token after login
  const r1b = await fetch('https://localhost:5181/api/moderation/csrf', {
    headers: { 'Cookie': cookieHeader() }
  });
  parseCookies(r1b);
  console.log('Renewed CSRF status:', r1b.status);

  // 3. Create user
  const email = `admin_created_${Date.now()}@appdate.ge`;
  const r2 = await fetch('https://localhost:5181/api/moderation/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    },
    body: JSON.stringify({
      email,
      password: 'AdminPassword123!',
      displayName: 'Tamar Test',
      dateOfBirth: '1999-05-20',
      gender: 'woman',
      city: 'Tbilisi',
      initialCrystals: 120
    })
  });
  const u = await r2.json();
  console.log('Create user status:', r2.status, u);

  // 4. Adjust crystals (+100)
  const r3 = await fetch(`https://localhost:5181/api/moderation/users/${u.userId}/crystals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    },
    body: JSON.stringify({
      amount: 100,
      mode: 'delta',
      reason: 'Admin bonus test'
    })
  });
  const adj1 = await r3.json();
  console.log('Adjust +100 status:', r3.status, adj1);

  // 5. Adjust crystals (-50)
  const r4 = await fetch(`https://localhost:5181/api/moderation/users/${u.userId}/crystals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    },
    body: JSON.stringify({
      amount: -50,
      mode: 'delta',
      reason: 'Admin deduction test'
    })
  });
  const adj2 = await r4.json();
  console.log('Adjust -50 status:', r4.status, adj2);

  // 6. Get profile detail
  const r5 = await fetch(`https://localhost:5181/api/moderation/profiles/${u.userId}`, {
    headers: { 'Cookie': cookieHeader() }
  });
  const detail = await r5.json();
  console.log('Final profile detail crystals:', detail.crystals, 'displayName:', detail.displayName);
}

run().catch(err => console.error('Error:', err));
