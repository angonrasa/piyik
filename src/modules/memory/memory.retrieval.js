// modules/memory/memory.retrieval.js
//
// Tahap 1 — Memory Retrieval Engine + Tahap 2.1 — Context Ranking +
// Tahap 4 — Memory Chain (05-Roadmap-Reakurasi.md). Kumpulkan kandidat
// dari tiga jalur (keyword match, relasi 1 langkah, relasi 2 langkah),
// tandai asal tiap kandidat, lalu urutkan lewat rankMemories()
// (memory.ranking.js).
//
// Return tetap array Notes polos (bukan {note, score}) — pemanggil
// (chat.controller.js) tidak perlu tahu ada skor di baliknya, cuma
// butuh daftar note yang sudah terurut relevansinya. Satu pengecualian
// kecil: note hasil relasi 2 langkah (Tahap 4) ditandai properti
// sementara `chainedFrom` (bukan field DB, cuma dipakai chat.controller.js
// untuk kalimat opsional Milestone 4.2 — lihat collectChainedCandidates).

import { extractMeaningfulWords, hasEnoughSignal } from "./memory.keyword.js";
import { searchNotes } from "../notes/notes.repository.js";
import { getRelatedNotes } from "../relations/relations.repository.js";
import { rankMemories } from "./memory.ranking.js";

/**
 * @param {string} pesan pesan asli user, apa adanya (belum dinormalisasi)
 * @returns {Promise<Array>} catatan yang cocok, terurut relevansi,
 *   array kosong jika tidak ada/tidak layak dicari
 */
export async function retrieveMemory(pesan) {
  const words = extractMeaningfulWords(pesan);
  if (!hasEnoughSignal(words)) return [];

  const query = words.join(" ");
  const directMatches = await searchNotes(query);
  if (directMatches.length === 0) return [];

  const candidates = await collectCandidates(directMatches);
  const ranked = rankMemories(candidates);
  
  // Milestone 2.2 — batasi maks 3 hasil, buang sisanya (bukan disimpan
  // buat ditampilkan nanti — DoD Tahap 2: chat tidak menampilkan daftar
  // panjang).
  return ranked.slice(0, 3).map((scored) => scored.note);
}

/**
 * Menyusun kandidat dari dua jalur: keyword match langsung, dan catatan
 * terkait (1 langkah relasi) dari tiap keyword match. Dedupe by id — kalau
 * satu catatan ketemu lewat KEDUA jalur, versi keyword match yang menang
 * (didaftar duluan), karena itu status prioritas yang benar.
 * @param {Array} directMatches
 * @returns {Promise<import('./memory.ranking.js').MemoryCandidate[]>}
 */
async function collectCandidates(directMatches) {
  const directCandidates = directMatches.map((note) => ({
    note,
    isKeywordMatch: true,
    isDirectRelation: false,
    seedNote: null,
  }));

  const relatedCandidates = await collectRelatedCandidates(directMatches);
  const chainedCandidates = await collectChainedCandidates(relatedCandidates);

  // Urutan penting untuk dedupeCandidates(): direct > related (depth 1) >
  // chained (depth 2). Kalau satu note ketemu lewat beberapa jalur, jalur
  // yang didaftar duluan yang menang.
  return dedupeCandidates([...directCandidates, ...relatedCandidates, ...chainedCandidates]);
}

/**
 * @param {Array} directMatches
 * @returns {Promise<import('./memory.ranking.js').MemoryCandidate[]>}
 */
async function collectRelatedCandidates(directMatches) {
  const perSeed = await Promise.all(
    directMatches.map(async (seedNote) => {
      const related = await getRelatedNotes(seedNote.id);
      return related.map((note) => ({
        note,
        isKeywordMatch: false,
        isDirectRelation: true,
        seedNote,
      }));
    })
  );
  return perSeed.flat();
}

/**
 * Tahap 4 — Memory Chain, Milestone 4.1. Dari tiap catatan hasil relasi
 * 1 langkah (relatedCandidates), telusuri 1 langkah lagi lewat
 * getRelatedNotes(). Dibatasi cuma sampai sini (depth 2 dari seed),
 * TIDAK dipanggil rekursif lebih jauh — sesuai DoD "maksimal 2 langkah".
 *
 * Note hasil chain ditandai `chainedFrom` (judul note perantara), dipakai
 * chat.controller.js untuk kalimat opsional Milestone 4.2. Ini properti
 * sementara di memori saja, bukan field yang disimpan ke Dexie.
 * @param {import('./memory.ranking.js').MemoryCandidate[]} relatedCandidates hasil depth 1
 * @returns {Promise<import('./memory.ranking.js').MemoryCandidate[]>}
 */
async function collectChainedCandidates(relatedCandidates) {
  const perCandidate = await Promise.all(
    relatedCandidates.map(async (candidate) => {
      const nextHop = await getRelatedNotes(candidate.note.id);
      return nextHop.map((note) => ({
        note: { ...note, chainedFrom: candidate.note.title },
        isKeywordMatch: false,
        isDirectRelation: false,
        isChainRelation: true,
        seedNote: candidate.note,
      }));
    })
  );
  return perCandidate.flat();
}

/**
 * @param {import('./memory.ranking.js').MemoryCandidate[]} candidates
 * @returns {import('./memory.ranking.js').MemoryCandidate[]}
 */
function dedupeCandidates(candidates) {
  const seenIds = new Set();
  const result = [];

  for (const candidate of candidates) {
    if (seenIds.has(candidate.note.id)) continue;
    seenIds.add(candidate.note.id);
    result.push(candidate);
  }

  return result;
}