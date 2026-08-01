// modules/chat/chat.controller.js
// Menghubungkan aksi pengguna (kirim pesan, buka tab Chat) dengan
// repository & view. Tahap 5 — Intent Engine: semua intent baru
// (create_note, edit_note, delete_note, latest_note, help) sudah dikenali
// detectIntent(). Tahap 8 — Rule Engine: create_note & delete_note sudah
// aktif (delete pakai konfirmasi "ya"). edit_note masih notYetActive
// (sengaja di-skip, belum ada spesifikasi format), lihat 05-Chat-Roadmap.md.
// Tahap 9: alur create_note dua langkah ("buat tugas" tanpa judul -> tunggu
//          pesan berikutnya sebagai judul).
// Tahap 10: entities.reference pada delete_note ("hapus catatan tadi"),
//           lihat handleDeleteNote & updateContext({ currentNote }) di
//           handleCreateNote/handleConfirmCreateTitle.
// Tahap 11: Bug fix — createNote() ternyata cuma mengembalikan id, bukan
//           objek catatan lengkap. currentNote sebelumnya (Tahap 10) salah
//           asumsi dan tersimpan dengan title undefined. Sekarang objek
//           note disusun sendiri dari data yang sudah diketahui (lihat
//           extractNoteId).
// Tahap 12: Refactor Conversation Context (v1) — pendingDelete & pendingCreate
//           (dua variabel pending terpisah di chat-memory.js) disatukan jadi
//           waitingAction + payload generik. handlePendingDelete &
//           handlePendingCreate lama digabung jadi handleWaitingAction(),
//           switch berdasarkan getWaitingAction().
// Tahap 13: Refactor Conversation Context (v2) — searchResults, currentNote,
//           relatedNotes, waitingAction, payload disatukan jadi SATU objek
//           conversationContext di chat-memory.js, dengan SATU jalur tulis:
//           updateContext(patch). Setter lama yang terpisah per field
//           (setSearchResults, setCurrentNote, setLastRelatedNotes) dihapus
//           — semua penulisan context sekarang lewat updateContext({...}),
//           dipanggil langsung di handler masing-masing (lihat
//           handleSearchNote, handleCreateNote, handleOpenNote,
//           handleShowRelation di bawah). waitFor()/clearWaiting() tetap
//           ada sebagai shortcut tipis khusus untuk waitingAction+payload.
//           Getter (getSearchResults, getCurrentNote, dst) tidak berubah.
// Tahap 14: Bug fix — capitalizeType() (sekarang resolveType, lihat komentar
//           di fungsinya) dulu mengubah type jadi "Tugas" (kapital) sebelum
//           disimpan, padahal konvensi type di seluruh aplikasi huruf kecil
//           ("tugas" — lihat NOTE_TYPE_KEYWORDS di chat.intent.js dan
//           TYPE_ICONS di shared/type-select.js). Akibatnya dropdown type
//           di editor catatan (<option value="tugas">) tidak match "Tugas"
//           dan tampil kosong, walau daftar catatan tetap tampil benar.
//           Sekarang type disimpan apa adanya, tanpa ubah casing.
// Tahap 15: Bug fix — loadChat() manggil renderMessages() SEBELUM
//           showView("chat"), jadi scroll-to-bottom di chat.view.js
//           kebaca scrollHeight 0 (halaman masih disembunyikan) dan tidak
//           ada efeknya. Pas pertama buka Chat, yang kelihatan pesan
//           paling lama, bukan paling baru. Urutan dibalik: showView()
//           dulu, baru renderMessages().

import { addMessage, addBotMessage, getAllMessages, deleteAllMessages } from "./chat.repository.js";
import { renderMessages, readInput, clearInput, showTypingIndicator, hideTypingIndicator } from "./chat.view.js";
import { showView } from "../../shared/view-switcher.js";
import { detectIntent } from "./chat.intent.js";
import { normalizeMessage } from "./chat.normalize.js";
import { searchNotes, getAllNotes, createNote, deleteNote } from "../notes/notes.repository.js";
import { getRelatedNotes } from "../relations/relations.repository.js";
import { retrieveMemory } from "../memory/memory.retrieval.js";
import {
  updateContext,
  getSearchResults,
  getCurrentNote,
  waitFor,
  getWaitingAction,
  getPayload,
  clearWaiting,
  resetMemory,
  WAITING_CONFIRM_DELETE,
  WAITING_CREATE_TITLE,
} from "./chat-memory.js";

/**
 * Tahap 15 — Bug fix: sebelumnya renderMessages() dipanggil SEBELUM
 * showView("chat"), padahal renderMessages() butuh scroll ke bawah
 * (messageList.scrollHeight, lihat chat.view.js). Selama halaman Chat
 * masih disembunyikan oleh view-switcher, scrollHeight kebaca 0, jadi
 * scroll-to-bottom itu tidak ada efeknya — akibatnya pas pertama kali
 * buka Chat, yang kelihatan pesan paling lama (scroll masih di atas),
 * bukan pesan terbaru. Urutan dibalik: tampilkan dulu halamannya, baru
 * render + scroll, supaya ukurannya sudah benar saat dihitung.
 */
async function loadChat() {
  const messages = await getAllMessages();
  showView("chat");
  renderMessages(messages);
}

// Rentang jeda "mengetik" sebelum balasan bot muncul (Backlog -
// 06-Chat-Polish-Roadmap.md). Dijalankan paralel dengan generateReply(),
// bukan ditambahkan di atasnya, supaya tidak menunda dua kali.
const TYPING_DELAY_MIN_MS = 400;
const TYPING_DELAY_MAX_MS = 900;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleSubmit(event) {
  event.preventDefault();

  const text = readInput();
  if (!text) return; // validasi minimal: jangan simpan pesan kosong

  await addMessage(text);
  clearInput();

  // Tampilkan pesan user dulu, baru proses balasan bot, supaya tidak
  // terasa balasan sudah ada sebelum pesan user muncul.
  renderMessages(await getAllMessages());

  showTypingIndicator();
  const randomDelay = TYPING_DELAY_MIN_MS + Math.random() * (TYPING_DELAY_MAX_MS - TYPING_DELAY_MIN_MS);
  const [reply] = await Promise.all([generateReply(text), delay(randomDelay)]);
  hideTypingIndicator();

  await addBotMessage(reply);

  const messages = await getAllMessages();
  renderMessages(messages);
}

/**
 * Menyusun balasan bot berdasarkan intent pesan user.
 * Intent baru ditambahkan sebagai case baru di sini, mengikuti cabang
 * yang ditambahkan di detectIntent().
 * @param {string} pesan
 * @returns {Promise<string>}
 */
async function generateReply(pesan) {
  const waitingReply = await handleWaitingAction(pesan);
  if (waitingReply) return waitingReply;

  // Normalisasi dijalankan di sini, SETELAH handleWaitingAction, supaya
  // balasan konfirmasi hapus ("ya"/"iya") atau judul catatan yang diketik
  // user tidak ikut terpotong oleh filler word removal (lihat
  // chat.normalize.js).
  const normalizedPesan = normalizeMessage(pesan);
  const { intent, target, entities } = detectIntent(normalizedPesan);

  switch (intent) {
    case "search_note":
      return handleSearchNote(entities.keyword);
    case "open_note":
      return handleOpenNote(entities.keyword ?? target, entities);
    case "show_relation":
      return handleShowRelation();
    case "create_note":
      return handleCreateNote(entities);
    case "edit_note":
      return notYetActive("ubah", target);
    case "delete_note":
      return handleDeleteNote(entities);
    case "latest_note":
      return handleLatestNote();
    case "help":
      return handleHelp();
    default:
      return handleFallback(pesan);
  }
}

// Variasi kalimat balasan Memory Retrieval pasif (Tahap 1 -
// 05-Roadmap-Reakurasi.md). Nadanya sengaja beda dari SEARCH_FOUND_REPLIES:
// di search_note, user MEMINTA pencarian. Di sini chat MENAWARKAN ingatan
// tanpa diminta, jadi kalimatnya harus terasa "mengingatkan", bukan
// "melaporkan hasil".
const MEMORY_RECALL_REPLIES = [
  (titles) => `Kamu pernah menulis hal serupa: ${titles}.`,
  (titles) => `Ini mengingatkanku ke catatan lamamu: ${titles}.`,
  (titles) => `Sepertinya ini mirip sama yang pernah kamu tulis: ${titles}.`,
];

// Variasi kalimat fallback saat intent gagal dikenali (Tahap B.1 -
// 06-Chat-Polish-Roadmap.md). Kasih contoh perintah pakai judul catatan
// asli dari DB (sama seperti handleHelp) supaya lebih relate.
const FALLBACK_REPLIES = [
  (contoh) => `Waduh, aku belum ngerti maksudmu. Coba bilang "cari ${contoh}" atau "buka ${contoh}" deh.`,
  (contoh) => `Hmm, belum nangkep nih. Coba pakai kata kayak "cari" atau "buka", contoh: "cari ${contoh}".`,
  (contoh) => `Duh, belum paham maksudmu. Ketik "bantuan" buat liat contoh perintah, atau coba "cari ${contoh}".`,
];

// Variasi kalimat fallback saat masih ada hasil pencarian terakhir
// (Tahap B.2). Arahkan user untuk membuka salah satu hasil tadi.
const FALLBACK_AFTER_SEARCH_REPLIES = [
  "Waduh, belum ngerti maksudmu. Mau buka salah satu dari hasil tadi? Bilang aja \"buka yang pertama\" atau sebutin judulnya.",
  "Belum nangkep nih. Dari hasil cari tadi, coba bilang \"buka yang kedua\" atau judulnya langsung.",
];

// Variasi kalimat fallback saat masih ada catatan yang sedang dibuka
// (Tahap B.2). Arahkan user untuk lihat hubungan catatan tersebut.
const FALLBACK_AFTER_OPEN_REPLIES = [
  (title) => `Waduh, belum ngerti maksudmu. Mau liat hubungan "${title}" yang lagi dibuka? Coba bilang "ada hubungannya dengan apa?".`,
  (title) => `Belum nangkep nih. "${title}" masih dibuka lho, mau liat catatan yang terhubung?`,
];

/**
 * Balasan saat pesan user tidak dikenali intent apapun oleh detectIntent().
 * Diprioritaskan berdasarkan konteks percakapan (Tahap B.2): kalau baru
 * saja mencari, arahkan ke hasil cari; kalau ada catatan sedang dibuka,
 * arahkan ke relasi; kalau tidak ada konteks, pakai fallback default (B.1).
 * @returns {Promise<string>}
 */
async function handleFallback(pesan) {
  const lastResults = getSearchResults();
  if (lastResults.length > 0) {
    return pickRandom(FALLBACK_AFTER_SEARCH_REPLIES);
  }

  const lastNote = getCurrentNote();
  if (lastNote) {
    return pickRandom(FALLBACK_AFTER_OPEN_REPLIES)(lastNote.title);
  }

  // Tahap 1 — Memory Retrieval Engine (05-Roadmap-Reakurasi.md). Coba
  // retrieval pasif dulu sebelum jatuh ke fallback generik. Kalau ketemu,
  // BUKAN dianggap hasil search_note biasa (lihat MEMORY_RECALL_REPLIES,
  // nadanya sengaja beda). Kalau tidak ketemu, diam-diam lanjut ke
  // fallback generik seperti biasa — chat tidak memaksakan jawaban
  // (DoD Milestone 1.3).
  const memories = await retrieveMemory(pesan);
  if (memories.length > 0) {
    updateContext({ searchResults: memories });
    const titles = memories.map((note) => note.title).join(", ");
    return pickRandom(MEMORY_RECALL_REPLIES)(titles);
  }

  const notes = await getAllNotes();
  const contoh = notes.length > 0 ? pickRandom(notes).title : "gunung api";
  return pickRandom(FALLBACK_REPLIES)(contoh);
}

/**
 * Cek apakah bot sedang menunggu jawaban user untuk sebuah aksi multi-step
 * (konfirmasi hapus, atau judul catatan yang belum disebutkan). Kalau ada,
 * pesan ini DIANGGAP sebagai jawaban untuk aksi itu (tidak dilewatkan ke
 * detectIntent()) — bukan pesan baru.
 *
 * Satu titik masuk untuk semua alur "tanya lalu tunggu jawaban" (lihat
 * catatan Tahap 12 di atas file ini). Menggantikan handlePendingDelete +
 * handlePendingCreate yang dulu terpisah.
 * @param {string} pesan
 * @returns {Promise<string|null>} balasan jika ada aksi yang ditangani, null jika tidak ada yang pending
 */
async function handleWaitingAction(pesan) {
  const action = getWaitingAction();
  if (!action) return null;

  const payload = getPayload();
  clearWaiting();

  switch (action) {
    case WAITING_CONFIRM_DELETE:
      return handleConfirmDelete(pesan, payload);
    case WAITING_CREATE_TITLE:
      return handleConfirmCreateTitle(pesan, payload);
    default:
      return null;
  }
}

// Variasi kalimat balasan delete_note setelah konfirmasi (Tahap A.4).
const DELETE_DONE_REPLIES = [
  (title) => `Sip, "${title}" udah dihapus.`,
  (title) => `Oke, "${title}" udah aku hapus.`,
  (title) => `Beres, "${title}" udah gak ada lagi.`,
];

/**
 * Jawaban atas WAITING_CONFIRM_DELETE. Kalau pesan ini "ya"/"iya" ->
 * jalankan delete. Kalau pesan lain -> batalkan diam-diam (lanjut ke
 * intent biasa).
 * @param {string} pesan
 * @param {{note: object}} payload
 * @returns {Promise<string|null>}
 */
async function handleConfirmDelete(pesan, payload) {
  const jawaban = pesan.trim().toLowerCase();
  if (jawaban === "ya" || jawaban === "iya") {
    await deleteNote(payload.note.id);
    return pickRandom(DELETE_DONE_REPLIES)(payload.note.title);
  }

  return null; // batal, lanjut proses pesan ini sebagai intent baru
}

/**
 * Mengambil id dari hasil createNote(), tanpa berasumsi bentuk return-nya.
 * Bug fix Tahap 11: createNote() ternyata cuma mengembalikan id (angka),
 * BUKAN objek catatan lengkap — asumsi sebelumnya (Tahap 10) salah dan
 * menyebabkan currentNote tersimpan dengan title undefined
 * (lihat handleCreateNote & handleConfirmCreateTitle). Fungsi ini menangani
 * kedua kemungkinan bentuk return (angka id langsung, atau objek yang
 * punya field id) supaya tidak gampang rusak lagi kalau repository berubah.
 * @param {number|{id: number}} result
 * @returns {number}
 */
function extractNoteId(result) {
  return result && typeof result === "object" && "id" in result ? result.id : result;
}

/**
 * Jawaban atas WAITING_CREATE_TITLE (dari "buat tugas" tanpa judul di
 * pesan sebelumnya, lihat handleCreateNote). Pesan ini DIANGGAP sebagai
 * judul apa adanya, lalu catatan langsung dibuat dengan type yang sudah
 * dititip di payload sejak pesan pertama — inilah bug fix Tahap 12: type
 * tidak lagi hilang karena disimpan di payload.type, bukan variabel
 * pending terpisah yang gampang lupa dibawa.
 * @param {string} pesan
 * @param {{type?: string|null}} payload
 * @returns {Promise<string>}
 */
async function handleConfirmCreateTitle(pesan, payload) {
  const title = pesan.trim();
  const type = resolveType(payload.type);
  const result = await createNote({ title, content: title, type });

  // Susun sendiri objek note dari data yang sudah kita punya (title,
  // content, type dari pesan ini), cuma ambil id dari hasil createNote()
  // lewat extractNoteId(). Supaya "hapus catatan tadi" setelahnya bisa
  // merujuk ke catatan ini (lihat getCurrentNote di handleDeleteNote).
  updateContext({ currentNote: { id: extractNoteId(result), title, content: title, type } });

  return pickRandom(CREATE_DONE_REPLIES)(title);
}

// Variasi kalimat balasan search_note (Tahap A.2 - 06-Chat-Polish-Roadmap.md).
// Dipilih acak supaya tidak terasa template tunggal. Kalau nanti intent lain
// juga butuh variasi + pickRandom, baru pindahkan ke shared/.
const SEARCH_EMPTY_REPLIES = [
  "Mau cari catatan apa nih?",
  "Cari catatan soal apa?",
  "Sebutin kata kuncinya dong, nanti aku carikan.",
];
const SEARCH_NOT_FOUND_REPLIES = [
  (target) => `Duh, belum ada catatan soal "${target}" nih.`,
  (target) => `Gak ketemu catatan tentang "${target}".`,
  (target) => `Udah dicari, tapi belum ada catatan soal "${target}".`,
];
const SEARCH_FOUND_REPLIES = [
  (n, titles) => `Sip, ketemu ${n} catatan: ${titles}.`,
  (n, titles) => `Nih, ada ${n} catatan yang cocok: ${titles}.`,
  (n, titles) => `Ketemu ${n} catatan: ${titles}.`,
];

/**
 * Mengambil satu elemen acak dari array.
 * @param {Array<any>} array
 * @returns {any}
 */
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * @param {string} target kata kunci pencarian
 * @returns {Promise<string>}
 */
async function handleSearchNote(target) {
  if (!target) return pickRandom(SEARCH_EMPTY_REPLIES);

  const results = await searchNotes(target);
  updateContext({ searchResults: results });

  if (results.length === 0) {
    return pickRandom(SEARCH_NOT_FOUND_REPLIES)(target);
  }

  const titles = results.map((note) => note.title).join(", ");
  return pickRandom(SEARCH_FOUND_REPLIES)(results.length, titles);
}

// Variasi kalimat balasan create_note (Tahap A.4 - 06-Chat-Polish-Roadmap.md).
const CREATE_EMPTY_REPLIES = [
  "Mau buat catatan apa nih?",
  "Judulnya apa nih?",
  "Boleh sebutin mau buat catatan tentang apa?",
];
const CREATE_DONE_REPLIES = [
  (title) => `Sip, "${title}" udah aku catetin.`,
  (title) => `Oke, "${title}" udah disimpan.`,
  (title) => `Beres, "${title}" udah aku catat.`,
];

/**
 * Tahap 14 — Bug fix: type catatan dari chat HARUS tetap huruf kecil
 * ("tugas", bukan "Tugas"), konsisten dengan konvensi yang dipakai di
 * seluruh aplikasi (lihat NOTE_TYPE_KEYWORDS di chat.intent.js, dan
 * TYPE_ICONS di shared/type-select.js — keduanya pakai key huruf kecil,
 * dicocokkan persis/case-sensitive, TANPA lowercasing tambahan).
 *
 * Sebelumnya fungsi ini (dulu bernama capitalizeType) mengubah huruf
 * pertama jadi kapital ("tugas" -> "Tugas") sebelum disimpan ke DB. Note
 * tetap kebentuk dengan type "Tugas", dan itu memang tampil benar di
 * daftar catatan (yang cuma menampilkan teks/ikon apa adanya) — tapi di
 * editor, <select id="input-type"> punya <option value="tugas"> huruf
 * kecil, jadi "Tugas" tidak match apapun dan dropdown jatuh ke kosong.
 * Fix-nya bukan nambah lowercasing di sini (itu cuma nutupin gejala),
 * tapi berhenti mengubah casing sama sekali — entities.type dari
 * detectIntent() sudah huruf kecil, tinggal dipakai apa adanya.
 * @param {string|null|undefined} type
 * @returns {string}
 */
function resolveType(type) {
  return type || "catatan";
}

/**
 * Membuat catatan baru dari chat. Title & content sama-sama diisi dari
 * entities.keyword (sesuai kesepakatan: belum ada input terpisah untuk
 * content lewat chat). Type default "catatan" kalau tidak disebutkan
 * (huruf kecil, lihat resolveType — Tahap 14).
 * Kalau judul belum disebutkan (mis. cuma "buat tugas"), titip type yang
 * sudah diketahui ke payload lewat waitFor(WAITING_CREATE_TITLE, ...)
 * supaya pesan BERIKUTNYA dianggap judul (lihat handleConfirmCreateTitle)
 * TANPA kehilangan type yang sudah disebutkan di pesan ini — ini bug fix
 * Tahap 12 (lihat catatan di atas file ini).
 * @param {{type?: string|null, keyword: string}} entities
 * @returns {Promise<string>}
 */
async function handleCreateNote(entities) {
  if (!entities.keyword) {
    waitFor(WAITING_CREATE_TITLE, { type: entities.type });
    return pickRandom(CREATE_EMPTY_REPLIES);
  }

  const title = entities.keyword;
  const type = resolveType(entities.type);
  const result = await createNote({ title, content: title, type });

  // Bug fix Tahap 10/11: susun sendiri objek note (jangan asumsikan
  // bentuk return createNote()) supaya referensi "tadi" bisa jalan tanpa
  // title undefined.
  updateContext({ currentNote: { id: extractNoteId(result), title, content: title, type } });

  return pickRandom(CREATE_DONE_REPLIES)(title);
}

// Variasi kalimat balasan delete_note (Tahap A.4).
const DELETE_EMPTY_REPLIES = [
  "Mau hapus catatan apa nih?",
  "Catatan mana yang mau dihapus?",
];
const DELETE_NOT_FOUND_REPLIES = [
  (keyword) => `Duh, gak ketemu catatan soal "${keyword}".`,
  (keyword) => `Belum ada catatan soal "${keyword}" yang bisa dihapus.`,
];
const DELETE_AMBIGUOUS_REPLIES = [
  (n, titles) => `Nih, ketemu ${n} catatan yang mirip: ${titles}. Sebutin judulnya lebih spesifik dong.`,
  (n, titles) => `Ada ${n} catatan yang cocok: ${titles}. Boleh sebutin judulnya lebih jelas?`,
];
const DELETE_CONFIRM_REPLIES = [
  (title) => `Yakin nih mau hapus "${title}"? Bilang "ya" kalau oke.`,
  (title) => `Beneran mau hapus "${title}"? Balas "ya" kalau yakin.`,
];
// Balasan saat entities.reference = true ("hapus catatan tadi") tapi
// belum ada catatan yang bisa dirujuk (belum pernah buat/buka catatan
// di percakapan ini). Beda dari DELETE_EMPTY_REPLIES (itu untuk kasus
// tidak ada keyword SAMA SEKALI, bukan referensi yang gagal di-resolve).
const DELETE_NO_REFERENCE_REPLIES = [
  "Catatan yang mana ya? Aku belum tau catatan apa yang kamu maksud.",
  "Belum ada catatan yang lagi dibicarakan nih. Sebutin judulnya dong.",
];

/**
 * Menghapus catatan dari chat, dengan konfirmasi dulu (lihat
 * handleConfirmDelete). Kalau hasil pencarian lebih dari 1, minta user
 * memperjelas judul dulu supaya tidak salah hapus.
 *
 * entities.reference = true (Tahap 10 - bug fix, mis. "hapus catatan
 * tadi") -> pakai catatan yang baru dibuat/dibuka (getCurrentNote),
 * bukan searchNotes(), karena "tadi"/"itu" bukan judul asli.
 * @param {{type?: string|null, keyword?: string, reference?: boolean}} entities
 * @returns {Promise<string>}
 */
async function handleDeleteNote(entities) {
  if (entities.reference) {
    const note = getCurrentNote();
    if (!note) return pickRandom(DELETE_NO_REFERENCE_REPLIES);

    waitFor(WAITING_CONFIRM_DELETE, { note });
    return pickRandom(DELETE_CONFIRM_REPLIES)(note.title);
  }

  if (!entities.keyword) return pickRandom(DELETE_EMPTY_REPLIES);

  const results = await searchNotes(entities.keyword);

  if (results.length === 0) {
    return pickRandom(DELETE_NOT_FOUND_REPLIES)(entities.keyword);
  }

  if (results.length > 1) {
    const titles = results.map((note) => note.title).join(", ");
    return pickRandom(DELETE_AMBIGUOUS_REPLIES)(results.length, titles);
  }

  const note = results[0];
  waitFor(WAITING_CONFIRM_DELETE, { note });
  return pickRandom(DELETE_CONFIRM_REPLIES)(note.title);
}

// Variasi kalimat balasan open_note (Tahap A.3 - 06-Chat-Polish-Roadmap.md).
const OPEN_NOT_FOUND_REPLIES = [
  "Waduh, aku belum tau catatan mana yang kamu maksud. Coba cari dulu atau sebutin judulnya.",
  "Belum jelas nih catatan yang mana. Sebutin judulnya atau cari dulu, ya.",
  "Hmm, belum nemu catatan yang kamu maksud. Coba sebutin judulnya.",
];
const OPEN_FOUND_REPLIES = [
  (title) => `Sip, ini ${title}.`,
  (title) => `Nih, ${title}.`,
  (title) => `Oke, buka ${title}.`,
];

/**
 * Membuka catatan lewat urutan (entities.index, dari hasil cari terakhir),
 * referensi "yang tadi"/"yang itu" (entities.reference, dari catatan
 * terakhir dibuka), atau lewat judul langsung (target).
 * @param {string|null} target
 * @param {{index?: number, reference?: boolean}} entities
 * @returns {Promise<string>}
 */
async function handleOpenNote(target, entities) {
  let note = null;

  if (entities.reference) {
    note = getCurrentNote();
  } else if (entities.index) {
    const results = getSearchResults();
    note = results[entities.index - 1];
  } else if (target) {
    const results = await searchNotes(target);
    note = results[0];
  }

  if (!note) {
    return pickRandom(OPEN_NOT_FOUND_REPLIES);
  }

  updateContext({ currentNote: note });
  return pickRandom(OPEN_FOUND_REPLIES)(note.title);
}

// Variasi kalimat balasan show_relation (Tahap A.4).
const RELATION_NO_NOTE_REPLIES = [
  "Buka catatan dulu dong, baru aku bisa cari hubungannya.",
  "Belum ada catatan yang dibuka nih. Buka dulu satu, ya.",
];
const RELATION_EMPTY_REPLIES = [
  (title) => `"${title}" belum ada hubungannya sama apapun nih.`,
  (title) => `Duh, "${title}" belum terhubung ke catatan lain.`,
];
const RELATION_FOUND_REPLIES = [
  (lines) => `Nih, terhubung dengan:\n${lines}`,
  (lines) => `Ini catatan yang berhubungan:\n${lines}`,
];

/**
 * Menjawab relasi dari catatan yang sedang dibuka (chat-memory).
 * @returns {Promise<string>}
 */
async function handleShowRelation() {
  const note = getCurrentNote();
  if (!note) {
    return pickRandom(RELATION_NO_NOTE_REPLIES);
  }

  const related = await getRelatedNotes(note.id);
  updateContext({ relatedNotes: related });

  if (related.length === 0) {
    return pickRandom(RELATION_EMPTY_REPLIES)(note.title);
  }

  const lines = related.map((n) => `- ${n.title}`).join("\n");
  return pickRandom(RELATION_FOUND_REPLIES)(lines);
}

// Variasi kalimat balasan latest_note (Tahap A.4).
const LATEST_EMPTY_REPLIES = [
  "Belum ada catatan tersimpan nih.",
  "Belum ada catatan sama sekali.",
];
const LATEST_FOUND_REPLIES = [
  (title) => `Nih, catatan terbaru: ${title}.`,
  (title) => `Yang paling baru: ${title}.`,
];

/**
 * @returns {Promise<string>}
 */
async function handleLatestNote() {
  const notes = await getAllNotes();
  if (notes.length === 0) return pickRandom(LATEST_EMPTY_REPLIES);

  const latest = notes.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return pickRandom(LATEST_FOUND_REPLIES)(latest.title);
}

/**
 * Contoh perintah di help pakai judul catatan asli milik user (diambil
 * acak dari DB) supaya lebih relate, bukan contoh hardcode "gunung api".
 * Kalau DB kosong (user baru), pakai contoh generik sebagai fallback.
 * @returns {Promise<string>}
 */
async function handleHelp() {
  const notes = await getAllNotes();
  const contoh = notes.length > 0 ? pickRandom(notes).title : "gunung api";

  return [
    "Nih, aku bisa bantu:",
    `- cari catatan (contoh: cari ${contoh})`,
    `- buka catatan (contoh: buka catatan ${contoh})`,
    "- lihat hubungan catatan yang sedang dibuka",
    "- lihat catatan terbaru",
  ].join("\n");
}

/**
 * Balasan sementara untuk intent yang sudah dikenali tapi aksinya
 * belum diimplementasi. Sekarang hanya dipakai untuk edit_note —
 * sengaja di-skip di Tahap 8 karena belum ada spesifikasi format
 * "ubah" (lihat 05-Chat-Roadmap.md).
 * @param {string} aksi
 * @param {string|null} target
 * @returns {string}
 */
function notYetActive(aksi, target) {
  const label = target ? ` "${target}"` : "";
  return `Oke, kamu mau ${aksi} catatan${label} — fitur ini belum aktif di chat.`;
}

/**
 * Membersihkan seluruh riwayat chat setelah user konfirmasi, sekaligus
 * reset chat-memory (hasil cari terakhir, catatan terakhir dibuka, dll)
 * supaya tidak nyangkut konteks lama.
 */
async function handleClearChat() {
  const yakin = window.confirm("Yakin hapus semua riwayat chat?");
  if (!yakin) return;

  await deleteAllMessages();
  resetMemory();

  const messages = await getAllMessages();
  renderMessages(messages);
}

/**
 * Inisialisasi modul Chat: pasang event listener form & tab bottom nav.
 */
export function initChat() {
  document.getElementById("chat-form").addEventListener("submit", handleSubmit);
  document.getElementById("nav-chat").addEventListener("click", loadChat);
  document.getElementById("btn-clear-chat").addEventListener("click", handleClearChat);
}
