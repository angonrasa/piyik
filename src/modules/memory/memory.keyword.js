// modules/memory/memory.keyword.js
//
// Tahap 1 — Memory Retrieval Engine (lihat 05-Roadmap-Reakurasi.md).
// Ekstraksi kata bermakna dari KALIMAT BEBAS (pesan chat biasa, bukan
// perintah). Beda dari chat.keyword.js (modules/chat), yang stopword-nya
// khusus buat sisa kalimat SETELAH kata kunci aksi ("cari", "buka", dst)
// dibuang duluan di chat.intent.js. Di sini belum ada kata aksi yang
// dibuang, jadi daftar stopword-nya lebih umum: partikel, kata hubung,
// kata ganti, kata keterangan waktu umum.
//
// Sengaja dibuat modul sendiri (bukan reuse/gabung ke chat.keyword.js)
// supaya modules/memory tetap berdiri sendiri, sesuai 03-Structure.md:
// "Setiap modul berdiri sendiri dan tidak bergantung langsung pada
// modul lain." Kalau nanti ada bagian yang sama persis dibutuhkan dua
// modul, baru dipindah ke shared/ — belum sekarang (YAGNI).

const GENERAL_STOPWORDS = [
  // Kata ganti
  "aku", "saya", "gue", "gw", "kamu", "kau", "dia", "mereka", "kita", "kami",
  // Kata hubung / partikel
  "yang", "dan", "atau", "dengan", "untuk", "pada", "dalam", "atas", "dari",
  "ke", "di", "adalah", "juga", "karena", "kalau", "kalo", "supaya", "agar",
  // Kata bantu / modal
  "akan", "sudah", "udah", "belum", "mau", "bisa", "harus", "lagi", "ada",
  // Negasi
  "tidak", "gak", "ga", "nggak", "enggak", "bukan",
  // Partikel pengisi
  "sih", "deh", "dong", "nih", "tuh", "kok", "ya", "aja", "saja", "banget",
  "sangat", "sekali",
  // Keterangan waktu umum (terlalu umum untuk jadi kata kunci pencarian)
  "hari", "ini", "itu", "tadi", "nanti", "sekarang", "kemarin", "besok",
];

// Ambang minimal kata bermakna yang harus tersisa supaya retrieval layak
// dijalankan (DoD Milestone 1.1: hindari retrieval dipaksakan dari
// kalimat yang terlalu umum/kosong makna). Contoh: "hari ini capek" ->
// sisa "capek" saja -> masih layak (1 kata, cukup spesifik). Tapi
// "aku lagi di sini aja" -> sisa kosong -> tidak layak.
const MIN_MEANINGFUL_WORDS = 1;
const MIN_WORD_LENGTH = 3;

/**
 * Membuang tanda baca dasar dari teks.
 * @param {string} text
 * @returns {string}
 */
function removePunctuation(text) {
  return text.replace(/[?!.,]/g, "");
}

/**
 * Mengekstrak kata-kata bermakna dari kalimat bebas, untuk dipakai
 * sebagai input pencarian pasif (Memory Retrieval). Hanya cleanup teks
 * sederhana (stopword + panjang minimal) — bukan NLP/AI.
 * @param {string} pesan
 * @returns {string[]} kata bermakna, huruf kecil, sudah dibuang stopword
 */
export function extractMeaningfulWords(pesan) {
  if (!pesan) return [];

  const cleaned = removePunctuation(pesan.toLowerCase());
  const words = cleaned.split(/\s+/).filter(Boolean);

  return words.filter(
    (word) => word.length >= MIN_WORD_LENGTH && !GENERAL_STOPWORDS.includes(word)
  );
}

/**
 * Cek apakah kata bermakna yang ditemukan cukup untuk menjalankan
 * retrieval.
 * @param {string[]} words
 * @returns {boolean}
 */
export function hasEnoughSignal(words) {
  return words.length >= MIN_MEANINGFUL_WORDS;
}
