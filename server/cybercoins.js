const feira = require("./feira-payments");

const bundles = Object.freeze([10, 25, 50, 100, 250].map(tijolinhos =>
  Object.freeze({ id: `cybercoins-${tijolinhos * 2}`, tijolinhos, cybercoins: tijolinhos * 2 })));
const processing = new Set();

function fail(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

function catalog() {
  return { currencyName: "Cybercoins", rate: 2, available: feira.available === true,
    withdrawAvailable: feira.creditAvailable === true, productId: feira.productId, bundles };
}

async function purchase(store, accountKey, body, save) {
  const bundle = bundles.find(entry => entry.id === body?.bundleId);
  if (!bundle || typeof body.purchaseId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.purchaseId))
    fail(400, "INVALID_PURCHASE", "Escolha um pacote e um identificador de compra válido.");
  const account = store.accounts[accountKey];
  const orders = store.cybercoinPurchases ||= {};
  let order = Object.hasOwn(orders, body.purchaseId) ? orders[body.purchaseId] : null;
  if (order && (order.accountKey !== accountKey || order.bundleId !== bundle.id || order.direction === "withdraw"))
    fail(409, "PURCHASE_CONFLICT", "Esta compra pertence a outra conta ou pacote.");
  if (order?.status === "completed") return order;
  if (processing.has(body.purchaseId))
    fail(409, "PAYMENT_PENDING", "Compra em processamento. Consulte novamente com o mesmo identificador.");
  if (order?.status === "pending")
    fail(409, "PAYMENT_PENDING", "Pagamento aguardando confirmação da feira. Não faça outra compra até a confirmação.");
  if (order?.status === "declined")
    fail(402, "FEIRA_DECLINED", "Pagamento recusado pela feira. Nenhuma Cybercoin foi adicionada.");
  if (Object.values(orders).some(entry => entry.accountKey === accountKey && entry !== order && ["pending", "confirmed"].includes(entry.status)))
    fail(409, "PAYMENT_PENDING", "Existe um pagamento aguardando confirmação na sua conta.");
  if (!Number.isSafeInteger(account.currency) || account.currency < 0 || !Number.isSafeInteger(account.currency + bundle.cybercoins))
    fail(409, "BALANCE_LIMIT", "O saldo da conta atingiu o limite.");
  if (!order) {
    if (feira.available !== true)
      fail(503, "FEIRA_UNAVAILABLE", "Compra de Cybercoins em breve. A integração com a feira ainda não está disponível.");
    if (typeof body.feiraToken !== "string" || body.feiraToken.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(body.feiraToken))
      fail(400, "INVALID_FEIRA_TOKEN", "Informe um token de pagamento válido da feira.");
    order = { id: body.purchaseId, accountKey, bundleId: bundle.id, tijolinhos: bundle.tijolinhos,
      cybercoins: bundle.cybercoins, status: "pending", createdAt: new Date().toISOString() };
    orders[order.id] = order;
    try { save(); } catch (error) {
      delete orders[order.id];
      fail(500, "PAYMENT_STORAGE", "Não foi possível registrar a compra. Nenhuma cobrança foi iniciada.");
    }
    processing.add(order.id);
    try {
      let receipt;
      try {
        receipt = await feira.debit({ purchaseId: order.id, bundleId: bundle.id,
          tijolinhos: bundle.tijolinhos, token: body.feiraToken });
      } catch (error) {
        if (error.code === "FEIRA_DECLINED") {
          order.status = "declined";
          try { save(); } catch { order.status = "pending"; }
          fail(402, "FEIRA_DECLINED", "Pagamento recusado pela feira. Nenhuma Cybercoin foi adicionada.");
        }
        fail(409, "PAYMENT_PENDING", "A feira ainda não confirmou o pagamento. Guarde o identificador da compra e aguarde a confirmação.");
      }
      if (typeof receipt?.id !== "string" || !receipt.id.trim() || receipt.id.length > 200 ||
          receipt.purchaseId !== order.id || receipt.tijolinhos !== order.tijolinhos ||
          Object.values(orders).some(entry => entry !== order && entry.receiptId === receipt.id))
        fail(409, "PAYMENT_PENDING", "Confirmação da feira inválida. O pagamento precisa ser conferido antes de liberar Cybercoins.");
      order.receiptId = receipt.id;
      order.status = "confirmed";
      // shortcut: pendências após queda exigem conciliação; automatizar quando a feira fornecer consulta por ID.
      try { save(); } catch {
        fail(500, "PAYMENT_STORAGE", "Pagamento confirmado, mas ainda não salvo. Consulte esta mesma compra; não pague novamente.");
      }
    } finally {
      processing.delete(order.id);
    }
  }
  // O saldo pode mudar enquanto o débito externo está em andamento.
  if (!Number.isSafeInteger(account.currency) || account.currency < 0 || !Number.isSafeInteger(account.currency + order.cybercoins))
    fail(409, "BALANCE_LIMIT", "Pagamento confirmado. Libere espaço no saldo e consulte esta mesma compra.");
  const previousBalance = account.currency;
  account.currency += order.cybercoins;
  order.status = "completed";
  order.completedAt = new Date().toISOString();
  try { save(); } catch {
    account.currency = previousBalance;
    order.status = "confirmed";
    delete order.completedAt;
    fail(500, "PAYMENT_STORAGE", "Pagamento confirmado, mas o saldo ainda não foi salvo. Consulte esta mesma compra; não pague novamente.");
  }
  return order;
}

async function withdraw(store, accountKey, body, save) {
  const bundle = bundles.find(entry => entry.id === body?.bundleId);
  if (!bundle || typeof body.purchaseId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.purchaseId))
    fail(400, "INVALID_PURCHASE", "Escolha um pacote e um identificador de câmbio válido.");
  const account = store.accounts[accountKey];
  const orders = store.cybercoinPurchases ||= {};
  let order = Object.hasOwn(orders, body.purchaseId) ? orders[body.purchaseId] : null;
  if (order && (order.accountKey !== accountKey || order.bundleId !== bundle.id || order.direction !== "withdraw"))
    fail(409, "PURCHASE_CONFLICT", "Este câmbio pertence a outra conta, pacote ou operação.");
  if (order?.status === "completed") return order;
  if (order?.status === "declined") fail(402, "FEIRA_DECLINED", "Câmbio recusado. As Cybercoins foram devolvidas.");
  if (processing.has(body.purchaseId)) fail(409, "PAYMENT_PENDING", "Câmbio em processamento. Consulte este mesmo identificador.");
  if (order && !order.receiptId)
    fail(409, "PAYMENT_REVIEW_REQUIRED", `O câmbio ${order.id} ficou sem recibo do banco. A organização precisa conferir essa tentativa antes de liberar ou devolver o valor. Esta consulta não enviou outra transferência.`);
  if (Object.values(orders).some(entry => entry !== order && entry.accountKey === accountKey && ["pending", "confirmed"].includes(entry.status)))
    fail(409, "PAYMENT_PENDING", "Existe uma operação aguardando confirmação na sua conta.");
  if (typeof body.feiraToken !== "string" || body.feiraToken.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(body.feiraToken))
    fail(401, "FEIRA_LOGIN_REQUIRED", "Autorize o banco com sua conta Google para continuar.");
  if (!order) {
    if (feira.creditAvailable !== true) fail(503, "FEIRA_UNAVAILABLE", "Câmbio com o banco ainda indisponível.");
    if (!Number.isSafeInteger(account.currency) || account.currency < bundle.cybercoins)
      fail(402, "INSUFFICIENT_CYBERCOINS", "Você não tem Cybercoins suficientes para este câmbio.");
    order = { id: body.purchaseId, accountKey, bundleId: bundle.id, direction: "withdraw",
      tijolinhos: bundle.tijolinhos, cybercoins: bundle.cybercoins, status: "pending", createdAt: new Date().toISOString() };
    account.currency -= order.cybercoins;
    orders[order.id] = order;
    try { save(); } catch {
      account.currency += order.cybercoins;
      delete orders[order.id];
      fail(500, "PAYMENT_STORAGE", "Não foi possível registrar o câmbio. Nenhuma transferência foi iniciada.");
    }
  }
  processing.add(order.id);
  try {
    if (!order.receiptId) {
      // shortcut: queda antes de salvar o recibo exige conciliação; automatizar quando a feira aceitar idempotência por ID.
      try {
        order.receiptId = await feira.credit({ tijolinhos: order.tijolinhos, token: body.feiraToken });
      } catch (error) {
        if (error.code === "FEIRA_DECLINED" && Number.isSafeInteger(account.currency + order.cybercoins)) {
          account.currency += order.cybercoins;
          order.status = "declined";
          try { save(); } catch {
            account.currency -= order.cybercoins;
            order.status = "pending";
            fail(500, "PAYMENT_STORAGE", "A devolução precisa ser conferida. Guarde o identificador do câmbio.");
          }
          fail(402, "FEIRA_DECLINED", `${error.message} As Cybercoins foram devolvidas.`);
        }
        fail(409, "PAYMENT_PENDING", "A feira ainda não confirmou o câmbio. Suas Cybercoins estão reservadas; não transfira novamente.");
      }
      if (typeof order.receiptId !== "string" || !/^[1-9][0-9]*$/.test(order.receiptId) ||
          Object.values(orders).some(entry => entry !== order && entry.receiptId === order.receiptId)) {
        delete order.receiptId;
        fail(409, "PAYMENT_PENDING", "Recibo da feira inválido ou já utilizado. O câmbio precisa ser conferido.");
      }
      // O recibo é salvo antes da consulta, permitindo retomar sem outro POST /credit.
      try { save(); } catch { fail(500, "PAYMENT_STORAGE", "Recibo recebido, mas não salvo. Consulte este mesmo câmbio."); }
    }
    let settledTijolinhos;
    try { settledTijolinhos = await feira.confirmCredit({ receiptId: order.receiptId, tijolinhos: order.tijolinhos, token: body.feiraToken }); } catch (error) {
      const code = ["FEIRA_STATEMENT_UNAUTHORIZED", "FEIRA_STATEMENT_UNAVAILABLE", "FEIRA_RECEIPT_NOT_FOUND", "FEIRA_AMOUNT_MISMATCH"].includes(error.code) ? error.code : "FEIRA_STATEMENT_UNAVAILABLE";
      fail(409, code, error.code === code ? error.message : "Não foi possível consultar o extrato da feira. O valor continua reservado; nenhum novo crédito foi enviado.");
    }
    if (settledTijolinhos === null) fail(409, "PAYMENT_PENDING", "Confira o banco: o valor do câmbio ainda não foi confirmado no extrato da feira.");
    if (!Number.isSafeInteger(settledTijolinhos) || settledTijolinhos <= 0 || settledTijolinhos > order.tijolinhos)
      fail(409, "FEIRA_AMOUNT_MISMATCH", "O valor confirmado pela feira precisa ser conferido. Nenhuma nova transferência foi enviada.");
    const spentCybercoins = settledTijolinhos * 2;
    const refundedCybercoins = order.cybercoins - spentCybercoins;
    if (!Number.isSafeInteger(account.currency) || account.currency < 0 || !Number.isSafeInteger(account.currency + refundedCybercoins))
      fail(409, "BALANCE_LIMIT", "Câmbio confirmado. Libere espaço no saldo e consulte este mesmo câmbio para receber a diferença.");
    // O preço fixo da feira pode reduzir o crédito: devolvemos a diferença junto com a conclusão.
    account.currency += refundedCybercoins;
    order.settledTijolinhos = settledTijolinhos;
    order.spentCybercoins = spentCybercoins;
    order.refundedCybercoins = refundedCybercoins;
    order.status = "completed";
    order.completedAt = new Date().toISOString();
    try { save(); } catch {
      account.currency -= refundedCybercoins;
      delete order.settledTijolinhos;
      delete order.spentCybercoins;
      delete order.refundedCybercoins;
      order.status = "pending";
      delete order.completedAt;
      fail(500, "PAYMENT_STORAGE", "Câmbio confirmado, mas não salvo. Consulte este mesmo identificador.");
    }
    return order;
  } finally { processing.delete(order.id); }
}

async function resume(store, accountKey, body, save) {
  if (typeof body?.purchaseId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.purchaseId))
    fail(400, "INVALID_PURCHASE", "Informe um identificador de câmbio válido.");
  const order = Object.hasOwn(store.cybercoinPurchases || {}, body.purchaseId) ? store.cybercoinPurchases[body.purchaseId] : null;
  if (!order || order.accountKey !== accountKey)
    fail(404, "PURCHASE_NOT_FOUND", "Esta tentativa não foi encontrada na sua conta. Nenhuma transferência foi enviada por esta consulta.");
  // Somente uma operação já registrada pode ser consultada; nunca cria outro débito/crédito externo.
  return (order.direction === "withdraw" ? withdraw : purchase)(store, accountKey,
    { bundleId: order.bundleId, purchaseId: order.id, feiraToken: body.feiraToken }, save);
}

module.exports = { catalog, purchase, withdraw, resume };
