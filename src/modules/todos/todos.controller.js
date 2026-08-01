// modules/todos/todos.controller.js
// Menghubungkan aksi pengguna (centang, tambah, hapus item) dengan repository & view.

import {
  getItemsForNote,
  addItem,
  setItemDone,
  deleteItem,
  deleteItemsForNote,
} from "./todos.repository.js";
import { setTodoSectionVisible, renderTodoList, readAndClearTodoInput } from "./todos.view.js";

let currentNoteId = null;

async function loadTodoItems() {
  const items = await getItemsForNote(currentNoteId);
  renderTodoList(items, handleToggle, handleDelete);
}

async function handleToggle(id, done) {
  await setItemDone(id, done);
  await loadTodoItems();
}

async function handleDelete(id) {
  await deleteItem(id);
  await loadTodoItems();
}

async function handleAdd() {
  const text = readAndClearTodoInput();
  if (!text) return;

  await addItem(currentNoteId, text);
  await loadTodoItems();
}

/**
 * Dipanggil oleh modules/notes saat detail sebuah catatan dibuka.
 * Checklist hanya ditampilkan kalau tipe note-nya "tugas".
 * @param {{id: number, type: string}} note
 */
export async function showTodosFor(note) {
  currentNoteId = note.id;
  const isTugas = note.type === "tugas";
  setTodoSectionVisible(isTugas);
  if (isTugas) {
    await loadTodoItems();
  }
}

/**
 * Menghapus semua item checklist milik sebuah note.
 * Dipakai modul notes saat sebuah catatan dihapus.
 */
export { deleteItemsForNote };

/**
 * Inisialisasi modul Todos: pasang event listener tombol tambah item.
 */
export function initTodos() {
  document.getElementById("btn-add-todo").addEventListener("click", handleAdd);
}
