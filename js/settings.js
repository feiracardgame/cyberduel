(function criarConfiguracoesCyberduel(global) {
  const STORAGE_KEY = "cyberduel.settings.v1";
  const DEFAULTS = Object.freeze({
    masterVolume: 0.85,
    musicVolume: 0.75,
    effectsVolume: 0.9,
    textScale: 1.12,
  });

  const clamp = (value, minimum, maximum) =>
    Math.min(maximum, Math.max(minimum, Number(value)));

  class CyberduelSettings {
    constructor(storage = globalThis.localStorage) {
      this.storage = storage;
      this.values = { ...DEFAULTS, ...this.read() };
      this.normalize();
      this.domUpdateQueued = false;
      this.observeDocument();
    }

    read() {
      try {
        const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) || "null");
        return saved && typeof saved === "object" ? saved : {};
      } catch {
        return {};
      }
    }

    normalize() {
      this.values.masterVolume = clamp(this.values.masterVolume, 0, 1);
      this.values.musicVolume = clamp(this.values.musicVolume, 0, 1);
      this.values.effectsVolume = clamp(this.values.effectsVolume, 0, 1);
      this.values.textScale = clamp(this.values.textScale, 1, 1.35);
      for (const [key, fallback] of Object.entries(DEFAULTS)) {
        if (!Number.isFinite(this.values[key])) this.values[key] = fallback;
      }
    }

    get(key) {
      return this.values[key];
    }

    set(key, value) {
      if (!Object.hasOwn(DEFAULTS, key)) return;
      this.values[key] = Number(value);
      this.normalize();
      this.save();
      if (key === "textScale") this.queueDomTextUpdate();
    }

    reset() {
      this.values = { ...DEFAULTS };
      this.save();
      this.queueDomTextUpdate();
    }

    save() {
      try {
        this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values));
      } catch {
        // O jogo continua com as preferências da sessão se o navegador
        // bloquear armazenamento (modo privado ou política do aparelho).
      }
    }

    music(baseVolume = 1) {
      return clamp(baseVolume, 0, 1) *
        this.values.masterVolume * this.values.musicVolume;
    }

    effects(baseVolume = 1) {
      return clamp(baseVolume, 0, 1) *
        this.values.masterVolume * this.values.effectsVolume;
    }

    phaserTextStyle(style = {}) {
      const scaled = { ...style };
      const size = scaled.fontSize;
      if (typeof size === "number") scaled.fontSize = size * this.values.textScale;
      else if (typeof size === "string") {
        const match = /^([0-9]+(?:\.[0-9]+)?)(px|pt)$/.exec(size.trim());
        if (match) {
          scaled.fontSize = `${Math.round(Number(match[1]) * this.values.textScale * 10) / 10}${match[2]}`;
        }
      }
      return scaled;
    }

    applyDomTextScale(root = global.document?.body) {
      if (!root || typeof global.getComputedStyle !== "function") return;
      const selector = "h1,h2,h3,h4,p,span,small,strong,label,button,input,select,textarea";
      const elements = [];
      if (root.matches?.(selector)) elements.push(root);
      elements.push(...(root.querySelectorAll?.(selector) || []));
      for (const element of elements) {
        if (!element.dataset.cyberBaseFontSize) {
          const base = Number.parseFloat(global.getComputedStyle(element).fontSize);
          if (!Number.isFinite(base) || base <= 0) continue;
          element.dataset.cyberBaseFontSize = String(base);
        }
        const base = Number(element.dataset.cyberBaseFontSize);
        element.style.fontSize = `${Math.round(base * this.values.textScale * 10) / 10}px`;
      }
      global.document?.documentElement?.style.setProperty(
        "--cyber-text-scale",
        String(this.values.textScale),
      );
    }

    queueDomTextUpdate(root) {
      if (this.domUpdateQueued) return;
      this.domUpdateQueued = true;
      const schedule = global.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
      schedule(() => {
        this.domUpdateQueued = false;
        this.applyDomTextScale(root || global.document?.body);
      });
    }

    observeDocument() {
      if (!global.document?.body || typeof global.MutationObserver !== "function") return;
      this.observer = new global.MutationObserver((records) => {
        if (records.some((record) => record.addedNodes.length)) this.queueDomTextUpdate();
      });
      this.observer.observe(global.document.body, { childList: true, subtree: true });
      this.queueDomTextUpdate();
    }
  }

  global.CyberduelSettings = CyberduelSettings;
  global.cyberduelSettings = new CyberduelSettings();
})(typeof window !== "undefined" ? window : globalThis);
