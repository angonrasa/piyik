// modules/settings/settings.repository.js
// Akses data untuk Backup & Restore (baca/tulis seluruh isi database)

import { db } from "../../core/db.js";

/**
 * Mengambil seluruh data dari database (notes + relations).
 * @returns {Promise<{version: number, exportedAt: string, notes: Array, relations: Array}>}
 */
export async function exportAllData() {
  const notes = await db.notes.toArray();
  const relations = await db.relations.toArray();

  return {
    version: 1, // versi format file backup, bukan versi skema Dexie
    exportedAt: new Date().toISOString(),
    notes,
    relations,
  };
}

/**
 * Menimpa seluruh isi database dengan data dari file backup.
 * Data lama (notes & relations) dihapus total sebelum data baru dimasukkan.
 * @param {{notes: Array, relations: Array}} data
 */
export async function importAllData(data) {
  await db.transaction("rw", db.notes, db.relations, async () => {
    await db.notes.clear();
    await db.relations.clear();

    if (data.notes?.length) {
      await db.notes.bulkAdd(data.notes);
    }
    if (data.relations?.length) {
      await db.relations.bulkAdd(data.relations);
    }
  });
}
