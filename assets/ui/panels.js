/* "About" and "Socials": two small panels opened from the pills beside "Find a cat". Both are
   native modal <dialog>s, so the focus stays inside while one is open and Escape closes it.

   The social links come from one file, data/socials.json, which the owner edits by hand. A link
   shows only when its address is a valid https address on a host this page knows (the site
   itself, X, Telegram, pump.fun, DexScreener); an empty one is simply left out. */

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** The hosts a social link may point to (and their subdomains). */
export const SOCIAL_HOSTS = ["catcoinsanctuary.com", "x.com", "twitter.com", "t.me", "telegram.me", "pump.fun", "dexscreener.com"];

/** A Solana address: base58, 32 to 44 characters. */
export const isMint = (s) => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

/** The address as a URL if it is https on an allowed host (no credentials, no odd ports), otherwise null. */
export function safeSocialUrl(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  let u;
  try { u = new URL(v.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return u.href;
}

/**
 * Checks data/socials.json. Returns a list of problems (empty when it is fine). Empty URLs are fine:
 * they mean "not yet".
 */
export function checkSocials(json) {
  const problems = [];
  if (!json || typeof json !== "object") return ["socials.json is not an object"];
  if (!Array.isArray(json.links)) problems.push("links is not a list");
  const ids = new Set();
  for (const [i, l] of (json.links || []).entries()) {
    if (!l || typeof l !== "object") { problems.push(`links[${i}] is not an object`); continue; }
    if (typeof l.id !== "string" || !/^[a-z0-9-]{1,24}$/.test(l.id)) problems.push(`links[${i}].id is missing or odd`);
    if (ids.has(l.id)) problems.push(`links[${i}].id repeats ${l.id}`);
    ids.add(l.id);
    if (typeof l.label !== "string" || !l.label.trim() || l.label.length > 60) problems.push(`links[${i}].label is missing or too long`);
    if (typeof l.url !== "string") problems.push(`links[${i}].url is not a string`);
    else if (l.url.trim() && !safeSocialUrl(l.url)) problems.push(`links[${i}].url is not an https address on an allowed host: ${l.url}`);
  }
  if (json.ticker !== undefined && (typeof json.ticker !== "string" || !/^\$[A-Z0-9]{2,12}$/.test(json.ticker))) problems.push("ticker is not like $NAME");
  if (json.contract !== undefined && json.contract !== "" && !isMint(json.contract)) problems.push("contract is not a Solana address");
  return problems;
}

/** The links to show: only valid, non-empty ones. */
export function socialLinks(json) {
  return (Array.isArray(json?.links) ? json.links : [])
    .map((l) => ({ id: String(l?.id || ""), label: String(l?.label || "").trim(), url: safeSocialUrl(l?.url) }))
    .filter((l) => l.url && l.label);
}

/** A small icon (fixed markup only). */
function icon(kind, cls) {
  const s = el("span", cls);
  if (kind === "x") s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 4l14 16M19 4L5 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  else if (kind === "telegram") s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3.5 11.5l16-6.5-3 15-5-4-2.5 3v-4.5l7.5-7-9.5 5.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';
  else if (kind === "website") s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 12h17M12 3.5c3 3.2 3 13.8 0 17M12 3.5c-3 3.2-3 13.8 0 17" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  else if (kind === "close") s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  else s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9.5c0-1.2 1.3-2 3-2s3 .8 3 2-1.3 1.7-3 2.2-3 1-3 2.3 1.3 2 3 2 3-.8 3-2M12 5.8v12.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  return s;
}

/** How a link's address reads under its label: the @handle for X, otherwise the host. */
function socialHost(l) {
  const u = new URL(l.url);
  const handle = u.pathname.split("/")[1];
  if (l.id === "x" && /^[A-Za-z0-9_]{1,15}$/.test(handle || "")) return `@${handle}`;
  return u.hostname.replace(/^www\./, "");
}

function shell(root, titleText, id) {
  root.replaceChildren();
  root.setAttribute("aria-labelledby", id);
  const head = el("div", "panel-head");
  const title = el("h2", "panel-title", titleText);
  title.id = id;
  const close = el("button", "finder-close");
  close.type = "button";
  close.setAttribute("aria-label", `Close ${titleText}`);
  close.append(icon("close"));
  close.addEventListener("click", () => root.close());
  head.append(title, close);
  const body = el("div", "panel-body");
  root.append(head, body);
  // A click on the backdrop (outside the panel's box) closes it too.
  root.addEventListener("click", (e) => {
    if (e.target !== root) return;
    const r = root.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) root.close();
  });
  return body;
}

/**
 * @param {object} o
 * @param {HTMLDialogElement} o.about
 * @param {HTMLDialogElement} o.socials
 * @param {object} [o.config]       data/socials.json (null while it loads or if it can't be read)
 * @param {() => void} [o.onDisclaimers]
 */
export function createPanels({ about, socials, config = null, onDisclaimers }) {
  const ticker = config?.ticker || "$CATSANC";

  /* ── About ── */
  {
    const body = shell(about, "About", "about-title");
    const logo = el("img", "panel-logo");
    logo.setAttribute("src", "assets/brand/wordmark-480.webp");
    logo.setAttribute("width", "480"); logo.setAttribute("height", "267");
    logo.setAttribute("alt", "Catcoin Sanctuary");
    body.append(
      logo,
      el("p", "panel-lead", `Where all catcoins live. A home for adoptable cats, and of ${ticker}.`),
      el("p", null, "The sanctuary researches companies, personalities, shows, movies and crypto projects for cats with real, verified lore (X posts and sources) that have no coin yet, or only a tiny one under $50k. Those cats move into the garden, and you can adopt one and launch its coin on StonkFun."),
      el("p", null, "Walk round the cottage and click a cat: its card tells you who it is, its lore and the posts and pages behind it. An adoptable cat becomes a real token only when it is launched on StonkFun and the hourly check finds that launch on Solana. Then a little gold coin turns over its head."),
      el("p", null, "Out by the fountain is the Hall of Fame: legendary cat coins that already exist, made by others. They are not adoptable; they are there as inspiration."),
    );
    const t = el("p", "panel-ticker");
    t.append(el("span", "panel-ticker-label", "The sanctuary's own coin"), el("span", "panel-ticker-name", ticker));
    body.append(t);
    if (isMint(config?.contract)) {
      const c = el("p", "panel-contract");
      c.append(el("span", null, "Contract "), el("code", null, config.contract));
      body.append(c);
    } else body.append(el("p", "panel-note", `${ticker} has not launched yet. Only an address posted here and on our own socials is ours.`));
    const d = el("button", "panel-link", "Read the disclaimers");
    d.type = "button";
    d.addEventListener("click", () => { about.close(); onDisclaimers?.(); });
    body.append(el("p", "panel-small", "Memecoins have no intrinsic value, and nothing here is financial advice."), d);
  }

  /* ── Socials ── */
  function drawSocials(cfg) {
    const body = shell(socials, "Socials", "socials-title");
    const links = socialLinks(cfg);
    const list = el("ul", "social-list");
    for (const l of links) {
      const li = el("li");
      const a = el("a", "social-item");
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const text = el("span", "social-text");
      text.append(el("span", "social-label", l.label), el("span", "social-host", socialHost(l)));
      a.append(icon(l.id, "social-icon"), text);
      li.append(a);
      list.append(li);
    }
    body.append(list);
    if (links.length < 3) body.append(el("p", "panel-note", "More links are on their way. Only links listed here are ours."));
  }
  drawSocials(config);

  const opener = (dlg) => () => { if (!dlg.open) dlg.showModal(); };
  return {
    openAbout: opener(about),
    openSocials: opener(socials),
    /** Redraws Socials once data/socials.json has loaded. */
    setConfig(cfg) { if (checkSocials(cfg).length === 0 || socialLinks(cfg).length) drawSocials(cfg); },
  };
}
