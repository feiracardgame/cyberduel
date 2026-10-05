// Janelas incluem a duração dos MP3 e uma pequena margem antes do relógio.
(function (global) {
  const announcements = Object.freeze({
    inicio: { texto: "Hora do Cyberduelo", som: "somHoraCyberduelo", arquivo: "hora_do_cyberduelo.mp3", duracao: 2900 },
    colocar: { texto: "Turno de posicionamento", som: "somTurnoPosicionamento", arquivo: "turno_de_posicionamento.mp3", duracao: 3300 },
    habilidades: { texto: "Turno de habilidade", som: "somTurnoHabilidade", arquivo: "turno_de_habilidade.mp3", duracao: 2400 },
  });
  if (typeof module !== "undefined") module.exports = announcements;
  else global.cyberduelBattleAnnouncements = announcements;
})(typeof window !== "undefined" ? window : globalThis);
