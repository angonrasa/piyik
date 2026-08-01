// modules/chat/chat.intent.js
// Fungsi pusat pendeteksi maksud pesan user. Murni pattern matching,
// tanpa AI/NLU/LLM (lihat 05-Chat-Roadmap.md - Catatan Arsitektur).
//
// Tahap E.5: extractAfterKeyword() memakai extractKeyword() (chat.keyword.js)
// untuk membuang kata yang bukan isi pencarian dari sisa kalimat. Ini
// menggantikan regex manual "^(catatan|tentang)" yang lama — kurang general
// karena cuma nangkep di awal kalimat, bukan di mana pun kata itu muncul.
//
// Tahap 2: search_note.
// Tahap 3: open_note (referensi urutan, misal "buka yang kedua").
// Tahap 4: show_relation.
// Tahap 5: create_note, edit_note, delete_note, latest_note, help,
//          + open_note diperluas supaya bisa kenali target lewat judul
//          langsung (misal "buka catatan gunung api").
// Tahap 6: entity "type" (tipe catatan) via extractTypeEntity(), dipakai
//          create_note/edit_note/delete_note/search_note/open_note(judul).
//          Entity "tanggal" & "nama orang" masih backlog (lihat roadmap).
// Tahap 7: referensi "yang tadi"/"yang itu" -> open_note dengan
//          entities.reference = true (lihat detectOpenNote).
// Tahap E.6: referensi urutan berdiri sendiri, mis. "yang kedua" (tanpa
//          kata "buka") -> open_note dengan entities.index (lihat
//          findOrdinalAfterYang). Sengaja dibatasi ke pola "yang <urutan>"
//          supaya tidak nabrak kata urutan yang muncul di intent lain
//          (mis. "cari satu potong roti").
// Tahap 10: Bug fix delete_note — "hapus catatan tadi" (referensi
//          berdiri sendiri, tanpa "yang" di depan) sekarang dikenali
//          sebagai entities.reference = true (lihat isStandaloneReference
//          & cabang delete_note di detectIntent). Beda dari REFERENCE_KEYWORDS
//          ("yang tadi"/"yang itu") yang dipakai open_note: itu dicek di
//          seluruh kalimat SEBELUM kata kunci aksi, sedangkan ini dicek
//          pada target SETELAH kata kunci "hapus" dibuang. Memory yang
//          dipakai untuk resolve reference-nya (lastOpenedNote) juga
//          diperluas dicatat oleh create_note (lihat chat.controller.js),
//          supaya "tadi" bisa merujuk ke catatan yang BARU DIBUAT, bukan
//          cuma yang dibuka.

import { extractKeyword } from "./chat.keyword.js";

const OPEN_KEYWORD = "buka";
const REFERENCE_KEYWORDS = ["yang tadi", "yang itu"];
// Kata acuan berdiri sendiri, dicek pada TARGET (sisa kalimat setelah kata
// kunci aksi & stopword dibuang), bukan pada seluruh kalimat seperti
// REFERENCE_KEYWORDS di atas. Dipakai delete_note (Tahap 10 - bug fix),
// supaya "hapus catatan tadi" merujuk ke catatan yang baru dibuat/dibicarakan.
const STANDALONE_REFERENCE_WORDS = ["tadi", "itu"];
const RELATION_KEYWORDS = ["hubungan", "terhubung", "relasi"];
const CREATE_KEYWORDS = ["buat", "tambah", "simpan"];
const EDIT_KEYWORDS = ["ubah", "edit"];
const DELETE_KEYWORDS = ["hapus"];
const LATEST_KEYWORDS = ["terbaru", "paling baru"];
const HELP_KEYWORDS = ["bantuan", "help", "bisa apa"];
const SEARCH_KEYWORDS = [
  "cari",
  "ada",
  "tampilkan",
  "tolong tampilkan",
  "aku pernah",
  "coba tampilkan",
  "lihat",
  "cek",
  "punya",
];

// Bug fix — "ada" di SEARCH_KEYWORDS salah kena kalau sebenarnya negasi
// ("jadwal gak ada"), bukan permintaan cari ("ada jadwal?"). Kalau lolos
// jadi search_note, extractAfterKeyword() motong SETELAH kata "ada" —
// padahal di kalimat negasi begini kata "ada" sering di akhir, jadi kata
// pentingnya ("jadwal") ikut kepotong duluan dan hilang. Dicek SEBELUM
// "ada" dianggap kata kunci search, supaya kalimat negasi jatuh ke
// intent lain / fallback (lihat 05-Roadmap-Reakurasi.md - Tahap 1,
// Memory Retrieval baru bisa jalan kalau intent-nya null).
const NEGATION_WORDS = ["gak", "ga", "nggak", "enggak", "tidak", "belum"];

/**
 * Cek apakah kata "ada" di kalimat ini didahului kata negasi langsung
 * (mis. "gak ada", "belum ada") — kalau iya, "ada" bukan kata kunci
 * search, jadi jangan dianggap search_note.
 * @param {string} lower
 * @returns {boolean}
 */
function isNegatedAda(lower) {
  return NEGATION_WORDS.some((neg) => new RegExp(`\\b${neg}\\s+ada\\b`).test(lower));
}

// Tipe catatan yang dikenali sebagai entity (sesuai 01-Piyik-Blueprint.md).
// "catatan" tidak dimasukkan karena sudah dibuang duluan di extractAfterKeyword
// (jadi tidak pernah muncul di awal target) — dan memang itu tipe default/umum.
//
// Bentuknya map (kata yang diketik user -> tipe internal), BUKAN array
// polos, karena "lagu" (kata Indonesia yang wajar diketik user) berbeda
// dari tipe internal yang dipakai note-type.js & type-select.js, yaitu
// "song" (lihat NOTE_TYPE_META di modules/notes/note-type.js). Untuk tipe
// lain kebetulan kata yang diketik sama persis dengan tipe internalnya,
// jadi map-nya identity, tapi tetap ditulis eksplisit supaya konsisten
// dan tidak ada asumsi tersembunyi "kata = tipe".
const NOTE_TYPE_KEYWORDS = {
  tugas: "tugas",
  ide: "ide",
  belanja: "belanja",
  orang: "orang",
  pengingat: "pengingat",
  lagu: "song",
};

// Kata urutan terbatas, ditambah pelan-pelan sesuai kebutuhan nyata.
const ORDINAL_WORDS = {
  pertama: 1,
  satu: 1,
  kedua: 2,
  dua: 2,
  ketiga: 3,
  tiga: 3,
  keempat: 4,
  empat: 4,
  kelima: 5,
  lima: 5,
};

/**
 * Mendeteksi intent dari satu pesan user.
 * Urutan pengecekan sengaja dari yang paling spesifik ke paling umum,
 * supaya kata kunci yang tumpang tindih (mis. "ada" di search_note vs
 * "ada hubungannya" di show_relation) tidak salah kena.
 * @param {string} pesan
 * @returns {{intent: string|null, target: string|null, entities: object}}
 */
export function detectIntent(pesan) {
  const lower = pesan.toLowerCase();

  const openIntent = detectOpenNote(lower);
  if (openIntent) return openIntent;

  if (RELATION_KEYWORDS.some((k) => lower.includes(k))) {
    return { intent: "show_relation", target: null, entities: {} };
  }

  const createKeyword = CREATE_KEYWORDS.find((k) => lower.includes(k));
  if (createKeyword) {
    const target = extractAfterKeyword(lower, createKeyword);
    return {
      intent: "create_note",
      target,
      entities: extractTypeEntity(target),
    };
  }

  const editKeyword = EDIT_KEYWORDS.find((k) => lower.includes(k));
  if (editKeyword) {
    const target = extractAfterKeyword(lower, editKeyword);
    return {
      intent: "edit_note",
      target,
      entities: extractTypeEntity(target),
    };
  }

  const deleteKeyword = DELETE_KEYWORDS.find((k) => lower.includes(k));
  if (deleteKeyword) {
    const target = extractAfterKeyword(lower, deleteKeyword);

    if (isStandaloneReference(target)) {
      return { intent: "delete_note", target: null, entities: { reference: true } };
    }

    return {
      intent: "delete_note",
      target,
      entities: extractTypeEntity(target),
    };
  }

  if (LATEST_KEYWORDS.some((k) => lower.includes(k))) {
    return { intent: "latest_note", target: null, entities: {} };
  }

  if (HELP_KEYWORDS.some((k) => lower.includes(k))) {
    return { intent: "help", target: null, entities: {} };
  }

  const searchKeyword = SEARCH_KEYWORDS.find(
    (k) => lower.includes(k) && !(k === "ada" && isNegatedAda(lower))
  );
  if (searchKeyword) {
    const target = extractAfterKeyword(lower, searchKeyword);
    return {
      intent: "search_note",
      target,
      entities: extractTypeEntity(target),
    };
  }

  return { intent: null, target: null, entities: {} };
}

/**
 * Mengenali intent open_note dalam 4 bentuk:
 * 1. "yang tadi" / "yang itu" -> merujuk ke catatan terakhir dibuka (entities.reference)
 * 2. "yang kedua" (berdiri sendiri, tanpa "buka") -> urutan dari hasil pencarian terakhir (entities.index)
 * 3. "buka yang kedua" -> sama seperti #2, tapi didahului kata "buka"
 * 4. "buka catatan gunung api" -> pakai target judul langsung
 * @param {string} lower
 * @returns {{intent: string, target: string|null, entities: object}|null}
 */
function detectOpenNote(lower) {
  const referenceKeyword = REFERENCE_KEYWORDS.find((k) => lower.includes(k));
  if (referenceKeyword) {
    return { intent: "open_note", target: null, entities: { reference: true } };
  }

  const standaloneIndex = findOrdinalAfterYang(lower);
  if (standaloneIndex) {
    return { intent: "open_note", target: null, entities: { index: standaloneIndex } };
  }

  if (!lower.includes(OPEN_KEYWORD)) return null;

  const ordinalWord = Object.keys(ORDINAL_WORDS).find((word) =>
    lower.includes(word)
  );
  if (ordinalWord) {
    return {
      intent: "open_note",
      target: null,
      entities: { index: ORDINAL_WORDS[ordinalWord] },
    };
  }

  const target = extractAfterKeyword(lower, OPEN_KEYWORD);
  if (!target) return null;

  return { intent: "open_note", target, entities: extractTypeEntity(target) };
}

/**
 * Cek apakah target (sisa kalimat setelah kata kunci aksi & stopword
 * dibuang oleh extractAfterKeyword) HANYA berisi kata acuan seperti
 * "tadi"/"itu" — artinya user merujuk ke catatan yang baru dibuat/
 * dibicarakan, bukan menyebut judul asli (Tahap 10 - bug fix delete_note).
 * @param {string} target
 * @returns {boolean}
 */
function isStandaloneReference(target) {
  return STANDALONE_REFERENCE_WORDS.includes(target.trim());
}

/**
 * Mengenali pola "yang <kata urutan>" berdiri sendiri, tanpa kata "buka"
 * (Tahap E.6). Contoh: "Yang kedua" -> 2, "yang pertama dong" -> 1.
 * Dibatasi ke pola "yang <urutan>" (bukan kata urutan sendirian di posisi
 * manapun) supaya tidak nabrak intent lain yang kebetulan mengandung kata
 * seperti "satu"/"dua" (mis. "cari satu potong roti").
 * @param {string} lower
 * @returns {number|null}
 */
function findOrdinalAfterYang(lower) {
  const ordinalWord = Object.keys(ORDINAL_WORDS).find((word) =>
    new RegExp(`\\byang\\s+${word}\\b`).test(lower)
  );
  return ordinalWord ? ORDINAL_WORDS[ordinalWord] : null;
}

/**
 * Mengenali entity tipe catatan di awal target, sisanya jadi keyword.
 * Contoh: "tugas ipa" -> { type: "tugas", keyword: "ipa" }
 * Kalau tidak ada tipe yang cocok, keyword = target apa adanya.
 * @param {string} target
 * @returns {{type: string|null, keyword: string}}
 */
function extractTypeEntity(target) {
  const typeWord = Object.keys(NOTE_TYPE_KEYWORDS).find((t) =>
    new RegExp(`^${t}\\b`).test(target)
  );
  if (!typeWord) return { type: null, keyword: target };

  const keyword = target.replace(new RegExp(`^${typeWord}\\s*`), "").trim();
  return { type: NOTE_TYPE_KEYWORDS[typeWord], keyword };
}

/**
 * Mengambil sisa kalimat setelah kata kunci, lalu dibersihkan lewat
 * extractKeyword() (E.5) supaya jadi kata kunci pencarian yang bersih.
 * Contoh: "buka catatan gunung api" + "buka" -> "gunung api"
 * @param {string} lower
 * @param {string} keyword
 * @returns {string}
 */
function extractAfterKeyword(lower, keyword) {
  const afterKeyword = lower.slice(lower.indexOf(keyword) + keyword.length);

  return extractKeyword(afterKeyword);
}
