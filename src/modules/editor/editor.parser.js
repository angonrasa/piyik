// modules/editor/editor.parser.js
// Mengurai markdown menjadi blok per baris + token inline (Phase 2). Hanya
// sintaks yang sudah didukung (YAGNI); sintaks baru ditambahkan per subtask.
// Tidak ada HTML.
//
// Blok: heading "# ", "## ", "### " di awal baris (spasi wajib, isi tidak
// kosong; "#tag" atau "####" tetap teks biasa), bullet "- ", nomor "1. "
// (1-3 digit), dan checklist "- [ ] " / "- [x] ", quote "> ", dan divider "---" (satu baris
// penuh). Spasi & isi tidak kosong juga wajib. Selain itu paragraf.
//
// Inline: **tebal**, *miring*, ***tebal miring***, ++garis bawah++,
// ~~coret~~, `kode`. Gaya boleh bertumpuk, mis. **tebal *miring***.
// Isi `kode` tidak diurai lagi (tanda ** di dalamnya tetap teks biasa).
//
// Callout (Phase 5 - K1): "> [!info]" (atau warning/success/error) + baris ">"
// berikutnya menjadi satu blok { type: "callout" }; lihat editor.groups.js.
//
// Tabel (Phase 5 - L1): baris "|a|b|" + pemisah "|---|---|" + baris "|...|"
// menjadi satu blok { type: "table", header, rows }; lihat editor.groups.js.
// Jumlah sel per baris disamakan (kurang = sel kosong); rata kolom diabaikan.
//
// Blok kode (Phase 5 - J1): baris ``` ... baris ``` (berpenutup) menjadi satu
// blok { type: "code" }. Pengelompokannya dari editor.groups.js, dipakai
// bersama editor blok.

import { groupLines, splitTableRow } from "./editor.groups.js";

// Tipe catatan yang isinya bukan markdown: Tugas (format checklist sendiri)
// dan Lagu (editor sendiri). Toolbar format tidak muncul & isi tidak dirender.
export const PLAIN_TEXT_TYPES = ["tugas", "song"];

// Isi tidak boleh diawali/diakhiri spasi dan tidak melewati baris.
// "??" (malas) penting: tanpa itu "**a** x **b**" tergabung jadi satu.
const BODY = "(\\S(?:.*?\\S)??)";

// Urutan = prioritas saat dua aturan cocok di posisi yang sama
// (mis. "***x***" harus dibaca tebal+miring, bukan tebal berisi "*x").
// "(?!\\*)" di penutup: "**a *b***" tidak menyisakan satu "*" liar.
const RULES = [
  // Kode inline lebih dulu: isinya dilindungi dari aturan lain (lihat parseInto).
  { re: /`([^`\n]+)`/, style: { code: true } },
  { re: new RegExp(`\\*\\*\\*${BODY}\\*\\*\\*(?!\\*)`), style: { bold: true, italic: true } },
  { re: new RegExp(`\\*\\*${BODY}\\*\\*(?!\\*)`), style: { bold: true } },
  { re: new RegExp(`\\+\\+${BODY}\\+\\+`), style: { underline: true } },
  { re: new RegExp(`~~${BODY}~~`), style: { strike: true } },
  // Miring: isi tanpa bintang lain, supaya tidak mencuri bintang tebal.
  { re: /\*([^*\s](?:[^*\n]*?[^*\s])??)\*/, style: { italic: true } },
];

const NO_STYLE = { bold: false, italic: false, underline: false, strike: false };

function parseInto(text, style, tokens) {
  while (text) {
    // Cari aturan yang cocok paling awal; seri dimenangkan urutan RULES.
    let best = null;
    for (const rule of RULES) {
      const match = rule.re.exec(text);
      if (match && (!best || match.index < best.match.index)) best = { rule, match };
    }

    if (!best) {
      tokens.push({ text, ...style });
      return;
    }

    const { rule, match } = best;
    if (match.index > 0) tokens.push({ text: text.slice(0, match.index), ...style });
    if (rule.style.code) {
      tokens.push({ text: match[1], ...style, code: true }); // isi kode apa adanya
    } else {
      parseInto(match[1], { ...style, ...rule.style }, tokens); // gaya bertumpuk
    }
    text = text.slice(match.index + match[0].length);
  }
}

/**
 * @param {string} text
 * @returns {Array<{ text: string, bold: boolean, italic: boolean, underline: boolean, strike: boolean, code?: true }>}
 *   `code` hanya ada (true) pada token kode inline.
 */
export function parseInline(text) {
  const tokens = [];
  parseInto(text, NO_STYLE, tokens);
  return tokens;
}

// Heading: 1-3 tanda "#", satu spasi, lalu isi yang memuat minimal satu
// karakter bukan-spasi.
const HEADING_RE = /^(#{1,3}) (.*\S.*)$/;

const CHECK_RE = /^- \[([ xX])\] (.*\S.*)$/;
// Bullet tidak boleh menelan checklist (termasuk checklist kosong "- [ ] ").
const QUOTE_RE = /^> (.*\S.*)$/;
const DIVIDER_RE = /^---[ \t]*$/;
const BULLET_RE = /^- (?!\[[ xX]\] )(.*\S.*)$/;
const NUMBER_RE = /^(\d{1,3})\. (.*\S.*)$/;

/**
 * Memecah teks per baris menjadi blok. Nomor list dipertahankan sesuai tulisan.
 * @param {string} text
 * @returns {Array<
 *   { type: "paragraph", text: string } |
 *   { type: "heading", level: number, text: string } |
 *   { type: "bullet", text: string } |
 *   { type: "check", checked: boolean, text: string } |
 *   { type: "quote", text: string } |
 *   { type: "divider", text: "" } |
 *   { type: "code", lang: string, text: string } |
 *   { type: "callout", variant: string, title: string, text: string } |
 *   { type: "table", header: string[], rows: string[][] } |
 *   { type: "number", number: number, text: string }>}
 *   Blok "code": `text` = isi di antara fence (tanpa baris fence), `lang` =
 *   kata setelah fence pembuka. Blok "callout": `variant` = info | warning |
 *   success | error, `title` = teks setelah "[!tipe]" (bisa kosong), `text` =
 *   isi (baris ">" berikutnya tanpa awalan "> ", disambung "\n"). Blok "table":
 *   `header` dan tiap baris di `rows` berisi sel (teks mentah, belum diurai
 *   inline) dengan jumlah sel sama.
 */
export function parseBlocks(text) {
  const lines = text.split("\n");
  return groupLines(lines).map((group) => {
    if (group.kind === "code") {
      return { type: "code", lang: group.meta.lang, text: lines.slice(group.start + 1, group.end - 1).join("\n") };
    }
    if (group.kind === "callout") {
      const body = lines.slice(group.start + 1, group.end).map((l) => l.replace(/^> ?/, ""));
      return { type: "callout", variant: group.meta.variant, title: group.meta.title, text: body.join("\n") };
    }
    if (group.kind === "table") return parseTable(lines.slice(group.start, group.end));
    return parseLine(lines[group.start]);
  });
}

// Baris tabel (header, pemisah, isi) -> blok. Semua baris diisi sel kosong
// sampai selebar baris terlebar, jadi tidak ada sel yang hilang.
function parseTable(tableLines) {
  const header = splitTableRow(tableLines[0]);
  const rows = tableLines.slice(2).map(splitTableRow);
  const cols = Math.max(header.length, ...rows.map((r) => r.length));
  const pad = (cells) => cells.concat(Array(cols - cells.length).fill(""));
  return { type: "table", header: pad(header), rows: rows.map(pad) };
}

// Satu baris biasa -> blok.
function parseLine(line) {
  let m = HEADING_RE.exec(line);
  if (m) return { type: "heading", level: m[1].length, text: m[2].trim() };
  m = CHECK_RE.exec(line);
  if (m) return { type: "check", checked: m[1] !== " ", text: m[2].trim() };
  m = BULLET_RE.exec(line);
  if (m) return { type: "bullet", text: m[1].trim() };
  m = NUMBER_RE.exec(line);
  if (m) return { type: "number", number: Number(m[1]), text: m[2].trim() };
  m = QUOTE_RE.exec(line);
  if (m) return { type: "quote", text: m[1].trim() };
  if (DIVIDER_RE.test(line)) return { type: "divider", text: "" };
  return { type: "paragraph", text: line };
}
