// modules/chat/chat.prompt-builder.js
//
// AI-3 — Prompt Builder (09-roadmap-ai-integration-v2-1.md). Menerima
// context package dari AI-2 (memory.context-builder.js) + pesan asli
// user, ubah jadi teks prompt sederhana. Modul ini TIDAK memanggil AI
// sama sekali — cuma menyusun string, sesuai Prinsip AI Integration
// (01-Piyik-Blueprint.md): tidak ada logic AI di luar ai-adapter.js
// nanti di AI-4.
//
// Catatan asumsi (roadmap AI-3.1 cuma bilang "note-note user +
// instruksi", tidak eksplisit sebut pesan asli user): prompt di sini
// TETAP menyertakan pesan asli user di baris terakhir, karena tanpa itu
// AI-4 nanti tidak tahu pertanyaan apa yang harus dijawab. Kalau ini
// bukan yang dimaksud, gampang diubah — cuma buang bagian `pesan` dari
// buildPrompt().

// Milestone 3.2 "cek apakah masuk akal dan tidak kepanjangan" — batasi
// isi tiap catatan biar prompt tidak membengkak kalau contentnya
// panjang. Angka kasar (bukan hasil pengukuran token asli), cukup buat
// MVP; boleh disesuaikan kalau nanti ketauan kepanjangan/kependekan
// pas AI-4 jalan beneran.
const MAX_CONTENT_CHARS = 300;

/**
 * @param {string} pesan pesan asli user
 * @param {{notes: Array, relations: Array}} context hasil buildContext() (AI-2)
 * @returns {string} teks prompt, siap dikirim ke AI nanti (AI-4)
 */
export function buildPrompt(pesan, context) {
  if (context.notes.length === 0) {
    return buildPromptWithoutNotes(pesan);
  }

  const notesText = context.notes.map(formatNote).join("\n");
  const relationsLine = context.relations.length > 0 ? formatRelationsLine(context.relations) : null;

  return [
    "Kamu adalah asisten pribadi di aplikasi catatan Piyik Mind. Jawab pertanyaan pengguna HANYA berdasarkan catatan-catatan di bawah ini. Jangan mengarang informasi yang tidak ada di catatan.",
    "",
    "Catatan yang relevan:",
    notesText,
    relationsLine,
    "",
    `Pertanyaan pengguna: ${pesan}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Prompt versi pendek kalau tidak ada catatan sama sekali yang relevan
 * (context.notes kosong) — tetap kirim pesan user, tapi instruksinya
 * beda: AI harus jujur bilang tidak nemu, bukan sok tau.
 * @param {string} pesan
 * @returns {string}
 */
function buildPromptWithoutNotes(pesan) {
  return [
    "Kamu adalah asisten pribadi di aplikasi catatan Piyik Mind. Tidak ada catatan pengguna yang relevan untuk pertanyaan ini. Jawab dengan jujur dan singkat pertanyaan pengguna, jangan mengarang jawaban.",
    "",
    `Pertanyaan pengguna: ${pesan}`,
  ].join("\n");
}

/**
 * @param {{title: string, type: string, content: string}} note
 * @returns {string}
 */
function formatNote(note) {
  const content =
    note.content.length > MAX_CONTENT_CHARS ? `${note.content.slice(0, MAX_CONTENT_CHARS)}...` : note.content;
  return `- [${note.type}] ${note.title}: ${content}`;
}

/**
 * @param {Array<{title: string}>} relations
 * @returns {string}
 */
function formatRelationsLine(relations) {
  const titles = relations.map((note) => note.title).join(", ");
  return `Catatan lain yang berkaitan: ${titles}.`;
}
