/* A very small stand-in for the browser's DOM: just enough of it for the page's card and list
   (assets/ui/card.js, assets/ui/finder.js) to render in Node, so a test can read what a visitor
   would see on each cat's card. Not a browser: no layout, no CSS, no events beyond click. */

export class Node {
  constructor() { this.parentNode = null; }
}

export class Text extends Node {
  constructor(data) { super(); this.data = String(data); }
  get textContent() { return this.data; }
}

const matches = (e, sel) => {
  const m = /^([a-z0-9]*)(?:#([\w-]+))?((?:\.[\w-]+)*)$/i.exec(sel.trim());
  if (!m) throw new Error(`minidom: unsupported selector ${sel}`);
  const [, tag, id, classes] = m;
  if (tag && e.tagName !== tag.toUpperCase()) return false;
  if (id && e.id !== id) return false;
  for (const c of classes.split(".").filter(Boolean)) if (!e.classList.contains(c)) return false;
  return true;
};

export class Element extends Node {
  constructor(tag) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.hidden = false;
    this.value = "";
    this.style = { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } };
    const self = this;
    this.classList = {
      contains: (c) => self.className.split(/\s+/).includes(c),
      add: (...cs) => { self.className = [...new Set([...self.className.split(/\s+/).filter(Boolean), ...cs])].join(" "); },
      remove: (...cs) => { self.className = self.className.split(/\s+/).filter((c) => c && !cs.includes(c)).join(" "); },
      toggle: (c, force) => { const on = force === undefined ? !self.classList.contains(c) : !!force; if (on) self.classList.add(c); else self.classList.remove(c); return on; },
    };
  }
  get className() { return this.attributes.class ?? ""; }
  set className(v) { this.attributes.class = String(v); }
  get id() { return this.attributes.id ?? ""; }
  set id(v) { this.attributes.id = String(v); }
  get children() { return this.childNodes.filter((n) => n instanceof Element); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this.replaceChildren(String(v ?? "")); }
  set innerHTML(v) { this.html = String(v); this.childNodes = []; }
  append(...nodes) {
    for (const n of nodes) {
      const node = n instanceof Node ? n : new Text(n);
      if (node.parentNode) node.parentNode.childNodes = node.parentNode.childNodes.filter((x) => x !== node);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  prepend(...nodes) {
    const keep = this.childNodes;
    this.childNodes = [];
    this.append(...nodes);
    this.childNodes.push(...keep.filter((n) => !this.childNodes.includes(n)));
  }
  remove() { const p = this.parentNode; if (p) { p.childNodes = p.childNodes.filter((x) => x !== this); this.parentNode = null; } }
  replaceChildren(...nodes) { for (const n of this.childNodes) n.parentNode = null; this.childNodes = []; this.append(...nodes.filter((n) => n !== "")); }
  replaceWith(n) {
    const p = this.parentNode;
    if (!p) return;
    if (n.parentNode) n.parentNode.childNodes = n.parentNode.childNodes.filter((x) => x !== n);
    const i = p.childNodes.indexOf(this);
    n.parentNode = p;
    p.childNodes[i] = n;
    this.parentNode = null;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { for (const fn of this.listeners.click ?? []) fn({ preventDefault() {} }); }
  focus() {}
  scrollTo() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  /** Every element under this one, depth first. */
  *walk() { for (const n of this.childNodes) if (n instanceof Element) { yield n; yield* n.walk(); } }
  querySelectorAll(sel) { const sels = sel.split(",").map((s) => s.trim()); return [...this.walk()].filter((e) => sels.some((s) => matches(e, s))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

/** Installs the stand-in as the globals the page's scripts use. Returns a function that removes it. */
export function installDom({ width = 1440, height = 900 } = {}) {
  const saved = {};
  const set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  set("document", { createElement: (tag) => new Element(tag) });
  set("Node", Node);
  set("ResizeObserver", class { observe() {} disconnect() {} });
  set("requestAnimationFrame", () => 0);
  set("addEventListener", () => {});
  set("window", { innerWidth: width, innerHeight: height });
  return () => { for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } };
}
