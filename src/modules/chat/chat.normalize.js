// modules/chat/chat.normalize.js
//
// Lapisan kecil sebelum detectIntent() (lihat 03-Intent-normali.md).
// Tidak mengubah chat.intent.js maupun arsitektur intent yang sudah ada.
// Rule-based sederhana, bukan NLP/AI.
//
// E.2 — Bersihkan Kata Pengisi.
// E.3 — Normalisasi Kata Kerja, HANYA untuk grup yang tidak mengubah
//       rute intent yang sudah berjalan (lihat catatan di bawah).
//
// PENTING: grup "lihat/cek/tampilkan/buka" SENGAJA tidak dinormalisasi.
// Di chat.intent.js saat ini, "lihat"/"cek"/"tampilkan" masuk
// SEARCH_KEYWORDS (jadi search_note), bukan open_note. Menyamakan semua
// jadi "buka" akan mengubah rute intent yang sudah berjalan — sudah
// dikonfirmasi ke user untuk TIDAK dilakukan. Kalau nanti mau diubah,
// itu keputusan arsitektur terpisah, bukan bagian dari normalisasi ini.
//
// E.4 — Kenali Pertanyaan Umum. Sama seperti E.3: hanya memetakan ke
// intent yang SUDAH ADA, tidak menambah intent baru.
// - "terakhir" / "barusan" / "tadi"       -> "terbaru" (sudah ada di
//   LATEST_KEYWORDS, chat.intent.js) => latest_note.
// - "pernah"                              -> "cari" (sudah ada di
//   SEARCH_KEYWORDS, chat.intent.js) => search_note.
//
// "apa aja" -> list_notes SENGAJA TIDAK diimplementasikan di sini.
// Intent "list_notes" belum ada sama sekali di chat.intent.js /
// chat.controller.js. Menambahkannya berarti menambah intent baru,
// bukan sekadar normalisasi kalimat ke intent yang sudah ada — di luar
// scope E.4. Dipindah ke Backlog di 03-Intent-normali.md.
//
// Tahap 10 — Bug fix: "catatan tadi" (bukan cuma "yang tadi") juga
// dikecualikan dari transformasi tadi->terbaru, supaya delete_note bisa
// merujuk ke catatan yang baru dibuat/dibicarakan lewat entities.reference
// (lihat applyQuestionPatterns & chat.intent.js).

// Kata pengisi yang tidak mempengaruhi maksud kalimat (E.2).
const FILLER_WORDS = [
  "dong",
  "deh",
  "nih",
  "ya",
  "coba",
  "tolong",
  "sih",
  "kok",
  "gitu",
  "tuh",
  "aja",
];

// Sinonim kata kerja yang AMAN dipetakan (E.3) — hanya menambah variasi
// ke intent yang memang sudah menampung kata kanoniknya, tidak memindah
// rute intent apapun:
// - "cari"  sudah ada di SEARCH_KEYWORDS
// - "buat"  sudah ada di CREATE_KEYWORDS
// - "lihat" sudah ada di SEARCH_KEYWORDS ("liat" cuma varian ejaan slang,
//   BUKAN disamakan ke grup "buka" — beda dengan catatan larangan di
//   atas yang soal menyamakan lihat/cek/tampilkan ke "buka")
const VERB_SYNONYMS = {
  nyari: "cari",
  catat: "buat",
  catetin: "buat",
  liat: "lihat",
};

// Pertanyaan umum -> kata kunci kanonik yang sudah dikenali chat.intent.js
// (E.4). Urutan penting: frasa dua kata dulu ("yang terakhir") sebelum
// kata tunggal, supaya tidak diproses dua kali secara tumpang tindih.
const QUESTION_PATTERNS = [
  { pattern: "terakhir", replacement: "terbaru" },
  { pattern: "barusan", replacement: "terbaru" },
  { pattern: "pernah", replacement: "cari" },
];

/**
 * Menghapus kata pengisi dari sebuah kalimat (E.2).
 * Hanya kata utuh (word boundary) yang dihapus.
 * @param {string} text
 * @returns {string}
 */
function removeFillerWords(text) {
  let result = text;

  for (const word of FILLER_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(pattern, "");
  }

  return result;
}

/**
 * Mengganti sinonim kata kerja dengan bentuk kanoniknya (E.3).
 * Hanya grup yang sudah dipastikan aman (lihat catatan di atas file ini).
 * @param {string} text
 * @returns {string}
 */
function applyVerbSynonyms(text) {
  let result = text;

  for (const [synonym, canonical] of Object.entries(VERB_SYNONYMS)) {
    const pattern = new RegExp(`\\b${synonym}\\b`, "gi");
    result = result.replace(pattern, canonical);
  }

  return result;
}

/**
 * Mengganti pola pertanyaan umum dengan kata kunci kanonik yang sudah
 * dikenali chat.intent.js (E.4). Lihat QUESTION_PATTERNS di atas.
 * @param {string} text
 * @returns {string}
 */
function applyQuestionPatterns(text) {
  let result = text;

  for (const { pattern, replacement } of QUESTION_PATTERNS) {
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    result = result.replace(regex, replacement);
  }

  // "tadi" ditangani terpisah (bukan lewat QUESTION_PATTERNS) karena
  // PENTING: kalau muncul sebagai "yang tadi", itu sudah dipakai
  // REFERENCE_KEYWORDS di chat.intent.js untuk open_note (merujuk ke
  // catatan TERAKHIR DIBUKA) — beda maksud dari latest_note (catatan
  // TERBARU dibuat). Kalau ikut diganti jadi "terbaru", rute open_note
  // yang sudah berjalan akan rusak. Jadi "tadi" hanya diganti kalau
  // TIDAK didahului kata "yang".
  //
  // Bug fix (Tahap 10): "catatan tadi" (mis. "hapus catatan tadi") juga
  // HARUS dikecualikan, dengan alasan sama seperti "yang tadi" di atas —
  // ini referensi ke catatan yang baru dibuat/dibicarakan (lihat
  // entities.reference di delete_note, chat.intent.js), bukan "catatan
  // terbaru" (note dengan createdAt paling baru). Sebelumnya cuma "yang
  // tadi" yang dikecualikan, jadi "catatan tadi" ikut berubah jadi
  // "catatan terbaru" dan salah nyari keyword "terbaru".
  result = result.replace(/(?<!\byang\s)(?<!\bcatatan\s)\btadi\b/gi, "terbaru");

  return result;
}

/**
 * Menormalisasi pesan user sebelum diteruskan ke detectIntent().
 * Output tetap berupa kalimat biasa, bukan struktur intent.
 * @param {string} pesan
 * @returns {string}
 */
export function normalizeMessage(pesan) {
  if (!pesan) return pesan;

  let result = removeFillerWords(pesan);
  result = applyVerbSynonyms(result);
  result = applyQuestionPatterns(result);

  return result.replace(/\s+/g, " ").trim();
}
