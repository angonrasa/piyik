// shared/notes-data.js
// Akses baca data Notes yang dipakai oleh lebih dari satu modul
// (modules/notes dan modules/relations), sesuai aturan: kode yang
// dipakai lebih dari satu modul dipindah ke shared/.

import { db } from "../core/db.js";

/**
 * Mengambil satu catatan berdasarkan id.
 * @param {number} id
 */
export async function getNote(id) {
  return db.notes.get(id);
}

/**
 * Mengambil seluruh catatan, diurutkan dari yang terbaru diubah.
 */
export async function getAllNotes() {
  const notes = await db.notes.toArray();
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}
