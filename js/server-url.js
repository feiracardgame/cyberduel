(function configurarServidor(global) {
  // API e Socket.IO devem usar sempre o mesmo destino.
  global.cyberduelServerUrl = function () {
    const parametro = new URLSearchParams(location.search).get("server");
    const configurado = global.CYBERDUEL_SERVER_URL || parametro;
    if (configurado && /^https?:\/\//i.test(configurado)) {
      return String(configurado).replace(/\/$/, "");
    }

    const portasEstaticas = new Set(["4173", "5173", "5500", "5501", "8080"]);
    if (portasEstaticas.has(location.port)) {
      return `${location.protocol}//${location.hostname}:3000`;
    }
    return location.origin;
  };
})(window);
