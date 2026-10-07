// modules/editor/editor.formatter.js
// Menerapkan format markdown ke textarea (Phase 2). Hanya mengubah teks di
// textarea; tidak menyentuh database. Perubahan dikirim lewat event "input",
// sehingga auto save, undo/redo, dan hitung kata ikut jalan seperti biasa.

import { toggleWrap } from "./editor.selection.js";
import { toggleLinePrefix, toggleDivider, numberStartFor, insertCallout, CALLOUT_VARIANTS, BLOCK_PREFIX } from "./editor.lines.js";
import { insertCodeBlock } from "./editor.fence.js";

// Nama format (dipakai atribut data-format di tombol toolbar) -> simbolnya.
const INLINE_MARKERS = {
  bold: "**",
  italic: "*",
  underline: "++",
  strike: "~~",
  code: "`", // kode inline (J3, lewat menu +)
};

// Format per baris: make(i) = awalan baris ke-i, match = tanda format sudah
// terpasang, keepMatched = baris yang sudah cocok dibiarkan saat memasang.
// Awalan blok lain diganti (BLOCK_PREFIX), tidak ditumpuk.
const LINE_FORMATS = {
  h1: { make: () => "# ", match: /^# / },
  h2: { make: () => "## ", match: /^## / },
  h3: { make: () => "### ", match: /^### / },
  // Bullet tidak cocok dengan checklist ("- [ ] " juga diawali "- ").
  bullet: { make: () => "- ", match: /^- (?!\[[ xX]\] )/ },
  // keepMatched: baris yang sudah checklist (mis. "- [x]") tidak direset.
  check: { make: () => "- [ ] ", match: /^- \[[ xX]\] /, keepMatched: true },
  number: { make: (i) => `${i + 1}. `, match: /^\d{1,3}\. / },
  quote: { make: () => "> ", match: /^> / },
};

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {string} format - kunci INLINE_MARKERS, LINE_FORMATS, "divider", "codeblock", atau "callout-<tipe>" (K2)
 */
export function applyFormat(textarea, format) {
  const { value, selectionStart, selectionEnd, scrollTop } = textarea;

  let result;
  if (INLINE_MARKERS[format]) {
    result = toggleWrap(value, selectionStart, selectionEnd, INLINE_MARKERS[format]);
  } else if (format === "codeblock") {
    result = insertCodeBlock(value, selectionStart, selectionEnd); // J3, lewat menu +
  } else if (format.startsWith("callout-") && CALLOUT_VARIANTS.includes(format.slice(8))) {
    result = insertCallout(value, selectionStart, selectionEnd, format.slice(8)); // K2, lewat menu +
  } else if (format === "divider") {
    result = toggleDivider(value, selectionStart);
  } else if (LINE_FORMATS[format]) {
    const spec = { ...LINE_FORMATS[format], strip: BLOCK_PREFIX };
    if (format === "number") {
      // Lanjutkan nomor dari baris di atas pilihan (E5), bukan selalu dari 1.
      const base = numberStartFor(value, selectionStart);
      spec.make = (i) => `${base + i}. `;
    }
    result = toggleLinePrefix(value, selectionStart, selectionEnd, spec);
  } else {
    return;
  }

  textarea.value = result.text;
  textarea.setSelectionRange(result.start, result.end);
  textarea.scrollTop = scrollTop; // mengubah .value bisa menggeser scroll
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}
