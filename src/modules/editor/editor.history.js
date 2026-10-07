// modules/editor/editor.history.js
// Riwayat perubahan editor (Phase 1 - B2: undo, B3: redo).
// Murni logika: tidak menyentuh DOM, database, atau modul lain.
// Satu "snapshot" = { title, content } (plain text).

const MAX_ENTRIES = 100; // batas supaya memori tidak membengkak

/**
 * Membuat riwayat baru.
 * @param {{title: string, content: string}} initial - keadaan awal editor
 */
export function createHistory(initial) {
  let stack = [initial];
  let index = 0; // posisi snapshot yang sedang aktif

  function isSame(a, b) {
    return a.title === b.title && a.content === b.content;
  }

  return {
    /** Mencatat snapshot baru. Diabaikan kalau sama dengan yang aktif. */
    record(snapshot) {
      if (isSame(snapshot, stack[index])) return;
      // Mengetik setelah undo membuang langkah "ke depan" (riwayat redo).
      stack = stack.slice(0, index + 1);
      stack.push(snapshot);
      if (stack.length > MAX_ENTRIES) stack.shift();
      index = stack.length - 1;
    },

    /** Mundur satu langkah. Mengembalikan snapshot, atau null kalau sudah di awal. */
    undo() {
      if (index === 0) return null;
      index -= 1;
      return stack[index];
    },

    canUndo() {
      return index > 0;
    },

    /** Maju satu langkah. Mengembalikan snapshot, atau null kalau sudah di akhir. */
    redo() {
      if (index >= stack.length - 1) return null;
      index += 1;
      return stack[index];
    },

    canRedo() {
      return index < stack.length - 1;
    },

    /** Mengosongkan riwayat (dipakai saat catatan lain dibuka). */
    reset(initial) {
      stack = [initial];
      index = 0;
    },
  };
}
