// Alerta global: permanece acima de qualquer cena, inclusive durante o duelo.
class CyberduelNameGuard {
  constructor(account) {
    this.account = account;
    this.dialog = null;
    this.checking = false;
    this.interval = window.setInterval(() => this.checkSession(), 15000);
    window.addEventListener("focus", () => this.checkSession());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.checkSession();
    });
  }

  sync(restriction) {
    if (restriction) this.show(restriction, { persisted: true });
    else if (this.persisted) this.close();
  }

  async checkSession() {
    if (!this.account.user || !this.account.token || this.checking || document.hidden) return;
    this.checking = true;
    const token = this.account.token;
    try {
      const payload = await this.account.request("/api/auth/session");
      // Não redesenha o menu nem interrompe o duelo a cada verificação.
      if (this.account.token === token) this.account.applyAuth(payload, false);
    } catch {
      // Uma falha de rede mantém o aviso e permite tentar a correção novamente.
    } finally { this.checking = false; }
  }

  showBan(reason = "") {
    this.close();
    this.show(null, { banned: true, reason });
  }

  show(fields, { local = false, persisted = false, preview = false, banned = false, reason = "" } = {}) {
    if (this.dialog && this.preview && !preview) this.close();
    if (this.dialog) {
      this.persisted ||= persisted;
      return;
    }
    this.persisted = persisted;
    this.preview = preview;
    this.previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "name-guard";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "name-guard-title");
    dialog.setAttribute("aria-describedby", "name-guard-warning");
    // Apenas texto estático entra no HTML; nomes do jogador nunca são interpolados.
    dialog.innerHTML = `
      <div class="name-guard__scan" aria-hidden="true"></div>
      <div class="name-guard__shell">
        <header class="name-guard__header">
          <span>CYBERDUEL <span class="name-guard__slash">/</span> CONTROLE DE IDENTIDADE</span>
          <span class="name-guard__status">ACESSO INTERROMPIDO</span>
        </header>
        <main class="name-guard__main">
          <section class="name-guard__message">
            <div class="name-guard__eyebrow"><span class="name-guard__mark" aria-hidden="true">!</span><span>NOME BLOQUEADO<br>ALTERAÇÃO OBRIGATÓRIA</span></div>
            <h1 id="name-guard-title">ESSE NOME <br>NÃO É <br><span>PERMITIDO</span></h1>
            <p id="name-guard-warning">Infrações desse modo não serão toleradas, troque imediatamente.</p>
          </section>
          <form class="name-guard__form">
            <div class="name-guard__form-heading"><span>01 / CORREÇÃO DE IDENTIDADE</span><b>REGULARIZE <br>SEU NOME.</b></div>
            <p class="name-guard__instructions">Escolha um nome permitido para continuar.</p>
            <div class="name-guard__fields"></div>
            <p class="name-guard__error" role="alert" aria-live="assertive"></p>
            <button class="name-guard__submit" type="submit">CORRIGIR E CONTINUAR <span aria-hidden="true">↗</span></button>
            <button class="name-guard__exit" type="button"></button>
          </form>
        </main>
        <footer class="name-guard__footer"><span>SEM EXCEÇÕES. SEM ATALHOS.</span><span>ACESSO LIBERADO APÓS A CORREÇÃO</span></footer>
      </div>`;
    this.dialog = dialog;
    const form = dialog.querySelector("form");
    const container = dialog.querySelector(".name-guard__fields");
    const inputs = {};
    if (banned) {
      dialog.querySelector(".name-guard__eyebrow").textContent = "ACESSO BLOQUEADO";
      dialog.querySelector("h1").textContent = "CONTA BANIDA";
      dialog.querySelector("#name-guard-warning").textContent = reason ? `Motivo: ${reason}` : "Esta conta foi banida pela administração.";
      dialog.querySelector(".name-guard__form-heading").textContent = "O acesso depende de liberação pela administração.";
      dialog.querySelector(".name-guard__instructions").textContent = "Você pode voltar à tela de login.";
      dialog.querySelector("footer").textContent = "CYBERDUEL / MODERAÇÃO DE CONTAS";
    }
    const addField = (name, labelText, maxLength, hint) => {
      const label = document.createElement("label");
      label.className = "name-guard__field";
      const caption = document.createElement("span");
      caption.textContent = labelText;
      const input = document.createElement("input");
      Object.assign(input, { name, type: "text", required: true, maxLength, autocomplete: name === "username" ? "username" : "nickname" });
      input.setAttribute("aria-label", labelText);
      input.placeholder = name === "nickname" ? "Seu novo apelido" : "Seu novo nick";
      input.spellcheck = false;
      if (name === "username") { input.minLength = 3; input.pattern = "[a-zA-Z0-9_.\\-]{3," + maxLength + "}"; }
      const help = document.createElement("small");
      help.textContent = hint;
      label.append(caption, input, help);
      container.append(label);
      inputs[name] = input;
    };
    if (banned) { /* Banimento não pode ser removido com uma troca de nome. */ }
    else if (local) addField("username", "NOVO NOME", 18, "3–18 caracteres. Letras, números, ponto, hífen ou sublinhado.");
    else {
      if (fields?.username) addField("username", "NOVO NICK ÚNICO", this.account.authProvider === "local" ? 18 : 24, "Letras, números, ponto, hífen ou sublinhado. Mínimo: 3 caracteres.");
      if (fields?.nickname || !fields?.username) addField("nickname", "NOVO APELIDO", 32, "Até 32 caracteres. Sem termos ofensivos ou identificação da equipe.");
    }
    const error = dialog.querySelector(".name-guard__error");
    const submit = dialog.querySelector(".name-guard__submit");
    const exit = dialog.querySelector(".name-guard__exit");
    if (banned) submit.remove();
    if (preview) {
      dialog.dataset.preview = "true";
      dialog.querySelector(".name-guard__instructions").textContent = "PRÉVIA LOCAL — nenhum dado da sua conta será alterado.";
      submit.firstChild.textContent = "SIMULAR CORREÇÃO ";
    }
    exit.textContent = preview ? "FECHAR TESTE" : this.account.user ? "SAIR DA CONTA" : "VOLTAR AO LOGIN";
    exit.addEventListener("click", async () => {
      if (submit.disabled) return;
      if (banned) { this.close(); window.location.reload(); return; }
      if (preview) { this.close(); return; }
      if (this.account.user) {
        // A tela do jogo ativo precisa voltar ao login ao encerrar a sessão.
        await this.account.logout();
        window.location.reload();
      } else this.close();
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (banned) return;
      if (submit.disabled) return;
      if (preview) { this.close(); return; }
      submit.disabled = true;
      error.textContent = "";
      submit.firstChild.textContent = "VALIDANDO NOVO NOME… ";
      try {
        const values = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]));
        if (local) await this.account.localLogin(values.username);
        else await this.account.correctName(values);
        this.close();
      } catch (exception) {
        error.textContent = exception.code === "NAME_NOT_ALLOWED" ? "Esse nome também não é permitido. Escolha outro." : exception.message;
        Object.values(inputs)[0].focus();
      } finally {
        submit.disabled = false;
        submit.firstChild.textContent = "CORRIGIR E CONTINUAR ";
      }
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      if (preview) this.close();
    });
    document.body.append(dialog);
    dialog.showModal();
    // O diálogo torna a página inerte; bloqueia também o teclado global do Phaser.
    dialog.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll("input, button")].filter(node => !node.disabled && !node.hidden);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    const gameInput = typeof game !== "undefined" ? game.input : null;
    this.gameInput = gameInput;
    this.inputWasEnabled = gameInput?.enabled;
    if (gameInput) gameInput.enabled = false;
    (Object.values(inputs)[0] || exit).focus({ preventScroll: true });
  }

  close() {
    if (!this.dialog) return;
    this.dialog.close();
    this.dialog.remove();
    this.dialog = null;
    this.persisted = false;
    this.preview = false;
    if (this.gameInput) this.gameInput.enabled = this.inputWasEnabled;
    this.gameInput = null;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }
}

window.cyberduelNameGuard = new CyberduelNameGuard(window.cyberduelAccount);
