// shared/empty-state.js
// Blok "belum ada data" (icon Piyik + judul + subjudul) yang dipakai lebih
// dari satu modul (modules/notes dan modules/home), sesuai aturan
// Structure.md: kode yang dipakai bersama dipindahkan ke shared/.

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Membuat ikon anak ayam (Piyik) sederhana, outline, untuk empty state.
 * Dibuat lewat createElementNS (bukan string HTML/SVG) sesuai aturan
 * Structure.md: "Jangan menulis HTML di dalam JavaScript."
 */
function createPiyikIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("width", "48");
  svg.setAttribute("height", "48");
  svg.classList.add("empty-state-icon");

  const body = document.createElementNS(SVG_NS, "circle");
  body.setAttribute("cx", "21");
  body.setAttribute("cy", "29");
  body.setAttribute("r", "13");
  body.setAttribute("fill", "none");
  body.setAttribute("stroke", "currentColor");
  body.setAttribute("stroke-width", "2");

  const head = document.createElementNS(SVG_NS, "circle");
  head.setAttribute("cx", "29");
  head.setAttribute("cy", "17");
  head.setAttribute("r", "7.5");
  head.setAttribute("fill", "none");
  head.setAttribute("stroke", "currentColor");
  head.setAttribute("stroke-width", "2");

  const beak = document.createElementNS(SVG_NS, "path");
  beak.setAttribute("d", "M35.5 17l4.5 1.8-4.5 1.8z");
  beak.setAttribute("fill", "currentColor");

  const eye = document.createElementNS(SVG_NS, "circle");
  eye.setAttribute("cx", "31");
  eye.setAttribute("cy", "15");
  eye.setAttribute("r", "1.3");
  eye.setAttribute("fill", "currentColor");

  svg.append(body, head, beak, eye);
  return svg;
}

/**
 * Membuat blok empty state (icon + judul + subjudul) yang bisa dipakai
 * ulang di list mana pun yang butuh menampilkan "belum ada data".
 * @param {string} title
 * @param {string} subtitle
 */
export function createEmptyState(title, subtitle) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  wrapper.appendChild(createPiyikIcon());

  const titleEl = document.createElement("p");
  titleEl.className = "empty-state-title";
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);

  const subtitleEl = document.createElement("p");
  subtitleEl.className = "empty-state-subtitle";
  subtitleEl.textContent = subtitle;
  wrapper.appendChild(subtitleEl);

  return wrapper;
}
