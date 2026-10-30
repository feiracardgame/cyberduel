(function (global) {
  const panel = document.getElementById("boot-status");
  const message = panel.querySelector("p");
  const retry = panel.querySelector("button");
  let finished = false;
  retry.onclick = () => global.location.reload();
  const fail = () => {
    message.textContent = "Não foi possível abrir o jogo. Verifique a conexão e tente novamente.";
    retry.hidden = false;
    panel.hidden = false;
  };
  global.cyberduelBoot = {
    loading() { panel.hidden = true; },
    ready() { finished = true; panel.hidden = true; },
    fail,
  };
  global.addEventListener("error", () => { if (!finished) fail(); }, true);
  global.addEventListener("unhandledrejection", () => { if (!finished) fail(); });
  document.addEventListener("webglcontextlost", () => {
    message.textContent = "Restaurando a imagem do jogo…";
    retry.hidden = false;
    panel.hidden = false;
  }, true);
  document.addEventListener("webglcontextrestored", () => { panel.hidden = true; }, true);
})(window);
