// modules/relations/relations.repository.js
// Akses data untuk Relations (CRUD ke Dexie)

import { db } from "../../core/db.js";

/**
 * Membuat relasi baru antara dua catatan.
 * @param {number} fromId
 * @param {number} toId
 */
export async function addRelation(fromId, toId) {
  return db.relations.add({ fromId, toId });
}

/**
 * Menghapus satu relasi berdasarkan id relasinya.
 * @param {number} relationId
 */
export async function removeRelation(relationId) {
  return db.relations.delete(relationId);
}

/**
 * Mengambil semua relasi yang melibatkan sebuah catatan,
 * baik sebagai fromId maupun toId.
 * @param {number} noteId
 */
export async function getRelationsForNote(noteId) {
  const asFrom = await db.relations.where("fromId").equals(noteId).toArray();
  const asTo = await db.relations.where("toId").equals(noteId).toArray();
  return [...asFrom, ...asTo];
}

/**
 * Mengambil seluruh baris relasi (dipakai untuk menghitung jumlah relasi
 * per catatan tanpa query berulang).
 */
export async function getAllRelations() {
  return db.relations.toArray();
}

/**
 * Menghitung jumlah relasi langsung untuk setiap catatan.
 * @returns {Promise<Object<number, number>>} peta noteId -> jumlah relasi
 */
export async function getRelationCounts() {
  const relations = await getAllRelations();
  const counts = {};

  for (const relation of relations) {
    counts[relation.fromId] = (counts[relation.fromId] || 0) + 1;
    counts[relation.toId] = (counts[relation.toId] || 0) + 1;
  }

  return counts;
}

/**
 * Mengambil daftar CATATAN (bukan baris relasi) yang terhubung dengan
 * sebuah catatan. Dipakai Chat untuk intent show_relation
 * (lihat 05-Chat-Roadmap.md Tahap 4).
 * @param {number} noteId
 * @returns {Promise<Array>} daftar catatan terkait
 */
export async function getRelatedNotes(noteId) {
  const relations = await getRelationsForNote(noteId);
  const relatedIds = relations.map((relation) =>
    relation.fromId === noteId ? relation.toId : relation.fromId
  );

  const notes = await Promise.all(relatedIds.map((id) => db.notes.get(id)));
  return notes.filter(Boolean); // buang jika ada note yang sudah terhapus
}

/**
 * Menghapus semua relasi yang melibatkan sebuah catatan.
 * WAJIB dipanggil saat catatan dihapus, agar tidak ada relasi "hantu"
 * yang menunjuk ke catatan yang sudah tidak ada.
 * @param {number} noteId
 */
export async function deleteRelationsForNote(noteId) {
  const relations = await getRelationsForNote(noteId);
  const ids = relations.map((relation) => relation.id);
  await db.relations.bulkDelete(ids);
}
