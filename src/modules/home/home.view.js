// modules/home/home.view.js
// Semua manipulasi DOM untuk halaman Home.
// Tidak ada HTML string di sini, semua elemen dibuat lewat createElement.

import { createEmptyState } from "../../shared/empty-state.js";
import { getNoteTypeMeta } from "../../shared/note-type-meta.js";

const recentListEl = document.getElementById("home-recent-list");
const recentHeadingEl = document.getElementById("home-recent-heading");
const seeAllBtn = document.getElementById("home-see-all");

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Membuat elemen <svg> outline kosong dengan atribut umum yang dipakai
 * semua ikon tipe catatan di file ini (viewBox, stroke, dsb).
 */
function createIconBase() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  return svg;
}

/**
 * Menambahkan satu elemen <path> ke sebuah <svg>.
 * @param {SVGSVGElement} svg
 * @param {string} d
 */
function addPath(svg, d) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
}

// ---------- Ikon per tipe catatan (outline, konsisten dengan gaya ikon
// bottom navigation di index.html) ----------

function createNoteIcon() {
  const svg = createIconBase();
  addPath(svg, "M6 3h9l4 4v14H6z");
  addPath(svg, "M14 3v5h5");
  addPath(svg, "M9 12h7M9 16h7");
  return svg;
}

function createTaskIcon() {
  const svg = createIconBase();
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "4");
  rect.setAttribute("y", "4");
  rect.setAttribute("width", "16");
  rect.setAttribute("height", "16");
  rect.setAttribute("rx", "3");
  svg.appendChild(rect);
  addPath(svg, "M8 12.5l2.5 2.5L16 9");
  return svg;
}

function createIdeaIcon() {
  const svg = createIconBase();
  addPath(svg, "M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0012 3z");
  addPath(svg, "M9.5 18.5h5");
  addPath(svg, "M10.3 21h3.4");
  return svg;
}

function createShoppingIcon() {
  const svg = createIconBase();
  addPath(svg, "M6 8h12l-1 12H7L6 8z");
  addPath(svg, "M9 8V6a3 3 0 016 0v2");
  return svg;
}

function createPersonIcon() {
  const svg = createIconBase();
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "8");
  circle.setAttribute("r", "3.2");
  svg.appendChild(circle);
  addPath(svg, "M5 20c1.2-4 4-6 7-6s5.8 2 7 6");
  return svg;
}

function createBellIcon() {
  const svg = createIconBase();
  addPath(svg, "M6 16v-4a6 6 0 1112 0v4l1.5 2.5h-15L6 16z");
  addPath(svg, "M10 20a2 2 0 004 0");
  return svg;
}

function createMusicIcon() {
  const svg = createIconBase();
  addPath(svg, "M9 18V5l12-2v13");
  const note1 = document.createElementNS(SVG_NS, "circle");
  note1.setAttribute("cx", "6");
  note1.setAttribute("cy", "18");
  note1.setAttribute("r", "3");
  svg.appendChild(note1);
  const note2 = document.createElementNS(SVG_NS, "circle");
  note2.setAttribute("cx", "18");
  note2.setAttribute("cy", "16");
  note2.setAttribute("r", "3");
  svg.appendChild(note2);
  return svg;
}

function createMenuIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "currentColor");

  for (const cy of [5, 12, 19]) {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", "12");
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", "1.6");
    svg.appendChild(dot);
  }
  return svg;
}

// Peta tipe -> pembuat ikon (bentuk ikon tetap milik Home sendiri, sesuai
// gaya outline bottom-nav). Warnanya TIDAK dihardcode di sini lagi —
// sebelumnya ada TYPE_META dengan colorClass manual per tipe yang ternyata
// beda dari warna canonical di shared/note-type-meta.js untuk "tugas" dan
// "belanja" (Home jadi sumber warna ketiga yang tidak sinkron). Sekarang
// class warna diturunkan dari getNoteTypeMeta(type).color lewat
// COLOR_CLASS_BY_VAR di bawah, supaya kalau warna canonical berubah,
// Home ikut berubah otomatis tanpa perlu disetel manual lagi.
const ICON_BY_TYPE = {
  catatan: createNoteIcon,
  tugas: createTaskIcon,
  ide: createIdeaIcon,
  belanja: createShoppingIcon,
  orang: createPersonIcon,
  pengingat: createBellIcon,
  song: createMusicIcon,
};

// Class warna Home (home.css) per nilai `color` canonical di
// shared/note-type-meta.js. Kalau nanti ada tipe baru dengan warna yang
// belum ada class-nya di sini, tambah dulu class-nya di home.css, baru
// daftarkan pasangannya di bawah.
const COLOR_CLASS_BY_VAR = {
  "var(--color-secondary, #4fc3f7)": "home-card-icon-secondary",
  "var(--color-warning, #ffa65e)": "home-card-icon-warning",
  "var(--color-primary, #62b43d)": "home-card-icon-primary",
  "#8a6d1b": "home-card-icon-lemon",
};

/**
 * Mengambil pembuat ikon + class warna Home untuk sebuah tipe, sinkron
 * dengan warna canonical (shared/note-type-meta.js).
 * @param {string} type
 */
function getRecentItemMeta(type) {
  const canonical = getNoteTypeMeta(type);
  const icon = ICON_BY_TYPE[type] || ICON_BY_TYPE.catatan;
  const colorClass = COLOR_CLASS_BY_VAR[canonical.color] || "home-card-icon-secondary";
  return { icon, colorClass };
}

/**
 * Memformat tanggal jadi teks relatif singkat: "10:30" (hari ini),
 * "Kemarin", "3 hari lalu", atau "12 Jul" untuk yang lebih lama.
 * @param {Date} date
 */
function formatRelativeTime(date) {
  const now = new Date();
  const target = new Date(date);

  if (target.toDateString() === now.toDateString()) {
    const hh = String(target.getHours()).padStart(2, "0");
    const mm = String(target.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);

  if (diffDays === 1) return "Kemarin";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} hari lalu`;

  return target.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/**
 * Memperbarui judul "Terbaru (N)" dan menampilkan tombol "Lihat semua"
 * hanya jika jumlah catatan melebihi yang ditampilkan di Home.
 * @param {number} totalCount - total seluruh catatan
 * @param {number} shownCount - jumlah yang ditampilkan di daftar Terbaru
 */
export function updateRecentHeading(totalCount, shownCount) {
  recentHeadingEl.textContent = `Terbaru (${totalCount})`;
  seeAllBtn.hidden = totalCount <= shownCount;
}

/**
 * Merender daftar catatan yang terakhir diperbarui.
 * @param {Array} notes
 * @param {(id: number) => void} onSelect - dipanggil saat sebuah catatan diklik
 */
export function renderRecent(notes, onSelect, relationCounts = {}) {
  recentListEl.textContent = ""; // kosongkan isi lama

  if (notes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "home-recent-empty";
    emptyItem.appendChild(
      createEmptyState("Belum ada catatan.", "Tulis apa saja untuk mulai mengingat.")
    );
    recentListEl.appendChild(emptyItem);
    return;
  }

  for (const note of notes) {
    const item = document.createElement("li");
    item.className = "home-recent-item";

    const meta = getRecentItemMeta(note.type);

    const iconEl = document.createElement("div");
    iconEl.className = `home-card-icon ${meta.colorClass}`;
    iconEl.appendChild(meta.icon());

    const textWrap = document.createElement("div");
    textWrap.className = "home-recent-text";

    const titleEl = document.createElement("span");
    titleEl.className = "home-recent-title";
    titleEl.textContent = note.title;

    const subtitleEl = document.createElement("span");
    subtitleEl.className = "home-recent-subtitle";
    const relationCount = relationCounts[note.id] || 0;
    const subtitleParts = [note.type];
    if (relationCount) subtitleParts.push(`${relationCount} relasi`);
    subtitleParts.push(formatRelativeTime(note.updatedAt));
    subtitleEl.textContent = subtitleParts.join(" • ");

    textWrap.appendChild(titleEl);
    textWrap.appendChild(subtitleEl);

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "home-recent-menu";
    menuBtn.setAttribute("aria-label", "Menu catatan");
    menuBtn.appendChild(createMenuIcon());
    // Menu titik tiga saat ini hanya visual, mengikuti mockup. Aksi
    // (ubah/hapus cepat dari Beranda) belum ada — item tetap bisa dibuka
    // lewat klik di mana pun pada kartu ini. Kalau nanti butuh menu aksi
    // sungguhan, catat sebagai task terpisah di 01-Piyik-Blueprint.md.
    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(note.id);
    });

    item.appendChild(iconEl);
    item.appendChild(textWrap);
    item.appendChild(menuBtn);
    item.addEventListener("click", () => onSelect(note.id));

    recentListEl.appendChild(item);
  }
}
