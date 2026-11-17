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
    const messages = { 401: "Entre novamente com Google. Sua conta e o Client ID precisam estar autorizados na feira.",
      402: "Saldo insuficiente na feira.", 403: "O produto 86 não está habilitado para esta operação na feira.",
      429: "Aguarde o intervalo da feira antes de tentar outro câmbio." };
    const error = new Error(messages[response.status] || "A feira não confirmou a operação.");
    if ([400, 401, 402, 403, 429].includes(response.status)) error.code = "FEIRA_DECLINED";
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
    const result = await request("credit", token, { product: PRODUCT_ID, value: tijolinhos });
    if (result.status !== 201 || !Number.isSafeInteger(result.body.operation) || result.body.operation <= 0)
      throw new Error("A feira retornou uma confirmação inválida.");
    return String(result.body.operation);
  },
  async confirmCredit({ receiptId, tijolinhos, token }) {
    const result = await request("statement", token);
    return Array.isArray(result.body) && result.body.some(entry =>
      String(entry.operation) === receiptId && entry.completed === true && Number(entry.value) === tijolinhos);
  },
};
