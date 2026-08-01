// modules/todos/todos.repository.js
// Akses data untuk item checklist (todoItems) milik satu note bertipe "tugas".

import { db } from "../../core/db.js";

/**
 * Mengambil semua item checklist milik satu note, terurut sesuai field `order`.
 * @param {number} noteId
 * @returns {Promise<Array>}
 */
export async function getItemsForNote(noteId) {
  const items = await db.todoItems.where("noteId").equals(noteId).toArray();
  return items.sort((a, b) => a.order - b.order);
}

/**
 * Menambah item checklist baru ke sebuah note.
 * @param {number} noteId
 * @param {string} text
 * @returns {Promise<number>} id item baru
 */
export async function addItem(noteId, text) {
  const existing = await getItemsForNote(noteId);
  const nextOrder = existing.length ? existing[existing.length - 1].order + 1 : 0;

  return db.todoItems.add({
    noteId,
    text,
    done: false,
    order: nextOrder,
  });
}

/**
 * Mengubah teks item checklist.
 * @param {number} id
 * @param {string} text
 */
export async function updateItemText(id, text) {
  return db.todoItems.update(id, { text });
}

/**
 * Membalik status selesai/belum sebuah item.
 * @param {number} id
 * @param {boolean} done
 */
export async function setItemDone(id, done) {
  return db.todoItems.update(id, { done });
}

/**
 * Menghapus item checklist.
 * @param {number} id
 */
export async function deleteItem(id) {
  return db.todoItems.delete(id);
}

/**
 * Menimpa seluruh item checklist milik sebuah note dengan daftar item baru.
 * Dipakai saat form disimpan (isi textarea di-parse ulang jadi item).
 * Item lama dihapus semua, item baru dibuat dari awal — sederhana, tapi artinya
 * id item bisa berubah tiap kali disimpan (belum ada fitur yang bergantung pada
 * id item tetap, jadi ini masih aman untuk saat ini).
 * @param {number} noteId
 * @param {Array<{text: string, done: boolean}>} items
 */
export async function replaceItemsForNote(noteId, items) {
  await deleteItemsForNote(noteId);

  let order = 0;
  for (const item of items) {
    await db.todoItems.add({
      noteId,
      text: item.text,
      done: item.done,
      order: order++,
    });
  }
}

/**
 * Menghitung jumlah item checklist yang belum selesai di seluruh catatan.
 * Dipakai oleh Home untuk menampilkan ringkasan kartu "Tugas".
 * @returns {Promise<number>}
 */
export async function countUndoneItems() {
  // Tidak bisa pakai db.todoItems.where("done").equals(false) karena
  // boolean bukan key yang valid untuk IndexedDB (menyebabkan DataError).
  // Jadi ambil semua item lalu filter di JavaScript.
  const items = await db.todoItems.toArray();
  return items.filter((item) => !item.done).length;
}

/**
 * Menghapus semua item checklist milik sebuah note.
 * Dipanggil saat note-nya dihapus, supaya tidak ada item "yatim".
 * @param {number} noteId
 */
export async function deleteItemsForNote(noteId) {
  const items = await db.todoItems.where("noteId").equals(noteId).toArray();
  const ids = items.map((item) => item.id);
  return db.todoItems.bulkDelete(ids);
}
