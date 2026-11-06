/**
 * Webhook Telegram di Vercel -> meneruskan ke Google Apps Script -> Google Sheets
 *
 * Environment variables di Vercel:
 *   BOT_TOKEN          token dari @BotFather (sudah ada)
 *   GOOGLE_SCRIPT_URL  URL web app Apps Script berakhiran /exec (sudah ada)
 *   SCRIPT_KEY         kunci rahasia, HARUS sama dengan API_KEY di Script properties Apps Script
 *   ALLOWED_CHAT_IDS   chat ID yang boleh mencatat, pisahkan dengan koma
 *   WEBHOOK_SECRET     (opsional) sama dengan secret_token di setWebhook
 *
 * Contoh chat:  makan 50rb nasi padang | bensin 60k | listrik 450.000 | spp 1,5jt kemarin
 */

const DEFAULT_CATEGORY = 'Lainnya';
const TZ = 'Asia/Jakarta';

// Kata kunci -> kategori. Nama kategori HARUS sama persis dengan daftar di sheet Ringkasan.
const KEYWORDS = {
  'Makanan & Minuman': ['makan', 'makanan', 'minum', 'minuman', 'nasi', 'kopi', 'jajan', 'sarapan', 'bakso', 'resto', 'restoran', 'warteg', 'galon'],
  'Transportasi': ['transport', 'transportasi', 'bensin', 'bbm', 'parkir', 'tol', 'ojek', 'gojek', 'grab', 'bus', 'krl', 'mrt', 'ongkos'],
  'Tagihan & Utilitas': ['listrik', 'pln', 'token', 'pdam', 'internet', 'wifi', 'pulsa', 'tagihan', 'gas', 'sewa', 'cicilan'],
  'Belanja Rumah Tangga': ['belanja', 'sabun', 'deterjen', 'tisu', 'sembako', 'dapur', 'perabot', 'kebutuhan'],
  'Pendidikan': ['sekolah', 'spp', 'buku', 'les', 'kursus', 'kuliah', 'pendidikan'],
  'Kesehatan': ['obat', 'dokter', 'vitamin', 'rs', 'klinik', 'apotek', 'kesehatan'],
  'Hiburan': ['hiburan', 'bioskop', 'nonton', 'game', 'liburan', 'wisata', 'netflix', 'spotify'],
  'Lainnya': ['lainnya', 'lain'],
};

const HELP =
  'Cara mencatat:\n' +
  'kategori jumlah keterangan\n\n' +
  'Contoh:\n' +
  'makan 50rb nasi padang\n' +
  'bensin 60k\n' +
  'listrik 450.000\n' +
  'spp 1,5jt kemarin\n\n' +
  'Perintah:\n' +
  '/total  - total bulan ini\n' +
  '/undo   - batalkan catatan terakhir\n' +
  '/id     - lihat chat ID Anda';

export default async function handler(req, res) {
  // Membuka URL ini di browser hanya untuk cek bahwa fungsi hidup
  if (req.method !== 'POST') return res.status(200).send('Bot Expense aktif');

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).send('unauthorized');
  }

  try {
    const msg = req.body?.message;
    if (msg?.text) await handleMessage(msg);
  } catch (err) {
    console.error(err);
  }
  // Selalu balas 200 supaya Telegram tidak mengirim ulang pesan yang sama
  return res.status(200).send('OK');
}

// ---------------------------------------------------------------------------
async function handleMessage(msg) {
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];

  if (cmd === '/id') return reply(chatId, 'Chat ID Anda: ' + chatId);
  if (!isAllowed(chatId)) {
    return reply(chatId, 'Chat ID ' + chatId + ' belum terdaftar di ALLOWED_CHAT_IDS.');
  }
  if (cmd === '/start' || cmd === '/help') return reply(chatId, HELP);

  try {
    if (cmd === '/total') {
      const r = await callSheet({ action: 'total', bulan: todayISO(0).slice(0, 7) });
      return reply(chatId, formatTotal(r));
    }

    if (cmd === '/undo') {
      const r = await callSheet({ action: 'undo' });
      if (r.empty) return reply(chatId, 'Tidak ada catatan yang bisa dibatalkan.');
      return reply(chatId, '↩️ Dibatalkan: ' + r.keterangan + ' (' + rupiah(r.jumlah) + ')');
    }

    const p = parseExpense(text);
    if (!p) return reply(chatId, 'Jumlah tidak terbaca.\nContoh: makan 50rb nasi padang');

    await callSheet({
      action: 'append',
      tanggal: p.date,
      kategori: p.category,
      keterangan: p.note,
      jumlah: p.amount,
    });
    const [y, m, d] = p.date.split('-');
    return reply(chatId,
      '✅ Tercatat\n' +
      'Tanggal: ' + d + '/' + m + '/' + y + '\n' +
      'Kategori: ' + p.category + '\n' +
      'Keterangan: ' + p.note + '\n' +
      'Jumlah: ' + rupiah(p.amount));
  } catch (err) {
    console.error(err);
    return reply(chatId, '⚠️ Gagal: ' + err.message);
  }
}

function isAllowed(chatId) {
  const ids = (process.env.ALLOWED_CHAT_IDS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return ids.includes(chatId);
}

// ---------------------------------------------------------------------------
// Parser teks pengeluaran
// ---------------------------------------------------------------------------
function parseExpense(text) {
  const tokens = text.split(/\s+/);
  let date = todayISO(0);

  // Format lama "catat 25000 makan" tetap bisa dipakai
  if (tokens[0].toLowerCase() === 'catat') tokens.shift();

  const yi = tokens.findIndex((t) => t.toLowerCase() === 'kemarin');
  if (yi >= 0) {
    date = todayISO(-1);
    tokens.splice(yi, 1);
  }

  // Cari token jumlah: utamakan yang bernilai >= 1000, kalau tidak ada ambil yang paling akhir
  const cands = [];
  tokens.forEach((t, i) => {
    const v = parseAmount(t);
    if (v !== null) cands.push({ i, v });
  });
  if (!cands.length) return null;
  const pick = cands.find((c) => c.v >= 1000) || cands[cands.length - 1];
  tokens.splice(pick.i, 1);

  let category = DEFAULT_CATEGORY;
  for (const t of tokens) {
    const c = findCategory(t);
    if (c) { category = c; break; }
  }

  let note = tokens.join(' ') || category;
  if (/^[=+\-@]/.test(note)) note = "'" + note; // cegah teks dianggap rumus oleh Sheets
  return { date, category, note, amount: pick.v };
}

// "50rb" "50k" "50.000" "1,5jt" "Rp50.000" "50000"
function parseAmount(tok) {
  const m = tok.toLowerCase().replace(/^rp\.?/, '').match(/^(\d[\d.,]*)(rb|ribu|k|jt|juta)?$/);
  if (!m) return null;
  const mult = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6 }[m[2]];
  const n = mult
    ? parseFloat(m[1].replace(',', '.')) * mult
    : parseInt(m[1].replace(/[.,]/g, ''), 10);
  return Number.isNaN(n) || n <= 0 ? null : Math.round(n);
}

function findCategory(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  for (const cat of Object.keys(KEYWORDS)) {
    if (KEYWORDS[cat].includes(w)) return cat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Komunikasi dengan Apps Script
// ---------------------------------------------------------------------------
async function callSheet(payload) {
  const resp = await fetch(process.env.GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, key: process.env.SCRIPT_KEY }),
  });
  const raw = await resp.text();
  let r;
  try {
    r = JSON.parse(raw);
  } catch {
    throw new Error('Balasan Apps Script tidak valid. Cek deployment (akses "Siapa saja") dan URL /exec.');
  }
  if (r.ok !== true) throw new Error(r.error || 'Google Sheets menolak data');
  return r;
}

function formatTotal(r) {
  const lines = Object.keys(r.byCat || {})
    .sort((a, b) => r.byCat[b] - r.byCat[a])
    .map((k) => '• ' + k + ': ' + rupiah(r.byCat[k]));
  return '📊 Total bulan ini: ' + rupiah(r.total) + (lines.length ? '\n' + lines.join('\n') : '');
}

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------
// Tanggal hari ini di Jakarta, format YYYY-MM-DD (offsetDays=-1 untuk kemarin)
function todayISO(offsetDays) {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  if (!offsetDays) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

function rupiah(n) {
  return 'Rp ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function reply(chatId, text) {
  const token = (process.env.BOT_TOKEN || '').trim();
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!r.ok) console.error('sendMessage gagal', r.status, await r.text());
}
