// modules/memory/memory.theme.js
//
// Tahap 5 — Theme Detection (05-Roadmap-Reakurasi.md).
// Dimensi tema yang dipakai: `type` catatan (tugas/lagu/ide/catatan),
// BUKAN keyword bebas — supaya tidak perlu logika ekstraksi kata kunci
// tambahan (yang berisiko nyerempet NLP). Field type sudah ada dan
// terstruktur, jadi paling sederhana sesuai KISS.
//
// Perhitungan selalu ON-THE-FLY dari getAllNotes(), TIDAK ada tabel
// agregasi baru maupun hasil yang di-cache (sesuai Milestone 5.1).

const RECENT_DAYS = 30;
const THEME_FREQUENCY_THRESHOLD = 3;

/**
 * Menghitung berapa catatan bertipe sama yang dibuat dalam N hari
 * terakhir.
 * @param {Array<object>} notes seluruh catatan (dari getAllNotes())
 * @param {string} type
 * @param {number} [days] default 30
 * @returns {number}
 */
export function countRecentByType(notes, type, days = RECENT_DAYS) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return notes.filter((note) => {
    if (note.type !== type) return false;
    const created = note.createdAt instanceof Date ? note.createdAt.getTime() : 0;
    return created >= cutoff;
  }).length;
}

/**
 * Cek apakah sebuah tipe catatan cukup sering muncul dalam 30 hari
 * terakhir (ambang sederhana Milestone 5.2: >= 3 kemunculan).
 * @param {Array<object>} notes seluruh catatan (dari getAllNotes())
 * @param {string} type
 * @returns {boolean}
 */
export function hasFrequentTheme(notes, type) {
  return countRecentByType(notes, type) >= THEME_FREQUENCY_THRESHOLD;
}
