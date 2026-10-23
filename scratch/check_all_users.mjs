async function checkUsers() {
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

  const r2 = await fetch('https://arenadate-production.up.railway.app/api/moderation/profiles', {
    headers: {
      'Cookie': cookieHeader(),
      'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN']
    }
  });
  const data = await r2.json();
  console.log('Profiles count:', data.length);
  console.log('Profiles:', data.map(u => ({ id: u.userId, email: u.email, name: u.displayName })));
}
checkUsers();
