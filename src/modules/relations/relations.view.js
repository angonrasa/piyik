// modules/relations/relations.view.js
// Manipulasi DOM untuk daftar catatan terkait & pemilih target relasi.
// Tidak ada HTML string, semua elemen dibuat lewat createElement.

import { getAllNotes } from "../../shared/notes-data.js";

const relatedListEl = document.getElementById("related-list");
const relationSummaryEl = document.getElementById("relation-summary");
const recommendedListEl = document.getElementById("recommended-list");
const relationTargetSelect = document.getElementById("relation-target");

/**
 * Merender daftar catatan yang terkait dengan catatan yang sedang dibuka.
 * @param {Array<{relationId: number, note: object}>} relatedItems
 * @param {(noteId: number) => void} onOpenNote
 * @param {(relationId: number) => void} onRemove
 */
export function renderRelatedList(relatedItems, onOpenNote, onRemove) {
  relatedListEl.textContent = "";

  if (relatedItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "note-empty";
    empty.textContent = "Belum ada catatan terkait.";
    relatedListEl.appendChild(empty);
    return;
  }

  for (const { relationId, note } of relatedItems) {
    const item = document.createElement("li");
    item.className = "note-item";

    const titleEl = document.createElement("span");
    titleEl.className = "note-item-title";
    titleEl.textContent = note.title;
    titleEl.addEventListener("click", () => onOpenNote(note.id));

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove-relation";
    removeBtn.textContent = "Putus";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onRemove(relationId);
    });

    item.appendChild(titleEl);
    item.appendChild(removeBtn);
    relatedListEl.appendChild(item);
  }
}

/**
 * Menampilkan ringkasan jumlah relasi langsung catatan yang sedang dibuka.
 * @param {number} count
 */
export function renderRelationSummary(count) {
  relationSummaryEl.textContent =
    count === 0
      ? "Belum terhubung dengan catatan lain."
      : `Terhubung langsung dengan ${count} catatan.`;
}

/**
 * Merender daftar rekomendasi catatan terkait (relasi 2 langkah)
 * beserta tombol untuk langsung menghubungkannya.
 * @param {Array<{id: number, note: object}>} recommendedItems
 * @param {(noteId: number) => void} onOpenNote
 * @param {(noteId: number) => void} onQuickAdd
 */
export function renderRecommendedList(recommendedItems, onOpenNote, onQuickAdd) {
  recommendedListEl.textContent = "";

  if (recommendedItems.length === 0) {
    const empty = document.createElement("li");
    empty.className = "note-empty";
    empty.textContent = "Belum ada rekomendasi.";
    recommendedListEl.appendChild(empty);
    return;
  }

  for (const { id, note } of recommendedItems) {
    const item = document.createElement("li");
    item.className = "note-item";

    const titleEl = document.createElement("span");
    titleEl.className = "note-item-title";
    titleEl.textContent = note.title;
    titleEl.addEventListener("click", () => onOpenNote(id));

    const addBtn = document.createElement("button");
    addBtn.className = "btn-quick-add";
    addBtn.textContent = "Hubungkan";
    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onQuickAdd(id);
    });

    item.appendChild(titleEl);
    item.appendChild(addBtn);
    recommendedListEl.appendChild(item);
  }
}

/**
 * Mengisi dropdown pilihan target relasi dengan catatan yang belum
 * terhubung langsung, dan mengecualikan catatan yang sedang dibuka sendiri.
 * @param {number} excludeId
 * @param {Set<number>} [alreadyRelatedIds]
 */
export async function populateRelationTarget(excludeId, alreadyRelatedIds = new Set()) {
  const notes = await getAllNotes();
  relationTargetSelect.textContent = "";

  for (const note of notes) {
    if (note.id === excludeId || alreadyRelatedIds.has(note.id)) continue;
    const option = document.createElement("option");
    option.value = String(note.id);
    option.textContent = note.title;
    relationTargetSelect.appendChild(option);
  }
}

/**
 * Membaca id catatan target yang sedang dipilih di dropdown.
 */
export function getSelectedRelationTarget() {
  const value = relationTargetSelect.value;
  return value ? Number(value) : null;
}
