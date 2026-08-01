// modules/home/home.controller.js
// Menghubungkan data ringkasan (jumlah catatan, tugas, ide) ke halaman Home,
// dan menghubungkan aksi pengguna (kartu, bottom nav) ke navigasi.

import { getAllNotes } from "../../shared/notes-data.js";
import { showView } from "../../shared/view-switcher.js";
import { openNote, goToList, goToNewNote } from "../notes/notes.controller.js";
import { getRelationCounts } from "../relations/relations.controller.js";
import { renderRecent, updateRecentHeading } from "./home.view.js";

const RECENT_LIMIT = 4;

/**
 * Memuat ulang daftar "Terbaru" dan menampilkan view Home.
 */
async function loadHome() {
  const notes = await getAllNotes(); // sudah terurut dari yang terbaru diubah
  const relationCounts = await getRelationCounts();
  renderRecent(notes.slice(0, RECENT_LIMIT), openNote, relationCounts);
  updateRecentHeading(notes.length, RECENT_LIMIT);
  showView("home");
}

/**
 * Membuka form catatan baru dari input capture di Home.
 * Catatan: teks yang diketik pengguna belum diteruskan sebagai judul —
 * modul notes belum punya cara menerima judul awal dari luar. Ini sengaja
 * dibiarkan sederhana dulu (lihat Backlog di 01-Piyik-Blueprint.md).
 */
/**
 * Membuka form catatan baru dari input capture di Home, membawa teks yang
 * sudah diketik pengguna sebagai judul awal.
 */
function handleCaptureSubmit(event) {
  event.preventDefault();
  const input = document.getElementById("home-capture-input");
  const draftTitle = input.value.trim();
  input.value = "";
  goToNewNote(draftTitle);
}

/**
 * Inisialisasi modul Home: pasang event listener form capture & bottom nav.
 */
export function initHome() {
  document.getElementById("home-capture-form").addEventListener("submit", handleCaptureSubmit);

  document.getElementById("nav-home").addEventListener("click", loadHome);
  document.getElementById("home-see-all").addEventListener("click", () => goToList(""));
  document.getElementById("nav-notes").addEventListener("click", () => goToList(""));
  document.getElementById("nav-add").addEventListener("click", () => goToNewNote());

  loadHome();
}
