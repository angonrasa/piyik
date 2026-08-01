// modules/todos/todos-format.js
// Konversi teks checklist (format "[ ] item" / "[x] item") <-> array item.
// Pure functions, tidak menyentuh DOM maupun database.

/**
 * Mengubah teks multi-baris jadi array item checklist.
 * Baris dengan "[x]" atau "[X]" di depan dianggap selesai.
 * Baris dengan "[ ]" atau tanpa tanda kurung dianggap belum selesai.
 * Baris kosong diabaikan.
 * @param {string} text
 * @returns {Array<{text: string, done: boolean}>}
 */
export function parseChecklistText(text) {
  const lines = text.split("\n").map((line) => line.trim());
  const items = [];

  for (const line of lines) {
    if (!line) continue; // lewati baris kosong

    const match = line.match(/^\[( |x|X)\]\s*(.*)$/);
    if (match) {
      const done = match[1].toLowerCase() === "x";
      const itemText = match[2].trim();
      if (itemText) items.push({ text: itemText, done });
    } else {
      // Baris tanpa format checklist tetap dianggap item baru (belum selesai),
      // supaya user bisa ngetik bebas tanpa hafal format persis.
      items.push({ text: line, done: false });
    }
  }

  return items;
}

/**
 * Mengubah array item checklist jadi teks multi-baris (kebalikan dari parseChecklistText).
 * @param {Array<{text: string, done: boolean}>} items
 * @returns {string}
 */
export function formatChecklistText(items) {
  return items.map((item) => `[${item.done ? "x" : " "}] ${item.text}`).join("\n");
}
