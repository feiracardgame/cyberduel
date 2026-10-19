(function (global) {
  const format = new Intl.NumberFormat("pt-BR");
  const fallbackAvatar = "assets/fotosdeperfil/ia_treinamento_icon.png";
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  class CyberduelLeaderboard {
    constructor(root) {
      this.root = root;
      this.body = root.querySelector("#leaderboard-rows");
      this.status = root.querySelector("#leaderboard-status");
      this.empty = root.querySelector("#leaderboard-empty");
      this.entries = [];
      this.initialized = false;
      this.rows = new Map();
      this.reducedMotion = global.matchMedia("(prefers-reduced-motion: reduce)");
      this.nameResizeObserver = global.ResizeObserver ? new global.ResizeObserver(() => this.updateNameScrolling()) : null;
      this.nameResizeObserver?.observe(root);
      document.fonts?.ready.then(() => this.updateNameScrolling());
      this.fillSlots();
    }

    createRow(entry) {
      const row = document.createElement("tr");
      row.className = "council-row";
      row.dataset.username = entry.username;
      const rank = document.createElement("td");
      rank.className = "rank-cell";
      const number = document.createElement("span");
      number.className = "rank-number";
      const movement = document.createElement("span");
      movement.className = "movement";
      movement.setAttribute("aria-hidden", "true");
      rank.append(number, movement);
      const portrait = document.createElement("td");
      portrait.className = "portrait-cell";
      const image = document.createElement("img");
      image.alt = "";
      image.addEventListener("error", () => {
        if (image.getAttribute("src") !== fallbackAvatar) image.src = fallbackAvatar;
      });
      portrait.append(image);
      const identity = document.createElement("td");
      const nameViewport = document.createElement("span");
      nameViewport.className = "player-name";
      const name = document.createElement("span");
      name.className = "player-name-text";
      nameViewport.append(name);
      identity.append(nameViewport);
      const influence = document.createElement("td");
      influence.className = "influence-cell";
      const score = document.createElement("span");
      score.className = "influence-value";
      influence.append(score);
      row.append(rank, portrait, identity, influence);
      row.parts = { number, movement, image, name, nameViewport, score };
      this.writeRow(row, entry);
      return row;
    }

    writeRow(row, entry) {
      row.parts.number.textContent = entry.position;
      if (row.parts.name.textContent !== (entry.nickname || entry.username)) row.parts.name.textContent = entry.nickname || entry.username;
      row.parts.name.title = entry.nickname || entry.username;
      const avatar = entry.avatar || fallbackAvatar;
      if (row.parts.image.getAttribute("src") !== avatar) row.parts.image.src = avatar;
      row.parts.score.textContent = format.format(entry.rating);
      row.setAttribute("aria-label", `${entry.position}º, ${entry.nickname || entry.username}, ${format.format(entry.rating)} de influência`);
    }

    fillSlots() {
      this.body.querySelectorAll(".is-placeholder").forEach(row => row.remove());
      for (let i = this.rows.size; i < 10; i++) {
        const row = document.createElement("tr");
        row.className = "council-row is-placeholder";
        row.setAttribute("aria-hidden", "true");
        for (const [className, value] of [["rank-cell", i + 1], ["portrait-cell", ""], ["", ""], ["influence-cell", "—"]]) {
          const cell = document.createElement("td");
          cell.className = className;
          cell.textContent = value;
          row.append(cell);
        }
        this.body.append(row);
      }
    }

    updateNameScrolling() {
      for (const row of this.rows.values()) {
        const { name, nameViewport } = row.parts;
        if (!nameViewport.clientWidth) continue;
        const overflow = Math.max(0, name.scrollWidth - nameViewport.clientWidth);
        nameViewport.classList[overflow > 1 ? "add" : "remove"]("is-scrolling");
        name.style.setProperty("--name-overflow", `${overflow}px`);
        name.style.setProperty("--name-duration", `${Math.max(6, overflow / 25 + 4)}s`);
      }
    }

    async countScore(element, from, to, duration) {
      const start = performance.now();
      await new Promise(resolve => {
        const tick = now => {
          const progress = Math.min(1, (now - start) / duration);
          element.textContent = format.format(Math.round(from + (to - from) * (1 - (1 - progress) ** 3)));
          if (progress < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }

    async update(entries) {
      const next = entries.slice(0, 10).map((entry, i) => ({ ...entry, position: i + 1 }));
      const previous = new Map(this.entries.map(entry => [entry.username, entry]));
      const animate = this.initialized && !this.reducedMotion.matches;
      let moving = false;
      for (const entry of next) {
        const old = previous.get(entry.username);
        const row = this.rows.get(entry.username);
        if (!old || !row) continue;
        if (old.position !== entry.position) {
          moving = true;
          row.classList.add(entry.position < old.position ? "is-up" : "is-down");
          row.parts.movement.title = entry.position < old.position ? "Subiu no ranking" : "Desceu no ranking";
        }
        if (old.rating !== entry.rating || old.nickname !== entry.nickname || old.avatar !== entry.avatar) row.classList.add("is-changed");
      }
      // Primeiro sinaliza a mudança; depois as próprias linhas trocam de lugar.
      if (moving && animate) await pause(650);
      const tops = new Map([...this.rows].map(([id, row]) => [id, row.getBoundingClientRect().top]));
      const ids = new Set(next.map(entry => entry.username));
      const transitions = [];
      for (const [id, row] of this.rows) {
        if (ids.has(id)) continue;
        if (animate) transitions.push(row.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).finished.catch(() => {}));
      }
      await Promise.all(transitions);
      for (const [id, row] of this.rows) {
        if (!ids.has(id)) { row.remove(); this.rows.delete(id); }
      }
      transitions.length = 0;
      for (const entry of next) {
        let row = this.rows.get(entry.username);
        const old = previous.get(entry.username);
        if (!row) {
          row = this.createRow(entry);
          this.rows.set(entry.username, row);
          if (this.initialized) row.classList.add("is-new");
        }
        this.writeRow(row, entry);
        this.body.append(row);
        if (animate && old?.rating !== undefined && old.rating !== entry.rating) transitions.push(this.countScore(row.parts.score, old.rating, entry.rating, 1100));
      }
      this.fillSlots();
      this.empty.hidden = next.length > 0;
      for (const entry of next) {
        if (!animate) continue;
        const row = this.rows.get(entry.username);
        const offset = tops.has(entry.username) ? tops.get(entry.username) - row.getBoundingClientRect().top : 0;
        if (offset || !previous.has(entry.username)) {
          const frames = previous.has(entry.username)
            ? [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }]
            : [{ opacity: 0, transform: "translateX(20px)" }, { opacity: 1, transform: "translateX(0)" }];
          transitions.push(row.animate(frames, { duration: 1100, easing: "cubic-bezier(.22,1,.36,1)" }).finished.catch(() => {}));
        }
      }
      this.entries = next;
      this.initialized = true;
      await Promise.all(transitions);
      this.updateNameScrolling();
      if (animate && (moving || this.body.querySelector(".is-changed, .is-new"))) await pause(1200);
      for (const row of this.rows.values()) row.classList.remove("is-up", "is-down", "is-changed", "is-new");
    }

    async refresh() {
      if (this.stopped || this.loading) return;
      clearTimeout(this.timer);
      this.loading = true;
      try {
        const response = await fetch(`${global.cyberduelServerUrl()}/api/leaderboard`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw Error("Ranking indisponível");
        const data = await response.json();
        if (!data.ok || !Array.isArray(data.entries) || data.entries.some(entry => !entry.username || !Number.isFinite(entry.rating))) throw Error("Resposta inválida");
        if (this.stopped) return;
        await this.update(data.entries);
        this.root.classList.add("is-live");
        this.root.classList.remove("is-offline");
        this.status.textContent = "";
      } catch {
        this.root.classList.remove("is-live");
        this.root.classList.add("is-offline");
        this.status.textContent = this.entries.length ? "Reconectando… Última classificação mantida." : "Sem conexão com o ranking. Tentando novamente…";
      } finally {
        this.loading = false;
        if (!this.stopped) this.timer = setTimeout(() => this.refresh(), 3000);
      }
    }

    stop() { this.stopped = true; clearTimeout(this.timer); }
  }

  global.CyberduelLeaderboard = CyberduelLeaderboard;
  const root = document.querySelector(".council-board");
  if (!root) return;
  const rain = document.querySelector(".code-rain");
  for (let i = 0; i < 32; i++) {
    const column = document.createElement("span");
    column.textContent = "01011001011010010100011001010110001010110100101010110100";
    column.style.cssText = `--x:${i * 3.2}%;--duration:${18 + i % 9}s;--delay:-${i * 2}s`;
    rain.append(column);
  }
  const board = global.cyberduelLeaderboard = new CyberduelLeaderboard(root);
  board.refresh();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) board.refresh(); });
  global.addEventListener("pagehide", () => board.stop());
  global.addEventListener("pageshow", () => { if (board.stopped) { board.stopped = false; board.refresh(); } });
})(window);
