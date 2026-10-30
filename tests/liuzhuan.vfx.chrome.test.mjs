// 回归测试：中央大幅流转特效只操作视觉 DOM，不影响任何真实卡牌或游戏存档。
import assert from "node:assert/strict";
const base = "http://127.0.0.1:9252";
const tab = await (await fetch(base + "/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok, bad) => { socket.onopen = ok; socket.onerror = bad; });
let next = 0;
const pending = new Map(), errors = [];
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params?.exceptionDetails?.text);
};
function send(method, params = {}) {
  return Promise.race([
    new Promise(resolve => { const id = ++next; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); }),
    new Promise((_, reject) => setTimeout(() => reject(Error("CDP timeout: " + method)), 10000)),
  ]);
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.result?.exceptionDetails) throw Error(JSON.stringify(response.result.exceptionDetails));
  return response.result?.result?.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expr, timeoutMs = 10000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (await evaluate(expr)) return;
    await sleep(150);
  }
  throw Error("Timeout: " + expr);
}
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:8089/tests/liuzhuan.vfx.preview.html" });
  await until("!!window.previewLiuzhuan");
  await evaluate("document.querySelector('#gain').click()");
  await until("!!document.querySelector('.lz-overlay .lz-title')");
  const initial = await evaluate("(()=>{const a=document.querySelector('.lz-overlay'),stage=a.querySelector('.lz-stage'),r=stage.getBoundingClientRect();return {title:a.querySelector('.lz-title').textContent,badge:a.querySelector('.lz-badge').textContent,count:a.querySelectorAll('.lz-comet').length,pointer:getComputedStyle(a).pointerEvents,center:Math.abs(r.left+r.width/2-innerWidth/2)<10,styles:!!document.querySelector('#liuzhuan-effect-styles'),color:getComputedStyle(a.querySelector('.lz-title')).color}})()");
  assert.equal(initial.title, "流转");
  assert.equal(initial.badge, "回收 3 张");
  assert.equal(initial.count, 3);
  assert.equal(initial.pointer, "none");
  assert.ok(initial.center);
  assert.ok(initial.styles);
  await evaluate("window.previewLiuzhuan({kind:'gain',source:document.querySelector('#enemy'),target:document.querySelector('#hero'),count:2})");
  assert.equal(await evaluate("document.querySelectorAll('.lz-overlay').length"), 1);
  assert.equal(await evaluate("document.querySelector('.lz-badge')?.textContent"), "回收 5 张");
  await sleep(2100);
  assert.equal(await evaluate("document.querySelectorAll('.lz-overlay').length"), 0);
  await evaluate("document.querySelector('#mark').click()");
  await until("!!document.querySelector('.lz-mark')");
  assert.equal(await evaluate("document.querySelector('.lz-mark').textContent"), "转");
  await sleep(950);
  assert.equal(await evaluate("document.querySelectorAll('.lz-mark').length"), 0);
  assert.deepEqual(errors, []);
  console.log("LIUZHUAN_VFX", JSON.stringify({success:true,initial,combinedCount:5,cleanup:true,mark:true,errors:errors.length}));
} catch(error) {
  console.error("LIUZHUAN_VFX", JSON.stringify({success:false,error:String(error),errors}));
  process.exitCode = 1;
} finally { socket.close(); }
