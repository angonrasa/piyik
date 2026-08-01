// modules/notes/notes.controller.js
// Menghubungkan aksi pengguna (klik, submit) dengan repository & view.

import {
  createNote,
  updateNote,
  deleteNote,
  getNote,
  getAllNotes,
} from "./notes.repository.js";

import {
  renderNoteList,
  resetForm,
  fillForm,
  fillFormTitle,
  readForm,
  fillDetail,
  updateContentMode,
} from "./notes.view.js";

import "./filter-chips.js";

import { showView } from "../../shared/view-switcher.js";

import {
  showRelationsFor,
  initRelations,
  getRelationCounts,
  deleteRelationsForNote,
} from "../relations/relations.controller.js";
import { showTodosFor, initTodos } from "../todos/todos.controller.js";
import { getItemsForNote, replaceItemsForNote, deleteItemsForNote } from "../todos/todos.repository.js";
import { parseChecklistText, formatChecklistText } from "../todos/todos-format.js";
import { filterNotes } from "../search/search.js";
import {
  initSong,
  showSongFor,
  toggleSongFormFields,
  resetSongForm,
  loadSongFormForEdit,
  saveSongForNote,
  deleteSongDetailsForNote,
} from "../song/song.controller.js";
import { getAllSongDetailsMap } from "../song/song.repository.js";

let selectedNoteId = null;
let cachedNotes = [];

const searchInput = document.getElementById("search-input");
const filterTypeSelect = document.getElementById("filter-type");
const inputTypeSelect = document.getElementById("input-type");

async function loadList() {
  cachedNotes = await getAllNotes();
  await applyFilter();
  showView("list");
}

async function applyFilter() {
  // songDetailsMap dipakai filterNotes untuk mencocokkan kata kunci ke
  // data chord (field `chords` & `lines[].chord`) pada catatan tipe "song".
  const songDetailsMap = await getAllSongDetailsMap();
  const filtered = filterNotes(
    cachedNotes,
    { query: searchInput.value, type: filterTypeSelect.value },
    songDetailsMap
  );
  const relationCounts = await getRelationCounts();
  renderNoteList(filtered, openDetail, relationCounts);
}

async function openDetail(id) {
  const note = await getNote(id);
  if (!note) return;
  selectedNoteId = id;
  fillDetail(note);
  showView("detail");
  await showRelationsFor(id, openDetail);
  await showTodosFor(note);
  await showSongFor(note);
}

function openNewForm(draftTitle = "") {
  selectedNoteId = null;
  resetForm();
  if (draftTitle) fillFormTitle(draftTitle);
  resetSongForm();
  toggleSongFormFields("catatan");
  showView("form");
}

async function openEditForm() {
  const note = await getNote(selectedNoteId);
  if (!note) return;

  if (note.type === "tugas") {
    const items = await getItemsForNote(note.id);
    fillForm(note, formatChecklistText(items));
  } else {
    fillForm(note);
  }

  toggleSongFormFields(note.type);
  if (note.type === "song") {
    await loadSongFormForEdit(note.id);
  }

  showView("form");
}

/**
 * Menyimpan data form ke database. Dipakai bersama oleh handleFormSubmit
 * (submit manual) dan autoSaveForm (autosave saat form ditinggalkan),
 * supaya keduanya lewat satu jalur simpan yang sama persis - tidak ada
 * logika ganda yang bisa tidak sinkron.
 * @param {Object} data - hasil readForm(), dengan title yang sudah dijamin
 *   tidak kosong oleh pemanggilnya.
 * @returns {Promise<number>} id catatan (baru atau yang sudah ada)
 */
async function persistForm(data) {
  // Untuk tipe tugas, sumber kebenaran checklist ada di tabel todoItems,
  // bukan field content — jadi content dikosongkan supaya tidak ada
  // salinan teks yang bisa basi (tidak sinkron saat item dicentang di Detail).
  let parsedItems = null;
  if (data.type === "tugas") {
    parsedItems = parseChecklistText(data.content);
    data.content = "";
  }

  let noteId;
  if (data.id) {
    noteId = data.id;
    await updateNote(data.id, data);
  } else {
    noteId = await createNote(data);
  }

  if (parsedItems !== null) {
    await replaceItemsForNote(noteId, parsedItems);
  } else if (data.id) {
    // Tipe diubah dari tugas ke tipe lain saat edit -> bersihkan item lama.
    await deleteItemsForNote(data.id);
  }

  // saveSongForNote menyimpan data song kalau tipe-nya "song", atau
  // membersihkan data song lama kalau tipe diubah ke tipe lain saat edit.
  await saveSongForNote(noteId, data.type);

  return noteId;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const data = readForm();

  if (!data.title) return; // validasi minimal: judul wajib diisi

  await persistForm(data);
  await loadList();
}

/**
 * Autosave: menyimpan isi form apa adanya tanpa menunggu user menekan
 * Simpan. Dipanggil saat form ditinggalkan lewat cara apa pun - tombol
 * back, pindah tab lain, sampai app ditutup/dibackground di HP (lihat
 * pemasangan listener di initNotes()).
 *
 * Beda dengan handleFormSubmit: judul TIDAK wajib. Kalau user baru sempat
 * menulis isi tapi belum sempat mengisi judul, judul diturunkan otomatis
 * dari baris pertama isi (mirip Google Keep/Apple Notes) supaya tulisan
 * tetap tersimpan, bukan hilang begitu saja.
 */
async function autoSaveForm() {
  const formView = document.getElementById("view-form");
  if (!formView || formView.hidden) return; // form sedang tidak dibuka

  const data = readForm();

  // Form kosong total (belum ada judul maupun isi) -> tidak ada yang perlu
  // disimpan, supaya tidak menumpuk catatan kosong tiap kali form dibuka
  // lalu langsung ditinggalkan tanpa menulis apa-apa.
  if (!data.title && !data.content) return;

  if (!data.title) {
    data.title = data.content.split("\n")[0].slice(0, 40) || "Tanpa judul";
  }

  const noteId = await persistForm(data);

  // Simpan id catatan yang baru dibuat kembali ke form, supaya kalau
  // autosave terpanggil lagi sebelum form ditutup (mis. app dibackground
  // dua kali), yang terjadi adalah update ke catatan yang sama, bukan
  // membuat catatan duplikat baru.
  if (!data.id) {
    document.getElementById("input-id").value = noteId;
  }
}

async function handleDelete() {
  if (selectedNoteId === null) return;
  const confirmed = confirm("Hapus catatan ini?");
  if (!confirmed) return;

  await deleteRelationsForNote(selectedNoteId);
  await deleteItemsForNote(selectedNoteId);
  await deleteSongDetailsForNote(selectedNoteId);
  await deleteNote(selectedNoteId);
  selectedNoteId = null;
  await loadList();
}

/**
 * Inisialisasi modul Notes: pasang semua event listener dan render awal.
 */
export function initNotes() {
  document.getElementById("btn-cancel").addEventListener("click", async () => {
    await autoSaveForm();
    loadList();
  });
  document.getElementById("note-form").addEventListener("submit", handleFormSubmit);

  document.getElementById("btn-back").addEventListener("click", loadList);
  document.getElementById("btn-edit").addEventListener("click", openEditForm);
  document.getElementById("btn-delete").addEventListener("click", handleDelete);

  initRelations();
  initTodos();
  initSong();
  searchInput.addEventListener("input", applyFilter);
  filterTypeSelect.addEventListener("change", applyFilter);
  inputTypeSelect.addEventListener("change", () => {
    updateContentMode(inputTypeSelect.value);
    toggleSongFormFields(inputTypeSelect.value);
  });

  // ---- Autosave: cover semua jalan keluar dari form ----

  // 1. Pindah ke tab lain lewat bottom nav / FAB sementara form masih terbuka.
  //    Listener tambahan ini tidak mengganggu handler navigasi asli (di
  //    index.js) - cuma numpang dengar klik yang sama untuk memicu simpan.
  ["nav-home", "nav-chat", "nav-notes", "nav-settings", "nav-add"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => autoSaveForm());
  });

  // 2. App dibackground atau layar dikunci - ini sinyal paling andal di HP
  //    untuk "aplikasi ditinggalkan", jauh lebih dipercaya daripada
  //    beforeunload yang sering tidak sempat jalan di mobile.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") autoSaveForm();
  });

  // 3. App benar-benar ditutup / dinavigasi keluar (mis. tombol back OS,
  //    swipe close). Dipasang sebagai lapis tambahan di luar visibilitychange.
  window.addEventListener("pagehide", () => autoSaveForm());
  // Catatan: sengaja TIDAK memanggil loadList() di sini. Home adalah
  // tampilan awal aplikasi (lihat index.js -> initHome()). Data list akan
  // otomatis dimuat begitu pengguna membuka tab "Catatan" (lewat goToList)
  // atau menekan "+ Baru"/"Batal". Memanggil loadList() di sini dulu pernah
  // menyebabkan race condition: loadList() dan loadHome() sama-sama async,
  // dan siapa pun yang selesai duluan "menang" menentukan view awal.
}

/**
 * Membuka detail sebuah catatan dari luar modul Notes (dipakai oleh Home
 * untuk membuka catatan dari daftar "Terakhir Diperbarui").
 * @param {number} id
 */
export function openNote(id) {
  return openDetail(id);
}

/**
 * Menampilkan daftar catatan dengan filter tipe tertentu (dipakai oleh Home
 * saat kartu ringkasan diklik, misalnya kartu "Tugas" atau "Ide").
 * @param {string} [typeFilter] - kosongkan untuk menampilkan semua tipe
 */
export async function goToList(typeFilter = "") {
  filterTypeSelect.value = typeFilter;
  searchInput.value = "";
  await loadList();
}

/**
 * Membuka form catatan baru dari luar modul Notes (dipakai oleh tombol "+"
 * pada bottom navigation).
 */
export function goToNewNote(draftTitle = "") {
  openNewForm(draftTitle);
}
