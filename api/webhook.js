```javascript
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Expense aktif");
  }

  const token = process.env.BOT_TOKEN;
  const sheetUrl = process.env.GOOGLE_SCRIPT_URL;

  const message = req.body?.message;
  if (!message?.chat?.id) return res.status(200).send("OK");

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  let reply;

  if (text === "/start") {
    reply = "Halo! Bot Expense siap mencatat pengeluaran.\n\nKetik:\ncatat 25000 makan";
  } else {
    const match = text.match(/^catat\s+(\d+)\s+(.+)$/i);

    if (!match) {
      reply = "Format salah.\nContoh: catat 25000 makan";
    } else {
      const jumlah = Number(match[1]);
      const kategori = match[2].trim();

      try {
        const response = await fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kategori: kategori,
            keterangan: kategori,
            jumlah: jumlah
          })
        });

        if (!response.ok) throw new Error("Gagal menyimpan");

        reply =
          `✅ Pengeluaran berhasil disimpan!\n\n` +
          `Kategori: ${kategori}\n` +
          `Jumlah: Rp${jumlah.toLocaleString("id-ID")}`;
      } catch (error) {
        reply = "❌ Gagal menyimpan ke Google Sheets.";
      }
    }
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: reply
    })
  });

  return res.status(200).send("OK");
}
```
