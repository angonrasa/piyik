// modules/editor/editor.renderer.js
// Menampilkan hasil parser (Phase 2). Elemen dibuat lewat createElement /
// textContent, bukan innerHTML, jadi teks pengguna tidak pernah dibaca
// sebagai HTML.

import { parseBlocks, parseInline } from "./editor.parser.js";

// Gaya token -> tag pembungkus (dari dalam ke luar).
const WRAPPERS = [
  ["bold", "strong"],
  ["italic", "em"],
  ["underline", "u"],
  ["strike", "del"],
];

// Menambahkan teks inline yang sudah bergaya ke `parent`.
function appendInline(parent, text) {
  for (const token of parseInline(text)) {
    let node;
    if (token.code) {
      node = document.createElement("code");
      node.className = "md-code-inline";
      node.textContent = token.text;
    } else {
      node = document.createTextNode(token.text);
    }
    for (const [flag, tag] of WRAPPERS) {
      if (!token[flag]) continue;
      const el = document.createElement(tag);
      el.appendChild(node);
      node = el;
    }
    parent.appendChild(node);
  }
}

// Baris list: penanda + teks, dipisah supaya baris panjang rata di bawah teks.
function fillListItem(line, markerEl, text, className) {
  line.className = className;
  const body = document.createElement("span");
  body.className = "md-li-text";
  appendInline(body, text);
  line.append(markerEl, body);
}

// Callout (K1): nama default (judul) dan simbol ikon tiap tipe.
const CALLOUTS = {
  info: { name: "Info", icon: "i" },
  warning: { name: "Peringatan", icon: "!" },
  success: { name: "Berhasil", icon: "\u2713" },
  error: { name: "Galat", icon: "\u00d7" },
};

// Kartu callout: ikon bulat + judul + isi. Baris isi dipisah "\n" (container
// white-space: pre-wrap menjaganya), tiap baris tetap diurai inline.
function renderCallout(block) {
  const spec = CALLOUTS[block.variant] || CALLOUTS.info;
  const card = document.createElement("div");
  card.className = `md-callout md-callout--${block.variant}`;
  card.setAttribute("role", "note");

  const icon = document.createElement("span");
  icon.className = "md-callout-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = spec.icon;

  const main = document.createElement("div");
  main.className = "md-callout-main";
  const title = document.createElement("div");
  title.className = "md-callout-title";
  title.textContent = block.title || spec.name;
  main.appendChild(title);

  if (block.text !== "") {
    const body = document.createElement("div");
    body.className = "md-callout-body";
    block.text.split("\n").forEach((line, i) => {
      if (i > 0) body.appendChild(document.createTextNode("\n"));
      appendInline(body, line);
    });
    main.appendChild(body);
  }

  card.append(icon, main);
  return card;
}

// Tabel (L1): <table> dalam wadah yang menggulir ke samping, supaya tabel
// lebar tidak melebarkan halaman. Isi sel mendukung inline (tebal, miring, kode).
function renderTable(block) {
  const wrap = document.createElement("div");
  wrap.className = "md-table-wrap";
  const table = document.createElement("table");
  table.className = "md-table";

  const fillRow = (cells, tag) => {
    const tr = document.createElement("tr");
    for (const text of cells) {
      const cell = document.createElement(tag);
      appendInline(cell, text);
      tr.appendChild(cell);
    }
    return tr;
  };

  const thead = document.createElement("thead");
  thead.appendChild(fillRow(block.header, "th"));
  const tbody = document.createElement("tbody");
  for (const row of block.rows) tbody.appendChild(fillRow(row, "td"));
  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

/**
 * Membuat satu elemen dari satu blok hasil parser: <div> (atau <hr> untuk
 * divider). Dipakai renderMarkdown dan renderLine.
 * @param {ReturnType<typeof parseBlocks>[number]} block
 * @returns {HTMLElement}
 */
function renderBlock(block) {
  if (block.type === "divider") {
    const hr = document.createElement("hr");
    hr.className = "md-hr";
    return hr;
  }

  if (block.type === "code") {
    // <pre><code>: isi apa adanya, tanpa penguraian inline. Gaya di rich.css.
    const pre = document.createElement("pre");
    pre.className = "md-code";
    if (block.lang) pre.dataset.lang = block.lang;
    const code = document.createElement("code");
    code.textContent = block.text;
    pre.appendChild(code);
    return pre;
  }

  if (block.type === "callout") return renderCallout(block);

  if (block.type === "table") return renderTable(block);

  const line = document.createElement("div");

  if (block.type === "heading") {
    line.className = `md-h${block.level}`;
    line.setAttribute("role", "heading");
    line.setAttribute("aria-level", String(block.level));
    appendInline(line, block.text);
  } else if (block.type === "check") {
    const box = document.createElement("span");
    box.className = "md-check";
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(block.checked));
    box.setAttribute("aria-readonly", "true"); // belum bisa diklik (Backlog)
    fillListItem(line, box, block.text, block.checked ? "md-li md-li-done" : "md-li");
  } else if (block.type === "bullet" || block.type === "number") {
    const marker = document.createElement("span");
    marker.className = "md-li-marker";
    marker.textContent = block.type === "bullet" ? "•" : `${block.number}.`;
    fillListItem(line, marker, block.text, "md-li");
  } else if (block.type === "quote") {
    line.className = "md-quote";
    appendInline(line, block.text);
  } else if (block.text === "") {
    line.appendChild(document.createElement("br")); // baris kosong tetap setinggi satu baris
  } else {
    appendInline(line, block.text);
  }

  return line;
}

/**
 * Merender SATU baris markdown menjadi satu elemen. Untuk blok non-aktif
 * di editor live preview (Phase 3b). `text` tidak boleh memuat "\n"; bila
 * ada, hanya baris pertama yang dipakai.
 * @param {string} text
 * @returns {HTMLElement}
 */
export function renderLine(text) {
  return renderBlock(parseBlocks(text)[0]);
}

/**
 * Merender satu grup baris (editor blok): satu baris biasa, atau seluruh baris
 * blok kode (termasuk fence), callout, atau tabel. Hasilnya satu elemen.
 * @param {string[]} lines
 * @returns {HTMLElement}
 */
export function renderLines(lines) {
  return renderBlock(parseBlocks(lines.join("\n"))[0]);
}

/**
 * Mengisi `container` dengan teks yang sudah dirender, satu <div> per baris.
 * Spasi & baris kosong tetap terjaga lewat `white-space: pre-wrap` milik
 * container (tiap <div> mewarisinya).
 * @param {HTMLElement} container
 * @param {string} text
 */
export function renderMarkdown(container, text) {
  container.textContent = "";
  for (const block of parseBlocks(text)) container.appendChild(renderBlock(block));
}

// Satu baris tanpa simbol inline.
function stripInline(text) {
  return parseInline(text)
    .map((token) => token.text)
    .join("");
}

/**
 * Teks tanpa simbol markdown, untuk cuplikan di daftar catatan.
 * Hanya tampilan; isi catatan tidak diubah.
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdown(text) {
  return parseBlocks(text)
    .map((block) => {
      if (block.type === "code") return block.text; // isi kode apa adanya
      if (block.type === "callout") {
        return [block.title, ...block.text.split("\n").map(stripInline)].filter(Boolean).join("\n");
      }
      if (block.type === "table") {
        return [block.header, ...block.rows].map((cells) => cells.map(stripInline).filter(Boolean).join(" ")).join("\n");
      }
      return stripInline(block.text);
    })
    .join("\n");
}
