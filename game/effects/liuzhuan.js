/** DIY 张春华「流转」视觉效果。不改变牌局、语音或真实卡牌信息。 */
const STYLE_ID = "liuzhuan-effect-styles";
let running = null;
const marked = new WeakMap();
function css() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "/game/effects/liuzhuan.css?v=20261030-1";
  document.head.append(link);
}
function node(parent, tag, cls, value) {
  const el = document.createElement(tag);
  el.className = cls;
  if (value !== undefined) el.textContent = value;
  parent.append(el);
  return el;
}
function position(subject, x, y) {
  const el = subject?.node?.avatar || subject?.node?.avatar2 || subject?.node || subject;
  const rect = el?.getBoundingClientRect?.();
  return rect && rect.width > 0 && rect.height > 0
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x, y };
}
function reducedMotion() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}
function stream(layer, from, to, count, duration) {
  if (reducedMotion() || !Element.prototype.animate) return;
  const w = innerWidth, h = innerHeight;
  const start = position(from, w * .23, h * .51);
  const end = position(to, w * .77, h * .53);
  const n = Math.min(Math.max(1, count), 6);
  for (let i = 0; i < n; i++) {
    const dot = node(layer, "i", "lz-comet");
    const s = (i - (n - 1) / 2) * 19;
    const point = (x, y, scale) => "translate(" + x + "px," + y + "px) scale(" + scale + ")";
    dot.animate([
      { transform: point(start.x, start.y + s, .3), opacity: 0, offset: 0 },
      { transform: point(start.x * .5 + w * .25, start.y * .5 + h * .23 + s - 23, 1.1), opacity: .85, offset: .26 },
      { transform: point(w * .5 + s * .3, h * .48, 1.6), opacity: 1, offset: .5 },
      { transform: point(end.x * .5 + w * .25, end.y * .5 + h * .23 + s - 22, .9), opacity: .68, offset: .76 },
      { transform: point(end.x, end.y, .1), opacity: 0, offset: 1 },
    ], { duration, delay: i * 35, easing: "ease-in-out", fill: "forwards" });
  }
}
function stop(current) {
  if (!current || current.closing) return;
  current.closing = true;
  current.layer.classList.add("lz-fading");
  setTimeout(() => {
    current.layer.remove();
    if (running === current) running = null;
  }, 260);
}
function gain(options) {
  const raw = Number(options.count);
  const count = Number.isFinite(raw) ? Math.max(1, Math.min(99, Math.round(raw))) : 1;
  const now = performance.now();
  if (running && !running.closing && document.contains(running.layer) && now - running.started < 650) {
    running.count += count;
    running.badge.textContent = "回收 " + running.count + " 张";
    running.badge.hidden = false;
    return;
  }
  if (running) stop(running);
  css();
  const duration = reducedMotion() ? 400 : 1420;
  const layer = node(document.body, "div", "lz-overlay");
  layer.setAttribute("aria-hidden", "true");
  node(layer, "div", "lz-veil");
  const stage = node(layer, "div", "lz-stage");
  node(stage, "div", "lz-halo");
  node(stage, "div", "lz-arc");
  node(stage, "div", "lz-arc lz-arc2");
  if (!reducedMotion()) {
    for (let i = 0; i < 18; i++) {
      const spark = node(stage, "i", "lz-spark");
      spark.style.setProperty("--lz-angle", (i * 20) + "deg");
      spark.style.setProperty("--lz-distance", (120 + i % 5 * 21) + "px");
      spark.style.setProperty("--lz-delay", (i % 6 * 40) + "ms");
    }
  }
  const title = node(stage, "div", "lz-titlewrap");
  node(title, "div", "lz-title", "流转");
  node(title, "div", "lz-subtitle", "流 光 回 环");
  const badge = node(title, "div", "lz-badge", "回收 " + count + " 张");
  badge.hidden = count <= 1;
  stream(layer, options.source, options.target, count, duration);
  const current = { layer, badge, count, started: now, closing: false };
  running = current;
  setTimeout(() => stop(current), duration);
}
function mark(options) {
  const who = options.source;
  if (!who || typeof who !== "object") return;
  const now = performance.now();
  if (now - (marked.get(who) || 0) < 550) return;
  marked.set(who, now);
  css();
  const p = position(who, innerWidth / 2, innerHeight / 2);
  const item = node(document.body, "span", "lz-mark", "转");
  item.setAttribute("aria-hidden", "true");
  item.style.left = p.x + "px";
  item.style.top = Math.max(24, p.y - 54) + "px";
  setTimeout(() => item.remove(), 720);
}
/** @param {{kind?:'gain'|'mark',source?:object,target?:object,count?:number}} options */
export function playLiuzhuanEffect(options = {}) {
  try {
    if (typeof document === "undefined" || document.hidden) return;
    if (options.kind === "mark") mark(options);
    else gain(options);
  } catch (err) {
    console.warn("[Liuzhuan VFX] cosmetic error ignored", err);
  }
}
