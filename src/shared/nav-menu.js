// shared/nav-menu.js
// Buka/tutup menu navigasi (tombol hamburger kiri bawah -> panel #bottom-nav).
// Dipisah dari view-switcher.js supaya logika menu tidak tercampur dengan
// logika ganti view. view-switcher.js memanggil closeNavMenu() tiap pindah view.

const toggleBtn = document.getElementById("nav-menu-toggle");
const panel = document.getElementById("bottom-nav");

/** Menutup panel menu. Aman dipanggil kapan saja. */
export function closeNavMenu() {
  panel.classList.remove("nav-open");
  toggleBtn.setAttribute("aria-expanded", "false");
}

// Ketuk hamburger: buka/tutup.
toggleBtn.addEventListener("click", () => {
  const isOpen = panel.classList.toggle("nav-open");
  toggleBtn.setAttribute("aria-expanded", String(isOpen));
});

// Ketuk item menu: tutup langsung (tidak menunggu proses pindah view).
panel.addEventListener("click", closeNavMenu);

// Ketuk di luar panel & tombol: tutup.
document.addEventListener("click", (event) => {
  if (!panel.contains(event.target) && !toggleBtn.contains(event.target)) {
    closeNavMenu();
  }
});
