// 无尽模式 DIY 选择 3 项技能→角色加载→模拟换将→存档续玩→新游戏重置，Chrome CDP 端到端回归。
import assert from "node:assert/strict";
const base="http://127.0.0.1:9252";
const tab=await (await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let id=0;const pending=new Map(),errors=[];
const nap=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return Promise.race([new Promise(resolve=>{const key=++id;pending.set(key,resolve);ws.send(JSON.stringify({id:key,method,params}))}),new Promise((_,reject)=>setTimeout(()=>reject(new Error("CDP timeout "+method)),12000))])}
ws.onmessage=e=>{let r=JSON.parse(e.data);if(r.id&&pending.has(r.id)){pending.get(r.id)(r);pending.delete(r.id)}if(r.method==="Page.javascriptDialogOpening")void send("Page.handleJavaScriptDialog",{accept:true});if(r.method==="Runtime.exceptionThrown")errors.push(r.params?.exceptionDetails?.exception?.description||r.params?.exceptionDetails?.text);};
await send("Page.enable");await send("Runtime.enable");
async function run(expression){const o=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(o.result?.exceptionDetails)throw Error(JSON.stringify(o.result.exceptionDetails).slice(0,1400));if(o.result?.result?.subtype==="error")throw Error(o.result.result.description);return o.result?.result?.value;}
async function until(expr,limit=11000){const start=Date.now();while(Date.now()-start<limit){const r=await run(expr);if(r)return r;await nap(250)}throw Error("Timeout waiting for "+expr.slice(0,110));}
async function navigate(){
  await send("Page.navigate",{url:"http://localhost:8089/index.html?mode=endless&build=endless-diy-skill-choice-test-20261027"});
  await nap(4200);
  const splash=await run("!!document.querySelector('#splash')");
  if(splash){await run("document.querySelector('#splash [link=endless]')?.click()");await nap(2300)}
}
async function selectThree(){
  for(let i=0;i<3;i++){
    await until("document.querySelectorAll('.dialog .button.character.selectable').length");
    const selected=await run(`(()=>{const options=[...document.querySelectorAll('.dialog .button.character.selectable')];const b=options.find(x=>x.link==='diy_zhangchunhua')||options[0];if(!b)return null;b.click();return b.link})()`);
    assert.ok(selected,"No selectable character "+i);
    if(i===0)assert.equal(selected,"diy_zhangchunhua");
    await nap(900);
  }
}
try{
  // 清除独立测试 profile 中的历史存档，不修改日常 Chrome 用户数据。
  await navigate();
  const prompt=await run("(()=>{const x=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='开始新的无尽游戏');if(x){x.click();return true}return false})()");
  if(prompt)await nap(900);
  await selectThree();
  await until("!!document.querySelector('#endless-diy-skill-picker')");
  // 竖向矮窗 / 手机窄窗：列表必须在面板内部滚动，底部确认按钮不能跑到窗口外。
  const layouts=[];
  for(const {width,height} of [{width:480,height:360},{width:360,height:560},{width:1280,height:720}]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await nap(160);
    // Chrome CDP 的虚拟窗口变更不一定触发 window.resize；主动通知弹窗重新测量。
    await run("window.dispatchEvent(new Event('resize'))");
    await nap(60);
    const m=await run(`(()=>{const p=document.querySelector('#endless-diy-skill-picker');const grid=p.querySelector('#endless-diy-skill-list');const panel=grid.parentElement;const confirm=p.querySelector('#endless-diy-skill-confirm');const g=grid.getBoundingClientRect();const before=grid.scrollTop;grid.scrollTop=grid.scrollHeight;const last=grid.querySelector('label:last-child').getBoundingClientRect();const c=confirm.getBoundingClientRect();const b=panel.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},panel:{top:b.top,bottom:b.bottom},grid:{top:g.top,bottom:g.bottom,height:g.height,scrollHeight:grid.scrollHeight,clientHeight:grid.clientHeight,scrollTop:grid.scrollTop,overflow:getComputedStyle(grid).overflowY},last:{bottom:last.bottom},confirm:{top:c.top,bottom:c.bottom},before}})()`);
    console.log('LAYOUT',JSON.stringify(m));
    assert.ok(m.panel.top >= -2 && m.panel.bottom <= m.viewport.height+2,'panel outside viewport');
    assert.ok(m.confirm.top >= 0 && m.confirm.bottom <= m.viewport.height+2,'confirm outside viewport');
    assert.ok(m.grid.bottom <= m.confirm.top,'scroll list overlaps footer');
    assert.ok(m.last.bottom <= m.grid.bottom+2,'last skill unreachable by scrolling');
    assert.equal(m.grid.overflow,'auto');
    if(height<=560){assert.ok(m.grid.scrollHeight>m.grid.clientHeight,'short viewport list should scroll');assert.ok(m.grid.scrollTop>0,'inner list did not scroll')}
    layouts.push(m);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  await nap(200);
  const picker=await run(`(()=>{const p=document.querySelector('#endless-diy-skill-picker');const inputs=[...p.querySelectorAll('input.endless-diy-skill-choice')];const keep=new Set(['diy_wansha','dcliuzhuan','diy_geiyuan']);const before=inputs.filter(x=>x.checked).length;inputs.forEach(i=>{i.checked=keep.has(i.value);i.dispatchEvent(new Event('change',{bubbles:true}))});const after=inputs.filter(x=>x.checked).map(x=>x.value);p.querySelector('#endless-diy-skill-confirm').click();return {total:inputs.length,before,after}})()`);
  assert.equal(picker.total,20);assert.equal(picker.before,20);assert.deepEqual(picker.after.sort(),["diy_geiyuan","diy_wansha","dcliuzhuan"].sort());
  await nap(5000);
  const snap=await run(`import('/noname.js').then(({lib,game,_status})=>{const s=JSON.parse(localStorage.getItem(lib.configprefix+'endless_save')||'null');return {name:game.me?.name,active:game.me?.skills?.slice(),configured:_status.endlessDiySkills,save:s?.diySkills,savePlayer:s?.player?.name,sourceCount:lib.characterPack.diy?.diy_zhangchunhua?.[3]?.length}})`);
  console.log("FIRST",JSON.stringify({picker,snap}));
  assert.equal(snap.name,'diy_zhangchunhua');
  assert.deepEqual([...snap.active].sort(),[...picker.after].sort());
  assert.deepEqual([...snap.configured].sort(),[...picker.after].sort());
  assert.deepEqual([...snap.save].sort(),[...picker.after].sort());
  assert.equal(snap.sourceCount,20);
  // AI 不允许使用任何 DIY 包武将（包括 ns_ 等非 diy_ 前缀的 DIY 包成员），也不允许通过旧候选池/直接初始化绕过。
  const aiGuard=await run(`import('/noname.js').then(({lib,game,_status})=>{const own=game.me;const diyNames=Object.keys(lib.characterPack.diy||{});const unusual=diyNames.find(n=>!n.startsWith('diy_')&&lib.character[n]);const normal='re_guojia';const before=game.players.filter(p=>p!==own).map(p=>p.name);const originalList=_status.endlessList;const originalAll=_status.endlessListAll;_status.endlessList=['diy_zhangchunhua',unusual,normal];_status.endlessListAll=['diy_zhangchunhua',unusual,normal];const draws=Array.from({length:18},()=>game.getEndlessCharacter());_status.endlessList=originalList;_status.endlessListAll=originalAll;const enemy=game.players.find(p=>p!==own);game.endlessInitCharacter(enemy,'diy_zhangchunhua',false);const rejectPrefix=enemy.name;game.endlessInitCharacter(enemy,unusual,false);const rejectPack=enemy.name;return {before,unusual,draws,rejectPrefix,rejectPack,pool:originalAll.slice(),isDiyAllowed:game.isEndlessEnemyCharacter('diy_zhangchunhua'),isPackAllowed:game.isEndlessEnemyCharacter(unusual),isNormalAllowed:game.isEndlessEnemyCharacter(normal),isPlayerDiy:own.name==='diy_zhangchunhua',initialAllowed:before.every(game.isEndlessEnemyCharacter),poolAllowed:originalAll.every(game.isEndlessEnemyCharacter)} })`);
  console.log('AI_GUARD',JSON.stringify(aiGuard));
  assert.equal(aiGuard.isPlayerDiy,true);
  assert.equal(aiGuard.isDiyAllowed,false);assert.equal(aiGuard.isPackAllowed,false);assert.equal(aiGuard.isNormalAllowed,true);
  assert.equal(aiGuard.initialAllowed,true,'AI initially selected a DIY package character');
  assert.equal(aiGuard.poolAllowed,true,'AI candidate pool contains DIY package characters');
  assert.ok(aiGuard.unusual,'Expected non-prefixed DIY package character');
  assert.ok(aiGuard.before.every(n=>!n.startsWith('diy_')),'Initial AI used DIY');
  assert.ok(aiGuard.draws.every(n=>n==='re_guojia'),'AI pool returned DIY');
  assert.ok(aiGuard.pool.every(n=>!n.startsWith('diy_')),'AI source pool polluted');
  assert.equal(aiGuard.rejectPrefix,'re_guojia');assert.equal(aiGuard.rejectPack,'re_guojia');
  // 与实际换将使用完全相同的初始化入口；角色重建不能恢复未选技能。
  const swapped=await run(`import('/noname.js').then(({game,_status})=>{game.endlessInitCharacter(game.me,'diy_zhangchunhua',true);return {active:game.me.skills.slice(),configured:_status.endlessDiySkills}})`);
  assert.deepEqual([...swapped.active].sort(),[...picker.after].sort());
  console.log("REINIT",JSON.stringify(swapped));
  // 模拟旧版存档含 DIY 敌方候选名单：恢复时应保留玩家存档但排除敌方 DIY。
  const legacy=await run(`import('/noname.js').then(({lib})=>{const key=lib.configprefix+'endless_save';const data=JSON.parse(localStorage.getItem(key));data.list=['diy_zhangchunhua','diy_wenyang','ns_zuoci',...data.list];localStorage.setItem(key,JSON.stringify(data));return data.list.slice(0,5)})`);
  console.log('LEGACY_POOL_INJECTED',JSON.stringify(legacy));
  // 重载页面，走游戏自带“继续无尽存档”入口，不能重新弹技能选择器。
  await navigate();
  await until("[...document.querySelectorAll('.control>div')].some(x=>x.textContent.trim()==='继续无尽存档')");
  const clicked=await run("(()=>{const x=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='继续无尽存档');x.click();return true})()");
  assert.equal(clicked,true);
  await nap(5000);
  const restored=await run(`import('/noname.js').then(({game,_status,lib})=>({name:game.me?.name,active:game.me?.skills?.slice(),configured:_status.endlessDiySkills,save:JSON.parse(localStorage.getItem(lib.configprefix+'endless_save')||'null')?.diySkills,pickerVisible:!!document.querySelector('#endless-diy-skill-picker'),enemyCandidates:_status.endlessList.slice(),enemyNames:game.players.filter(p=>p!==game.me).map(p=>p.name)}))`);
  console.log("RESTORED",JSON.stringify(restored));
  assert.equal(restored.name,'diy_zhangchunhua');
  assert.equal(restored.pickerVisible,false);
  assert.ok(restored.enemyCandidates.every(n=>!n.startsWith('diy_')&&!['ns_zuoci'].includes(n)),'Legacy AI pool still contains DIY');
  assert.ok(restored.enemyNames.every(n=>!n.startsWith('diy_')&&!['ns_zuoci'].includes(n)),'Restored enemy contains DIY');
  assert.deepEqual([...restored.active].sort(),[...picker.after].sort());
  assert.deepEqual([...restored.configured].sort(),[...picker.after].sort());
  assert.deepEqual([...restored.save].sort(),[...picker.after].sort());
  // “开始新游戏”必须重新展示默认全选的20项，而不继承上一存档的3项。
  await navigate();
  await until("[...document.querySelectorAll('.control>div')].some(x=>x.textContent.trim()==='开始新的无尽游戏')");
  await run("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='开始新的无尽游戏').click()})()");
  await nap(700);
  await selectThree();
  await until("!!document.querySelector('#endless-diy-skill-picker')");
  const reset=await run(`(()=>{const p=document.querySelector('#endless-diy-skill-picker');return {total:p.querySelectorAll('input.endless-diy-skill-choice').length,checked:p.querySelectorAll('input.endless-diy-skill-choice:checked').length}})()`);
  console.log("NEW_GAME",JSON.stringify(reset));
  assert.equal(reset.total,20);assert.equal(reset.checked,20);
  const emptySelection=await run(`(()=>{const p=document.querySelector('#endless-diy-skill-picker');[...p.querySelectorAll('button')].find(x=>x.textContent==='全不选').click();const n=p.querySelectorAll('input.endless-diy-skill-choice:checked').length;p.querySelector('#endless-diy-skill-confirm').click();return n})()`);
  assert.equal(emptySelection,0);
  await nap(4300);
  const emptySave=await run(`import('/noname.js').then(({lib,game,_status})=>({active:game.me.skills.slice(),config:_status.endlessDiySkills,save:JSON.parse(localStorage.getItem(lib.configprefix+'endless_save')||'null')?.diySkills}))`);
  assert.deepEqual(emptySave,{active:[],config:[],save:[]});
  await navigate();
  await until("[...document.querySelectorAll('.control>div')].some(x=>x.textContent.trim()==='继续无尽存档')");
  await run("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='继续无尽存档').click()})()");
  await nap(4000);
  const emptyRestored=await run(`import('/noname.js').then(({game,_status})=>({active:game.me.skills.slice(),config:_status.endlessDiySkills,picker:!!document.querySelector('#endless-diy-skill-picker')}))`);
  assert.deepEqual(emptyRestored,{active:[],config:[],picker:false});
  assert.deepEqual(errors,[]);
  console.log("EMPTY_SELECTION",JSON.stringify({emptySelection,emptySave,emptyRestored}));
  console.log("ENDLESS_DIY_SKILL_PICKER",JSON.stringify({success:true,picker,first:snap.active.length,reinit:swapped.active.length,restored:restored.active.length,newGameDefault:reset.checked,emptyPersisted:emptyRestored.active.length,errors}));
} catch(e){console.error("ENDLESS_DIY_SKILL_PICKER",JSON.stringify({success:false,error:String(e),errors}));process.exitCode=1}
finally{ws.close()}
