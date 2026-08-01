// modules/chat/chat.view.js
// Render murni untuk halaman Chat. Tidak menyimpan state, tidak memanggil DB.

const messageList = document.getElementById("chat-message-list");
const chatInput = document.getElementById("chat-input");

/**
 * Menampilkan seluruh riwayat pesan sebagai bubble, lalu scroll ke pesan
 * paling baru. Menampilkan empty state jika belum ada pesan sama sekali.
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

  for (const message of messages) {
    const li = document.createElement("li");
    li.className = `chat-bubble chat-bubble-${message.sender}`;
    li.textContent = message.text;
    messageList.appendChild(li);
  }

  messageList.scrollTop = messageList.scrollHeight;
}

/**
 * Menampilkan bubble "sedang mengetik..." sementara menunggu balasan bot,
 * supaya tidak terasa balasan muncul instan (Backlog -
 * 06-Chat-Polish-Roadmap.md). Dihapus lagi lewat hideTypingIndicator().
 */
export function showTypingIndicator() {
  const li = document.createElement("li");
  li.id = "chat-typing-indicator";
  li.className = "chat-bubble chat-bubble-bot";
  li.textContent = "Sedang mengetik...";
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