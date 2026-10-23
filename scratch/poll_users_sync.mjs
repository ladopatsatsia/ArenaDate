async function pollUsers() {
  for (let i = 0; i < 30; i++) {
    try {
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
      if (r2.ok) {
        const data = await r2.json();
        console.log(`[Attempt ${i + 1}] Registered profiles count: ${data.length}`);
        if (data.length > 3) {
          console.log('SUCCESS! All registered users and profiles are now visible in admin panel:');
          console.log(data.map(u => `${u.displayName || '(No Name)'} | ${u.email} | ${u.city}`).join('\n'));
          process.exit(0);
        }
      } else {
        console.log(`[Attempt ${i + 1}] Moderation API status: ${r2.status}`);
      }
    } catch (e) {
      console.log(`[Attempt ${i + 1}] Error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
}
pollUsers();
