// Mengganti ikon bulat di field "Tipe" pada form catatan mengikuti tipe
// yang sedang dipilih, DAN (baru) menghandle bottom-sheet custom yang
// menggantikan popup native <select> -- popup native tidak bisa di-style
// (dirender OS), jadi diganti overlay + panel sendiri di sini.
//
// <select id="input-type"> tetap dipertahankan di DOM sebagai sumber
// value sesungguhnya (dipakai form + kode lain yang baca .value / dengar
// event "change"), cuma disembunyikan visual lewat CSS. Modul ini hanya
// menambah UI di atasnya -- tidak menyentuh logika simpan/edit catatan.
//
// Berdiri sendiri (self-init saat modul ini di-load), sesuai aturan
// "shared/ dipakai banyak modul, tidak bergantung ke modul lain".
import { getNoteTypeMeta } from "./note-type-meta.js";

const selectEl = document.getElementById("input-type");
const triggerEl = document.getElementById("type-select-trigger");
const iconWrapEl = document.getElementById("type-select-icon");
const labelEl = document.getElementById("type-select-label");
const overlayEl = document.getElementById("type-sheet-overlay");
const sheetEl = document.getElementById("type-sheet");

function renderTypeIcon(type, targetEl) {
  const meta = getNoteTypeMeta(type);
  targetEl.style.background = meta.bg;
  // meta.color berisi var(--...) — ini hanya di-resolve browser kalau masuk
  // lewat CSSOM (style.color), bukan lewat atribut HTML mentah. SVG tetap
  // pakai stroke="currentColor" supaya ikut warna dari style.color di wrapper.
  targetEl.style.color = meta.color;
  targetEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>`;
}

// Update tampilan pill trigger (ikon + label teks) sesuai value select saat ini.
function updateTrigger(type) {
  renderTypeIcon(type, iconWrapEl);
  const opt = selectEl.querySelector(`option[value="${type}"]`);
  labelEl.textContent = opt ? opt.textContent : type;
}

// Bangun daftar item sheet dari <option> yang ada di #input-type, supaya
// label & urutan tipe cuma ditulis sekali (di HTML select), tidak dobel.
function buildSheet() {
  sheetEl.querySelectorAll(".type-sheet-item").forEach((el) => el.remove());

  Array.from(selectEl.options).forEach((opt) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "type-sheet-item";
    item.dataset.type = opt.value;
    item.setAttribute("role", "option");

    const icon = document.createElement("span");
    icon.className = "type-sheet-item-icon";
    renderTypeIcon(opt.value, icon);

    const label = document.createElement("span");
    label.className = "type-sheet-item-label";
    label.textContent = opt.textContent;

    const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    check.setAttribute("class", "type-sheet-item-check");
    check.setAttribute("viewBox", "0 0 24 24");
    check.setAttribute("width", "18");
    check.setAttribute("height", "18");
    check.setAttribute("fill", "none");
    check.setAttribute("stroke", "currentColor");
    check.setAttribute("stroke-width", "2");
    check.setAttribute("stroke-linecap", "round");
    check.setAttribute("stroke-linejoin", "round");
    check.innerHTML = '<path d="M20 6 9 17l-5-5" />';

    item.append(icon, label, check);
    item.addEventListener("click", () => selectType(opt.value));
    sheetEl.appendChild(item);
  });
}

// Tandai item yang cocok dengan value select saat ini sebagai aktif.
function syncActiveItem() {
  const current = selectEl.value;
  sheetEl.querySelectorAll(".type-sheet-item").forEach((item) => {
    const active = item.dataset.type === current;
    item.classList.toggle("type-sheet-item-active", active);
    item.setAttribute("aria-selected", String(active));
  });
}

function openSheet() {
  syncActiveItem();
  overlayEl.hidden = false;
  // Tunda satu frame supaya transisi opacity/transform jalan (mengubah
  // dari [hidden] ke class terbuka di frame yang sama tidak dianimasikan
  // browser).
  requestAnimationFrame(() => overlayEl.classList.add("type-sheet-overlay-open"));
  triggerEl.setAttribute("aria-expanded", "true");
}

function closeSheet() {
  overlayEl.classList.remove("type-sheet-overlay-open");
  triggerEl.setAttribute("aria-expanded", "false");
  // Tunggu transisi selesai baru benar-benar dilepas dari a11y tree,
  // supaya animasi slide-down sempat terlihat.
  setTimeout(() => {
    overlayEl.hidden = true;
  }, 200);
}

function selectType(type) {
  if (selectEl.value !== type) {
    selectEl.value = type;
    // bubbles: true -- supaya kode lain yang dengar event "change" di
    // level form/document (kalau ada) tetap kebagian.
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
  closeSheet();
}

if (selectEl && triggerEl && iconWrapEl && labelEl && overlayEl && sheetEl) {
  buildSheet();
  updateTrigger(selectEl.value);

  triggerEl.addEventListener("click", openSheet);

  // Tap di area gelap luar panel -- bukan di panelnya sendiri -- menutup sheet.
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) closeSheet();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlayEl.hidden) closeSheet();
  });

  // Sengaja ditunda lewat requestAnimationFrame: kalau ada kode lain yang
  // men-set selectEl.value lalu trigger "change" (mis. saat membuka
  // catatan lama untuk diedit), update tampilan trigger tetap sinkron.
  selectEl.addEventListener("change", () => {
    requestAnimationFrame(() => updateTrigger(selectEl.value));
  });
}
