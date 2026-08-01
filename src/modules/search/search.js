// modules/search/search.js
// Logika pencarian & filter catatan. Modul ini tidak menyentuh DOM
// sama sekali, hanya fungsi murni yang menerima data dan mengembalikan data.

/**
 * Menyaring daftar catatan berdasarkan kata kunci (judul/isi) dan tipe.
 * Khusus catatan bertipe "song", kata kunci yang tidak cocok di judul/isi
 * masih dicek sekali lagi ke data chord-nya (field `chords` dan
 * `lines[].chord`) lewat `songDetailsMap`.
 * @param {Array} notes
 * @param {{query?: string, type?: string}} filters
 * @param {Object<number, Object>} [songDetailsMap] - peta noteId -> record
 *   songDetails, dipakai untuk pencarian berdasarkan chord. Kosongkan kalau
 *   tidak butuh (misal caller belum punya datanya).
 * @returns {Array} catatan yang cocok
 */
export function filterNotes(notes, { query = "", type = "" } = {}, songDetailsMap = {}) {
  const keyword = query.trim().toLowerCase();

  return notes.filter((note) => {
    const matchesType = !type || note.type === type;
    if (!matchesType) return false;

    if (!keyword) return true;

    const matchesTitleOrContent =
      note.title.toLowerCase().includes(keyword) ||
      note.content.toLowerCase().includes(keyword);
    if (matchesTitleOrContent) return true;

    if (note.type === "song") {
      return matchesChord(songDetailsMap[note.id], keyword);
    }

    return false;
  });
}

/**
 * Mengecek apakah sebuah kata kunci cocok dengan data chord milik satu lagu
 * (baik field `chords` bebas, maupun chord per baris di `lines`).
 * @param {Object} [details] - record songDetails milik note yang dicek
 * @param {string} keyword - sudah dalam bentuk lowercase
 * @returns {boolean}
 */
function matchesChord(details, keyword) {
  if (!details) return false;

  if (details.chords && details.chords.toLowerCase().includes(keyword)) {
    return true;
  }

  return (details.lines ?? []).some(
    (line) => line.chord && line.chord.toLowerCase().includes(keyword)
  );
}
