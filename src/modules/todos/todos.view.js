// modules/todos/todos.view.js
// Semua manipulasi DOM untuk checklist (todoItems).

const todoSectionEl = document.getElementById("todo-section");
const todoListEl = document.getElementById("todo-list");
const todoInputEl = document.getElementById("todo-input");

/**
 * Menampilkan atau menyembunyikan section checklist.
 * Checklist hanya relevan untuk note bertipe "tugas".
 * @param {boolean} visible
 */
export function setTodoSectionVisible(visible) {
  todoSectionEl.hidden = !visible;
}

/**
 * Merender daftar item checklist.
 * @param {Array} items
 * @param {(id: number, done: boolean) => void} onToggle
 * @param {(id: number) => void} onDelete
 */
export function renderTodoList(items, onToggle, onDelete) {
  todoListEl.textContent = "";

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "todo-empty";
    emptyItem.textContent = "Belum ada item.";
    todoListEl.appendChild(emptyItem);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "todo-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => onToggle(item.id, checkbox.checked));

    const textEl = document.createElement("span");
    textEl.className = "todo-item-text";
    textEl.textContent = item.text;
    if (item.done) textEl.classList.add("todo-item-done");

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "todo-item-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => onDelete(item.id));

    li.appendChild(checkbox);
    li.appendChild(textEl);
    li.appendChild(deleteBtn);
    todoListEl.appendChild(li);
  }
}

/**
 * Mengambil teks dari input "tambah item", lalu mengosongkannya.
 * @returns {string}
 */
export function readAndClearTodoInput() {
  const text = todoInputEl.value.trim();
  todoInputEl.value = "";
  return text;
}
