// modules/editor/editor.shortcuts.js
// CTRL virtual + keyboard shortcut (Phase 3 - E2). Tidak menyentuh database.
//
// Dua jalur masuk:
// 1. Keyboard HP: tombol CTRL di bar bersifat sekali-pakai. Saat menyala,
//    huruf berikutnya (event beforeinput insertText) dibatalkan lalu dibaca
//    sebagai Ctrl+huruf. Shift diabaikan (huruf kapital otomatis keyboard HP). Khusus undo/redo, CTRL
//    tetap menyala untuk pengulangan (lihat repeatHistory). Hasil probe: keyboard HP
//    mengirim keydown "Unidentified", jadi jalur ini TIDAK memakai keydown.
// 2. Keyboard fisik: keydown dengan ctrl/meta. Salin/tempel/potong/pilih
//    semua dibiarkan ke browser; Ctrl+Z/Y sudah ditangani editor.controller.js;
//    yang ditangani di sini hanya Ctrl+B/I/U dan Ctrl+Shift+X (coret).
//
// Semua perubahan teks lewat event "input", jadi undo/redo, auto save, dan
// hitung kata jalan seperti biasa.

import { PLAIN_TEXT_TYPES } from "./editor.parser.js";
import { applyFormat } from "./editor.formatter.js";

const ACTIONS = {
  c: "copy",
  x: "cut",
  v: "paste",
  a: "selectAll",
  z: "undo",
  y: "redo",
  b: "bold",
  i: "italic",
  u: "underline",
};

// Kombinasi dengan Shift yang artinya lain dari versi tanpa Shift.
const SHIFT_ACTIONS = { z: "redo", x: "strike" };

// Nama aksi = nama format di editor.formatter.js.
const FORMAT_ACTIONS = new Set(["bold", "italic", "underline", "strike"]);
const HISTORY_ACTIONS = new Set(["undo", "redo"]);

/**
 * Logika murni: huruf + Shift -> nama aksi (atau null kalau tidak dikenal).
 * Shift tanpa arti khusus dianggap sama dengan tanpa Shift.
 * @param {string} letter
 * @param {boolean} shift
 * @returns {string|null}
 */
export function resolveShortcut(letter, shift) {
  const key = letter.toLowerCase();
  if (shift && SHIFT_ACTIONS[key]) return SHIFT_ACTIONS[key];
  return ACTIONS[key] || null;
}

function isLetter(data) {
  return data.length === 1 && data.toLowerCase() !== data.toUpperCase();
}

/**
 * @param {Object} options
 * @param {HTMLTextAreaElement|Object} options.contentEl - target teks (textarea,
 *   atau adapter berbentuk textarea milik editor blok)
 * @param {HTMLElement} [options.focusEl] - elemen tempat event keyboard dipasang
 *   (default contentEl; di editor blok: textarea blok aktif)
 * @param {HTMLSelectElement} options.typeEl
 * @param {HTMLElement} options.ctrlBtnEl - tombol CTRL di bar format
 * @param {() => void} options.undo - fungsi undo milik editor.controller.js
 * @param {() => void} options.redo
 * @returns {{ disarm: () => void }}
 */
export function initShortcuts({ contentEl, focusEl = contentEl, typeEl, ctrlBtnEl, undo, redo }) {
  let armed = false;
  // Setelah undo/redo, CTRL tetap menyala supaya z/Z/y bisa diulang seperti
  // menekan tombol undo berkali-kali. Huruf lain mematikannya dan diketik biasa.
  let repeatHistory = false;

  const isActive = () => !PLAIN_TEXT_TYPES.includes(typeEl.value);

  function setArmed(on) {
    armed = on;
    repeatHistory = false;
    ctrlBtnEl.setAttribute("aria-pressed", String(on));
  }

  // ---------- Clipboard ----------

  function selectedText() {
    return contentEl.value.slice(contentEl.selectionStart, contentEl.selectionEnd);
  }

  // Mengganti pilihan (atau menyisip di kursor) dengan teks, lewat event "input".
  function replaceSelection(text) {
    const { value, selectionStart: start, selectionEnd: end, scrollTop } = contentEl;
    contentEl.value = value.slice(0, start) + text + value.slice(end);
    const pos = start + text.length;
    contentEl.setSelectionRange(pos, pos);
    contentEl.scrollTop = scrollTop;
    contentEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Clipboard API; cadangan execCommand menyalin pilihan yang sedang aktif.
  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return document.execCommand("copy");
    }
  }

  async function copySelection() {
    const text = selectedText();
    if (text) await writeClipboard(text);
  }

  async function cutSelection() {
    const text = selectedText();
    // Teks hanya dihapus kalau benar-benar tersalin.
    if (text && (await writeClipboard(text))) replaceSelection("");
  }

  async function pasteClipboard() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return; // izin ditolak / tidak didukung (lihat 00c: plugin clipboard saat migrasi)
    }
    if (text) replaceSelection(text);
  }

  // ---------- Aksi ----------

  function run(action) {
    if (!action) return;
    // Di dalam blok kode (Phase 5 - I3) format teks dimatikan: kode apa adanya.
    if (FORMAT_ACTIONS.has(action)) {
      if (!contentEl.isCode) applyFormat(contentEl, action);
    }
    else if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "selectAll") {
      // Editor blok hanya bisa memilih satu baris (seleksi lintas baris: Backlog).
      if (contentEl.selectActiveLine) contentEl.selectActiveLine();
      else contentEl.setSelectionRange(0, contentEl.value.length);
    }
    else if (action === "copy") copySelection();
    else if (action === "cut") cutSelection();
    else if (action === "paste") pasteClipboard();
  }

  // ---------- Keyboard HP: tombol CTRL ----------

  ctrlBtnEl.addEventListener("click", () => setArmed(!armed));
  focusEl.addEventListener("blur", () => setArmed(false));

  focusEl.addEventListener("beforeinput", (event) => {
    if (!armed) return;
    const data = event.data;
    if (event.inputType === "insertText" && data && isLetter(data) && event.cancelable) {
      // Shift sengaja diabaikan di keyboard HP: Gboard memakai huruf kapital
      // otomatis (awal baris/kalimat), jadi "z" bisa datang sebagai "Z" tanpa
      // Shift sungguhan. Di sini z/Z = undo, y/Y = redo, x/X = potong.
      const action = resolveShortcut(data, false);
      // Sedang berulang undo/redo, lalu huruf lain: CTRL mati, huruf diketik.
      if (repeatHistory && !HISTORY_ACTIONS.has(action)) {
        setArmed(false);
        return;
      }
      event.preventDefault(); // huruf tidak masuk ke teks
      if (HISTORY_ACTIONS.has(action)) repeatHistory = true;
      else setArmed(false);
      run(action);
      return;
    }
    // Ketikan lain (spasi, angka, hapus, dst): CTRL mati, ketikan jalan biasa.
    setArmed(false);
  });

  // ---------- Keyboard fisik ----------

  focusEl.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || !isActive()) return;
    if (event.key.length !== 1) return; // mis. "Unidentified"
    const action = resolveShortcut(event.key, event.shiftKey);
    if (!FORMAT_ACTIONS.has(action)) return; // sisanya urusan browser / controller
    event.preventDefault(); // cegah Ctrl+B/I/U bawaan browser
    if (!contentEl.isCode) applyFormat(contentEl, action);
  });

  return { disarm: () => setArmed(false) };
}
