export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Expense aktif");
  }

  const token = process.env.BOT_TOKEN;
  const sheetUrl = process.env.GOOGLE_SCRIPT_URL;
  const chatId = req.body?.message?.chat?.id;
  const text = (req.body?.message?.text || "").trim();

  if (!chatId) return res.status(200).send("OK");

  let reply;

  if (text === "/start") {
    reply = "Halo! Bot Expense siap mencatat.\nKetik: catat 25000 makan";
  } else {
    const match = text.match(/^catat\s+(\d+)\s+(.+)$/i);

    if (!match) {
      reply = "Format: catat 25000 makan";
    } else {
      const jumlah = Number(match[1]);
      const kategori = match[2].trim();

      try {
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
          reply = `✅ Berhasil disimpan!\nKategori: ${kategori}\nJumlah: Rp${jumlah.toLocaleString("id-ID")}`;
        } else {
          reply = "❌ Google Sheets gagal menyimpan data.";
        }
      } catch (error) {
        console.error(error);
        reply = "❌ Gagal koneksi Google Sheets.";
      }
    }
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply })
  });

  return res.status(200).send("OK");
}
