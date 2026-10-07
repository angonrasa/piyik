// modules/editor/editor.lines.js
// Logika murni untuk awalan di awal baris (Phase 2 - D3/D4). Dipakai ulang
// oleh heading, bullet, number, checklist, dan quote. Tidak menyentuh DOM.

// Semua awalan blok yang saling menggantikan (satu baris = satu jenis blok).
// Format baru (checklist, quote) ditambahkan ke sini.
// Checklist harus sebelum bullet: "- [ ] " juga diawali "- ".
export const BLOCK_PREFIX = /^(?:#{1,3} |- \[[ xX]\] |- |\d{1,3}\. |> )/;

/**
 * Memasang/melepas awalan di awal baris-baris yang kena pilihan.
 * - Baris kosong dilewati kalau pilihan mencakup lebih dari satu baris;
 *   baris yang dilewati tidak memakai nomor.
 * - Baris pertama yang dituju menentukan arah: kalau sudah cocok `match`
 *   -> lepas dari semua baris yang cocok; selain itu -> pasang di semua
 *   baris (awalan blok lain yang cocok `strip` diganti, mis. "- " -> "1. ").
 * - Pilihan ikut bergeser; kursor di baris kosong berakhir setelah awalan.
 * @param {string} text - isi lengkap textarea
 * @param {number} start - awal pilihan
 * @param {number} end - akhir pilihan
 * @param {Object} format
 * @param {(i: number) => string} format.make - awalan untuk baris ke-i (mulai 0) di antara baris yang dituju
 * @param {RegExp} format.match - awalan format ini yang sudah terpasang
 * @param {RegExp} format.strip - awalan blok apa pun yang harus diganti (BLOCK_PREFIX)
 * @param {boolean} [format.keepMatched] - saat memasang, baris yang sudah cocok `match` dibiarkan (mis. checklist yang sudah tercentang tidak direset)
 * @returns {{ text: string, start: number, end: number }}
 */
export function toggleLinePrefix(text, start, end, { make, match, strip, keepMatched = false }) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  // Pilihan yang berakhir tepat setelah "\n" tidak ikut menyentuh baris berikutnya.
  const effEnd = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const nl = text.indexOf("\n", effEnd);
  const lineEnd = nl === -1 ? text.length : nl;

  const lines = text.slice(lineStart, lineEnd).split("\n");
  const skipEmpty = lines.length > 1;
  const targets = lines.map((line) => !(skipEmpty && line === ""));
  const first = lines.findIndex((_, i) => targets[i]);
  if (first === -1) return { text, start, end };

  const removing = match.test(lines[first]);

  // Per baris: berapa karakter dibuang (r) dan ditambah (a) di awal baris.
  let k = 0; // urutan di antara baris yang dituju
  const changes = lines.map((line, i) => {
    if (!targets[i]) return { line, r: 0, a: 0 };
    if (removing) {
      const m = line.match(match);
      return m ? { line: line.slice(m[0].length), r: m[0].length, a: 0 } : { line, r: 0, a: 0 };
    }
    if (keepMatched && match.test(line)) return { line, r: 0, a: 0 };
    const old = line.match(strip);
    const r = old ? old[0].length : 0;
    const prefix = make(k++);
    return { line: prefix + line.slice(r), r, a: prefix.length };
  });

  const newBlock = changes.map((c) => c.line).join("\n");
  const totalDelta = newBlock.length - (lineEnd - lineStart);

  // Petakan posisi lama -> posisi baru.
  function mapPos(pos) {
    if (pos < lineStart) return pos;
    if (pos > lineEnd) return pos + totalDelta;
    let origStart = lineStart;
    let newStart = lineStart;
    for (let i = 0; i < lines.length; i++) {
      const { r, a, line } = changes[i];
      const origLen = lines[i].length;
      if (pos <= origStart + origLen) {
        const col = pos - origStart;
        return newStart + (col <= r ? a : col - r + a);
      }
      origStart += origLen + 1;
      newStart += line.length + 1;
    }
    return pos + totalDelta;
  }

  return {
    text: text.slice(0, lineStart) + newBlock + text.slice(lineEnd),
    start: mapPos(start),
    end: mapPos(end),
  };
}

// Baris divider: "---" (spasi di belakang diabaikan).
export const DIVIDER_LINE = /^---[ \t]*$/;

/**
 * Divider bukan awalan, tapi baris sisipan:
 * - baris kursor berisi teks -> "---" disisipkan sebagai baris baru di bawahnya
 * - baris kursor kosong -> baris itu menjadi "---"
 * - baris kursor sudah "---" -> baris dihapus (toggle)
 * Kursor berakhir di baris di bawah divider; kalau divider di akhir teks,
 * baris kosong dibuat supaya langsung bisa mengetik.
 * @param {string} text
 * @param {number} pos - posisi kursor
 * @returns {{ text: string, start: number, end: number }}
 */
export function toggleDivider(text, pos) {
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const nl = text.indexOf("\n", pos);
  const lineEnd = nl === -1 ? text.length : nl;
  const line = text.slice(lineStart, lineEnd);
  const hasNext = lineEnd < text.length;

  // Hapus divider (beserta satu pemisah baris).
  if (DIVIDER_LINE.test(line)) {
    if (hasNext) return caret(text.slice(0, lineStart) + text.slice(lineEnd + 1), lineStart);
    if (lineStart > 0) return caret(text.slice(0, lineStart - 1), lineStart - 1);
    return caret("", 0);
  }

  // Baris kosong dipakai ulang; baris berisi dapat divider di bawahnya.
  const isBlank = line.trim() === "";
  const before = text.slice(0, isBlank ? lineStart : lineEnd);
  const after = text.slice(lineEnd);
  const inserted = isBlank ? "---" : "\n---";

  if (!hasNext) return caret(before + inserted + "\n", before.length + inserted.length + 1);
  return caret(before + inserted + after, before.length + inserted.length + 1);
}

function caret(text, pos) {
  return { text, start: pos, end: pos };
}

// Awalan list yang dilanjutkan saat Enter (Phase 3 - E3). Heading tidak
// termasuk. Checklist harus sebelum bullet: "- [ ] " juga diawali "- ".
const LIST_PREFIX = /^(?:- \[[ xX]\] |- |(\d{1,3})\. |> )/;

/**
 * Enter di item list -> baris baru dengan awalan berikutnya:
 *   "- x" -> "- "   "1. x" -> "2. "   "- [x] x" -> "- [ ] "   "> x" -> "> "
 * Sisa teks di kanan kursor ikut ke item baru, dan nomor item berurutan di
 * bawahnya ikut naik. Mengembalikan null (Enter
 * biasa) kalau: ada teks terpilih, baris bukan item list, kursor di dalam
 * awalan, atau item masih kosong (keluar dari list = exitList, E4).
 * @param {string} text
 * @param {number} start - awal pilihan
 * @param {number} end - akhir pilihan
 * @returns {{ text: string, start: number, end: number } | null}
 */
export function continueList(text, start, end) {
  if (start !== end) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", start);
  const lineEnd = nl === -1 ? text.length : nl;
  const line = text.slice(lineStart, lineEnd);

  const match = line.match(LIST_PREFIX);
  if (!match) return null;
  const prefixLen = match[0].length;
  if (start - lineStart <= prefixLen) return null;
  if (line.slice(prefixLen).trim() === "") return null;

  let next = match[0];
  if (match[1] !== undefined) next = `${Number(match[1]) + 1}. `;
  else if (/^- \[[ xX]\] $/.test(match[0])) next = "- [ ] ";

  const inserted = "\n" + next;
  // Item bernomor disisip di tengah list: nomor item di bawahnya ikut naik.
  const rest = match[1] !== undefined ? renumberFollowing(text.slice(lineEnd), Number(match[1])) : text.slice(lineEnd);
  // Spasi di awal sisa teks tidak ikut ke item baru (kursor di antara dua kata).
  const tail = text.slice(start, lineEnd).replace(/^[ \t]+/, "");
  return {
    text: text.slice(0, start) + inserted + tail + rest,
    start: start + inserted.length,
    end: start + inserted.length,
  };
}

/**
 * Smart formatting (Phase 3 - F1). Spasi diketik tepat setelah "[]", "[ ]",
 * "[x]", atau "[X]" yang jadi satu-satunya isi baris -> baris menjadi
 * "- [ ] " / "- [x] " dan kursor di belakangnya (spasi yang diketik sudah
 * termasuk di awalan). Hanya di kolom 0. Mengembalikan null (spasi biasa)
 * kalau: ada teks terpilih, ada teks di kanan kursor, atau isi baris bukan
 * salah satu bentuk di atas.
 * @param {string} text
 * @param {number} start - awal pilihan
 * @param {number} end - akhir pilihan
 * @returns {{ text: string, start: number, end: number } | null}
 */
export function smartChecklist(text, start, end) {
  if (start !== end) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", start);
  const lineEnd = nl === -1 ? text.length : nl;
  if (lineEnd !== start) return null; // masih ada teks di kanan kursor

  const m = text.slice(lineStart, start).match(/^\[([ xX]?)\]$/);
  if (!m) return null;

  const prefix = m[1].toLowerCase() === "x" ? "- [x] " : "- [ ] ";
  return caret(text.slice(0, lineStart) + prefix + text.slice(lineEnd), lineStart + prefix.length);
}

/**
 * Auto indent (Phase 3 - E6). Enter di baris biasa yang diawali spasi/tab ->
 * baris baru memakai spasi/tab yang sama (seperti editor kode). Baris yang
 * hanya berisi spasi juga disalin. Hanya bagian indent di kiri kursor yang
 * disalin (kursor di awal baris -> tidak ada indent). Spasi di awal sisa
 * teks yang pindah ke baris baru dibuang supaya indent tidak dobel.
 * Mengembalikan null (Enter biasa) kalau: ada teks terpilih atau baris tidak
 * berindent. Awalan list/heading hanya dikenali di kolom 0, jadi baris
 * berindent tidak pernah bentrok dengan continueList.
 * @param {string} text
 * @param {number} start - awal pilihan
 * @param {number} end - akhir pilihan
 * @returns {{ text: string, start: number, end: number } | null}
 */
export function continueIndent(text, start, end) {
  if (start !== end) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", start);
  const lineEnd = nl === -1 ? text.length : nl;
  const line = text.slice(lineStart, lineEnd);

  const indent = line.match(/^[ \t]*/)[0].slice(0, start - lineStart);
  if (indent === "") return null;

  const tail = text.slice(start, lineEnd).replace(/^[ \t]+/, "");
  const pos = start + 1 + indent.length;
  return {
    text: text.slice(0, start) + "\n" + indent + tail + text.slice(lineEnd),
    start: pos,
    end: pos,
  };
}

/**
 * Keluar dari list (Phase 3 - E4). Dipakai untuk Enter dan Backspace di item
 * kosong: awalan dihapus, baris jadi kosong, kursor di awal baris.
 * Mengembalikan null (perilaku biasa) kalau: ada teks terpilih, baris bukan
 * item list, item masih berisi teks, atau kursor di dalam awalan.
 * @param {string} text
 * @param {number} start - awal pilihan
 * @param {number} end - akhir pilihan
 * @returns {{ text: string, start: number, end: number } | null}
 */
export function exitList(text, start, end) {
  if (start !== end) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", start);
  const lineEnd = nl === -1 ? text.length : nl;
  const line = text.slice(lineStart, lineEnd);

  const match = line.match(LIST_PREFIX);
  if (!match) return null;
  if (line.slice(match[0].length).trim() !== "") return null;
  if (start - lineStart < match[0].length) return null;

  return caret(text.slice(0, lineStart) + text.slice(lineEnd), lineStart);
}

/**
 * Nomor awal untuk tombol Number (Phase 3 - E5). Kalau baris tepat di atas
 * baris pertama pilihan berbentuk "N. ...", hasilnya N + 1; selain itu 1.
 * Nomor lain di dokumen tidak diubah.
 * @param {string} text
 * @param {number} start - awal pilihan
 * @returns {number}
 */
export function numberStartFor(text, start) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  if (lineStart === 0) return 1;
  const prevStart = text.lastIndexOf("\n", lineStart - 2) + 1;
  const m = text.slice(prevStart, lineStart - 1).match(/^(\d{1,3})\. /);
  return m ? Math.min(Number(m[1]) + 1, 999) : 1;
}

// `rest` = teks mulai dari akhir baris item ("\n" + baris-baris di bawahnya).
// Baris bernomor yang berurutan langsung setelah item asli (n+1, n+2, ...)
// dinaikkan satu. Berhenti di baris pertama yang bukan lanjutan berurutan,
// jadi nomor yang sengaja berbeda tidak diubah.
function renumberFollowing(rest, n) {
  const parts = rest.split("\n"); // parts[0] selalu "" (rest diawali "\n" atau kosong)
  let orig = n;
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^(\d{1,3})\. /);
    if (!m || Number(m[1]) !== orig + 1) break;
    orig += 1;
    parts[i] = `${orig + 1}. ` + parts[i].slice(m[0].length);
  }
  return parts.join("\n");
}

// Tipe callout yang bisa disisipkan (Phase 5 - K2); sama dengan detektor di editor.groups.js.
export const CALLOUT_VARIANTS = ["info", "warning", "success", "error"];

/**
 * Menyisipkan callout (Phase 5 - K2, item Info/Peringatan/Berhasil/Galat di
 * menu +): baris "> [!tipe]" dan baris isi "> ", kursor di akhir baris isi.
 * - Baris kursor kosong: dipakai ulang untuk callout.
 * - Baris kursor berisi: callout disisip di bawahnya. Kalau baris itu bagian
 *   dari deretan baris ">" (quote/callout), callout disisip setelah deretan
 *   itu supaya tidak memotongnya.
 * - Teks tidak pernah dihapus; kalau ada pilihan, titik sisip = baris tempat
 *   pilihan berakhir.
 * - Baris ">" tepat di bawah titik sisip dipisah baris kosong supaya tidak
 *   menempel jadi isi callout baru.
 * @param {string} text - teks penuh
 * @param {number} start - awal pilihan / kursor
 * @param {number} end - akhir pilihan
 * @param {string} variant - salah satu CALLOUT_VARIANTS
 * @returns {{ text: string, start: number, end: number }}
 */
export function insertCallout(text, start, end, variant) {
  // Pilihan yang berakhir tepat setelah "\n" tidak ikut menyentuh baris berikutnya.
  const pos = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const lineStart = pos > 0 ? text.lastIndexOf("\n", pos - 1) + 1 : 0;
  let lineEnd = text.indexOf("\n", pos);
  if (lineEnd < 0) lineEnd = text.length;

  const isBlank = lineStart === lineEnd;
  if (!isBlank && text[lineStart] === ">") {
    // Maju sampai baris ">" terakhir dari deretan ini.
    while (lineEnd < text.length && text[lineEnd + 1] === ">") {
      const next = text.indexOf("\n", lineEnd + 1);
      lineEnd = next < 0 ? text.length : next;
    }
  }

  const block = `> [!${variant}]\n> `;
  const before = isBlank ? text.slice(0, lineStart) : `${text.slice(0, lineEnd)}\n`;
  const after = text.slice(lineEnd);
  const cursor = before.length + block.length;
  const gap = after.startsWith("\n>") ? "\n" : "";
  return { text: before + block + gap + after, start: cursor, end: cursor };
}
