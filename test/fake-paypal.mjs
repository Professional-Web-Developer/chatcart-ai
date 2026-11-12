// In-memory stand-in for the PayPal REST API, installed over globalThis.fetch. No network, no real keys.
export function installFakePayPal() {
  process.env.PAYPAL_CLIENT_ID = 'test-client-id';
  process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
  process.env.PAYPAL_API_BASE = 'https://paypal.test';
  delete process.env.DATABASE_URL;

  const state = { orders: new Map(), calls: [], refunded: new Set(), invoices: new Map(), seq: 0, failNext: null };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method ?? 'GET';
    const body = init.body && u.pathname !== '/v1/oauth2/token' ? JSON.parse(init.body) : undefined;
    state.calls.push({ method, path: u.pathname, body, headers: init.headers ?? {}, raw: init.body });
    if (u.pathname === '/v1/oauth2/token') return json(200, { access_token: 'tok', expires_in: 3600 });
    if (state.failNext && state.failNext.match(method, u.pathname)) {
      const f = state.failNext; state.failNext = null;
      return json(f.status, { name: 'ERR', details: [{ issue: f.issue }] });
    }
    let m;
    if (method === 'POST' && u.pathname === '/v2/checkout/orders') {
      const id = `PPORDER${++state.seq}`;
      const unit = body.purchase_units[0];
      const o = { id, status: 'PAYER_ACTION_REQUIRED', purchase_units: [{ custom_id: unit.custom_id, amount: unit.amount }] };
      state.orders.set(id, o);
      return json(200, o);
    }
    if ((m = u.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)$/)) && method === 'GET') {
      const o = state.orders.get(m[1]);
      return o ? json(200, o) : json(404, { name: 'RESOURCE_NOT_FOUND' });
    }
    if ((m = u.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/)) && method === 'POST') {
      const o = state.orders.get(m[1]);
      if (!o) return json(404, { name: 'RESOURCE_NOT_FOUND' });
      if (o.status !== 'APPROVED') return json(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: o.status === 'COMPLETED' ? 'ORDER_ALREADY_CAPTURED' : 'ORDER_NOT_APPROVED' }] });
      o.status = 'COMPLETED';
      o.purchase_units[0].payments = { captures: [{ id: `CAP${++state.seq}`, status: 'COMPLETED', amount: o.purchase_units[0].amount }] };
      return json(201, o);
    }
    if ((m = u.pathname.match(/^\/v2\/payments\/captures\/([^/]+)\/refund$/)) && method === 'POST') {
      if (state.refunded.has(m[1])) return json(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'CAPTURE_FULLY_REFUNDED' }] });
      state.refunded.add(m[1]);
      return json(201, { id: `REF${++state.seq}`, status: 'COMPLETED' });
    }
    if (method === 'POST' && u.pathname === '/v2/invoicing/invoices') {
      const id = `INV2-TEST-${++state.seq}`;
      state.invoices.set(id, { ...body, id, status: 'DRAFT' });
      return json(201, { id, status: 'DRAFT' });
    }
    if ((m = u.pathname.match(/^\/v2\/invoicing\/invoices\/([^/]+)\/send$/)) && method === 'POST') {
      state.invoices.get(m[1]).status = 'SENT';
      return json(200, { href: `https://paypal.test/invoice/p/#${m[1]}`, rel: 'payer-view', method: 'GET' });
    }
    if ((m = u.pathname.match(/^\/v2\/invoicing\/invoices\/([^/]+)$/)) && method === 'GET') {
      return json(200, { id: m[1], status: 'SENT', detail: { metadata: { recipient_view_url: `https://paypal.test/invoice/p/#${m[1]}` } } });
    }
    return json(500, { name: 'UNEXPECTED_TEST_CALL' });
  };

  return {
    state,
    approve(id) { state.orders.get(id).status = 'APPROVED'; },
    calls: (method, re) => state.calls.filter((c) => c.method === method && re.test(c.path)),
    failOnce(method, re, status, issue) { state.failNext = { match: (mm, p) => mm === method && re.test(p), status, issue }; },
  };
}
