// modules/song/song.repository.js
// Akses data untuk songDetails (data spesifik lagu milik satu note bertipe "song").
// Berbeda dari todoItems (banyak item per note), songDetails hanya 1 record per note.

import { db } from "../../core/db.js";

/**
 * Mengambil data detail lagu milik satu note.
 * @param {number} noteId
 * @returns {Promise<Object|undefined>} record songDetails, atau undefined jika belum ada
 */
export async function getSongDetails(noteId) {
  return db.songDetails.where("noteId").equals(noteId).first();
}

/**
 * Menyimpan data detail lagu milik satu note (upsert: buat baru kalau belum
 * ada, timpa kalau sudah ada). Dipanggil saat form note tipe "song" disimpan.
 * @param {number} noteId
 * @param {{lyrics: string, tempo: number|null, key: string, genre: string, status: string}} data
 */
export async function saveSongDetails(noteId, data) {
  const existing = await getSongDetails(noteId);
  const record = { noteId, ...data };

  if (existing) {
    return db.songDetails.update(existing.id, record);
  }
  return db.songDetails.add(record);
}

/**
 * Mengambil seluruh songDetails dan mengembalikannya sebagai peta
 * noteId -> record, supaya bisa dicek cepat per note (dipakai untuk
 * pencarian berdasarkan chord di modules/search).
 * @returns {Promise<Object<number, Object>>}
 */
export async function getAllSongDetailsMap() {
  const all = await db.songDetails.toArray();
  const map = {};
  for (const detail of all) {
    map[detail.noteId] = detail;
  }
  return map;
}

/**
 * Menghapus data detail lagu milik sebuah note.
 * Dipanggil saat note-nya dihapus, atau saat tipe note diubah dari "song"
 * ke tipe lain (supaya tidak ada data lagu "yatim").
 * @param {number} noteId
 */
export async function deleteSongDetailsForNote(noteId) {
  const existing = await getSongDetails(noteId);
  if (existing) {
    await db.songDetails.delete(existing.id);
  }
}
