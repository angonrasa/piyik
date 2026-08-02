// modules/memory/memory.similarity.js
//
// Tahap 3 — Reflection Engine, Milestone 3.1 (05-Roadmap-Reakurasi.md).
// Deteksi kesamaan sederhana antara dua teks (pesan baru vs catatan hasil
// retrieval) lewat 5 kategori, MURNI cocok kata kunci (rule-based, tanpa
// NLP/AI) — konsisten sama gaya NOTE_TYPE_KEYWORDS/SEARCH_KEYWORDS di
// chat.intent.js.
//
// "Orang" & "proyek" TIDAK pakai daftar kata hardcode (nama orang/proyek
// beda-beda tiap user, nggak bisa ditebak generik) — vocabnya diambil
// OTOMATIS dari data yang sudah ada:
//   - orang  -> judul catatan bertipe "orang"
//   - proyek -> judul SEMUA catatan
// "Tempat" & "aktivitas" pakai daftar kata TETAP (starter list, PERLU
// DITAMBAH MANUAL sesuai kebiasaan user sendiri — lihat komentar di
// masing-masing const di bawah).
//
// Skor per kategori dijumlah jadi satu skor total. Kalau skor >=
// SIMILARITY_THRESHOLD, dua teks dianggap "mirip" (Milestone 3.1).
// Kategori dengan bobot match tertinggi dipakai buat kalimat penghubung
// (Milestone 3.2, lihat REFLECTION_REPLIES & buildReflection() di
// chat.controller.js).

// Starter list — kata tempat umum Bahasa Indonesia.
// TAMBAH MANUAL sesuai kebutuhan (mis. nama kota/daerah yang sering ditulis).
const PLACE_KEYWORDS = [
  "rumah", "kantor", "sekolah", "kelas", "kampus",
  "masjid", "cigeulis", "pandeglang", "pasar", "warung", "cafe", "kafe",
  "taman", "lapangan", "perpustakaan",
];

// Starter list — kata kerja aktivitas umum.
// TAMBAH MANUAL sesuai kebutuhan.
const ACTIVITY_KEYWORDS = [
  "rapat", "meeting", "diskusi", "belajar", "mengajar",
  "gowes", "belanja", "olahraga", "lari", "masak", "sepedaan", "ngajar", "mudik",
  "kerja", "ngoding", "coding",
];

// Kata penanda sebab — dipakai buat CEK KEBERADAAN (apakah kedua teks
// sama-sama menyinggung sebab), BUKAN bandingkan isi klausanya. Beda dari
// extractCause() (memory.reflection.js) yang narik teks lengkap setelah
// "karena" khusus buat kalimat balasan.
const CAUSE_MARKERS = ["karena", "akibat", "supaya", "agar"];

// Bobot per kategori (Milestone 3.1, sesuai contoh yang diberikan).
// "Proyek" & "orang" lebih berat karena itu entitas spesifik (kalau sama,
// hampir pasti memang berhubungan) — "aktivitas"/"tempat"/"sebab" lebih
// ringan karena kata kuncinya umum, gampang kebetulan sama tanpa benar-
// benar berhubungan.
const CATEGORY_WEIGHTS = {
  proyek: 3,
  orang: 2,
  aktivitas: 1,
  tempat: 1,
  sebab: 1,
};

// Skor total minimum supaya dua teks dianggap "mirip" (Milestone 3.1).
// Default disamakan dengan satu kategori terkuat (proyek). Adjustable —
// naikkan kalau kerasa kepicu kegampangan, turunkan kalau kerasa susah.
export const SIMILARITY_THRESHOLD = 3;

/**
 * Mencari kata/frasa dari vocab yang muncul di sebuah teks.
 * Satu kata -> dicek whole word (biar "ide" tidak kena "identitas").
 * Frasa multi-kata (mis. "Piyik Brain") -> dicek sebagai substring biasa.
 * @param {string} text
 * @param {string[]} vocab
 * @returns {string[]} kata/frasa dari vocab yang ketemu di teks ini
 */
function findMatches(text, vocab) {
  const lower = text.toLowerCase();

  return vocab.filter((entry) => {
    const word = entry.toLowerCase().trim();
    if (!word) return false;

    return word.includes(" ")
      ? lower.includes(word)
      : new RegExp(`\\b${word}\\b`).test(lower);
  });
}

/**
 * Skor satu kategori: dianggap match kalau ada minimal satu kata/frasa
 * vocab yang muncul di KEDUA teks (bukan cuma salah satu).
 * @param {string} textA @param {string} textB
 * @param {string[]} vocab @param {number} weight
 * @returns {{matched: boolean, weight: number, keyword: string|null}}
 */
function scoreCategory(textA, textB, vocab, weight) {
  const matchesA = findMatches(textA, vocab);
  if (matchesA.length === 0) return { matched: false, weight: 0, keyword: null };

  const matchesB = findMatches(textB, vocab);
  const shared = matchesA.find((word) => matchesB.includes(word));

  return shared
    ? { matched: true, weight, keyword: shared }
    : { matched: false, weight: 0, keyword: null };
}

/**
 * Menyusun vocab "orang" & "proyek" dari data catatan yang SUDAH ADA
 * (bukan hardcode) — lihat catatan di kepala file.
 * @param {Array<{title: string, type: string}>} notes daftar semua catatan (dari getAllNotes())
 * @returns {{orang: string[], proyek: string[]}}
 */
export function buildSimilarityVocab(notes) {
  const orang = notes.filter((note) => note.type === "orang").map((note) => note.title);
  const proyek = notes.map((note) => note.title);
  return { orang, proyek };
}

/**
 * Menghitung kesamaan antara dua teks berdasarkan 5 kategori
 * (Milestone 3.1). Kategori dicek dari bobot terbesar ke terkecil,
 * supaya kalau beberapa kategori match bareng, topCategory yang dipilih
 * adalah yang paling spesifik/kuat (dipakai buat kalimat penghubung,
 * Milestone 3.2).
 * @param {string} textA teks pertama (bisa pesan chat mentah)
 * @param {string} textB teks kedua (bisa judul+isi catatan)
 * @param {{orang: string[], proyek: string[]}} vocab dari buildSimilarityVocab()
 * @returns {{score: number, topCategory: string|null, keyword: string|null}}
 */
export function calculateSimilarity(textA, textB, vocab) {
  const results = {
    proyek: scoreCategory(textA, textB, vocab.proyek, CATEGORY_WEIGHTS.proyek),
    orang: scoreCategory(textA, textB, vocab.orang, CATEGORY_WEIGHTS.orang),
    aktivitas: scoreCategory(textA, textB, ACTIVITY_KEYWORDS, CATEGORY_WEIGHTS.aktivitas),
    tempat: scoreCategory(textA, textB, PLACE_KEYWORDS, CATEGORY_WEIGHTS.tempat),
    sebab: scoreCategory(textA, textB, CAUSE_MARKERS, CATEGORY_WEIGHTS.sebab),
  };

  const order = ["proyek", "orang", "aktivitas", "tempat", "sebab"];
  const score = order.reduce((sum, category) => sum + results[category].weight, 0);
  const topCategory = order.find((category) => results[category].matched) ?? null;
  const keyword = topCategory ? results[topCategory].keyword : null;

  return { score, topCategory, keyword };
}
