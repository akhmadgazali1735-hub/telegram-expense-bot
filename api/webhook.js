```javascript
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Expense aktif");
  }

  const token = process.env.BOT_TOKEN;
  const sheetUrl = process.env.GOOGLE_SCRIPT_URL;

  const message = req.body?.message;

  if (!message?.chat?.id) {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  async function sendMessage(text) {
    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  }

  try {
    if (text === "/start" || text === "/help") {
      await sendMessage(
        "Halo! Bot Expense siap mencatat.\n\n" +
        "Format:\ncatat 25000 makan\n\n" +
        "Contoh:\ncatat 15000 kopi"
      );
    } else {
      const match = text.match(/^catat\s+(\d+)\s+(.+)$/i);

      if (!match) {
        await sendMessage("Format salah.\nContoh: catat 25000 makan");
      } else {
        const jumlah = Number(match[1]);
        const kategori = match[2].trim();

        if (!sheetUrl) {
          await sendMessage("GOOGLE_SCRIPT_URL belum diatur di Vercel.");
        } else {
          const response = await fetch(sheetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kategori,
              keterangan: kategori,
              jumlah
            })
          });

          const result = await response.json();

          if (result.ok === true) {
            await sendMessage(
              "✅ Berhasil disimpan!\n\n" +
              "Kategori: " + kategori + "\n" +
              "Jumlah: Rp" + jumlah.toLocaleString("id-ID")
            );
          } else {
            await sendMessage("❌ Gagal menyimpan ke Google Sheets.");
          }
        }
      }
    }
  } catch (error) {
    console.error("ERROR:", error);
    await sendMessage("❌ Terjadi error. Periksa Google Sheets atau Apps Script.");
  }

  return res.status(200).send("OK");
}
```
