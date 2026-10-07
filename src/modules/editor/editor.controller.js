// modules/editor/editor.controller.js
// Menghubungkan input judul & isi dengan riwayat undo/redo (Phase 1 - B2, B3)
// hitungan kata (C2), label terakhir diedit (C3), toolbar format (D1),
// pemantau keyboard virtual (E1), dan shortcut/CTRL virtual (E2),
// bantuan mengetik (E3-E4), tombol undo/redo di bar format, dan editor blok
// (H2-H6; lihat editor.blocks.js).
// Modul ini tidak menyentuh database. Elemen DOM dan aksi simpan
// di-inject oleh pemanggil (modul notes).

import { createHistory } from "./editor.history.js";
import { createWordCount } from "./editor.wordcount.js";
import { createTimestamp } from "./editor.timestamp.js";
import { initToolbar } from "./editor.toolbar.js";
import { watchKeyboard } from "./editor.keyboard.js";
import { initShortcuts } from "./editor.shortcuts.js";
import { initTyping } from "./editor.typing.js";
import { createBlockEditor } from "./editor.blocks.js";
import { initInsertMenu } from "./editor.insert.js";

// Jeda mengetik sebelum satu langkah riwayat dicatat. Inilah yang membuat
// undo bergerak per "jeda ketikan", bukan per huruf.
const RECORD_DELAY_MS = 600;

/**
 * @param {Object} options
 * @param {HTMLInputElement} options.titleEl
 * @param {HTMLTextAreaElement} options.contentEl
 * @param {HTMLButtonElement} options.undoBtn
 * @param {HTMLButtonElement} options.redoBtn
 * @param {HTMLSelectElement} options.typeEl - tipe catatan (hitungan kata disembunyikan untuk Lagu/Tugas)
 * @param {HTMLElement} options.wordCountEl - elemen tampilan jumlah kata
 * @param {HTMLElement} options.formatBarEl - bar tombol format
 * @param {HTMLElement} options.timestampEl - elemen label "Diedit ..."
 * @param {(date: Date|number|string) => string} options.formatTime - pemformat waktu relatif
 * @param {() => void} options.onRestore - dipanggil setelah undo/redo mengubah
 *   isi form (mengubah .value lewat kode tidak memicu event "input", jadi
 *   pemanggil perlu tahu supaya auto save tetap jalan).
 * @returns {{ reset: () => void, setLastEdited: (updatedAt: Date|number|string) => void }}
 */
export function initEditor({ titleEl, contentEl, undoBtn, redoBtn, typeEl, wordCountEl, timestampEl, formatTime, formatBarEl, onRestore }) {
  const history = createHistory(readSnapshot());
  const wordCount = createWordCount({ contentEl, typeEl, outputEl: wordCountEl });
  const timestamp = createTimestamp({ outputEl: timestampEl, format: formatTime });
  // Editor blok (H2-H6): selalu dibuat; mati sendiri untuk Tugas/Lagu.
  // contentEl tetap sumber kebenaran teks; blok hanya tampilan di atasnya.
  // onKindChange: bar format meredup di dalam blok kode (lihat editor.css).
  const blocks = createBlockEditor({ contentEl, typeEl, onKindChange: (kind) => (formatBarEl.dataset.kind = kind) });
  // Toolbar butuh status keyboard, keyboard butuh memanggil toolbar.refresh:
  // dihubungkan lewat closure supaya tidak saling menunggu.
  let keyboard = null;
  // Mode blok (H5): fokus dipantau di textarea blok aktif, dan format/shortcut
  // bekerja lewat adapter berbentuk textarea milik blok.
  const textTarget = blocks ? blocks.target : contentEl;
  const focusEl = blocks ? blocks.inputEl : contentEl;
  const toolbar = initToolbar({ barEl: formatBarEl, contentEl: textTarget, focusEl, typeEl, isKeyboardOpen: () => (keyboard ? keyboard.isOpen() : false) });
  keyboard = watchKeyboard(() => toolbar.refresh());
  // Menu Sisipkan (+): sheet berisi blok lanjutan (Phase 5 - J3).
  initInsertMenu({
    buttonEl: formatBarEl.querySelector("#editor-insert-btn"),
    overlayEl: document.getElementById("insert-sheet-overlay"),
    sheetEl: document.getElementById("insert-sheet"),
    barEl: formatBarEl,
    target: textTarget,
  });
  toolbar.refresh();
  let timer = null;
  let pending = false; // ada ketikan yang belum dicatat ke riwayat

  function readSnapshot() {
    return { title: titleEl.value, content: contentEl.value };
  }

  // Tombol muncul (fade, lihat main.css) hanya kalau aksinya bisa dilakukan.
  // Redo disembunyikan saat ada ketikan yang belum dicatat, karena ketikan
  // itu akan membuang riwayat redo begitu dicatat.
  // Tombol undo/redo di bar format (di atas keyboard) tidak disembunyikan,
  // tapi diredupkan (disabled), supaya posisi tombol lain di bar tidak bergeser.
  const barUndoBtn = formatBarEl.querySelector('[data-history="undo"]');
  const barRedoBtn = formatBarEl.querySelector('[data-history="redo"]');

  function updateButton() {
    const canUndo = history.canUndo() || pending;
    const canRedo = history.canRedo() && !pending;
    undoBtn.dataset.visible = String(canUndo);
    redoBtn.dataset.visible = String(canRedo);
    if (barUndoBtn) barUndoBtn.disabled = !canUndo;
    if (barRedoBtn) barRedoBtn.disabled = !canRedo;
  }

  // Catat ketikan yang masih menunggu jeda, sekarang juga.
  function flush() {
    clearTimeout(timer);
    history.record(readSnapshot());
    pending = false;
    updateButton();
  }

  function handleInput() {
    pending = true;
    updateButton();
    clearTimeout(timer);
    timer = setTimeout(flush, RECORD_DELAY_MS);
  }

  // Menerapkan snapshot hasil undo/redo ke form.
  function restore(snapshot) {
    updateButton();
    if (!snapshot) return;
    const before = contentEl.value;
    titleEl.value = snapshot.title;
    contentEl.value = snapshot.content;
    placeCaretAtChange(before, snapshot.content);
    wordCount.refresh(); // .value diubah lewat kode, event "input" tidak terpicu
    blocks?.refresh(); // blok aktif pindah ke baris tempat kursor berada
    onRestore();
  }

  // Mengubah .value lewat kode memindahkan kursor ke akhir seluruh teks.
  // Supaya kursor tetap di tempat perubahan, ia ditaruh tepat di akhir bagian
  // yang berubah (awalan & akhiran yang sama dilewati).
  function placeCaretAtChange(before, after) {
    if (before === after) return;
    const max = Math.min(before.length, after.length);
    let from = 0;
    while (from < max && before[from] === after[from]) from++;
    let tail = 0;
    while (tail < max - from && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
    const pos = after.length - tail;
    contentEl.setSelectionRange(pos, pos);
  }

  function undo() {
    flush(); // ketikan terakhir ikut tercatat sebelum mundur
    restore(history.undo());
  }

  function redo() {
    flush(); // ketikan yang tertunda membuang riwayat redo, jadi dicatat dulu
    restore(history.redo());
  }

  function isUndoShortcut(event) {
    return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
  }

  // Ctrl/Cmd+Shift+Z atau Ctrl/Cmd+Y.
  function isRedoShortcut(event) {
    if (!(event.ctrlKey || event.metaKey)) return false;
    const key = event.key.toLowerCase();
    return (event.shiftKey && key === "z") || (!event.shiftKey && key === "y");
  }

  // CTRL virtual + shortcut (E2). undo/redo diteruskan supaya hanya ada satu
  // tumpukan riwayat. Tombol CTRL ada di dalam bar format.
  const shortcuts = initShortcuts({
    contentEl: textTarget,
    focusEl,
    typeEl,
    ctrlBtnEl: formatBarEl.querySelector("#editor-ctrl-btn"),
    undo,
    redo,
  });

  // Bantuan mengetik di isi catatan (E3: Enter melanjutkan list).
  initTyping({ contentEl, typeEl });

  [titleEl, contentEl].forEach((el) => el.addEventListener("input", handleInput));

  // Pintasan undo/redo dipasang juga di textarea blok aktif (kalau ada).
  // Event "input"-nya tidak dipasang: blok sudah memicu "input" di contentEl.
  [titleEl, contentEl, blocks?.inputEl].filter(Boolean).forEach((el) => {
    // Ctrl/Cmd+Z, Shift+Z, dan Y (keyboard fisik) dialihkan ke riwayat kita,
    // supaya tidak ada dua tumpukan (bawaan browser vs milik kita) yang
    // bentrok.
    el.addEventListener("keydown", (event) => {
      if (isUndoShortcut(event)) {
        event.preventDefault();
        undo();
      } else if (isRedoShortcut(event)) {
        event.preventDefault();
        redo();
      }
    });

    // Gestur/tombol undo-redo bawaan keyboard HP juga masuk lewat sini.
    el.addEventListener("beforeinput", (event) => {
      if (event.inputType === "historyUndo") {
        event.preventDefault();
        undo();
      } else if (event.inputType === "historyRedo") {
        event.preventDefault();
        redo();
      }
    });
  });

  // Jangan rebut fokus dari field yang sedang diketik (keyboard tetap terbuka).
  [undoBtn, redoBtn].forEach((btn) => {
    btn.addEventListener("mousedown", (event) => event.preventDefault());
  });
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);

  // Tombol undo/redo di bar format. Rebut-fokus sudah dicegah oleh
  // editor.toolbar.js (mousedown di bar); klik hanya memanggil undo/redo yang sama.
  formatBarEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history]");
    if (!button || button.disabled) return;
    if (button.dataset.history === "undo") undo();
    else redo();
  });

  updateButton();

  return {
    /** Dipanggil setelah form diisi ulang (catatan baru / catatan lain dibuka). */
    reset() {
      clearTimeout(timer);
      pending = false;
      history.reset(readSnapshot());
      updateButton();
      wordCount.refresh();
      blocks?.reset(); // daftar blok dimuat ulang dari contentEl
      timestamp.clear(); // catatan baru / belum ada waktu simpan
      toolbar.refresh();
      shortcuts.disarm();
    },

    /** Dipanggil setelah catatan dibuka atau selesai auto save. */
    setLastEdited(updatedAt) {
      timestamp.set(updatedAt);
    },
  };
}
