const token = '8909547232:AAEx5dJSZjYY_D1UH9ifmlyCDgaI1csUseg';
const chatId = process.argv[2] || '5735625723';
const publicUrl = process.argv[3] || 'https://kits-dns-optional-pulling.trycloudflare.com';

async function main() {
  console.log(`Updating for ChatId=${chatId} with URL=${publicUrl}...`);

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
          web_app: { url: `${publicUrl}/` }
        }
      })
    });
    const menuJson = await menuRes.json();
    console.log('Personal menu update:', menuJson);
  } catch (err) {
    console.error('Menu error:', err.message);
  }

  // 2. Send message with inline WebApp button
  try {
    const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: '🔥 ARENA განახლდა! დააჭირეთ ქვედა ღილაკს აპლიკაციის გასახსნელად:',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 ARENA-ს გახსნა',
                web_app: { url: `${publicUrl}/` }
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
