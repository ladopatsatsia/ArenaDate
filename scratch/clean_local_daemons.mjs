import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('=== Cleaning Local Cloudflare and Watchdog Daemons ===');

// 1. Kill cloudflared if running
try {
  execSync('taskkill /F /IM cloudflared.exe', { stdio: 'ignore' });
  console.log('Stopped local cloudflared.exe');
} catch {
  console.log('cloudflared was not running');
}

// 2. Remove Windows Startup shortcut
const startupDir = path.join(
  process.env.APPDATA || '',
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);
const shortcutPath = path.join(startupDir, 'ARENA-Production.lnk');
if (fs.existsSync(shortcutPath)) {
  fs.unlinkSync(shortcutPath);
  console.log(`Deleted startup shortcut: ${shortcutPath}`);
} else {
  console.log(`No shortcut found at: ${shortcutPath}`);
}

// 3. Update infra/.env so it points to Railway
const envPath = 'infra/.env';
if (fs.existsSync(envPath)) {
  let env = fs.readFileSync(envPath, 'utf-8');
  env = env.replace(/^TELEGRAM_WEB_APP_URL=.*$/m, 'TELEGRAM_WEB_APP_URL=https://arenadate-production.up.railway.app');
  fs.writeFileSync(envPath, env, 'utf-8');
  console.log('Updated infra/.env TELEGRAM_WEB_APP_URL to Railway');
}

// 4. Set Telegram Webhook and Menu Button directly on Telegram API
const match = fs.readFileSync(envPath, 'utf-8').match(/^TELEGRAM_BOT_TOKEN=(.*)$/m);
if (match) {
  const token = match[1].trim().replace(/^['"]|['"]$/g, '');
  const targetUrl = 'https://arenadate-production.up.railway.app';

  // Set Menu Button
  const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'ARENA',
        web_app: { url: targetUrl + '/' }
      }
    })
  }).then(r => r.json());
  console.log('Telegram setChatMenuButton:', menuRes);

  // Set Webhook
  const whRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `${targetUrl}/api/payments/telegram-stars/webhook`,
      allowed_updates: ['message', 'pre_checkout_query']
    })
  }).then(r => r.json());
  console.log('Telegram setWebhook:', whRes);
}

console.log('=== Done! Telegram bot is now 100% disconnected from local PC and bound to Railway. ===');
