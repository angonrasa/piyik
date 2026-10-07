// modules/editor/editor.toolbar.js
// Bar tombol format (Phase 2). Tampil terus selama editor terbuka dan tipe
// catatan mendukung markdown (bukan Tugas/Lagu); tidak lagi bergantung pada
// fokus atau keyboard. Hilang bersama layar Editor (bar ada di dalam
// #view-form, jadi ikut tersembunyi saat pindah layar).
// Tombol ditentukan di HTML lewat atribut data-format (lihat
// editor.formatter.js), jadi menambah format baru tidak mengubah file ini.
// Posisi tepat di atas keyboard (atau di dasar layar saat keyboard tertutup)
// diatur CSS lewat --keyboard-offset (ditulis editor.keyboard.js).

import { PLAIN_TEXT_TYPES } from "./editor.parser.js";
import { applyFormat } from "./editor.formatter.js";

/**
 * @param {Object} options
 * @param {HTMLElement} options.barEl - tampil/sembunyi lewat data-visible
 * @param {HTMLTextAreaElement|Object} options.contentEl - target teks untuk
 *   applyFormat (textarea, atau adapter berbentuk textarea milik editor blok)
 * @param {HTMLSelectElement} options.typeEl
 * @returns {{ refresh: () => void }}
 */
export function initToolbar({ barEl, contentEl, typeEl }) {
  // Hitung ulang dari keadaan sekarang (dipakai saat form diisi ulang atau
  // tipe berganti). Bar tampil selama tipe catatan mendukung markdown.
  function refresh() {
    barEl.dataset.visible = String(!PLAIN_TEXT_TYPES.includes(typeEl.value));
  }

  typeEl.addEventListener("change", refresh);

  // Jangan rebut fokus dari textarea (keyboard tetap terbuka).
  barEl.addEventListener("mousedown", (event) => event.preventDefault());
  barEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-format]");
    if (button) applyFormat(contentEl, button.dataset.format);
  });

  refresh();
  return { refresh };
}
