export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("Telegram expense bot is ready.");

  const token = process.env.BOT_TOKEN;
  const secret = process.env.WEBHOOK_SECRET;

  if (!token) return res.status(500).send("BOT_TOKEN belum diatur.");

  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).send("Unauthorized");
  }

  const message = req.body?.message;
  if (!message?.chat?.id) return res.status(200).send("OK");

  const chatId = message.chat.id;
  const text = (message.text || "").trim();
  let reply;

  if (text === "/start" || text === "/help") {
    reply = "Halo! Aku bot catatan pengeluaran.\n\nKirim: catat 25000 makan\nContoh: catat 15000 kopi";
  } else {
    const match = text.match(/^catat\s+(\d+)\s+(.+)$/i);
    if (match) {
      const amount = Number(match[1]).toLocaleString("id-ID");
      const category = match[2].trim();
      reply = `✅ Pengeluaran dicatat (sementara)\nNominal: Rp${amount}\nKategori: ${category}\n\nCatatan: versi starter ini belum menyimpan data ke database.`;
    } else {
      reply = "Format belum cocok.\nKirim: catat 25000 makan";
    }
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply })
  });

  return res.status(200).send("OK");
}
