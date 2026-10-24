const token = process.env.TELEGRAM_BOT_TOKEN || process.env.Telegram__BotToken || '';
if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required.');
  process.exit(1);
}
const chatId = process.argv[2] || '8233503382';
const publicUrl = process.argv[3] || 'https://equality-elect-hair-toner.trycloudflare.com';

async function main() {
  const ts = Date.now();
  const freshUrl = `${publicUrl}/?v=${ts}`;
  console.log(`Updating for ChatId=${chatId} with URL=${freshUrl}...`);

  // 1. Update personal chat menu button
  try {
    const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        menu_button: {
          type: 'web_app',
          text: 'ARENA',
          web_app: { url: freshUrl }
        }
      })
    });
    const menuJson = await menuRes.json();
    console.log('Personal menu update:', menuJson);
  } catch (err) {
    console.error('Menu error:', err.message);
  }

  // 2. Send message with inline WebApp button and Direct Browser link
  try {
    const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: '🚀 ARENA განახლდა!\n\nთუ ტელეფონით ძველი ვერსია ან შეცდომა გხვდებათ:\n1. დააჭირეთ „🚀 ARENA-ს გახსნა“ ღილაკს.\n2. თუ მაინც არ იხსნება, ზედა მარჯვენა კუთხეში სამ წერტილს (⋮) დააჭირეთ და აირჩიეთ „Reload Page“ / გვერდის განახლება.',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 ARENA-ს გახსნა (Mini App)',
                web_app: { url: freshUrl }
              }
            ],
            [
              {
                text: '🌐 ბრაუზერში შემოწმება',
                url: freshUrl
              }
            ]
          ]
        }
      })
    });
    const msgJson = await msgRes.json();
    console.log('Message result:', msgJson);
  } catch (err) {
    console.error('Message error:', err.message);
  }
}

main();
