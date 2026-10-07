// modules/editor/editor.typing.js
// Bantuan mengetik di textarea isi (Phase 3). E3: Enter melanjutkan list.
// E4: Enter / Backspace di item list kosong keluar dari list.
// E6: Enter di baris berindent menyalin indent ke baris baru.
// F1: spasi setelah "[]" / "[x]" di awal baris menjadi checklist.
// Dipasang lewat beforeinput, bukan keydown: keyboard HP mengirim keydown
// "Unidentified" (hasil probe E2), sedangkan beforeinput konsisten.
// Tidak menyentuh database. Menghapus initTyping() dari editor.controller.js
// mengembalikan perilaku textarea biasa.

import { PLAIN_TEXT_TYPES } from "./editor.parser.js";
import { continueList, exitList, continueIndent, smartChecklist } from "./editor.lines.js";

/**
 * @param {Object} options
 * @param {HTMLTextAreaElement} options.contentEl
 * @param {HTMLSelectElement} options.typeEl
 */
export function initTyping({ contentEl, typeEl }) {
  // Bagian teks yang berubah antara `a` (lama) dan `b` (baru): awalan dan
  // akhiran yang sama dilewati. Hasilnya rentang di `a` yang diganti `insert`.
  function diffRange(a, b) {
    const max = Math.min(a.length, b.length);
    let from = 0;
    while (from < max && a[from] === b[from]) from++;
    let tail = 0;
    while (tail < max - from && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
    return { from, to: a.length - tail, insert: b.slice(from, b.length - tail) };
  }

  // Memasang hasil. execCommand dipakai dulu supaya undo dan scroll berjalan
  // seperti ketikan biasa: "insertText" untuk penyisipan, "delete" kalau
  // hasilnya murni penghapusan (insertText dengan teks kosong tidak andal).
  // Kalau tidak tersedia, teks diganti langsung lewat .value.
  function apply(result) {
    const { from, to, insert } = diffRange(contentEl.value, result.text);
    contentEl.setSelectionRange(from, to);
    const ok = insert === "" ? document.execCommand("delete") : document.execCommand("insertText", false, insert);
    if (ok) {
      contentEl.setSelectionRange(result.start, result.end);
      return;
    }

    const scrollTop = contentEl.scrollTop;
    contentEl.value = result.text;
    contentEl.setSelectionRange(result.start, result.end);
    contentEl.scrollTop = scrollTop;
    contentEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  contentEl.addEventListener("beforeinput", (event) => {
    const isEnter = event.inputType === "insertLineBreak" || event.inputType === "insertParagraph";
    const isBackspace = event.inputType === "deleteContentBackward";
    const isSpace = event.inputType === "insertText" && event.data === " ";
    if (!isEnter && !isBackspace && !isSpace) return;
    if (event.isComposing || !event.cancelable) return;
    if (PLAIN_TEXT_TYPES.includes(typeEl.value)) return;

    const { value, selectionStart, selectionEnd } = contentEl;
    // Enter: lanjutkan list dulu, kalau item kosong keluar dari list,
    // kalau bukan list salin indent baris. Backspace: hanya keluar dari list.
    let result;
    if (isSpace) {
      result = smartChecklist(value, selectionStart, selectionEnd);
    } else if (isEnter) {
      result =
        continueList(value, selectionStart, selectionEnd) ||
        exitList(value, selectionStart, selectionEnd) ||
        continueIndent(value, selectionStart, selectionEnd);
    } else {
      result = exitList(value, selectionStart, selectionEnd);
    }
    if (!result) return; // perilaku biasa

    event.preventDefault();
    apply(result);
  });
}
