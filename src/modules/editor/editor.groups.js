// modules/editor/editor.groups.js
// Pengelompokan baris (Phase 5 - I1). Fungsi murni, tanpa DOM.
// Satu blok bisa memakai lebih dari satu baris (blok kode; nanti callout &
// tabel), jadi daftar baris dikelompokkan dulu. Parser Detail dan editor blok
// memakai fungsi ini bersama, supaya keduanya tidak bisa beda tafsir.
//
// Setiap grup: { kind, start, end, meta } dengan `end` eksklusif.
// Semua baris tercakup tepat satu grup (tanpa celah, tanpa tumpang tindih).
//   - "line": satu baris biasa (meta kosong).
//   - "code": fence "```" ... "```" yang berpenutup. meta.lang = kata pertama
//     setelah fence pembuka ("" kalau tidak ada). Fence tanpa penutup dianggap
//     baris biasa, supaya mengetik "```" tidak menelan isi catatan di bawahnya.
//   - "callout" (K1): baris "> [!tipe] judul" (tipe: info, warning, success,
//     error) diikuti baris-baris yang diawali ">". meta.variant = tipe (huruf
//     kecil), meta.title = teks setelah "[!tipe]" ("" kalau tidak ada). Isinya
//     boleh hanya baris pembuka. "> [!lain]" bukan callout (quote biasa).
//   - "table" (L1): baris "|a|b|" yang baris keduanya pemisah "|---|---|",
//     lalu baris "|...|" berurutan. meta.cols = jumlah sel di baris pertama.
//     Tanpa baris pemisah, baris "|...|" tetap baris biasa.
//
// Menambah jenis grup baru (callout, table) = menambah satu detektor di
// DETECTORS; groupLines tidak perlu diubah.

// Fence pembuka: "```" lalu (opsional) nama bahasa, tanpa backtick lain
// (supaya "```a```" di satu baris tidak dianggap fence).
const FENCE_OPEN_RE = /^```([^`]*)$/;
// Fence penutup: hanya "```" (spasi di ujung boleh). "```js" bukan penutup,
// jadi fence di dalam fence tidak membuka atau menutup grup baru.
const FENCE_CLOSE_RE = /^```[ \t]*$/;

/**
 * Detektor: dipanggil di baris `start`; mengembalikan { end, meta } kalau
 * grup jenis ini dimulai di sana, atau null kalau bukan.
 * @typedef {(lines: string[], start: number) => ({ end: number, meta: Object } | null)} Detector
 */

/** @type {Detector} */
function detectCode(lines, start) {
  const open = FENCE_OPEN_RE.exec(lines[start]);
  if (!open) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (FENCE_CLOSE_RE.test(lines[i])) {
      return { end: i + 1, meta: { lang: open[1].trim().split(/\s+/)[0] } };
    }
  }
  return null; // tanpa penutup
}

// Callout: "> [!info]" / warning / success / error (huruf besar-kecil bebas),
// lalu judul opsional (dipisah spasi; "[!info]x" bukan callout). Baris isi = baris apa pun yang diawali ">"; callout
// berikutnya ("> [!...]" lagi) memulai grup baru.
const CALLOUT_OPEN_RE = /^> \[!(info|warning|success|error)\](?:[ \t]+(.*))?$/i;
const CALLOUT_BODY_RE = /^>/;

/** @type {Detector} */
function detectCallout(lines, start) {
  const open = CALLOUT_OPEN_RE.exec(lines[start]);
  if (!open) return null;
  let end = start + 1;
  while (end < lines.length && CALLOUT_BODY_RE.test(lines[end]) && !CALLOUT_OPEN_RE.test(lines[end])) end++;
  return { end, meta: { variant: open[1].toLowerCase(), title: (open[2] ?? "").trim() } };
}

// Tabel (L1). Baris tabel diawali dan diakhiri "|"; "\|" di dalam sel = tanda
// "|" biasa. Baris pemisah: semua selnya hanya "-" (boleh diapit ":" untuk rata
// kolom, yang diabaikan). splitTableRow dipakai juga oleh parser.
function isTableRow(line) {
  const s = line.trim();
  return s.length >= 2 && s.startsWith("|") && s.endsWith("|") && !s.endsWith("\\|");
}

/**
 * Memecah baris tabel menjadi sel (tanpa "|" pembuka/penutup, spasi tepi dibuang,
 * "\|" menjadi "|"). Dipakai untuk baris yang sudah lolos isTableRow.
 * @param {string} line
 * @returns {string[]}
 */
export function splitTableRow(line) {
  const s = line.trim();
  const cells = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += s[i];
    }
  }
  cells.push(cur);
  cells.shift(); // sebelum "|" pembuka
  cells.pop(); // setelah "|" penutup
  return cells.map((c) => c.trim());
}

function isTableSeparator(line) {
  return isTableRow(line) && splitTableRow(line).every((c) => /^:?-+:?$/.test(c));
}

/** @type {Detector} */
function detectTable(lines, start) {
  if (!isTableRow(lines[start]) || start + 1 >= lines.length || !isTableSeparator(lines[start + 1])) return null;
  let end = start + 2;
  while (end < lines.length && isTableRow(lines[end])) end++;
  return { end, meta: { cols: splitTableRow(lines[start]).length } };
}

// Urutan = prioritas bila dua detektor cocok di baris yang sama.
const DETECTORS = [
  { kind: "code", detect: detectCode },
  { kind: "callout", detect: detectCallout },
  { kind: "table", detect: detectTable },
];

/**
 * @param {string[]} lines - isi catatan yang sudah dipecah per baris
 * @returns {Array<{ kind: string, start: number, end: number, meta: Object }>}
 */
export function groupLines(lines) {
  const groups = [];
  let i = 0;
  while (i < lines.length) {
    let group = null;
    for (const { kind, detect } of DETECTORS) {
      const found = detect(lines, i);
      if (found) {
        group = { kind, start: i, end: found.end, meta: found.meta };
        break;
      }
    }
    if (!group) group = { kind: "line", start: i, end: i + 1, meta: {} };
    groups.push(group);
    i = group.end;
  }
  return groups;
}

/**
 * Grup yang memuat baris `line` (null kalau di luar jangkauan).
 * @param {Array<{ start: number, end: number }>} groups
 * @param {number} line
 */
export function findGroup(groups, line) {
  return groups.find((g) => line >= g.start && line < g.end) ?? null;
}

/**
 * Sidik jari daftar grup (jenis + rentang). Dua daftar dengan sidik jari sama
 * berarti struktur blok tidak berubah, jadi tampilan tidak perlu disusun ulang.
 */
export function groupsSignature(groups) {
  return groups.map((g) => `${g.kind}:${g.start}-${g.end}`).join("|");
}
