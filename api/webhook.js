```javascript
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Expense aktif");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

  if (!BOT_TOKEN || !GOOGLE_SCRIPT_URL) {
    return res.status(500).send("Environment variables belum lengkap");
  }

  const message = req.body?.message;

  if (!message?.chat?.id) {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  let reply;

  try {
    if (text === "/start" || text === "/help") {
      reply =
        "Halo! 👋 Bot Expense siap mencatat pengeluaran.\n\n" +
        "Format:\n" +
        "catat 25000 makan\n\n" +
        "Contoh:\n" +
        "catat 15000 kopi";
    } else {
      const match = text.match(/^catat\s+(\d+)\s+(.+)$/i);

      if (!match) {
        reply = "Format salah.\nContoh: catat 25000 makan";
      } else {
        const jumlah = Number(match[1]);
        const kategori = match[2].trim();

        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tanggal: new Date().toISOString(),
            kategori: kategori,
            keterangan: kategori,
            jumlah: jumlah
          })
        });

        const result = await response.json();

        if (!response.ok || result.ok !== true) {
          throw new Error("Gagal menyimpan ke Google Sheets");
        }

        reply =
          "✅ Pengeluaran berhasil disimpan!\n\n" +
          "Kategori: " + kategori + "\n" +
          "Jumlah: Rp" + jumlah.toLocaleString("id-ID");
      }
    }
  } catch (error) {
    console.error(error);
    reply = "❌ Gagal menyimpan ke Google Sheets. Periksa Apps Script.";
  }

  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply
      })
    }
  );

  return res.status(200).send("OK");
}
```
