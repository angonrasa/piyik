// shared/view-switcher.js
// Mengatur satu-satunya view yang aktif di antara Home, List, Form, Detail.
// Dipakai oleh lebih dari satu modul (home & notes), jadi ditempatkan di shared/
// sesuai aturan Structure.md.

const views = {
  home: document.getElementById("view-home"),
  list: document.getElementById("view-list"),
  form: document.getElementById("view-form"),
  detail: document.getElementById("view-detail"),
  settings: document.getElementById("view-settings"),
  chat: document.getElementById("view-chat"),
  about: document.getElementById("view-about"),
};

const bottomNav = document.getElementById("bottom-nav");
const fabAdd = document.getElementById("nav-add");
const navHome = document.getElementById("nav-home");
const navNotes = document.getElementById("nav-notes");
const navSettings = document.getElementById("nav-settings");
const navChat = document.getElementById("nav-chat");

/**
 * Menampilkan salah satu view: "home", "list", "form", "detail", "settings",
 * "chat", atau "about". Menyembunyikan sisanya, dan menandai tab bottom
 * navigation yang aktif.
 * @param {"home"|"list"|"form"|"detail"|"settings"|"chat"|"about"} name
 */
export function showView(name) {
  for (const key in views) {
    views[key].hidden = key !== name;
  }

  // Bottom nav disembunyikan saat mengisi form supaya tidak tertutup keyboard.
  bottomNav.hidden = name === "form";

  // FAB disembunyikan di Home: input capture di Home sudah jadi satu-satunya
  // jalan untuk membuat catatan baru di halaman itu, biar tidak ada dua
  // elemen yang menuju aksi yang sama.
  // FAB juga disembunyikan di About: halaman statis, tidak relevan untuk
  // membuat catatan baru.
  fabAdd.hidden = name === "home" || name === "about";

  navHome.classList.toggle("nav-item-active", name === "home");
  // List & Detail sama-sama dianggap bagian dari tab "Catatan".
  navNotes.classList.toggle("nav-item-active", name === "list" || name === "detail");
  navSettings.classList.toggle("nav-item-active", name === "settings");
  navChat.classList.toggle("nav-item-active", name === "chat");
}
