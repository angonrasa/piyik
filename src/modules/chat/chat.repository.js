// modules/chat/chat.repository.js
// Akses data ke tabel chatMessages. Tidak menyentuh DOM sama sekali.

import { db } from "../../core/db.js";

/**
 * Menyimpan satu pesan baru dari pengguna.
 * @param {string} text
 * @returns {Promise<number>} id pesan yang baru dibuat
 */
export async function addMessage(text) {
  return db.chatMessages.add({
    sender: "user",
    text,
    createdAt: new Date(),
  });
}

/**
 * Menyimpan satu pesan balasan dari bot (lihat 05-Chat-Roadmap.md Tahap 2).
 * @param {string} text
 * @param {Array<object>} [noteRefs] catatan yang mau ditampilkan sebagai
 *   mini-note-card di bawah teks (Tahap Chat Native Polish — mini-note-card).
 *   Opsional, tidak butuh perubahan skema Dexie (field tanpa index tetap
 *   bisa disimpan apa adanya).
 * @returns {Promise<number>} id pesan yang baru dibuat
 */
export async function addBotMessage(text, noteRefs = []) {
  return db.chatMessages.add({
    sender: "bot",
    text,
    noteRefs,
    createdAt: new Date(),
  });
}

/**
 * Mengambil seluruh riwayat pesan, terurut dari yang paling lama ke terbaru.
 * @returns {Promise<Array>}
 */
export async function getAllMessages() {
  return db.chatMessages.orderBy("createdAt").toArray();
}

/**
 * Menghapus seluruh riwayat chat (dipakai tombol "Bersihkan riwayat"
 * di header halaman Chat).
 * @returns {Promise<void>}
 */
export async function deleteAllMessages() {
  return db.chatMessages.clear();
}
