async function poll() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('https://arenadate-production.up.railway.app/api/health/live');
      const text = await res.text();
      console.log(`Attempt ${i + 1} (${res.status}): ${text.substring(0, 100)}`);
      if (res.status === 200) {
        console.log('SUCCESS! Health live is 200 OK');
        process.exit(0);
      }
    } catch (e) {
      console.log(`Attempt ${i + 1} error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}
poll();
