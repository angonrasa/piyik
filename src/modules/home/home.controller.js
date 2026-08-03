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
 * Inisialisasi modul Home: pasang event listener form capture & bottom nav.
 * Catatan: sengaja TIDAK memanggil loadHome() di sini. Editor (form catatan
 * baru) adalah tampilan awal aplikasi sekarang, bukan Home (lihat index.js
 * -> goToNewNote() dipanggil sebagai boot view terakhir). Memanggil
 * loadHome() di sini dulu memicu race condition yang sama seperti yang
 * dijelaskan di notes.controller.js -> initNotes(): loadHome() dan
 * goToNewNote() sama-sama berujung ke showView(), dan siapa pun yang
 * selesai duluan "menang" menentukan view yang benar-benar tampil. Data
 * Home otomatis dimuat begitu pengguna membuka tab "Beranda" (lewat
 * nav-home).
 */
export function initHome() {
  document.getElementById("home-add-btn").addEventListener("click", () => goToNewNote());

  document.getElementById("nav-home").addEventListener("click", loadHome);
  document.getElementById("home-see-all").addEventListener("click", () => goToList(""));
  document.getElementById("nav-notes").addEventListener("click", () => goToList(""));
  document.getElementById("nav-add").addEventListener("click", () => goToNewNote());
}
