(function () {
  const socket = window.cyberduelMultiplayer?.connect() || io(window.cyberduelServerUrl());
  const queue = [], seen = new Set();
  let current = null;
  const showNext = () => {
    if (current || !queue.length) return;
    const notice = queue.shift();
    const panel = document.createElement("aside");
    panel.className = "server-notice";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-label", "Aviso da administração");
    panel.setAttribute("popover", "manual");
    const label = document.createElement("strong");
    label.textContent = "CYBERDUEL / AVISO DA ADMINISTRAÇÃO";
    const message = document.createElement("p");
    message.textContent = notice.message;
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "ENTENDI";
    close.setAttribute("aria-label", "Fechar aviso da administração");
    close.addEventListener("click", () => {
      panel.remove(); current = null; showNext();
    });
    panel.addEventListener("pointerdown", event => event.stopPropagation());
    panel.addEventListener("keydown", event => event.stopPropagation());
    panel.append(label, message, close);
    document.body.append(panel);
    current = panel;
    panel.showPopover?.();
  };
  socket.on("server-notice", notice => {
    if (!notice || typeof notice.id !== "string" || typeof notice.message !== "string" || seen.has(notice.id)) return;
    seen.add(notice.id);
    if (seen.size > 100) seen.delete(seen.values().next().value);
    queue.push(notice);
    showNext();
  });
})();
