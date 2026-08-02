// modules/memory/memory.ranking.js
//
// Tahap 2 — Context Ranking (05-Roadmap-Reakurasi.md).
// Milestone 2.1: skema prioritas SEDERHANA (bukan sistem ranking rumit).
// Urutan tier (paling penting -> paling ringan):
//   keyword sama > relasi langsung > tag sama > tipe sama > waktu terbaru
//
// Skor cuma angka biasa per catatan buat urutkan hasil retrieval. Tidak
// disimpan ke DB, tidak dipakai di luar modul memory (chat.controller.js
// cuma terima daftar note yang sudah terurut, tidak perlu tahu skornya).

const TIER_KEYWORD_MATCH = 10000;
const TIER_DIRECT_RELATION = 1000;
const TIER_TAG_MATCH = 100;
const TIER_TYPE_MATCH = 10;

// Skala sangat kecil supaya kontribusi waktu TIDAK PERNAH mengalahkan
// tier di atasnya (jarak antar tier 10x, jadi harus jauh di bawah itu).
const RECENCY_SCALE = 1e-15;

/**
 * @typedef {Object} MemoryCandidate
 * @property {object} note
 * @property {boolean} isKeywordMatch - true kalau ketemu langsung via searchNotes
 * @property {boolean} isDirectRelation - true kalau ketemu via getRelatedNotes
 * @property {object|null} seedNote - catatan asal penelusuran relasi,
 *   null kalau candidate ini sendiri hasil keyword match
 */

/**
 * Mengurutkan kandidat memori berdasarkan skema prioritas Milestone 2.1.
 * @param {MemoryCandidate[]} candidates
 * @returns {{note: object, score: number}[]} terurut skor tertinggi dulu
 */
export function rankMemories(candidates) {
  return candidates
    .map((c) => ({ note: c.note, score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score);
}

/** @param {MemoryCandidate} candidate @returns {number} */
function scoreCandidate(candidate) {
  let score = 0;

  if (candidate.isKeywordMatch) score += TIER_KEYWORD_MATCH;
  if (candidate.isDirectRelation) score += TIER_DIRECT_RELATION;

  // Tag & tipe cuma masuk akal dibandingkan TERHADAP sesuatu — di sini
  // terhadap seedNote (catatan asal relasi). Kalau candidate ini keyword
  // match langsung (seedNote null), dua tier ini memang tidak berlaku.
  if (candidate.seedNote) {
    if (hasSameTag(candidate.note, candidate.seedNote)) score += TIER_TAG_MATCH;
    if (candidate.note.type === candidate.seedNote.type) score += TIER_TYPE_MATCH;
  }

  score += recencyScore(candidate.note);

  return score;
}

/**
 * Tier "tag sama". Field `tags` BELUM ada di struktur Notes sekarang
 * (masih Backlog Future Version — lihat 01-Piyik-Blueprint.md). Sengaja
 * ditulis generik: begitu field `tags` (array string) ditambahkan ke
 * Notes, tier ini OTOMATIS ikut aktif, tanpa perlu balik edit file ini.
 * Sampai saat itu tagsA/tagsB selalu kosong -> selalu false -> skor 0.
 * @param {object} noteA @param {object} noteB @returns {boolean}
 */
function hasSameTag(noteA, noteB) {
  const tagsA = noteA.tags ?? [];
  const tagsB = noteB.tags ?? [];
  return tagsA.some((tag) => tagsB.includes(tag));
}

/**
 * Tiebreaker waktu: catatan lebih baru dapat skor sedikit lebih tinggi.
 * Diskalakan sangat kecil, cuma pemutus seri DALAM tier yang sama.
 * @param {object} note @returns {number}
 */
function recencyScore(note) {
  const time = note.createdAt instanceof Date ? note.createdAt.getTime() : 0;
  return time * RECENCY_SCALE;
}