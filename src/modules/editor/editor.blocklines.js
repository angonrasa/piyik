// modules/editor/editor.blocklines.js
// Logika murni untuk editor blok (Phase 3b - H2): satu blok = satu grup baris
// (Phase 5 - I2; grup dibuat editor.groups.js, kebanyakan satu baris, blok kode
// beberapa baris). Tidak menyentuh DOM, jadi mudah diuji dengan Node.
// Semua fungsi tidak mengubah array masukan; hasilnya array baru.

/** Teks penuh -> daftar baris. Selalu menghasilkan minimal satu baris. */
export function splitLines(text) {
  return String(text).split("\n");
}

/** Daftar baris -> teks penuh (kebalikan splitLines). */
export function joinLines(lines) {
  return lines.join("\n");
}

/**
 * Posisi karakter di teks penuh -> { line, col }.
 * Offset di luar batas dijepit ke akhir teks.
 */
export function offsetToPos(lines, offset) {
  let remaining = Math.max(0, offset);
  for (let i = 0; i < lines.length; i++) {
    if (remaining <= lines[i].length) return { line: i, col: remaining };
    remaining -= lines[i].length + 1; // +1 untuk "\n"
  }
  const last = lines.length - 1;
  return { line: last, col: lines[last].length };
}

/** { line, col } -> posisi karakter di teks penuh. Kolom dijepit ke panjang baris. */
export function posToOffset(lines, line, col) {
  let offset = 0;
  for (let i = 0; i < line; i++) offset += lines[i].length + 1;
  return offset + Math.min(col, lines[line].length);
}

/**
 * Isi blok aktif berubah menjadi `value` yang mungkin memuat "\n" (Enter,
 * atau tempel teks beberapa baris). Baris `start`..`end` (eksklusif; satu grup)
 * diganti oleh pecahannya. `caret` = posisi kursor di dalam `value`.
 * Mengembalikan daftar baris baru + posisi kursor { line, col } di dalamnya.
 */
export function replaceRange(lines, start, end, value, caret) {
  const parts = value.split("\n");
  const next = lines.slice(0, start).concat(parts, lines.slice(end));
  const beforeCaret = value.slice(0, caret).split("\n");
  return {
    lines: next,
    line: start + beforeCaret.length - 1,
    col: beforeCaret[beforeCaret.length - 1].length,
  };
}

/** Kasus satu baris dari replaceRange (dipertahankan untuk pemanggil lama). */
export function expandLine(lines, index, value, caret) {
  return replaceRange(lines, index, index + 1, value, caret);
}

/** Teks satu grup (baris-barisnya digabung "\n") = isi textarea blok aktif. */
export function groupText(lines, group) {
  return lines.slice(group.start, group.end).join("\n");
}

/** Posisi karakter awal grup di teks penuh (dijepit bila `lines` sempat menyusut). */
export function groupStartOffset(lines, group) {
  return posToOffset(lines, Math.min(group.start, lines.length - 1), 0);
}

/**
 * { line, col } di teks penuh -> posisi di dalam textarea grup (teks grup
 * dimulai dari awal baris pertama grup).
 */
export function innerOffset(lines, group, line, col) {
  return posToOffset(lines, line, col) - groupStartOffset(lines, group);
}

/**
 * Jenis baris untuk gaya blok aktif (H4): "h1" | "h2" | "h3" | "check" |
 * "bullet" | "number" | "quote" | "paragraph". Hanya melihat awalan (spasi
 * setelah simbol wajib) dan sengaja lebih longgar dari parseBlocks: isi boleh
 * masih kosong, supaya gaya langsung muncul begitu "# " terbentuk.
 */
export function lineKind(text) {
  let m = /^(#{1,3}) /.exec(text);
  if (m) return `h${m[1].length}`;
  if (/^- \[[ xX]\] /.test(text)) return "check";
  if (text.startsWith("- ")) return "bullet";
  if (/^\d{1,3}\. /.test(text)) return "number";
  if (text.startsWith("> ")) return "quote";
  return "paragraph";
}

/**
 * Hasil bantuan mengetik dari editor.lines.js ({ text, start }, berlaku pada
 * teks penuh) -> daftar baris baru + posisi kursor { line, col }.
 */
export function fromTextResult(result) {
  const lines = splitLines(result.text);
  return { lines, ...offsetToPos(lines, result.start) };
}

/**
 * Backspace di awal baris `index`: gabungkan dengan baris di atasnya.
 * Kursor berhenti di titik sambungan. Mengembalikan null kalau sudah baris pertama.
 */
export function mergeWithPrevious(lines, index) {
  if (index <= 0) return null;
  const prev = lines[index - 1];
  const next = lines.slice(0, index - 1).concat([prev + lines[index]], lines.slice(index + 1));
  return { lines: next, line: index - 1, col: prev.length };
}

// ---------- Ketukan pada blok yang dirender ----------

// Awalan markdown yang tidak tampil sebagai teks di blok yang dirender.
const TAP_PREFIX_RE = /^(#{1,3} |- \[[ xX]\] |- |\d{1,3}\. |> )/;

/**
 * Mengubah posisi ketukan di blok yang SUDAH DIRENDER menjadi posisi kursor di
 * teks mentah. `visibleText` = teks yang tampil di blok (tanpa penanda list),
 * `visibleOffset` = jumlah karakter tampil sebelum titik ketukan. Simbol
 * markdown (**, ++, ~~, `) dilewati dengan mencocokkan karakter berurutan.
 * @param {string[]} lines
 * @param {{ kind: string, start: number, end: number }} group
 * @param {string} visibleText
 * @param {number} visibleOffset
 * @returns {{ line: number, col: number }}
 */
export function tapToPos(lines, group, visibleText, visibleOffset) {
  if (group.kind === "code") {
    // Teks tampil = baris di antara fence, disambung "\n".
    let rest = visibleOffset;
    const first = group.start + 1;
    const last = group.end - 2; // baris isi terakhir (bisa < first kalau kosong)
    for (let i = first; i <= last; i++) {
      if (rest <= lines[i].length) return { line: i, col: rest };
      rest -= lines[i].length + 1;
    }
    return last >= first ? { line: last, col: lines[last].length } : { line: first, col: 0 };
  }
  const raw = lines[group.start];
  let col = TAP_PREFIX_RE.exec(raw)?.[0].length ?? 0;
  for (let k = 0; k < visibleOffset; k++) {
    const idx = raw.indexOf(visibleText[k], col);
    if (idx < 0) return { line: group.start, col: raw.length };
    col = idx + 1;
  }
  return { line: group.start, col };
}
