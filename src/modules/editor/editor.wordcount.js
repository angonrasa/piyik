// modules/editor/editor.wordcount.js
// Hitung jumlah kata isi catatan (Phase 1 - C2).
// Hasil hanya ditampilkan, tidak disimpan. Tidak menyentuh database.

// Tipe yang tidak menampilkan hitungan: Lagu (punya counter sendiri),
// Tugas (isinya checklist, bukan teks bebas).
const HIDDEN_TYPES = ["song", "tugas"];

// Jeda setelah berhenti mengetik sebelum menghitung ulang, supaya
// mengetik tetap ringan pada catatan panjang.
const COUNT_DELAY_MS = 150;

/**
 * Menghitung kata: potongan teks yang dipisah spasi/tab/baris baru dan
 * memuat minimal satu huruf/angka. Simbol markdown yang berdiri sendiri
 * (mis. "#" pada "# Judul") serta awalan list (nomor, checklist) di awal baris tidak dihitung.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  // Awalan list di awal baris ("1. ", "- [x] ") bukan kata.
  const trimmed = text.replace(/^(?:\d{1,3}\. |- \[[ xX]\] )/gm, "").trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).filter((chunk) => /[\p{L}\p{N}]/u.test(chunk)).length;
}

/**
 * @param {Object} options
 * @param {HTMLTextAreaElement} options.contentEl
 * @param {HTMLSelectElement} options.typeEl
 * @param {HTMLElement} options.outputEl - tampil/sembunyi lewat data-visible
 * @returns {{ refresh: () => void }}
 */
export function createWordCount({ contentEl, typeEl, outputEl }) {
  let timer = null;

  // Hitung & tampilkan sekarang juga. Saat disembunyikan, teks lama
  // dibiarkan supaya fade-out tidak menampilkan kotak kosong.
  function refresh() {
    clearTimeout(timer);
    const count = countWords(contentEl.value);
    const visible = count > 0 && !HIDDEN_TYPES.includes(typeEl.value);
    if (visible) outputEl.textContent = `${count} kata`;
    outputEl.dataset.visible = String(visible);
  }

  contentEl.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, COUNT_DELAY_MS);
  });
  typeEl.addEventListener("change", refresh);

  refresh();
  return { refresh };
}
