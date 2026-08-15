// modules/memory/memory.timeline.js
//
// Tahap 6 — Timeline Awareness (05-Roadmap-Reakurasi.md).
// Dimensi yang dibandingkan sama seperti Tahap 5 (memory.theme.js):
// `type` catatan, bukan keyword bebas — konsisten KISS, tidak perlu
// logika ekstraksi kata kunci tambahan.
//
// Perhitungan ON-THE-FLY dari getAllNotes(), tidak ada agregasi tersimpan.

const MIN_SPAN_DAYS = 14;
const MIN_NOTES_FOR_TIMELINE = 2;

/**
 * Milestone 6.1. Filter catatan bertipe sama, urutkan dari yang paling
 * lama ke paling baru.
 * @param {Array<object>} notes seluruh catatan (dari getAllNotes())
 * @param {string} type
 * @returns {Array<object>}
 */
export function getNotesByType(notes, type) {
  return notes
    .filter((note) => note.type === type)
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
}

/**
 * Milestone 6.2 (bagian cek). Cek apakah catatan bertipe sama sudah
 * "berkembang" cukup jauh — minimal 2 catatan DAN jarak waktu catatan
 * tertua vs terbaru >= 14 hari (ambang sederhana, supaya 2 catatan yang
 * dibuat di hari yang sama tidak dianggap "perjalanan").
 * @param {Array<object>} notesOfType hasil getNotesByType(), HARUS sudah
 *   terurut ascending (asumsi dipakai bareng getNotesByType())
 * @returns {boolean}
 */
export function hasTimelineProgress(notesOfType) {
  if (notesOfType.length < MIN_NOTES_FOR_TIMELINE) return false;

  const oldest = toTime(notesOfType[0].createdAt);
  const newest = toTime(notesOfType[notesOfType.length - 1].createdAt);
  const spanDays = (newest - oldest) / (24 * 60 * 60 * 1000);

  return spanDays >= MIN_SPAN_DAYS;
}

/** @param {Date} createdAt @returns {number} */
function toTime(createdAt) {
  return createdAt instanceof Date ? createdAt.getTime() : 0;
}
