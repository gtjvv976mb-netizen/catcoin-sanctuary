// Talks to the BAGWORK server. The server runs the agents 24/7 on mainnet;
// the browser only watches and asks the creator's wallet to sign.
async function json(url, opts = {}) {
  const r = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opts });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Request failed (' + r.status + ')');
  return body;
}
const post = (url, body) => json(url, { method: 'POST', body: JSON.stringify(body || {}) });

function hub() {
  const sets = { update: new Set(), trade: new Set(), event: new Set(), bonded: new Set() };
  return {
    on: (k, fn) => { sets[k].add(fn); return () => sets[k].delete(fn); },
    emit: (k, ...a) => sets[k].forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } }),
  };
}

export async function createApi() {
  const h = hub();
  const first = await json('/api/state');
  const api = {
    config: first.config,
    snapshot: first,
    onUpdate: (fn) => h.on('update', fn),
    onTrade: (fn) => h.on('trade', fn),
    onEvent: (fn) => h.on('event', fn),
    onBonded: (fn) => h.on('bonded', fn),

    getAgent: (id) => json('/api/agents/' + encodeURIComponent(id)).catch((e) => (/not found/i.test(e.message) ? null : Promise.reject(e))),
    blockhash: () => json('/api/blockhash'),

    prepareLaunch: (p) => post('/api/launch/prepare', p),
    setLaunchImage: (id, image) => post(`/api/launch/${id}/image`, { image }),
    confirmFunding: (id, signature) => post(`/api/launch/${id}/funded`, { signature }),

    deposit: (id, signature) => post(`/api/agents/${id}/deposit`, { signature }),
    withdraw: (id, p) => post(`/api/agents/${id}/withdraw`, p),
    pause: (id, p) => post(`/api/agents/${id}/pause`, p),
    setStrategy: (id, p) => post(`/api/agents/${id}/strategy`, p),
    retry: (id, p) => post(`/api/agents/${id}/retry`, p),
    buySkin: (id, p) => post(`/api/agents/${id}/skin/buy`, p),
    setSkin: (id, p) => post(`/api/agents/${id}/skin`, p),
    holdSkin: (id, p) => post(`/api/agents/${id}/skin/hold`, p),
    getCustom: (owner) => json('/api/custom-strategy/' + encodeURIComponent(owner)).then((r) => r.strategy),
    saveCustom: (p) => post('/api/custom-strategy', p),
  };

  const es = new EventSource('/api/stream');
  es.addEventListener('snapshot', (ev) => {
    const s = JSON.parse(ev.data);
    api.snapshot = { ...s, feed: api.snapshot.feed, bonded: api.snapshot.bonded || [] };
    if (s.config) api.config = s.config;
    h.emit('update', api.snapshot);
  });
  es.addEventListener('trade', (ev) => {
    const t = JSON.parse(ev.data);
    api.snapshot.feed = [t, ...(api.snapshot.feed || [])].slice(0, 60);
    h.emit('trade', t);
  });
  es.addEventListener('bonded', (ev) => {
    const b = JSON.parse(ev.data);
    api.snapshot.bonded = [b, ...(api.snapshot.bonded || []).filter((x) => x.mint !== b.mint)].slice(0, 12);
    h.emit('bonded', b);
  });
  for (const type of ['launch', 'fund', 'fees', 'levelup', 'reward', 'skin']) es.addEventListener(type, (ev) => h.emit('event', type, JSON.parse(ev.data)));
  return api;
}
