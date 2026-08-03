// modules/chat/chat.view.js
// Render murni untuk halaman Chat. Tidak menyimpan state, tidak memanggil DB.
//
// Tahap Chat Native Polish: bubble sekarang di-grup ala iMessage — pesan
// beruntun dari sender yang sama dirapatkan, avatar bot ("🐣") & jam cuma
// muncul di bubble TERAKHIR tiap grup, dan bubble terakhir itu dapat sudut
// lancip + "ekor" kecil (lihat .group-end di chat.css) sebagai penanda akhir
// giliran ngomong. Ini murni styling/markup, tidak mengubah data pesan
// ataupun alur chat.controller.js.

import { getNoteTypeMeta } from "../../shared/note-type-meta.js";
import { formatRelativeTime } from "../../shared/format-time.js";

const messageList = document.getElementById("chat-message-list");
const chatInput = document.getElementById("chat-input");

/**
 * Format jam pesan, format "18:02".
 * @param {Date} date
 * @returns {string}
 */
function formatClockTime(date) {
  const target = date instanceof Date ? date : new Date(date);
  const hh = String(target.getHours()).padStart(2, "0");
  const mm = String(target.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Menandai tiap pesan apakah dia awal/akhir dari grup pesan beruntun milik
 * sender yang sama. Cukup dicek berdasarkan sender pesan sebelum/sesudahnya
 * (KISS — tidak perlu cek jarak waktu antar pesan untuk app personal ini).
 * @param {Array<{sender:string}>} messages
 * @returns {Array<{groupStart:boolean, groupEnd:boolean}>}
 */
function markGroups(messages) {
  return messages.map((message, i) => ({
    groupStart: i === 0 || messages[i - 1].sender !== message.sender,
    groupEnd: i === messages.length - 1 || messages[i + 1].sender !== message.sender,
  }));
}

/**
 * Membuat satu mini-note-card (dipakai di dalam bubble bot untuk hasil
 * search_note/latest_note — lihat chat.controller.js lastNoteRefs).
 * Ikon & warna pakai getNoteTypeMeta() (shared/), satu sumber kebenaran
 * yang sama dipakai daftar Catatan & form Editor, supaya konsisten.
 * data-note-id dibaca oleh handleMiniNoteCardClick() di chat.controller.js
 * untuk buka detail — chat.view.js sendiri tidak memanggil openNote()
 * langsung (biar tetap "render murni", lihat komentar file ini).
 * @param {{id:number, title:string, type:string, updatedAt:Date}} note
 * @returns {HTMLDivElement}
 */
function buildNoteCard(note) {
  const meta = getNoteTypeMeta(note.type);

  const card = document.createElement("div");
  card.className = "mini-note-card";
  card.dataset.noteId = String(note.id);

  const icon = document.createElement("div");
  icon.className = "mini-note-card-icon";
  icon.style.background = meta.bg;
  icon.style.color = meta.color;
  icon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>`;

  const info = document.createElement("div");
  info.className = "mini-note-card-info";
  info.innerHTML = `
    <p class="mini-note-card-title"></p>
    <p class="mini-note-card-meta"></p>
  `;
  info.querySelector(".mini-note-card-title").textContent = note.title;
  info.querySelector(".mini-note-card-meta").textContent = `${meta.label} • ${formatRelativeTime(note.updatedAt)}`;

  card.appendChild(icon);
  card.appendChild(info);
  return card;
}

/**
 * Membuat satu <li> baris pesan (bubble, avatar kalau bot & groupEnd, jam
 * kalau groupEnd, mini-note-card kalau ada noteRefs).
 * @param {{sender:string, text:string, createdAt:Date, noteRefs?:Array}} message
 * @param {{groupStart:boolean, groupEnd:boolean}} group
 * @returns {HTMLLIElement}
 */
function buildMessageRow(message, group) {
  const isBot = message.sender === "bot";

  const li = document.createElement("li");
  li.className = `chat-row chat-row-${message.sender}${group.groupStart ? " group-start" : ""}`;

  if (isBot) {
    const avatar = document.createElement("span");
    avatar.className = "chat-avatar" + (group.groupEnd ? "" : " chat-avatar-spacer");
    avatar.textContent = "🐣";
    li.appendChild(avatar);
  }

  const wrap = document.createElement("div");
  wrap.className = "chat-bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble-${message.sender}${group.groupEnd ? " group-end" : ""}`;
  bubble.textContent = message.text;
  wrap.appendChild(bubble);

  if (message.noteRefs?.length) {
    message.noteRefs.forEach((note) => bubble.appendChild(buildNoteCard(note)));
  }

  if (group.groupEnd) {
    const time = document.createElement("span");
    time.className = "chat-timestamp";
    time.textContent = formatClockTime(message.createdAt);
    wrap.appendChild(time);
  }

  li.appendChild(wrap);
  return li;
}

/**
 * Menampilkan seluruh riwayat pesan sebagai bubble (dikelompokkan ala
 * iMessage, lihat markGroups), lalu scroll ke pesan paling baru.
 * Menampilkan empty state jika belum ada pesan sama sekali.
 * @param {Array<{id:number, sender:string, text:string, createdAt:Date}>} messages
 */
export function renderMessages(messages) {
  messageList.innerHTML = "";

  if (messages.length === 0) {
    messageList.innerHTML = `
      <li class="chat-empty">
        <p class="chat-empty-title">Belum ada percakapan.</p>
        <p class="chat-empty-subtitle">Ketik pesan pertamamu di bawah.</p>
      </li>
    `;
    return;
  }

  const groups = markGroups(messages);
  messages.forEach((message, i) => {
    messageList.appendChild(buildMessageRow(message, groups[i]));
  });

  messageList.scrollTop = messageList.scrollHeight;
}

/**
 * Menampilkan indikator "sedang mengetik" berupa titik-titik animasi
 * (bukan teks) sementara menunggu balasan bot, supaya tidak terasa
 * balasan muncul instan (Backlog - 06-Chat-Polish-Roadmap.md). Dihapus
 * lagi lewat hideTypingIndicator(). Dibuat pakai markup yang sama seperti
 * bubble bot biasa (avatar + group-end) supaya terasa menyatu, bukan
 * elemen asing.
 */
export function showTypingIndicator() {
  const li = document.createElement("li");
  li.id = "chat-typing-indicator";
  li.className = "chat-row chat-row-bot group-start";

  const avatar = document.createElement("span");
  avatar.className = "chat-avatar";
  avatar.textContent = "🐣";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble chat-bubble-bot group-end chat-typing-bubble";
  bubble.innerHTML = "<span></span><span></span><span></span>";

  const wrap = document.createElement("div");
  wrap.className = "chat-bubble-wrap";
  wrap.appendChild(bubble);

  li.appendChild(avatar);
  li.appendChild(wrap);
  messageList.appendChild(li);
  messageList.scrollTop = messageList.scrollHeight;
}

/**
 * Menghapus bubble "sedang mengetik..." kalau ada.
 */
export function hideTypingIndicator() {
  document.getElementById("chat-typing-indicator")?.remove();
}

/**
 * Mengambil teks yang sedang diketik pengguna (sudah di-trim).
 * @returns {string}
 */
export function readInput() {
  return chatInput.value.trim();
}

/**
 * Mengosongkan kembali input setelah pesan terkirim, sekaligus blur
 * supaya keyboard virtual otomatis tertutup (pola sama seperti
 * Claude/ChatGPT) — biar area yang baru kebuka gak nutupin pesan yang
 * baru dikirim.
 */
export function clearInput() {
  chatInput.value = "";
  chatInput.blur();
}
