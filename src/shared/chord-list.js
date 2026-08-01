// shared/chord-list.js
// Data & logic transpose chord. Ditaruh di shared/ karena berpotensi
// dipakai lebih dari satu bagian modul song (editor & read mode).
//
// Catatan: sempat ada COMMON_CHORDS untuk autocomplete di editor, tapi
// dicabut — field Chord sekarang teks bebas (boleh lebih dari satu chord
// per baris + spasi manual untuk posisi), datalist satu-nilai sudah tidak
// cocok lagi untuk kasus itu.

export const CHORD_ROOTS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
];

// Peta nama root -> nomor semitone (0-11), dipakai untuk hitung transpose.
const ROOT_TO_SEMITONE = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Root chord + huruf kualitasnya (m, 7, maj7, dim, sus4, dst) di awal kata.
// Contoh match: "Bb7" -> root "Bb", sisanya "7". "Em" -> root "E", sisanya "m".
const CHORD_TOKEN_PATTERN = /^([A-G])(#|b)?(.*)$/;

/**
 * Menggeser satu token chord sejumlah semitone. Token yang tidak diawali
 * huruf A-G (misal tanda baca nyasar) dikembalikan apa adanya, tidak error.
 * @param {string} token
 * @param {number} steps - boleh negatif (turun) atau positif (naik)
 * @returns {string}
 */
export function transposeChordToken(token, steps) {
  const match = token.match(CHORD_TOKEN_PATTERN);
  if (!match) return token;

  const [, letter, accidental = "", rest] = match;
  const rootName = letter + accidental;
  const semitone = ROOT_TO_SEMITONE[rootName];
  if (semitone === undefined) return token;

  const newSemitone = ((semitone + steps) % 12 + 12) % 12;
  // Pertahankan gaya penulisan asli (pakai "b" -> tetap pakai flat setelah
  // digeser; selain itu default ke sharp), supaya hasilnya tidak terasa acak.
  const names = accidental === "b" ? FLAT_NAMES : SHARP_NAMES;
  return names[newSemitone] + rest;
}

// Pola ketat untuk DETEKSI baris chord (beda dari CHORD_TOKEN_PATTERN di
// atas yang dipakai untuk transpose dan sengaja permisif). Di sini token
// harus cocok persis root + kualitas akor yang dikenal + slash chord
// opsional, supaya kata lirik biasa yang kebetulan diawali huruf A-G
// (mis. "Ada", "Bawa") tidak salah terdeteksi sebagai chord.
const CHORD_LINE_TOKEN_PATTERN =
  /^[A-G](#|b)?(maj7|maj|min7|min|dim7|dim|aug|sus4|sus2|sus|add9|add11|m7b5|m7|m6|m9|m11|m13|m|6|7|9|11|13)?(\/[A-G](#|b)?)?$/;

/**
 * Mengecek apakah sebuah baris teks adalah "baris chord": setelah dipecah
 * per spasi, SEMUA token di baris itu cocok pola akor. Baris kosong atau
 * baris yang punya minimal satu token bukan-akor dianggap bukan baris
 * chord (baris lirik biasa). Dipakai saat render (bukan saat simpan),
 * sesuai keputusan di 08-Design-Song-NoteType.md.
 * @param {string} line
 * @returns {boolean}
 */
export function isChordLine(line) {
  const trimmed = (line ?? "").trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.every((token) => CHORD_LINE_TOKEN_PATTERN.test(token));
}

/**
 * Menggeser semua chord dalam satu baris "chord line" (boleh berisi lebih
 * dari satu chord dipisah spasi manual, misal "Em      C      Em"). Spasi
 * asli dipertahankan persis supaya tidak merusak posisi kata lain yang
 * tidak ikut berubah panjang — meski begitu, kalau nama chord hasil
 * transpose beda jumlah karakter (misal "C" jadi 1 huruf, "Db" 2 huruf),
 * alignment ke lirik di bawahnya tetap bisa sedikit bergeser; itu
 * konsekuensi dari posisi berbasis teks bebas, bukan bug.
 * @param {string} chordLine
 * @param {number} steps
 * @returns {string}
 */
export function transposeChordLine(chordLine, steps) {
  if (!chordLine || steps === 0) return chordLine;
  return chordLine
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transposeChordToken(part, steps)))
    .join("");
}
