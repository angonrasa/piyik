// shared/format-time.js
// Util kecil untuk menampilkan waktu relatif ("2 jam lalu") dari sebuah
// Date/timestamp. Dipakai lintas modul (bukan cuma notes), makanya taruh
// di shared/ sesuai 03-Structure.md.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Mengubah timestamp/Date menjadi teks waktu relatif dalam Bahasa Indonesia.
 * Untuk selisih lebih dari 7 hari, dikembalikan sebagai tanggal singkat
 * (dd/mm/yyyy) supaya tidak menyesatkan ("30 hari lalu" kurang berguna).
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
  const target = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - target.getTime();

  if (Number.isNaN(diffMs)) return "";
  if (diffMs < MINUTE) return "Baru saja";
  if (diffMs < HOUR) return `${Math.floor(diffMs / MINUTE)} menit lalu`;
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)} jam lalu`;
  if (diffMs < 7 * DAY) return `${Math.floor(diffMs / DAY)} hari lalu`;

  return target.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
