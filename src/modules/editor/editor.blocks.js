// modules/editor/editor.blocks.js
// Editor blok (Phase 3b - H2): isi catatan tampil sebagai daftar blok.
// Blok = grup baris dari editor.groups.js (I2): umumnya satu baris Markdown,
// tapi blok kode (fence ``` ... ```) memuat beberapa baris. Blok aktif =
// textarea berisi markdown mentah satu grup; blok lain dirender (renderLines,
// sama dengan Detail; blok kode J1 ikut).
// Posisi kursor yang dibawa antar fungsi tetap { line, col } di teks penuh;
// hanya textarea blok aktif yang memakai posisi relatif terhadap grupnya.
//
// Textarea asli (contentEl) tetap ada di DOM tapi disembunyikan, dan tetap
// menjadi sumber kebenaran teks penuh. Tiap ketikan di blok aktif mengisi
// contentEl.value lalu memicu event "input" di contentEl, jadi riwayat, auto
// save, dan hitung kata jalan tanpa diubah. Modul ini tidak menyentuh database.
//
// H3: Enter, Backspace, dan spasi memakai ulang bantuan mengetik dari
// editor.lines.js (list, indent, checklist) pada teks penuh, sama seperti
// editor.typing.js, jadi penomoran ulang item di bawahnya ikut jalan.
//
// H5: toolbar, CTRL virtual, dan shortcut memakai `target`, adapter berbentuk
// textarea (value, selectionStart/End, setSelectionRange, dispatchEvent) di
// atas daftar blok, jadi editor.formatter.js dan editor.shortcuts.js tidak
// perlu tahu soal blok. Seleksi dan format lintas baris belum didukung.
//
// I3: di dalam blok kode bantuan mengetik list dimatikan (lanjut list, keluar
// list, "[]" -> checklist); hanya salin indent yang tetap jalan. Perubahan
// jenis blok aktif dilaporkan lewat onKindChange (dipakai untuk meredupkan
// tombol format di bar).
//
// J2: Enter di akhir baris "```" (belum berpenutup) menambah baris kosong +
// fence penutup, kursor di antara keduanya (editor.fence.js).
//
// K2: blok aktif callout memakai bantuan quote yang sudah ada (Enter melanjutkan
// "> ", Enter/Backspace di "> " kosong keluar dari callout); tidak ada kode baru
// di jalur Enter. Yang ditambah hanya data-kind/data-variant untuk gaya.
//
// H6: mode blok sekarang default (flag dihapus). Hanya aktif untuk tipe selain
// Tugas/Lagu (PLAIN_TEXT_TYPES); keduanya tetap memakai textarea biasa.

import { PLAIN_TEXT_TYPES } from "./editor.parser.js";
import { continueList, exitList, continueIndent, smartChecklist } from "./editor.lines.js";
import { smartCodeFence } from "./editor.fence.js";
import { renderLines } from "./editor.renderer.js";
import { groupLines, findGroup, groupsSignature } from "./editor.groups.js";
import {
  splitLines,
  joinLines,
  offsetToPos,
  posToOffset,
  replaceRange,
  groupText,
  groupStartOffset,
  innerOffset,
  mergeWithPrevious,
  tapToPos,
  fromTextResult,
  lineKind,
} from "./editor.blocklines.js";

const HIDDEN_CLASS = "content-textarea--blocks"; // menyembunyikan contentEl (editor.css)

/**
 * @param {Object} options
 * @param {HTMLTextAreaElement} options.contentEl - textarea asli (disembunyikan saat mode blok aktif)
 * @param {HTMLSelectElement} options.typeEl
 * @param {(kind: string) => void} [options.onKindChange] - dipanggil saat jenis
 *   blok aktif berganti ("code" | "line"); dipakai controller untuk bar format
 * @returns {{
 *   inputEl: HTMLTextAreaElement,
 *   target: Object,
 *   reset: () => void,
 *   refresh: () => void,
 * }}
 */
export function createBlockEditor({ contentEl, typeEl, onKindChange }) {
  const container = document.createElement("div");
  container.className = "block-editor";
  container.hidden = true;
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Isi catatan");

  // Satu textarea dipakai berulang: dipindah ke blok yang sedang aktif.
  const input = document.createElement("textarea");
  input.className = "block-input";
  input.rows = 1;
  input.setAttribute("aria-label", "Isi baris");

  contentEl.after(container);

  let lines = [""];
  let groups = groupLines(lines); // grup baris yang sedang tampil
  let activeLine = -1; // baris kursor di teks penuh; -1 = tidak ada blok aktif
  let activeGroup = null; // grup yang memuat activeLine (isi textarea blok aktif)
  let on = false;
  let activeBlock = null; // elemen .block yang memegang textarea (untuk data-kind)

  // ---------- Tampilan ----------

  function isEmptyDoc() {
    return lines.length === 1 && lines[0] === "";
  }

  function updatePlaceholder() {
    input.placeholder = isEmptyDoc() ? contentEl.placeholder : "";
  }

  // Tinggi textarea mengikuti isi. Gaya `field-sizing: content` (editor.css)
  // sudah cukup di Chrome baru; ini cadangan untuk WebView yang belum punya.
  function autosize() {
    input.style.height = "auto";
    if (input.scrollHeight) input.style.height = `${input.scrollHeight}px`;
  }

  // Gaya baris aktif mengikuti awalannya (H4); simbol tetap terlihat.
  // Blok kode (I2) punya gaya sendiri: monospace, tanpa bungkus baris.
  // Callout (K2): data-kind="callout" + data-variant (tipe dari header, ikut
  // berubah saat header diedit) dipakai rich.css untuk warna blok aktif.
  function updateKind() {
    reportKind();
    if (!activeBlock) return;
    const kind = activeGroup?.kind;
    activeBlock.dataset.kind = kind === "code" || kind === "callout" ? kind : lineKind(input.value);
    if (kind === "callout") activeBlock.dataset.variant = activeGroup.meta.variant;
    else delete activeBlock.dataset.variant;
  }

  // Memberi tahu pemanggil kalau jenis blok aktif berganti (hanya saat berubah).
  let reportedKind = "line";
  function reportKind() {
    const kind = activeGroup?.kind === "code" ? "code" : "line";
    if (kind === reportedKind) return;
    reportedKind = kind;
    onKindChange?.(kind);
  }

  const inCode = () => activeGroup?.kind === "code";

  // Tampilan blok yang tidak aktif: baris biasa atau blok kode (J1), dirender
  // renderer yang sama dengan Detail.
  function renderGroup(group) {
    return renderLines(lines.slice(group.start, group.end)) || document.createElement("p");
  }

  // Menyusun ulang seluruh daftar blok. Hanya dipanggil saat struktur atau
  // blok aktif berubah, bukan tiap ketikan (supaya fokus & keyboard HP tetap).
  function renderAll() {
    const fragment = document.createDocumentFragment();
    activeBlock = null;
    groups = groupLines(lines);
    activeGroup = activeLine >= 0 ? findGroup(groups, activeLine) : null;
    groups.forEach((group) => {
      const block = document.createElement("div");
      block.className = "block";
      block.dataset.index = String(group.start); // baris pertama grup
      block.dataset.end = String(group.end); // eksklusif
      if (group === activeGroup) {
        block.classList.add("block--active");
        input.value = groupText(lines, group);
        block.appendChild(input);
        activeBlock = block;
      } else {
        block.appendChild(renderGroup(group));
      }
      fragment.appendChild(block);
    });
    container.textContent = "";
    container.appendChild(fragment);
    updatePlaceholder();
    updateKind();
    autosize();
  }

  // Menjaga blok aktif tetap terlihat di atas bar format + keyboard virtual.
  // Ruang yang disisakan diatur CSS lewat scroll-margin-bottom (editor.css).
  // Yang dijaga terlihat adalah BARIS KURSOR, bukan seluruh blok: blok yang
  // tinggi (kode panjang, paragraf bungkus banyak baris) tidak boleh membuat
  // layar tertahan di atas blok sementara kursor ada di bawah.
  const MIRROR_PROPS = [
    "boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "fontStyle",
    "letterSpacing", "lineHeight", "paddingTop", "paddingRight", "paddingBottom",
    "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
    "borderLeftWidth", "whiteSpace", "overflowWrap", "wordBreak", "tabSize",
  ];

  // Posisi vertikal kursor di dalam textarea blok aktif (px dari tepi atas
  // textarea), diukur lewat salinan tersembunyi teks sampai kursor.
  function measureCaret() {
    const cs = getComputedStyle(input);
    const mirror = document.createElement("div");
    MIRROR_PROPS.forEach((prop) => (mirror.style[prop] = cs[prop]));
    Object.assign(mirror.style, { position: "absolute", visibility: "hidden", top: "0", left: "-9999px", height: "auto", overflow: "hidden" });
    mirror.textContent = input.value.slice(0, input.selectionStart);
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const top = marker.offsetTop - input.scrollTop;
    const height = parseFloat(cs.lineHeight) || marker.offsetHeight;
    mirror.remove();
    return { top, height };
  }

  function keepActiveVisible() {
    if (!activeBlock) return;
    if (document.activeElement !== input) {
      activeBlock.scrollIntoView({ block: "nearest" });
      return;
    }
    // Penanda setinggi satu baris tepat di baris kursor; scrollIntoView memakai
    // scroll-margin-nya (.caret-marker di editor.css) untuk menghindari bar + keyboard.
    const { top, height } = measureCaret();
    const marker = document.createElement("span");
    marker.className = "caret-marker";
    Object.assign(marker.style, { top: `${top}px`, height: `${height}px` });
    activeBlock.appendChild(marker);
    marker.scrollIntoView({ block: "nearest" });
    marker.remove();
  }

  // Menjadikan grup yang memuat baris `line` blok aktif, kursor di kolom `col`
  // baris itu.
  function activate(line, col, focus) {
    activeLine = line;
    renderAll();
    if (!activeGroup) return;
    const inner = innerOffset(lines, activeGroup, line, col);
    input.setSelectionRange(inner, inner);
    if (focus) {
      input.focus({ preventScroll: true });
      keepActiveVisible();
    }
  }

  // ---------- Sinkron ke textarea asli ----------

  // Mengisi contentEl dan memberi tahu modul lain lewat event "input".
  function syncToTextarea(line, col) {
    contentEl.value = joinLines(lines);
    const offset = posToOffset(lines, line, col);
    try {
      contentEl.setSelectionRange(offset, offset);
    } catch {
      // abaikan: kursor contentEl hanya dipakai untuk undo/redo
    }
    contentEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ---------- Adapter berbentuk textarea untuk formatter & shortcuts (H5) ----------

  // Pola pakai formatter: set value -> setSelectionRange -> scrollTop ->
  // dispatchEvent("input") -> focus. Nilai baru ditampung di `lines`, kursor
  // ditampung di `pendingSelection`, dan semuanya dikomit di dispatchEvent.
  let pendingSelection = null;
  // Posisi di textarea blok aktif -> posisi di teks penuh. Tanpa blok aktif
  // dianggap grup pertama (sama seperti perilaku lama).
  function toFullOffset(inner) {
    return groupStartOffset(lines, activeGroup || groups[0]) + inner;
  }

  function commitTarget() {
    const sel = pendingSelection || { start: 0, end: 0 };
    pendingSelection = null;
    const from = offsetToPos(lines, sel.start);
    const to = offsetToPos(lines, sel.end);
    syncToTextarea(from.line, from.col);
    activate(from.line, from.col, true);
    // Pilihan hanya dipertahankan bila masih dalam satu grup (blok).
    if (activeGroup && findGroup(groups, to.line) === activeGroup && (to.line !== from.line || to.col !== from.col)) {
      input.setSelectionRange(
        innerOffset(lines, activeGroup, from.line, from.col),
        innerOffset(lines, activeGroup, to.line, to.col),
      );
    }
  }

  const target = {
    get value() {
      return joinLines(lines);
    },
    set value(text) {
      lines = splitLines(text);
    },
    get selectionStart() {
      return toFullOffset(input.selectionStart);
    },
    get selectionEnd() {
      return toFullOffset(input.selectionEnd);
    },
    get scrollTop() {
      return 0;
    },
    set scrollTop(_value) {},
    setSelectionRange(start, end) {
      pendingSelection = { start, end };
    },
    dispatchEvent() {
      commitTarget();
      return true;
    },
    focus() {}, // activate() sudah memfokuskan textarea blok
    // Ctrl+A di editor blok: pilih seluruh baris aktif saja.
    selectActiveLine() {
      input.setSelectionRange(0, input.value.length);
    },
  };

  // ---------- Pemuatan dari contentEl ----------

  /** Baca ulang teks dari contentEl, tanpa blok aktif (kecuali catatan kosong). */
  function reset() {
    if (!on) return;
    lines = splitLines(contentEl.value);
    activeLine = isEmptyDoc() ? 0 : -1;
    renderAll();
  }

  /**
   * Dipanggil setelah kode lain mengubah contentEl.value (undo/redo): blok aktif
   * pindah ke baris tempat kursor contentEl berada. Fokus dipertahankan kalau
   * sebelumnya ada di blok aktif.
   */
  function refresh() {
    if (!on) return;
    const hadFocus = document.activeElement === input;
    lines = splitLines(contentEl.value);
    const pos = offsetToPos(lines, contentEl.selectionStart);
    activate(pos.line, pos.col, hadFocus);
  }

  // Aktif hanya untuk tipe selain Tugas/Lagu. Dipanggil saat awal dan tiap tipe berubah.
  function applyMode() {
    const next = !PLAIN_TEXT_TYPES.includes(typeEl.value);
    if (next !== on) {
      on = next;
      container.hidden = !on;
      contentEl.classList.toggle(HIDDEN_CLASS, on);
    }
    reset();
  }

  // ---------- Interaksi ----------

  // Ketikan di blok aktif. Isi textarea menggantikan seluruh baris grup.
  // Nilainya bisa memuat "\n" (Enter, tempel teks beberapa baris, atau Enter
  // di dalam blok kode). Setelah itu grup dihitung ulang: kalau susunan blok
  // berubah (baris dipecah, fence berpasangan/lepas), tampilan disusun ulang
  // dan blok aktif mengikuti kursor; kalau tidak, cukup perbarui gaya & tinggi
  // (tidak disusun ulang tiap ketikan supaya fokus & keyboard HP tetap).
  input.addEventListener("input", () => {
    if (!activeGroup) return;
    const result = replaceRange(lines, activeGroup.start, activeGroup.end, input.value, input.selectionStart);
    lines = result.lines;
    activeLine = result.line;
    syncToTextarea(result.line, result.col);

    const nextGroups = groupLines(lines);
    if (groupsSignature(nextGroups) !== groupsSignature(groups)) {
      activate(result.line, result.col, true);
      return;
    }
    groups = nextGroups;
    activeGroup = findGroup(groups, activeLine);
    updatePlaceholder();
    updateKind(); // sebelum autosize: ukuran huruf heading mengubah tinggi
    autosize();
    keepActiveVisible(); // baris yang sedang diketik jangan tertutup keyboard
  });

  input.addEventListener("focus", autosize);

  // Kursor digeser dengan tombol panah (tanpa mengubah teks): layar ikut.
  input.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow")) keepActiveVisible();
  });

  // Keyboard baru muncul/berubah tinggi -> posisikan ulang. rAF supaya
  // --keyboard-offset (ditulis editor.keyboard.js) sudah diperbarui.
  window.visualViewport?.addEventListener("resize", () => {
    if (document.activeElement === input) requestAnimationFrame(keepActiveVisible);
  });

  // ---------- Bantuan mengetik (H3) ----------

  // Menjalankan salah satu fungsi editor.lines.js pada teks penuh dengan
  // kursor di blok aktif. Mengembalikan true kalau ada yang diubah.
  function runAssist(...assists) {
    const value = joinLines(lines);
    const offset = toFullOffset(input.selectionStart);
    const end = toFullOffset(input.selectionEnd);
    let result = null;
    for (const assist of assists) {
      result = assist(value, offset, end);
      if (result) break;
    }
    if (!result) return false;
    const next = fromTextResult(result);
    lines = next.lines;
    syncToTextarea(next.line, next.col);
    activate(next.line, next.col, true);
    return true;
  }

  // Backspace di awal blok: gabung dengan blok di atas. Dipasang di beforeinput
  // (keyboard HP) dan keydown (keyboard fisik); keydown yang menangani akan
  // membatalkan beforeinput, jadi tidak pernah dobel.
  function mergeUp() {
    if (!activeGroup || input.selectionStart !== 0 || input.selectionEnd !== 0) return false;
    const result = mergeWithPrevious(lines, activeGroup.start);
    if (!result) return false;
    lines = result.lines;
    syncToTextarea(result.line, result.col);
    activate(result.line, result.col, true);
    return true;
  }

  // Backspace: keluar dari list kalau item kosong (exitList), kalau tidak
  // dan kursor di awal blok -> gabung ke atas.
  function handleBackspace() {
    if (inCode()) return mergeUp(); // di kode tidak ada "keluar list"
    return runAssist(exitList) || mergeUp();
  }

  input.addEventListener("beforeinput", (event) => {
    if (event.isComposing || !event.cancelable || !activeGroup) return;
    const type = event.inputType;
    let handled = false;
    if (type === "deleteContentBackward") {
      handled = handleBackspace();
    } else if (type === "insertLineBreak" || type === "insertParagraph") {
      // Lanjut list, kalau item kosong keluar dari list, kalau tidak salin
      // indent. Heading/paragraf biasa: dibiarkan, dipecah oleh handler input.
      // Di blok kode: tanpa list, hanya salin indent (I3).
      // J2: Enter di akhir baris "```" menambah fence penutup (hanya di luar blok kode).
      handled = inCode() ? runAssist(continueIndent) : runAssist(smartCodeFence, continueList, exitList, continueIndent);
    } else if (type === "insertText" && event.data === " ") {
      handled = inCode() ? false : runAssist(smartChecklist); // "[]" + spasi -> "- [ ] "
    }
    if (handled) event.preventDefault();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Backspace" || event.isComposing) return;
    if (handleBackspace()) event.preventDefault();
  });

  // Ketuk blok yang dirender -> jadi blok aktif. mousedown dibatalkan supaya
  // fokus tidak lepas dari textarea (keyboard HP tetap terbuka); aktivasi
  // dilakukan di click. Kursor ditaruh di akhir blok (posisi ketukan tidak
  // bisa dipetakan karena simbol markdown tidak tampil di blok yang dirender).
  container.addEventListener("mousedown", (event) => {
    if (event.target !== input) event.preventDefault();
  });


  // Titik ketukan di blok yang dirender -> { text, offset }: teks yang tampil
  // (tanpa penanda list/checklist) dan jumlah karakternya sebelum titik itu.
  // null kalau ketukan tidak jatuh di teks (mis. baris kosong).
  function visibleHit(block, x, y) {
    let node = null;
    let offset = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      node = p?.offsetNode ?? null;
      offset = p?.offset ?? 0;
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      node = r?.startContainer ?? null;
      offset = r?.startOffset ?? 0;
    }
    if (!node || node.nodeType !== Node.TEXT_NODE || !block.contains(node)) return null;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let text = "";
    let hit = -1;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement?.closest(".md-li-marker, .md-check")) continue; // penanda bukan isi
      if (n === node) hit = text.length + offset;
      text += n.data;
    }
    return hit < 0 ? null : { text, offset: hit };
  }

  container.addEventListener("click", (event) => {
    if (event.target === input) return;
    const block = event.target.closest(".block");
    if (block && container.contains(block)) {
      if (block.classList.contains("block--active")) return;
      // Kursor ditaruh tepat di kata yang diketuk (bukan di akhir blok), supaya
      // pengguna tidak perlu mencari posisi kursor lagi.
      const group = groups.find((g) => g.start === Number(block.dataset.index));
      const hit = group && visibleHit(block, event.clientX, event.clientY);
      if (hit) {
        const pos = tapToPos(lines, group, hit.text, hit.offset);
        activate(pos.line, pos.col, true);
        return;
      }
      const last = Number(block.dataset.end) - 1; // baris terakhir grup
      activate(last, lines[last].length, true);
      return;
    }
    // Ruang kosong di bawah blok terakhir -> aktifkan baris terakhir.
    if (event.target === container) {
      const last = lines.length - 1;
      activate(last, lines[last].length, true);
    }
  });

  // updateContentMode (notes.view.js) mengganti placeholder contentEl setelah
  // event change ini, jadi placeholder dibaca ulang di giliran berikutnya.
  typeEl.addEventListener("change", () => {
    applyMode();
    setTimeout(updatePlaceholder, 0);
  });

  applyMode();

  return { inputEl: input, target, reset, refresh };
}
