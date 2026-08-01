// modules/notes/notes.repository.js
// Akses data untuk Notes (CRUD ke Dexie)

import { db } from "../../core/db.js";
import { getNote, getAllNotes } from "../../shared/notes-data.js";

export { getNote, getAllNotes };

/**
 * Membuat catatan baru.
 * @param {{title: string, type: string, content: string}} data
 * @returns {Promise<number>} id catatan baru
 */
export async function createNote(data) {
  const now = new Date();
  return db.notes.add({
    title: data.title,
    type: data.type,
    content: data.content,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Mengubah catatan yang sudah ada.
 * @param {number} id
 * @param {{title: string, type: string, content: string}} data
 */
export async function updateNote(id, data) {
  return db.notes.update(id, {
    title: data.title,
    type: data.type,
    content: data.content,
    updatedAt: new Date(),
  });
}

/**
 * Menghapus catatan.
 * @param {number} id
 */
export async function deleteNote(id) {
  return db.notes.delete(id);
}

/**
 * Mencari catatan berdasarkan judul atau isi (case-insensitive).
 * Dipakai oleh Chat untuk intent search_note (lihat 05-Chat-Roadmap.md Tahap 2).
 * @param {string} keyword
 * @returns {Promise<Array>} daftar catatan yang cocok
 */
export async function searchNotes(keyword) {
  if (!keyword) return [];

  const lower = keyword.toLowerCase();

  return db.notes
    .filter(
      (note) =>
        note.title.toLowerCase().includes(lower) ||
        note.content.toLowerCase().includes(lower)
    )
    .toArray();
}
