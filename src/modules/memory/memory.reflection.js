// modules/memory/memory.reflection.js
//
// Tahap 3 — Reflection Engine (05-Roadmap-Reakurasi.md).
// File ini fokus pada kategori "sebab" saja — ekstraksi klausa lengkap
// setelah kata "karena" untuk kalimat balasan yang lebih detail
// (lihat extractCause()).
//
// 4 kategori lain (orang/tempat/aktivitas/proyek) TIDAK di-backlog —
// sudah diimplementasikan dan aktif, tapi ada di memory.similarity.js,
// bukan di sini. Semuanya tetap rule-based murni (keyword matching &
// vocab dari data yang ada), TANPA NLP/AI — jadi tidak melanggar
// prinsip "Tidak ada AI generatif/LLM" (01-Piyik-Blueprint.md).
// Lihat memory.similarity.js untuk detail kelima kategori.
//
// Murni cocok kata literal, konsisten sama chat.intent.js / chat.keyword.js.

const CAUSE_KEYWORD = "karena";

/**
 * Mencari klausa "karena ..." di isi sebuah catatan.
 * @param {{content?: string}} note
 * @returns {string|null} teks setelah "karena" sampai akhir kalimat,
 *   null kalau tidak ada / kosong
 */
export function extractCause(note) {
  const content = note?.content ?? "";
  const lower = content.toLowerCase();

  const match = lower.match(new RegExp(`\\b${CAUSE_KEYWORD}\\b`));
  if (!match) return null;

  const after = content.slice(match.index + CAUSE_KEYWORD.length);
  const endMatch = after.match(/[.!?\n]/);
  const clause = endMatch ? after.slice(0, endMatch.index) : after;

  const cause = clause.trim();
  return cause.length > 0 ? cause : null;
}