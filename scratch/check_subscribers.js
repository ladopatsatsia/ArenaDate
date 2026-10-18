const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://dating:1518faf66b9b4bdde77296c4aa32fb8c6720b9c899d43df2@127.0.0.1:54432/dating" });
client.connect().then(async () => {
  const res = await client.query('SELECT "ChatId", "Username", "FirstName" FROM "TelegramSubscribers"');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}).catch(console.error);
