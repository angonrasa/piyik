// core/db.js
// Setup database IndexedDB menggunakan Dexie.js

export let db = null;

/**
 * Menggabungkan baris-baris lama {chord, text} menjadi satu string `lyrics`
 * plain text (chord di baris atas, lirik di baris bawah, dipisah baris
 * kosong antar pasangan) — dipakai sekali saat migrasi versi 6.
 * @param {{chord?: string, text?: string}[]} lines
 * @returns {string}
 */
function linesToLyrics(lines) {
  const blocks = lines.map((line) => {
    const rows = [];
    if (line.chord && line.chord.trim() !== "") rows.push(line.chord);
    rows.push(line.text ?? "");
    return rows.join("\n");
  });
  return blocks.join("\n\n");
}

/**
 * Menyiapkan dan membuka koneksi database.
 * Dipanggil sekali saat aplikasi dimulai (lihat index.js).
 * @returns {Promise<boolean>} true jika berhasil, false jika gagal
 */
export async function checkDatabase() {
  if (typeof Dexie === "undefined") {
    console.error(
      "Dexie tidak ditemukan. Kemungkinan skrip Dexie (dari CDN) gagal dimuat " +
        "karena tidak ada koneksi internet saat halaman dibuka."
    );
    return false;
  }

  try {
    db = new Dexie("PiyikBrainDB");

    // Versi 1 (Tahap 1): hanya tabel notes.
    // WAJIB tetap didefinisikan persis seperti ini walau tidak dipakai lagi,
    // supaya Dexie tahu skema awal dan bisa upgrade database lama dengan benar.
    db.version(1).stores({
      notes: "++id, title, type, createdAt, updatedAt",
    });

    // Versi 2 (Tahap 3): menambahkan tabel relations.
    // Menaikkan nomor versi ini yang membuat Dexie benar-benar
    // membuat object store relations di database yang sudah ada sebelumnya.
    db.version(2).stores({
      notes: "++id, title, type, createdAt, updatedAt",
      relations: "++id, fromId, toId",
    });

    // Versi 3 (Fitur Tugas/Checklist): menambahkan tabel todoItems.
    // Item checklist milik satu note (type: "tugas"), disimpan terpisah
    // supaya nanti bisa di-query lintas semua note (misal untuk fitur Chat).
    db.version(3).stores({
      notes: "++id, title, type, createdAt, updatedAt",
      relations: "++id, fromId, toId",
      todoItems: "++id, noteId, done, order",
    });

    // Versi 4 (Fitur Lagu/Song): menambahkan tabel songDetails.
    // Data spesifik lagu (lirik, chord, tempo, key, genre, status) milik
    // satu note (type: "song"), disimpan terpisah dari tabel notes —
    // mengikuti pola yang sama seperti todoItems.
    db.version(4).stores({
      notes: "++id, title, type, createdAt, updatedAt",
      relations: "++id, fromId, toId",
      todoItems: "++id, noteId, done, order",
      songDetails: "++id, noteId",
    });

    // Versi 5 (Tahap 1 — Chat Dasar): menambahkan tabel chatMessages.
    // Menyimpan riwayat percakapan di halaman Chat. Field `sender` sudah
    // disiapkan untuk membedakan "user" vs "bot", walau Tahap 1 baru
    // mengisi sender: "user" (belum ada balasan bot — lihat 05-Chat-Roadmap.md
    // Tahap 2 untuk logika balasan).
    db.version(5).stores({
      notes: "++id, title, type, createdAt, updatedAt",
      relations: "++id, fromId, toId",
      todoItems: "++id, noteId, done, order",
      songDetails: "++id, noteId",
      chatMessages: "++id, sender, createdAt",
    });

    // Versi 6 (Revisi Editor Lagu): songDetails pindah dari editor per-baris
    // (`lines: [{chord, text}]`) ke satu field teks polos `chords+lirik`
    // (`lyrics`), sesuai 08-Design-Song-NoteType.md.
    // Struktur store tidak berubah (lyrics bukan field yang diindeks, jadi
    // tidak perlu ditulis di skema `stores`), tapi versi tetap dinaikkan
    // supaya fungsi upgrade() di bawah ini benar-benar dijalankan Dexie
    // untuk mengisi `lyrics` pada data lama.
    // Field `lines` dan `chords` (ringkasan chord progresi) lama TIDAK
    // dihapus dari data existing — dibiarkan menganggur di DB (Dexie tidak
    // memaksa hapus kolom), kode baru cukup berhenti membacanya. Ini supaya
    // migrasi tetap sederhana (KISS) dan tidak berisiko kehilangan data
    // kalau ada yang perlu dicek ulang nanti.
    db.version(6)
      .stores({
        notes: "++id, title, type, createdAt, updatedAt",
        relations: "++id, fromId, toId",
        todoItems: "++id, noteId, done, order",
        songDetails: "++id, noteId",
        chatMessages: "++id, sender, createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("songDetails").toCollection().modify((record) => {
          if (Array.isArray(record.lines) && record.lines.length > 0) {
            record.lyrics = linesToLyrics(record.lines);
          } else if (typeof record.lyrics !== "string") {
            record.lyrics = "";
          }
        });
      });

    await db.open();
    return true;
  } catch (error) {
    console.error("Gagal membuka database:", error);
    return false;
  }
}
