// modules/memory/memory.suggestion.js
//
// Tahap 9 — Memory Suggestion (05-Roadmap-Reakurasi.md).
// Milestone 9.1: deteksi trigger keyword "rencana ke depan" di pesan
// baru — MURNI cocok kata (whole word), tanpa NLP, konsisten sama pola
// modul memory/ lain.
//
// Milestone 9.2 SENGAJA tidak ada logic retrieval baru di file ini —
// pemanggil (chat.controller.js) reuse retrieveMemory() (Tahap 1) apa
// adanya, yang otomatis sudah batasi maksimal 3 hasil (Tahap 2.2). DoD
// "tetap ≤3 tawaran" terpenuhi tanpa kode tambahan.

// Starter list — kata penanda "rencana ke depan". TAMBAH MANUAL sesuai
// kebutuhan.
const TRIGGER_KEYWORDS = [
  "besok", "lusa", "nanti", "rencana", "rencananya", "akan",
  "minggu depan", "bulan depan", "target",
];

/**
 * Milestone 9.1. Cek apakah sebuah teks menyinggung rencana ke depan.
 * @param {string} text
 * @returns {boolean}
 */
export function hasSuggestionTrigger(text) {
  const lower = text.toLowerCase();

  return TRIGGER_KEYWORDS.some((word) =>
    word.includes(" ") ? lower.includes(word) : new RegExp(`\\b${word}\\b`).test(lower)
  );
}
