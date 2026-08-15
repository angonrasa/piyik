// modules/memory/memory.pattern.js
//
// Tahap 7 — Personal Pattern (05-Roadmap-Reakurasi.md).
// DISEDERHANAKAN dari spesifikasi asli (disepakati saat pengerjaan,
// lihat catatan Tahap 19 di chat.controller.js):
// - Dimensi CUMA hari-dalam-seminggu (BUKAN tanggal-dalam-bulan / jam-
//   dalam-hari — 3 dimensi sekaligus terlalu kombinatorik untuk app
//   personal 1 orang).
// - Ambang CUMA ">= 3 kali di hari yang sama, dalam 8 minggu terakhir"
//   (BUKAN "3 minggu berturut-turut" — versi berurutan butuh logika
//   nomor minggu/kalender yang sudah bukan "rule sederhana" lagi).
// Versi ketat (berurutan + 3 dimensi) dicatat di Backlog Future Version
// kalau versi sederhana ini dirasa kurang akurat.
//
// Perhitungan ON-THE-FLY dari getAllNotes(), tidak ada agregasi tersimpan.

const RECENT_WEEKS = 8;
const HABIT_THRESHOLD = 3;

const WEEKDAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Milestone 7.1 (disederhanakan). Hitung berapa kali catatan bertipe
 * sama dibuat di tiap hari-dalam-seminggu, dalam 8 minggu terakhir.
 * @param {Array<object>} notes seluruh catatan (dari getAllNotes())
 * @param {string} type
 * @returns {number[]} array 7 elemen, index 0 = Minggu ... 6 = Sabtu
 *   (mengikuti Date.getDay())
 */
export function getWeekdayFrequency(notes, type) {
  const cutoff = Date.now() - RECENT_WEEKS * 7 * 24 * 60 * 60 * 1000;
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const note of notes) {
    if (note.type !== type) continue;
    if (!(note.createdAt instanceof Date)) continue;
    if (note.createdAt.getTime() < cutoff) continue;

    counts[note.createdAt.getDay()] += 1;
  }

  return counts;
}

/**
 * Milestone 7.2 (disederhanakan). Cari hari-dalam-seminggu yang paling
 * sering dipakai untuk tipe catatan tertentu, kalau kemunculannya
 * cukup konsisten (>= 3 kali dalam 8 minggu terakhir).
 * @param {Array<object>} notes seluruh catatan (dari getAllNotes())
 * @param {string} type
 * @returns {string|null} nama hari (mis. "Senin"), atau null kalau
 *   belum ada pola yang cukup konsisten
 */
export function detectHabit(notes, type) {
  const counts = getWeekdayFrequency(notes, type);

  let bestDay = -1;
  let bestCount = 0;
  counts.forEach((count, day) => {
    if (count > bestCount) {
      bestCount = count;
      bestDay = day;
    }
  });

  return bestCount >= HABIT_THRESHOLD ? WEEKDAY_NAMES[bestDay] : null;
}
