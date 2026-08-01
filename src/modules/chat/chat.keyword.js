// modules/chat/chat.keyword.js
//
// E.5 — Ekstraksi Kata Kunci.
//
// Dipakai di dalam extractAfterKeyword() (chat.intent.js), SETELAH sisa
// kalimat diambil berdasarkan kata kunci intent (mis. "cari", "buka").
// Tugasnya cuma satu: buang kata yang bukan isi pencarian dari sisa
// kalimat itu, supaya target/keyword yang dipakai untuk searchNotes()
// bersih. Murni cleanup teks, TIDAK menyentuh deteksi intent apapun.
//
// Contoh:
// "nyatet gunung api gak?"      -> "gunung api"
// "catatan tentang fotosintesis?" -> "fotosintesis"
// "jadwal kelas 8"              -> "jadwal kelas 8" (tidak ada yang dibuang)

// Kata yang dibuang karena bukan isi pencarian:
// - pronoun / kata bantu ("aku", "mau", dst.)
// - kata kerja perintah pencarian yang mungkin ikut kebawa ke sisa
//   kalimat (kata kunci utamanya sendiri sudah dipotong duluan di
//   extractAfterKeyword, ini jaga-jaga kalau kata sejenis nyempil lagi)
// - kata umum "catatan" / "tentang" yang sering ikut kalimat tapi
//   bukan isi pencarian
// - partikel tanya / negasi
const KEYWORD_STOPWORDS = [
  // Pronoun
  "aku",
  "kamu",
  "saya",
  "gue",
  "kau",
  // Kata bantu / modal
  "mau",
  "ingin",
  "pernah",
  "bisa",
  // Kata kerja pencarian/perintah
  "cari",
  "nyari",
  "lihat",
  "liat",
  "cek",
  "tampilkan",
  "buka",
  "catat",
  "catetin",
  "nyatet",
  "punya",
  "ada",
  // Kata umum, bukan isi pencarian
  "catatan",
  "tentang",
  // Partikel tanya / negasi
  "gak",
  "ga",
  "nggak",
  "enggak",
  "sih",
  "kah",
  "apakah",
  "apa",
];

/**
 * Membuang tanda baca yang tidak relevan untuk kata kunci pencarian.
 * @param {string} text
 * @returns {string}
 */
function removePunctuation(text) {
  return text.replace(/[?!.,]/g, "");
}

/**
 * Membuang kata di KEYWORD_STOPWORDS dari teks (word boundary saja,
 * supaya tidak salah potong kata lain, mis. "apa" di dalam "apapun").
 * @param {string} text
 * @returns {string}
 */
function removeStopwords(text) {
  let result = text;

  for (const word of KEYWORD_STOPWORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(pattern, "");
  }

  return result;
}

/**
 * Membersihkan sisa kalimat menjadi kata kunci pencarian yang bersih.
 * @param {string} text
 * @returns {string}
 */
export function extractKeyword(text) {
  if (!text) return text;

  let result = removePunctuation(text);
  result = removeStopwords(result);

  return result.replace(/\s+/g, " ").trim();
}
