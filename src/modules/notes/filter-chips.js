// modules/notes/filter-chips.js
// Tanggung jawab tunggal: menyinkronkan chip filter tipe (UI baru, lihat
// mockup) dengan <select id="filter-type"> yang sudah ada. Tidak menyentuh
// logika pencarian/filter di index.js — hanya memicu event "change" seperti
// kalau pengguna memilih lewat dropdown asli.

const chipsContainer = document.getElementById("filter-chips");
const filterSelect = document.getElementById("filter-type");

if (chipsContainer && filterSelect) {
  const chips = Array.from(chipsContainer.querySelectorAll(".chip"));

  function setActiveChip(type) {
    chips.forEach((chip) => {
      chip.classList.toggle("chip-active", chip.dataset.type === type);
    });
  }

  chipsContainer.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;

    filterSelect.value = chip.dataset.type;
    filterSelect.dispatchEvent(new Event("change"));
    setActiveChip(chip.dataset.type);
  });

  // Jaga sinkron kalau tipe difilter lewat dropdown "Semua" langsung.
  filterSelect.addEventListener("change", () => {
    setActiveChip(filterSelect.value);
  });
}
