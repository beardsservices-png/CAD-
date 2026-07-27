// app/dialogs.js — non-blocking in-app dialogs (modal, prompt, confirm, alert)
// and the transient toast. Pure DOM utilities: no App state, never freeze the
// page, always dismissable via Esc / backdrop click.

export function showModal({ title, message = "", input = false, value = "", placeholder = "", ok = "OK", cancel = "Cancel" }) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "app-modal";
    const card = document.createElement("div");
    card.className = "app-modal-card";
    const h = document.createElement("div");
    h.className = "app-modal-title";
    h.textContent = title;
    card.appendChild(h);
    if (message) {
      const p = document.createElement("div");
      p.className = "app-modal-msg";
      p.textContent = message;
      card.appendChild(p);
    }
    let field = null;
    if (input) {
      field = document.createElement("input");
      field.className = "app-modal-input";
      field.type = "text";
      field.value = value;
      field.placeholder = placeholder;
      card.appendChild(field);
    }
    const actions = document.createElement("div");
    actions.className = "app-modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ghost";
    cancelBtn.textContent = cancel;
    const okBtn = document.createElement("button");
    okBtn.className = "ghost primary";
    okBtn.textContent = ok;
    if (cancel === null) cancelBtn.style.display = "none";
    actions.append(cancelBtn, okBtn);
    card.appendChild(actions);
    back.appendChild(card);
    document.body.appendChild(back);
    if (field) setTimeout(() => { field.focus(); field.select(); }, 0);

    const finish = (result) => {
      window.removeEventListener("keydown", onKey, true);
      back.remove();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(input ? null : false); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finish(input ? (field ? field.value : "") : true); }
    };
    window.addEventListener("keydown", onKey, true);
    okBtn.onclick = () => finish(input ? (field ? field.value : "") : true);
    cancelBtn.onclick = () => finish(input ? null : false);
    back.onclick = (e) => { if (e.target === back) finish(input ? null : false); };
  });
}

export const promptDialog = (title, value = "", placeholder = "") =>
  showModal({ title, input: true, value, placeholder });
export const confirmDialog = (title, message = "") =>
  showModal({ title, message, ok: "OK", cancel: "Cancel" });
export const alertDialog = (title, message = "") =>
  showModal({ title, message, ok: "OK", cancel: null });

let toastTimer;
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
