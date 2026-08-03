// modules/notes/notes.view.js
// Semua manipulasi DOM untuk fitur Notes.
// Tidak ada HTML string di sini, semua elemen dibuat lewat createElement.

const noteListEl = document.getElementById("note-list");

const formTitleEl = document.getElementById("form-title");
const inputId = document.getElementById("input-id");
const inputTitle = document.getElementById("input-title");
const inputType = document.getElementById("input-type");
const inputContent = document.getElementById("input-content");
const inputContentLabel = document.getElementById("input-content-label");
const inputContentCounter = document.getElementById("input-content-counter");

const detailTitleEl = document.getElementById("detail-title");
const detailTypeEl = document.getElementById("detail-type");
const detailContentEl = document.getElementById("detail-content");

import { createEmptyState } from "../../shared/empty-state.js";
import { formatRelativeTime } from "../../shared/format-time.js";
import { getNoteTypeMeta } from "./note-type.js";

const CHECKLIST_PLACEHOLDER =
  "Satu baris = satu item, contoh:\n[ ] Cari referensi\n[x] Buat outline\n[ ] Tulis Bab 1";

// Icon outline (viewBox 24x24) khusus aksi di card, bukan identitas tipe
// (itu ada di note-type.js). Ditaruh di sini karena cuma dipakai di file ini.
const ICON_LINK = `<path d="M9 12a4 4 0 0 1 1.2-2.9l3-3a4 4 0 1 1 5.7 5.7l-1.7 1.7"/><path d="M15 12a4 4 0 0 1-1.2 2.9l-3 3a4 4 0 1 1-5.7-5.7l1.7-1.7"/>`;
const ICON_DOTS = `<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>`;

/**
 * Membuat elemen <svg> outline 24x24 dari isi path/circle mentah.
 * @param {string} innerMarkup
 * @param {string} className
 */
function createIcon(innerMarkup, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (className) svg.setAttribute("class", className);
  svg.innerHTML = innerMarkup;
  return svg;
}

/**
 * Menyesuaikan label & placeholder textarea "Isi" tergantung tipe yang dipilih.
 * Dipanggil tiap kali dropdown tipe berubah.
 * @param {string} type
 */
export function updateContentMode(type) {
  if (type === "tugas") {
    inputContentLabel.textContent = "Checklist";
    inputContent.placeholder = CHECKLIST_PLACEHOLDER;
  } else if (type === "song") {
    // Untuk lagu, field "Isi" dipakai sebagai catatan bebas seputar lagu
    // (lirik/chord/detail lain punya field sendiri, lihat song.view.js).
    // song.view.js yang mengaktifkan counter+maxlength-nya sendiri untuk
    // mode ini (lihat setSongContentNoteMode), jadi tidak disentuh di sini.
    inputContentLabel.textContent = "Catatan";
    inputContent.placeholder = "Catatan bebas seputar lagu ini (opsional)";
  } else if (type === "ide") {
    inputContentLabel.textContent = "Isi";
    inputContent.placeholder = "Tuliskan ide yang terlintas...";
  } else if (type === "belanja") {
    inputContentLabel.textContent = "Isi";
    inputContent.placeholder = "Satu baris = satu barang, contoh:\nBeras\nTelur\nSabun";
  } else if (type === "orang") {
    inputContentLabel.textContent = "Isi";
    inputContent.placeholder = "Info tentang orang ini, misal kelas, kontak, catatan penting";
  } else if (type === "pengingat") {
    inputContentLabel.textContent = "Isi";
    inputContent.placeholder = "Apa yang perlu diingat, dan kapan?";
  } else {
    // "catatan" dan tipe lain di luar daftar di atas
    inputContentLabel.textContent = "Isi";
    inputContent.placeholder = "Tulis apa saja yang ingin kamu simpan...";
  }

  // Untuk tipe selain "song", catatan bersifat bebas panjang (lihat
  // 01-Piyik-Blueprint.md - tidak ada batas karakter untuk catatan biasa).
  // Tanpa baris ini, counter & maxlength yang diaktifkan song.view.js saat
  // form pernah dipakai untuk tipe "song" akan tetap nempel ketika tipe
  // diganti ke tipe lain (mis. "Catatan") - itu sebabnya "0/300" pernah
  // muncul di catatan biasa.
  if (type !== "song") {
    inputContent.removeAttribute("maxlength");
    inputContentCounter.hidden = true;
    inputContentCounter.textContent = "";
  }
}

/**
 * Membuat satu elemen card untuk daftar catatan (Tahap 2 - Card Catatan).
 * @param {Object} note
 * @param {number} relationCount
 * @param {(id: number) => void} onSelect
 */
function createNoteCard(note, relationCount, onSelect) {
  const meta = getNoteTypeMeta(note.type);

  const item = document.createElement("li");
  item.className = "note-item";
  item.addEventListener("click", () => onSelect(note.id));

  // ---- Avatar bulat berwarna sesuai tipe ----
  const avatar = document.createElement("div");
  avatar.className = "note-item-avatar";
  avatar.style.background = meta.bg;
  avatar.style.color = meta.color;
  avatar.appendChild(createIcon(meta.icon, "note-item-avatar-icon"));

  // ---- Bagian tengah: judul, subjudul, cuplikan ----
  const body = document.createElement("div");
  body.className = "note-item-body";

  const titleEl = document.createElement("p");
  titleEl.className = "note-item-title";
  titleEl.textContent = note.title;

  const subtitleEl = document.createElement("p");
  subtitleEl.className = "note-item-subtitle";
  subtitleEl.style.color = meta.color;
  subtitleEl.textContent = meta.label;

  if (relationCount) {
    subtitleEl.append(" \u00B7 ");
    const countSpan = document.createElement("span");
    countSpan.textContent = `${relationCount} relasi`;
    subtitleEl.appendChild(countSpan);
  }

  const snippetEl = document.createElement("p");
  snippetEl.className = "note-item-snippet";
  snippetEl.textContent = note.content || "";

  body.append(titleEl, subtitleEl, snippetEl);

  // ---- Bagian kanan: aksi (link, menu) + waktu relatif ----
  const side = document.createElement("div");
  side.className = "note-item-side";

  const actions = document.createElement("div");
  actions.className = "note-item-actions";

  const linkBtn = document.createElement("button");
  linkBtn.type = "button";
  linkBtn.className = "note-item-icon-btn note-item-link-btn";
  if (relationCount) linkBtn.classList.add("note-item-link-btn-active");
  linkBtn.setAttribute("aria-label", "Lihat relasi");
  linkBtn.appendChild(createIcon(ICON_LINK));
  // Jangan buka detail 2x saat menekan tombol aksi di dalam card.
  linkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(note.id);
  });

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "note-item-icon-btn note-item-menu-btn";
  menuBtn.setAttribute("aria-label", "Menu catatan");
  menuBtn.appendChild(createIcon(ICON_DOTS));
  // Belum ada aksi (edit/hapus cepat) — visual saja untuk Tahap 2.
  menuBtn.addEventListener("click", (e) => e.stopPropagation());

  actions.append(linkBtn, menuBtn);

  const timeEl = document.createElement("span");
  timeEl.className = "note-item-time";
  timeEl.textContent = formatRelativeTime(note.updatedAt);

  side.append(actions, timeEl);

  item.append(avatar, body, side);
  return item;
}

/**
 * Merender daftar catatan ke dalam <ul id="note-list">.
 * @param {Array} notes
 * @param {(id: number) => void} onSelect - dipanggil saat item diklik
 * @param {Object<number, number>} [relationCounts] - peta noteId -> jumlah relasi
 */
export function renderNoteList(notes, onSelect, relationCounts = {}) {
  noteListEl.textContent = ""; // kosongkan isi lama

  if (notes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "note-empty";
    emptyItem.appendChild(
      createEmptyState("Belum ada catatan.", "Ayo mulai menyimpan pengetahuanmu.")
    );
    noteListEl.appendChild(emptyItem);
    return;
  }

  for (const note of notes) {
    const count = relationCounts[note.id] || 0;
    noteListEl.appendChild(createNoteCard(note, count, onSelect));
  }
}

/**
 * Mengosongkan form dan menyiapkannya untuk catatan baru.
 */
export function resetForm() {
  formTitleEl.textContent = "Catatan Baru";
  inputId.value = "";
  inputTitle.value = "";
  inputType.value = "catatan";
  // Set .value lewat kode tidak memicu event "change" bawaan browser (itu
  // cuma terpicu saat user memilih manual), padahal type-select.js dengar
  // event ini untuk update ikon bulat di field Tipe. Tanpa baris ini, ikon
  // baru ikut berubah setelah user mengganti dropdown sendiri. Pola sama
  // dengan filter-chips.js.
  inputType.dispatchEvent(new Event("change"));
  inputContent.value = "";
  updateContentMode("catatan");
}

/**
 * Mengisi judul form dengan draft dari input capture Home, tanpa mengubah
 * bagian form lainnya (dipanggil setelah resetForm()).
 * @param {string} title
 */
export function fillFormTitle(title) {
  inputTitle.value = title;
}

/**
 * Mengisi form dengan data catatan yang akan diubah.
 * @param {Object} note
 * @param {string} [contentOverride] - dipakai untuk note tipe "tugas": teks
 *   checklist hasil format dari item, menggantikan note.content apa adanya.
 */
export function fillForm(note, contentOverride) {
  formTitleEl.textContent = "Ubah Catatan";
  inputId.value = note.id;
  inputTitle.value = note.title;
  inputType.value = note.type;
  // Lihat komentar sama di resetForm() -> perlu dipicu manual supaya ikon
  // tipe di form Ubah Catatan langsung sesuai, tanpa nunggu user ganti dropdown.
  inputType.dispatchEvent(new Event("change"));
  inputContent.value = contentOverride !== undefined ? contentOverride : note.content;
  updateContentMode(note.type);
}

/**
 * Membaca nilai form saat ini menjadi objek data.
 */
export function readForm() {
  return {
    id: inputId.value ? Number(inputId.value) : null,
    title: inputTitle.value.trim(),
    type: inputType.value,
    content: inputContent.value.trim(),
  };
}

/**
 * Menampilkan detail satu catatan.
 * Untuk tipe "tugas", paragraf isi disembunyikan karena checklist
 * (di bawahnya) adalah sumber kebenaran, bukan field content.
 *
 * Warna pill tipe diset inline dari getNoteTypeMeta() (menang otomatis
 * atas rule lama .detail-type-pill[data-type="..."] di main.css, yang
 * sempat jadi sumber warna terpisah — tugas/belanja/orang/pengingat beda
 * dari daftar Catatan, dan "song" tidak punya rule sama sekali). Rule CSS
 * lama itu jadi tidak lagi dipakai, tapi sengaja dibiarkan ada di main.css
 * (tidak dihapus) supaya diff tetap kecil — bisa dibersihkan lain kali.
 */
export function fillDetail(note) {
  detailTitleEl.textContent = note.title;

  const meta = getNoteTypeMeta(note.type);
  detailTypeEl.textContent = meta.label;
  detailTypeEl.style.background = meta.bg;
  detailTypeEl.style.color = meta.color;

  const isTugas = note.type === "tugas";
  detailContentEl.hidden = isTugas;
  detailContentEl.textContent = isTugas ? "" : note.content;
}
