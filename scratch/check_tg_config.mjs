import fs from 'node:fs';

const envContent = fs.readFileSync('infra/.env', 'utf-8');
const match = envContent.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m);
if (!match) {
  console.error('TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}
const token = match[1].trim().replace(/^['"]|['"]$/g, '');

const webhookUrl = 'https://arenadate-production.up.railway.app/api/payments/telegram-stars/webhook';

async function update() {
  const setWh = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'pre_checkout_query']
    })
  }).then(r => r.json());
  console.log('--- Updated Webhook ---', setWh);

  const menu = await fetch(`https://api.telegram.org/bot${token}/getChatMenuButton`).then(r => r.json());
  console.log('--- Current Menu Button ---', JSON.stringify(menu, null, 2));

  const wh = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json());
  console.log('--- Current Webhook Info ---', JSON.stringify(wh, null, 2));
}

update().catch(console.error);
