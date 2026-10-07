// modules/editor/editor.insert.js
// Menu Sisipkan (+) (Phase 5 - J3): satu tombol di bar format membuka bottom
// sheet berisi blok lanjutan. Item sheet = daftar ITEMS di bawah; tabel,
// rumus, dan sketsa (L-N) tinggal menambah satu entri. Callout (K2) = empat
// entri, lewat applyFormat(target, "callout-<tipe>").
// Memakai kelas CSS bottom sheet tipe catatan (.type-sheet-*, editor.css) dan
// pola buka/tutup yang sama dengan shared/type-select.js. Tidak menyentuh
// database; teks diubah lewat applyFormat (event "input" seperti format lain).

import { applyFormat } from "./editor.formatter.js";

const CLOSE_DELAY_MS = 200; // sama dengan transisi sheet (--transition-fast)

// Ikon garis 24x24 (Lucide), isi <svg> saja.
const ITEMS = [
  {
    id: "code",
    label: "Kode inline",
    icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    run: (target) => applyFormat(target, "code"),
  },
  {
    id: "codeblock",
    label: "Blok kode",
    icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m10 10-2 2 2 2"/><path d="m14 14 2-2-2-2"/>',
    run: (target) => applyFormat(target, "codeblock"),
  },
  {
    id: "callout-info",
    label: "Info",
    icon: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    run: (target) => applyFormat(target, "callout-info"),
  },
  {
    id: "callout-warning",
    label: "Peringatan",
    icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    run: (target) => applyFormat(target, "callout-warning"),
  },
  {
    id: "callout-success",
    label: "Berhasil",
    icon: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    run: (target) => applyFormat(target, "callout-success"),
  },
  {
    id: "callout-error",
    label: "Galat",
    icon: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    run: (target) => applyFormat(target, "callout-error"),
  },
];

function buildItem(item, onPick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "type-sheet-item";
  button.dataset.insert = item.id;
  button.setAttribute("role", "menuitem");

  const iconWrap = document.createElement("span");
  iconWrap.className = "type-sheet-item-icon insert-sheet-item-icon";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({
    viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor",
    "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
  })) svg.setAttribute(name, value);
  svg.innerHTML = item.icon; // konstanta di ITEMS, bukan teks pengguna
  iconWrap.appendChild(svg);

  const label = document.createElement("span");
  label.className = "type-sheet-item-label";
  label.textContent = item.label;

  button.append(iconWrap, label);
  button.addEventListener("click", () => onPick(item));
  return button;
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.buttonEl - tombol + di bar format
 * @param {HTMLElement} options.overlayEl - latar gelap sheet (hidden di awal)
 * @param {HTMLElement} options.sheetEl - panel sheet (berisi handle)
 * @param {HTMLElement} options.barEl - bar format; data-kind="code" = di dalam blok kode
 * @param {HTMLTextAreaElement|Object} options.target - target teks untuk applyFormat
 * @returns {{ close: () => void }}
 */
export function initInsertMenu({ buttonEl, overlayEl, sheetEl, barEl, target }) {
  if (!buttonEl || !overlayEl || !sheetEl) return { close() {} };

  const isOpen = () => !overlayEl.hidden && overlayEl.classList.contains("type-sheet-overlay-open");

  function open() {
    if (barEl.dataset.kind === "code") return; // tidak ada gunanya menyisip kode di dalam kode
    overlayEl.hidden = false;
    // Satu frame supaya transisi jalan (hidden -> terbuka di frame sama tidak dianimasikan).
    requestAnimationFrame(() => overlayEl.classList.add("type-sheet-overlay-open"));
    buttonEl.setAttribute("aria-expanded", "true");
  }

  function close() {
    overlayEl.classList.remove("type-sheet-overlay-open");
    buttonEl.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!overlayEl.classList.contains("type-sheet-overlay-open")) overlayEl.hidden = true;
    }, CLOSE_DELAY_MS);
  }

  function pick(item) {
    item.run(target); // teks dulu (fokus kembali ke blok), baru sheet menutup
    close();
  }

  ITEMS.forEach((item) => sheetEl.appendChild(buildItem(item, pick)));

  buttonEl.addEventListener("click", () => (isOpen() ? close() : open()));

  // Jangan rebut fokus dari blok aktif: keyboard tetap terbuka dan kursor tetap di tempat.
  overlayEl.addEventListener("mousedown", (event) => event.preventDefault());

  // Ketuk area gelap di luar panel menutup sheet.
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) close();
  });

  return { close };
}
