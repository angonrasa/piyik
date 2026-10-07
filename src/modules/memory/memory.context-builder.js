// modules/memory/memory.context-builder.js
//
// AI-2 — Context Builder (09-roadmap-ai-integration-v2-1.md). Menyiapkan
// "context package" sederhana buat AI (nanti dipakai AI-3 Prompt Builder),
// TANPA menyentuh AI sama sekali di sini. Reuse retrieveMemory() (Tahap 1,
// memory.retrieval.js — sudah termasuk ranking Tahap 2 & chain Tahap 4)
// dan getRelatedNotes() (dipakai juga di Memory Chain Tahap 4) apa
// adanya — tidak bikin query pencarian/relasi baru.
//
// Prinsip AI Integration (01-Piyik-Blueprint.md): modul ini TIDAK query
// Dexie langsung, TIDAK tahu skema DB di luar bentuk Note/Relation yang
// sudah dikembalikan repository lain, dan TIDAK bisa create/edit/delete
// apapun. Cuma baca & susun ulang jadi object polos untuk dikonsumsi
// AI-3 (prompt-builder.js) nanti.

import { retrieveMemory } from "./memory.retrieval.js";
import { getRelatedNotes } from "../relations/relations.repository.js";

/**
 * Milestone AI-2.1 — retrieval dasar, reuse retrieveMemory() (Tahap 1)
 * apa adanya (sudah otomatis dibatasi maks 3 hasil & terurut relevansi,
 * lihat memory.retrieval.js — tidak perlu dibatasi ulang di sini).
 *
 * Milestone AI-2.2 — tambahkan relasi dari tiap note hasil retrieval,
 * reuse getRelatedNotes() (relation engine yang sama dipakai Memory
 * Chain Tahap 4), bukan bikin query relasi baru.
 *
 * @param {string} pesan pesan asli user
 * @returns {Promise<{notes: Array, relations: Array}>} context package,
 *   { notes: [], relations: [] } kalau tidak ada hasil retrieval sama
 *   sekali (bukan error — pemanggil cukup cek notes.length).
 */
export async function buildContext(pesan) {
  const notes = await retrieveMemory(pesan);
  const relations = await collectRelations(notes);

  return { notes, relations };
}

/**
 * Ambil relasi tiap note hasil retrieval, gabung jadi satu array datar.
 * Dedupe by id — kalau satu note terhubung ke lebih dari satu note hasil
 * retrieval, cukup dihitung sekali, supaya context package tidak
 * membengkak kalau notes-nya saling berelasi satu sama lain.
 * @param {Array} notes
 * @returns {Promise<Array>}
 */
async function collectRelations(notes) {
  const perNote = await Promise.all(notes.map((note) => getRelatedNotes(note.id)));

  const seenIds = new Set();
  const result = [];
  for (const related of perNote.flat()) {
    if (seenIds.has(related.id)) continue;
    seenIds.add(related.id);
    result.push(related);
  }
  return result;
}
