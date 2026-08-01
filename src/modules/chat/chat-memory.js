// modules/chat/chat-memory.js
// Conversation Context — working memory sementara chat (in-memory, bukan
// di IndexedDB, hilang saat halaman di-refresh). Dibangun di Tahap 3
// (searchResults, currentNote). Tahap 7 menambah relatedNotes (relasi
// terakhir ditampilkan) untuk mendukung referensi "yang tadi" / "yang itu"
// di chat.intent.js. Tahap 8/9 menambah waitingAction + payload untuk alur
// multi-step (konfirmasi hapus, tanya judul catatan).
//
// Tahap 13 — Refactor jadi satu objek `conversationContext`, dengan SATU
// jalur tulis: updateContext(patch). Sebelumnya tiap field punya setter
// sendiri (setSearchResults, setCurrentNote, setLastRelatedNotes, waitFor)
// yang independen satu sama lain. Masalahnya bukan soal rapi-rapian saja:
// tiap intent baru (create, edit, delete, relation, search, nanti reminder/
// task) jadi harus "menebak sendiri" setter mana yang perlu dipanggil, dan
// gampang lupa satu field — persis kasus bug pendingCreate kehilangan type
// di Tahap 11/12. Dengan satu pintu tulis, semua intent — lama maupun baru
// — mengikuti SATU pola yang sama untuk memperbarui context: panggil
// updateContext({ ...field yang berubah }). Tidak ada lagi setter baru yang
// perlu ditambah tiap kali ada field baru.
//
// Baca (getCurrentNote, getSearchResults, dst) TETAP dipisah per field —
// bukan bagian dari masalah lama, dan lebih terbaca sebagai "ambil
// currentNote" daripada "ambil context lalu ambil .currentNote sendiri".
// Yang dipusatkan cuma sisi tulis.
//
// (lihat 05-Chat-Roadmap.md). Jangan bikin modul memory baru yang terpisah.

// Nama aksi yang bisa jadi nilai waitingAction. Ditaruh di sini (bukan di
// controller) supaya satu sumber kebenaran, dipakai controller untuk
// menulis (updateContext) maupun membaca (switch di handleWaitingAction).
export const WAITING_CONFIRM_DELETE = "confirm_delete";
export const WAITING_CREATE_TITLE = "create_note_title";

// Satu-satunya representasi state percakapan saat ini. Field baru cukup
// ditambah di sini + didaftarkan lewat patch dari updateContext() di
// pemanggil — TIDAK perlu fungsi setter baru di modul ini.
let conversationContext = {
  currentNote: null,
  searchResults: [],
  relatedNotes: [],
  waitingAction: null,
  payload: {},
};

/**
 * Satu-satunya jalur untuk mengubah conversationContext. Menerima objek
 * sebagian (patch) lalu digabung (merge) ke context yang ada — field yang
 * tidak disebut di patch tidak berubah.
 *
 * Contoh: updateContext({ currentNote: note })
 *         updateContext({ searchResults: results })
 *         updateContext({ waitingAction: WAITING_CONFIRM_DELETE, payload: { note } })
 *
 * Validasi ringan: warning ke console kalau patch berisi key yang tidak
 * dikenal (typo, mis. "curentNote") — supaya tidak diam-diam menciptakan
 * field baru yang tidak pernah dibaca siapa pun.
 * @param {object} patch
 */
export function updateContext(patch) {
  for (const key of Object.keys(patch)) {
    if (!(key in conversationContext)) {
      console.warn(`updateContext: field "${key}" tidak dikenal di conversationContext, dicek typo-nya.`);
    }
  }

  conversationContext = { ...conversationContext, ...patch };
}

/**
 * Menandai bot sedang menunggu jawaban user untuk sebuah aksi multi-step
 * (mis. konfirmasi hapus, atau judul catatan yang belum disebutkan).
 * Shortcut tipis di atas updateContext(), supaya pemanggilnya (chat.controller.js)
 * tidak perlu menulis dua field (waitingAction + payload) manual tiap kali.
 * @param {string} action salah satu konstanta WAITING_*
 * @param {object} [data] data yang sudah diketahui, dibaca lagi lewat getPayload()
 */
export function waitFor(action, data = {}) {
  updateContext({ waitingAction: action, payload: data });
}

/**
 * Membatalkan/menghapus state menunggu jawaban (dipanggil setelah
 * dijawab ATAU dibatalkan). Shortcut tipis di atas updateContext().
 */
export function clearWaiting() {
  updateContext({ waitingAction: null, payload: {} });
}

/**
 * @returns {Array} hasil pencarian terakhir, kosong jika belum pernah cari
 */
export function getSearchResults() {
  return conversationContext.searchResults;
}

/**
 * @returns {object|null} catatan yang sedang/terakhir dibuka atau dibuat
 */
export function getCurrentNote() {
  return conversationContext.currentNote;
}

/**
 * @returns {Array} catatan relasi yang terakhir ditampilkan
 */
export function getLastRelatedNotes() {
  return conversationContext.relatedNotes;
}

/**
 * @returns {string|null} aksi yang sedang menunggu jawaban, null jika tidak ada
 */
export function getWaitingAction() {
  return conversationContext.waitingAction;
}

/**
 * @returns {object} data yang tersimpan untuk waitingAction saat ini
 */
export function getPayload() {
  return conversationContext.payload;
}

/**
 * Mengembalikan conversationContext ke kondisi awal (dipakai saat
 * riwayat chat dibersihkan lewat tombol "Bersihkan riwayat" di header).
 */
export function resetMemory() {
  conversationContext = {
    currentNote: null,
    searchResults: [],
    relatedNotes: [],
    waitingAction: null,
    payload: {},
  };
}
