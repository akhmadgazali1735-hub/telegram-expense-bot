export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Expense aktif");
  }

  const token = process.env.BOT_TOKEN;
  const chatId = req.body?.message?.chat?.id;
  const text = req.body?.message?.text || "";

  if (!chatId) return res.status(200).send("OK");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Bot Expense aktif kembali: " + text
      })
    });
  } catch (error) {
    console.error(error);
  }

  return res.status(200).send("OK");
}
