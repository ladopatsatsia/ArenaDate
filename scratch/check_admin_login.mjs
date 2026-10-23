async function testAdmin() {
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

  const r0 = await fetch('https://arenadate-production.up.railway.app/api/moderation/csrf');
  parseCookies(r0);
  console.log('CSRF status:', r0.status, cookieJar);

  const r1 = await fetch('https://arenadate-production.up.railway.app/api/moderation/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    },
    body: JSON.stringify({ email: 'admin@appdate.ge', password: 'AdminPassword123!' })
  });
  parseCookies(r1);
  console.log('Login status:', r1.status, await r1.text());

  const r2 = await fetch('https://arenadate-production.up.railway.app/api/moderation/me', {
    headers: {
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    }
  });
  console.log('Me status:', r2.status, await r2.text());
}
testAdmin();
