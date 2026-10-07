// modules/editor/editor.selection.js
// Logika murni untuk membungkus/melepas simbol markdown di sekitar pilihan
// teks (Phase 2). Tidak menyentuh DOM, jadi mudah diuji dan dipakai ulang
// oleh semua format inline (bold, italic, underline, strikethrough).

// Banyaknya karakter `ch` yang berderet persis sebelum/sesudah posisi `index`.
function runBefore(text, index, ch) {
  let count = 0;
  while (index - 1 - count >= 0 && text[index - 1 - count] === ch) count++;
  return count;
}

function runAfter(text, index, ch) {
  let count = 0;
  while (index + count < text.length && text[index + count] === ch) count++;
  return count;
}

// Apakah `marker` sudah terpasang di sekitar pilihan?
// Tebal "**" dan miring "*" sama-sama memakai bintang, jadi dibedakan lewat
// jumlah bintang di tepi: "*x*" miring, "**x**" tebal, "***x***" keduanya.
// Miring aktif kalau jumlahnya ganjil; marker lain aktif kalau cukup panjang.
function isApplied(marker, left, right) {
  const run = Math.min(left, right);
  return marker.length === 1 ? run % 2 === 1 : run >= marker.length;
}

/**
 * Membungkus pilihan dengan `marker`, atau melepasnya kalau sudah terbungkus.
 * - Spasi di tepi pilihan tidak ikut terbungkus (markdown tidak merender
 *   "** kata **").
 * - Kalau pilihan sendiri mencakup simbolnya ("**kata**"), simbol itu
 *   dianggap bagian luar.
 * - Tanpa pilihan: menyisipkan marker ganda dengan kursor di tengah; kursor
 *   di dalam marker ganda yang kosong melepasnya lagi.
 * @param {string} text - isi lengkap textarea
 * @param {number} start - awal pilihan
 * @param {number} end - akhir pilihan
 * @param {string} marker - mis. "**", "*", "++", "~~"
 * @returns {{ text: string, start: number, end: number }} teks baru + pilihan baru
 */
export function toggleWrap(text, start, end, marker) {
  const m = marker.length;
  const ch = marker[0];

  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;

  // Pilihan mencakup simbolnya di kedua ujung -> persempit ke isinya.
  const selected = text.slice(start, end);
  let lead = 0;
  while (lead < selected.length && selected[lead] === ch) lead++;
  let trail = 0;
  while (trail < selected.length - lead && selected[selected.length - 1 - trail] === ch) trail++;
  if (lead > 0 && trail > 0) {
    start += lead;
    end -= trail;
  }

  const before = text.slice(0, start);
  const inner = text.slice(start, end);
  const after = text.slice(end);

  if (isApplied(marker, runBefore(text, start, ch), runAfter(text, end, ch))) {
    return {
      text: before.slice(0, -m) + inner + after.slice(m),
      start: start - m,
      end: end - m,
    };
  }

  return {
    text: before + marker + inner + marker + after,
    start: start + m,
    end: end + m,
  };
}
