import assert from "node:assert/strict";
const base="http://127.0.0.1:9252";
const tab=await (await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
let id=0;const waiters=new Map(),errors=[];
ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id&&waiters.has(x.id)){waiters.get(x.id)(x);waiters.delete(x.id)}if(x.method==="Page.javascriptDialogOpening")call("Page.handleJavaScriptDialog",{accept:true});if(x.method==="Runtime.exceptionThrown")errors.push(x.params?.exceptionDetails?.exception?.description||x.params?.exceptionDetails?.text)};
function call(method,params={}){return Promise.race([new Promise(ok=>{let n=++id;waiters.set(n,ok);ws.send(JSON.stringify({id:n,method,params}))}),new Promise((_,no)=>setTimeout(()=>no(Error("CDP timeout "+method)),10000))])}
async function evalJs(expr){const r=await call("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,1000));return r.result?.result?.value}
const nap=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(expr,t=10000){let start=Date.now();while(Date.now()-start<t){let x=await evalJs(expr);if(x)return x;await nap(240)}throw Error("timeout "+expr.slice(0,100))}
async function nav(){await call("Page.navigate",{url:"http://127.0.0.1:8089/index.html?mode=endless&build=hp-regression-20261030"});await nap(4100);if(await evalJs("!!document.querySelector('#splash')")){await evalJs("document.querySelector('#splash [link=endless]')?.click()");await nap(2300)}}
try{
 await call("Page.enable");await call("Runtime.enable");
 await nav();
 await until("[...document.querySelectorAll('.control>div')].some(x=>x.textContent.trim()==='开始新的无尽游戏') || document.querySelectorAll('.dialog .button.character.selectable').length>0");
 await evalJs("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='开始新的无尽游戏')?.click()})()");
 for(let i=0;i<3;i++){
   await until("document.querySelectorAll('.dialog .button.character.selectable').length>0");
   const pick=await evalJs("(()=>{let a=[...document.querySelectorAll('.dialog .button.character.selectable')];let b=a.find(x=>x.link==='diy_zhangchunhua')||a[0];b.click();return b.link})()");
   console.log("PICK",i,pick);await nap(750);
 }
 await until("!!document.querySelector('#endless-diy-skill-picker')");
 await evalJs("(()=>{let p=document.querySelector('#endless-diy-skill-picker');p.querySelector('#endless-diy-skill-confirm').click()})()");
 await nap(1500);
 await evalJs("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='取消')?.click()})()");
 await nap(3900);
 let snap=await evalJs("import('/noname.js').then(({lib,game,_status})=>({name:game.me?.name,hp:game.me?.hp,maxHp:game.me?.maxHp,storage:JSON.parse(localStorage.getItem(lib.configprefix+'endless_save')||'null')?.player,phase:_status.currentPhase?.name}))");
 console.log("INITIAL",JSON.stringify(snap));
 assert.equal(snap.name,"diy_zhangchunhua");
 const mutated=await evalJs("import('/noname.js').then(({lib,game})=>{let me=game.me, key=lib.configprefix+'endless_save';let save=JSON.parse(localStorage.getItem(key));me.maxHp=18;me.hp=7;me.update();let saved=JSON.parse(localStorage.getItem(key));return {live:{hp:me.hp,maxHp:me.maxHp},save:saved.player}})");
 console.log("MUTATED",JSON.stringify(mutated));
 assert.equal(mutated.save.hp,7);assert.equal(mutated.save.maxHp,18);
 await nav();await until("[...document.querySelectorAll('.control>div')].some(x=>x.textContent.trim()==='继续无尽存档')");
 await evalJs("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='继续无尽存档').click()})()");
 await nap(4500);
 const restored=await evalJs("import('/noname.js').then(({lib,game})=>({hp:game.me?.hp,maxHp:game.me?.maxHp,saved:JSON.parse(localStorage.getItem(lib.configprefix+'endless_save')||'null')?.player}))");
 console.log("RESTORED",JSON.stringify(restored));
 const swap=await evalJs("import('/noname.js').then(({game})=>{let me=game.me;me.maxHp=18;me.hp=7;me.update();const before={hp:me.hp,maxHp:me.maxHp};game.endlessInitCharacter(me,me.name1,true);return {before,after:{hp:me.hp,maxHp:me.maxHp}}})");
 console.log("REINIT",JSON.stringify(swap));
 assert.equal(restored.hp,7,'Current HP must survive a real reload');
 assert.equal(restored.maxHp,18,'Max HP must survive a real reload');
 assert.deepEqual(swap.after,swap.before,'Reinitialization must preserve the character HP state');
 const swapped=await evalJs("import('/noname.js').then(({lib,game,_status})=>{const me=game.me;const original=me.name1;const incoming=_status.endlessReserve.shift();_status.endlessReserve.push(original);game.endlessInitCharacter(me,incoming,true);const initial={name:me.name1,hp:me.hp,maxHp:me.maxHp};me.maxHp=15;me.hp=4;me.hujia=3;me.update();const changed=JSON.parse(localStorage.getItem(lib.configprefix+'endless_save'));const i=_status.endlessReserve.indexOf(original);_status.endlessReserve.splice(i,1);_status.endlessReserve.push(incoming);game.endlessInitCharacter(me,original,true);const back={name:me.name1,hp:me.hp,maxHp:me.maxHp,hujia:me.hujia};const stored=JSON.parse(localStorage.getItem(lib.configprefix+'endless_save'));return {initial,incoming,changed:changed.player,back,stored:stored.player,map:stored.healthByCharacter,reserve:stored.reserve}})");
 console.log('SWAPPED',JSON.stringify(swapped));
 assert.equal(swapped.changed.name,swapped.incoming);
 assert.equal(swapped.changed.hp,4);assert.equal(swapped.changed.maxHp,15);assert.equal(swapped.changed.hujia,3);
 assert.deepEqual(swapped.back,{name:'diy_zhangchunhua',hp:7,maxHp:18,hujia:0});
 assert.equal(swapped.map[swapped.incoming].hp,4);assert.equal(swapped.map[swapped.incoming].maxHp,15);
 assert.equal(swapped.map.diy_zhangchunhua.hp,7);assert.equal(swapped.map.diy_zhangchunhua.maxHp,18);
 await nav();await until("[...document.querySelectorAll('.control>div')].some(x=>x.textContent.trim()==='继续无尽存档')");
 await evalJs("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='继续无尽存档').click()})()");
 await nap(3900);
 const second=await evalJs("import('/noname.js').then(({lib,game,_status})=>{const me=game.me;const active={name:me.name1,hp:me.hp,maxHp:me.maxHp};const snapshot=JSON.parse(localStorage.getItem(lib.configprefix+'endless_save'));const target=Object.keys(snapshot.healthByCharacter||{}).find(x=>x!==me.name1&&_status.endlessReserve.includes(x));const i=_status.endlessReserve.indexOf(target);_status.endlessReserve.splice(i,1);_status.endlessReserve.push(me.name1);game.endlessInitCharacter(me,target,true);return {active,reserve:{name:me.name1,hp:me.hp,maxHp:me.maxHp,hujia:me.hujia},backup:!!localStorage.getItem(lib.configprefix+'endless_save_pre_health_fix_backup')}})");
 console.log('SECOND_RELOAD',JSON.stringify(second));
 assert.equal(second.active.hp,7);assert.equal(second.active.maxHp,18);
 assert.equal(second.reserve.name,swapped.incoming);assert.equal(second.reserve.hp,4);assert.equal(second.reserve.maxHp,15);assert.equal(second.reserve.hujia,3);
 assert.equal(second.backup,true,'Original save should be backed up once on resume');
 assert.deepEqual(errors,[],'No runtime JS error');
 console.log("ENDLESS_HP_DIAG",JSON.stringify({success:true,liveAutosave:true,reloadRestores:true,reinitPreserves:true,perCharacter:true,secondReload:true,backup:true,errors:errors.length}));
}catch(err){console.error("ENDLESS_HP_DIAG_ERROR",String(err),errors.slice(0,2));process.exitCode=1}finally{ws.close()}
