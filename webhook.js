export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram Expense Bot aktif");
  }

  try {
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body),
      redirect: "follow"
    });

    const result = await response.text();

    console.log("Google Apps Script:", result);

    return res.status(200).send("OK");

  } catch (error) {
    console.error(error);
    return res.status(500).send("Webhook error");
  }
}