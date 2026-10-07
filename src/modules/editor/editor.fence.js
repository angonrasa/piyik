// modules/editor/editor.fence.js
// Smart formatting blok kode (Phase 5 - J2). Fungsi murni, tanpa DOM.
// Bentuk hasil sama dengan bantuan mengetik di editor.lines.js:
// { text, start } berlaku pada teks penuh (start = posisi kursor baru), atau
// null kalau tidak ada yang perlu dilakukan.

// Baris pembuka fence yang belum berpenutup: "```" atau "```bahasa".
// (Kalau sudah ada penutup di bawahnya, baris ini sudah jadi grup `code`
// dan Enter di sana diperlakukan sebagai Enter biasa di dalam blok kode.)
const FENCE_LINE_RE = /^```[^`]*$/;

/**
 * Enter di akhir baris "```" menambah baris kosong + fence penutup, kursor di
 * baris kosong di antara keduanya. Pemanggil hanya memakai ini di luar blok
 * kode. Baris lain (mis. "```" di tengah kalimat) tidak berubah.
 * @param {string} value - teks penuh
 * @param {number} offset - awal pilihan / kursor
 * @param {number} end - akhir pilihan
 * @returns {{ text: string, start: number } | null}
 */
export function smartCodeFence(value, offset, end) {
  if (offset !== end) return null; // ada pilihan: Enter biasa
  const lineStart = value.lastIndexOf("\n", offset - 1) + 1;
  let lineEnd = value.indexOf("\n", offset);
  if (lineEnd < 0) lineEnd = value.length;
  if (offset !== lineEnd) return null; // kursor harus di akhir baris
  if (!FENCE_LINE_RE.test(value.slice(lineStart, lineEnd))) return null;
  return {
    text: `${value.slice(0, offset)}\n\n\`\`\`${value.slice(offset)}`,
    start: offset + 1,
  };
}

/**
 * Menyisipkan blok kode (Phase 5 - J3, item "Blok kode" di menu +).
 * - Ada pilihan: teks terpilih dibungkus fence (kursor di akhir isi).
 * - Baris kursor kosong: pasangan fence disisip di baris itu, kursor di tengah.
 * - Baris kursor berisi: pasangan fence disisip di bawah baris itu.
 * Fence selalu berdiri di barisnya sendiri.
 * @param {string} value - teks penuh
 * @param {number} start - awal pilihan / kursor
 * @param {number} end - akhir pilihan
 * @returns {{ text: string, start: number, end: number }}
 */
export function insertCodeBlock(value, start, end) {
  if (start !== end) {
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lead = before === "" || before.endsWith("\n") ? "" : "\n";
    const trail = after === "" || after.startsWith("\n") ? "" : "\n";
    const head = `${before}${lead}\`\`\`\n${value.slice(start, end)}`;
    return { text: `${head}\n\`\`\`${trail}${after}`, start: head.length, end: head.length };
  }
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", start);
  if (lineEnd < 0) lineEnd = value.length;
  if (lineStart === lineEnd) {
    const pos = lineStart + 4; // di baris kosong antara dua fence
    return { text: `${value.slice(0, lineStart)}\`\`\`\n\n\`\`\`${value.slice(lineEnd)}`, start: pos, end: pos };
  }
  const pos = lineEnd + 5;
  return { text: `${value.slice(0, lineEnd)}\n\`\`\`\n\n\`\`\`${value.slice(lineEnd)}`, start: pos, end: pos };
}
