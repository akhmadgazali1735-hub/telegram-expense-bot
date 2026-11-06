export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Expense aktif");
  }

  const token = process.env.BOT_TOKEN;
  const message = req.body?.message;

  if (!message?.chat?.id) {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const text = message.text || "";

  let reply;

  if (text === "/start") {
    reply = "Halo! Bot Expense aktif kembali.";
  } else {
    reply = "Pesan diterima: " + text;
  }

  const telegram = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply })
    }
  );

  console.log("Telegram response:", await telegram.text());

  return res.status(200).send("OK");
}
