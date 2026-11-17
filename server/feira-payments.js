const BASE_URL = "https://feira-de-jogos.dev.br/api/v2";
const PRODUCT_ID = 86;

async function request(route, token, body) {
  const response = await fetch(`${BASE_URL}/${route}`, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const messages = { 401: route === "statement"
      ? "A feira recusou o acesso ao extrato. O Client ID usado no jogo precisa ser autorizado também para consultar o banco."
      : "A feira recusou a autorização de crédito. Sua conta e o Client ID precisam estar autorizados na feira.",
      402: "Saldo insuficiente na feira.", 403: "O produto 86 não está habilitado para esta operação na feira.",
      429: "Aguarde o intervalo da feira antes de tentar outro câmbio." };
    const error = new Error(messages[response.status] || "A feira não confirmou a operação.");
    if (route === "statement") error.code = response.status === 401 ? "FEIRA_STATEMENT_UNAUTHORIZED" : "FEIRA_STATEMENT_UNAVAILABLE";
    else if ([400, 401, 402, 403, 429].includes(response.status)) error.code = "FEIRA_DECLINED";
    throw error;
  }
  return { status: response.status, body: await response.json() };
}

module.exports = {
  // shortcut: /debit aceita apenas foods/arcade; habilitar quando a feira aceitar o jogo 86 e definir os preços dos pacotes.
  available: false,
  creditAvailable: true,
  productId: PRODUCT_ID,
  async debit() {
    throw Object.assign(new Error("A feira precisa habilitar compras de Cybercoins para o jogo 86."), { code: "FEIRA_DECLINED" });
  },
  async credit({ tijolinhos, token }) {
    try {
      const statement = await request("statement", token);
      if (!Array.isArray(statement.body)) throw new Error("O extrato da feira retornou uma resposta inválida.");
    } catch (error) {
      // A consulta não movimenta dinheiro: falhar aqui permite devolver a reserva.
      throw Object.assign(new Error(`${error.code ? error.message : "Não foi possível consultar o banco da feira."} Nenhuma transferência foi enviada.`), { code: "FEIRA_DECLINED" });
    }
    const result = await request("credit", token, { product: PRODUCT_ID, value: tijolinhos });
    if (result.status !== 201 || !Number.isSafeInteger(result.body.operation) || result.body.operation <= 0)
      throw new Error("A feira retornou uma confirmação inválida.");
    return String(result.body.operation);
  },
  async confirmCredit({ receiptId, tijolinhos, token }) {
    const result = await request("statement", token);
    if (!Array.isArray(result.body)) throw Object.assign(new Error("O extrato da feira retornou uma resposta inválida."), { code: "FEIRA_STATEMENT_UNAVAILABLE" });
    const entry = result.body.find(entry => String(entry.operation) === receiptId);
    if (!entry) throw Object.assign(new Error(`A operação ${receiptId} ainda não aparece no extrato da feira. Nenhum novo crédito foi enviado.`), { code: "FEIRA_RECEIPT_NOT_FOUND" });
    const value = typeof entry.value === "number" || typeof entry.value === "string" ? Number(entry.value) : NaN;
    if (!Number.isSafeInteger(value) || value <= 0 || value > tijolinhos)
      throw Object.assign(new Error(`A feira registrou ${entry.value} tijolinhos na operação ${receiptId}, mas o câmbio previa ${tijolinhos}. É preciso conferir o preço do produto 86 com a organização.`), { code: "FEIRA_AMOUNT_MISMATCH" });
    return entry.completed === true ? value : null;
  },
};
