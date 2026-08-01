// modules/relations/relations.controller.js
// Menghubungkan aksi pengguna (tambah/hapus relasi) dengan repository & view.

import {
  addRelation,
  removeRelation,
  getRelationsForNote,
  getRelationCounts,
  deleteRelationsForNote,
} from "./relations.repository.js";
import { getNote } from "../../shared/notes-data.js";
import {
  renderRelatedList,
  renderRelationSummary,
  renderRecommendedList,
  populateRelationTarget,
  getSelectedRelationTarget,
} from "./relations.view.js";

let currentNoteId = null;
let navigateToNote = null;
let directRelatedIds = new Set();

async function loadRelated() {
  const relations = await getRelationsForNote(currentNoteId);

  const relatedItems = [];
  directRelatedIds = new Set();

  for (const relation of relations) {
    const otherId = relation.fromId === currentNoteId ? relation.toId : relation.fromId;
    const note = await getNote(otherId);
    if (note) {
      relatedItems.push({ relationId: relation.id, note });
      directRelatedIds.add(otherId);
    }
  }

  renderRelatedList(relatedItems, navigateToNote, handleRemove);
  renderRelationSummary(relatedItems.length);
  await populateRelationTarget(currentNoteId, directRelatedIds);

  await loadRecommended();
}

/**
 * Aturan sederhana: catatan yang terhubung dengan catatan yang terhubung
 * langsung dengan catatan ini (relasi 2 langkah), tapi belum terhubung
 * langsung, direkomendasikan sebagai kemungkinan hubungan baru.
 */
async function loadRecommended() {
  const recommendedMap = new Map(); // noteId -> note

  for (const relatedId of directRelatedIds) {
    const secondDegree = await getRelationsForNote(relatedId);

    for (const relation of secondDegree) {
      const candidateId = relation.fromId === relatedId ? relation.toId : relation.fromId;

      const isSelf = candidateId === currentNoteId;
      const isAlreadyDirect = directRelatedIds.has(candidateId);
      const alreadyAdded = recommendedMap.has(candidateId);

      if (isSelf || isAlreadyDirect || alreadyAdded) continue;

      const note = await getNote(candidateId);
      if (note) recommendedMap.set(candidateId, note);
    }
  }

  const recommendedItems = Array.from(recommendedMap, ([id, note]) => ({ id, note }));
  renderRecommendedList(recommendedItems, navigateToNote, handleQuickAdd);
}

async function handleQuickAdd(targetId) {
  await addRelation(currentNoteId, targetId);
  await loadRelated();
}

async function handleAdd() {
  const targetId = getSelectedRelationTarget();
  if (!targetId || targetId === currentNoteId) return;
  if (directRelatedIds.has(targetId)) return; // cegah relasi duplikat

  await addRelation(currentNoteId, targetId);
  await loadRelated();
}

async function handleRemove(relationId) {
  await removeRelation(relationId);
  await loadRelated();
}

/**
 * Dipanggil oleh modules/notes saat detail sebuah catatan dibuka.
 * @param {number} noteId
 * @param {(noteId: number) => void} onNavigateToNote - pindah ke detail catatan lain
 */
export async function showRelationsFor(noteId, onNavigateToNote) {
  currentNoteId = noteId;
  navigateToNote = onNavigateToNote;
  await loadRelated();
}

/**
 * Mengambil peta jumlah relasi langsung untuk semua catatan.
 * Dipakai modul notes untuk menampilkan badge jumlah relasi di daftar.
 */
export { getRelationCounts };

/**
 * Membersihkan seluruh relasi milik sebuah catatan.
 * Dipakai modul notes saat sebuah catatan dihapus.
 */
export { deleteRelationsForNote };

/**
 * Inisialisasi modul Relations: pasang event listener tombol tambah relasi.
 */
export function initRelations() {
  document.getElementById("btn-add-relation").addEventListener("click", handleAdd);
}

