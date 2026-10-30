// 真实 Chrome 回归：DIY「流转」在敌人 phaseEnd 强制弃置剩余“转”手牌并回收。
import assert from "node:assert/strict";
const base="http://127.0.0.1:9252";
const tab=await (await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let id=0;const pending=new Map(),errors=[],dialogs=[];
const nap=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return Promise.race([new Promise(resolve=>{const key=++id;pending.set(key,resolve);ws.send(JSON.stringify({id:key,method,params}))}),new Promise((_,reject)=>setTimeout(()=>reject(new Error("CDP timeout "+method)),12000))])}
ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id&&pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id)}if(msg.method==="Page.javascriptDialogOpening"){dialogs.push(msg.params?.message||"");void send("Page.handleJavaScriptDialog",{accept:true})}if(msg.method==="Runtime.exceptionThrown")errors.push(msg.params?.exceptionDetails?.exception?.description||msg.params?.exceptionDetails?.text)};
async function run(expression){const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(result.result?.exceptionDetails)throw Error(JSON.stringify(result.result.exceptionDetails).slice(0,1500));return result.result?.result?.value}
async function until(expression,timeout=11000){const start=Date.now();while(Date.now()-start<timeout){const v=await run(expression);if(v)return v;await nap(250)}throw Error("Timeout waiting "+expression.slice(0,130))}
try{
 await send("Page.enable"); await send("Runtime.enable");
 await send("Page.navigate",{url:"http://localhost:8089/index.html?mode=endless&build=liuzhuan-turnend-regression-20261030"});
 await nap(4200);
 if(await run("!!document.querySelector('#splash')")){await run("document.querySelector('#splash [link=endless]')?.click()");await nap(2300)}
 await run("(()=>{const b=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='开始新的无尽游戏');b?.click();return !!b})()");
 await nap(800);
 for(let i=0;i<3;i++){
   await until("document.querySelectorAll('.dialog .button.character.selectable').length>0");
   const selected=await run("(()=>{const a=[...document.querySelectorAll('.dialog .button.character.selectable')];const chosen=a.find(x=>x.link==='diy_zhangchunhua')||a[0];if(!chosen)return null;chosen.click();return chosen.link})()");
   assert.ok(selected,"Missing character selection "+i);
   if(i===0)assert.equal(selected,"diy_zhangchunhua");
   await nap(700);
 }
 await until("!!document.querySelector('#endless-diy-skill-picker')");
 const picker=await run("(()=>{const p=document.querySelector('#endless-diy-skill-picker');const boxes=[...p.querySelectorAll('input.endless-diy-skill-choice')];boxes.forEach(x=>{x.checked=x.value==='dcliuzhuan';x.dispatchEvent(new Event('change',{bubbles:true}))});const enabled=boxes.filter(x=>x.checked).map(x=>x.value);p.querySelector('#endless-diy-skill-confirm').click();return {total:boxes.length,enabled}})()");
 assert.equal(picker.total,20);assert.deepEqual(picker.enabled,["dcliuzhuan"]);
 await nap(650);
 await run("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='取消')?.click()})()");
 await nap(3500);
 const setup=await run(`import('/noname.js').then(({lib,game,_status,get,ui})=>{
    const me=game.me, enemy=game.players.find(p=>p!==me), skill=lib.skill.diy_endless_liuzhuan_turnend;
    const state=window.__lzTurnEnd={events:[],ids:[],untagged:[],injected:false,discarded:false};
    const checkDiy=skill.filter({player:enemy},me);
    const dummyCard={hasGaintag:tag=>tag==='dcliuzhuan_tag'};
    const origGetCards=enemy.getCards;
    enemy.getCards=function(area,...rest){return area==='h'?[dummyCard]:origGetCards.call(this,area,...rest)};
    const checks={markedDiy:skill.filter({player:enemy},me),markedLiuba:skill.filter({player:enemy},{name:'dc_liuba',hasSkill:()=>true}),ownTurn:skill.filter({player:me},me),none:skill.filter({player:enemy},{name:'diy_zhangchunhua',hasSkill:()=>false})};
    enemy.getCards=origGetCards;
    // 测试专用：在真实 phaseEnd 判定入口注入剩余“转”牌，避免依赖随机 AI 出牌和额外测试技能注册。
    const originalTurnEndFilter=skill.filter;
    skill.filter=function(evt,owner){
      if(owner===me&&evt.player&&evt.player!==me&&!state.injected){
        const opponent=evt.player;
        let hand=opponent.getCards('h');
        if(hand.length<3){opponent.directgain(get.cards(3-hand.length));hand=opponent.getCards('h')}
        const marked=hand.slice(0,2);
        state.injected=true;
        state.ids=marked.map(c=>c.cardid);
        state.untagged=hand.slice(2).map(c=>c.cardid);
        opponent.addGaintag(marked,'dcliuzhuan_tag');
        opponent.addTempSkill('dcliuzhuan_tag');
        state.events.push({type:'mark-at-phaseEnd',actor:opponent.name,ids:state.ids,untagged:state.untagged});
      }
      const result=originalTurnEndFilter.call(this,evt,owner);
      if(evt.player!==me)state.events.push({type:'phaseEnd-filter',actor:evt.player?.name,owner:owner?.name,yes:result});
      return result;
    };
    lib.skill.__lz_turnend_observe={
      trigger:{global:'loseAfter'},forced:true,silent:true,priority:-100,
      filter(e,p){return p===me&&state.injected&&e.player!==me&&state.ids.some(id=>(e.hs||[]).some(c=>c.cardid===id))},
      content(){state.events.push({type:'marked-lose',who:trigger.player.name,ids:(trigger.hs||[]).filter(c=>state.ids.includes(c.cardid)).map(c=>c.cardid),discard:trigger.position===ui.discardPile})}
    };
    me.addSkill('__lz_turnend_observe');
    const originalDiscard=enemy.discard;
    enemy.discard=function(cards,...args){const arr=Array.isArray(cards)?cards:[cards];state.events.push({type:'discard-called',ids:arr.map(c=>c.cardid),tags:arr.map(c=>c.hasGaintag('dcliuzhuan_tag'))});return originalDiscard.call(this,cards,...args)};
    const originalGainFilter=lib.skill.dcliuzhuan_gain.filter;
    lib.skill.dcliuzhuan_gain.filter=function(e,owner){const ok=originalGainFilter.call(this,e,owner);if((e.hs||[]).some(c=>state.ids.includes(c.cardid)))state.events.push({type:'gain-filter',ok,name:e.name,position:e.position===ui.discardPile,hs:(e.hs||[]).map(c=>({id:c.cardid,tag:e.gaintag_map?.[c.cardid]}))});return ok};
    const originalGainContent=lib.skill.dcliuzhuan_gain.content;
    lib.skill.dcliuzhuan_gain.content=function(){if(trigger.name==='lose'&&(trigger.hs||[]).some(c=>state.ids.includes(c.cardid)))state.events.push({type:'gain-content',cards:(trigger.hs||[]).map(c=>({id:c.cardid,pos:get.position(c,true)}))});return originalGainContent.apply(this,arguments)};
    const originalMeGain=me.gain;
    me.gain=function(cards,...args){const arr=Array.isArray(cards)?cards:[cards];if(arr.some(c=>state.ids.includes(c?.cardid)))state.events.push({type:'owner-gain-method',ids:arr.map(c=>c?.cardid)});return originalMeGain.call(this,cards,...args)};
    const originalAudio=game.trySkillAudio;
    game.trySkillAudio=function(s,owner,...args){if(s==='dcliuzhuan_gain')state.events.push({type:'recovery-audio'});return originalAudio.call(this,s,owner,...args)};
    return {name:me.name,enemy:enemy.name,selected:_status.endlessDiySkills,expanded:game.expandSkills(me.getSkills()).filter(s=>s.startsWith('diy_endless_liuzhuan')),text:get.skillInfoTranslation('dcliuzhuan',me),checks,initial:checkDiy,trigger:skill.trigger};
 })`);
 console.log("SETUP",JSON.stringify({picker,setup}));
 assert.equal(setup.name,"diy_zhangchunhua");
 assert.ok(setup.expanded.includes("diy_endless_liuzhuan_turnend"));
 assert.ok(setup.expanded.includes("diy_endless_liuzhuan_deathgain"));
 assert.equal(setup.text.includes("⑤其他角色的回合结束时"),true);
 assert.deepEqual(setup.checks,{markedDiy:true,markedLiuba:false,ownTurn:false,none:false});
 const forced=await run("(()=>{const b=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='结束回合');if(b){b.click();return 'end'}const c=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='取消');if(c){c.click();return 'cancel'}return 'none'})()");
 console.log("ADVANCE",forced);
 let state;
 for(let i=0;i<75;i++){
   await nap(450);
   await run("(()=>{const b=[...document.querySelectorAll('.control>div')];const c=b.find(x=>x.textContent.trim()==='取消');if(c)c.click();const e=b.find(x=>x.textContent.trim()==='结束回合');if(e)e.click()})()");
   state=await run(`import('/noname.js').then(({game,_status})=>{const s=window.__lzTurnEnd;const opponent=game.players.find(x=>x!==game.me&&x.name===s.events.find(e=>e.type==='mark-at-phaseEnd')?.actor);return {phase:_status.currentPhase?.name,events:s.events.slice(-14),ids:s.ids,untagged:s.untagged,recovered:s.ids.filter(id=>game.me.getCards('h').some(c=>c.cardid===id)),remaining:opponent?s.untagged.filter(id=>opponent.getCards('h').some(c=>c.cardid===id)):[]}})`);
   if(i%10===0)console.log("POLL",i,JSON.stringify({phase:state?.phase,events:state?.events?.map(e=>e.type),recovered:state?.recovered}));
   if(state?.ids.length===2&&state?.recovered.length===2)break;
 }
 console.log("TURNEND_FINAL",JSON.stringify({state,errors,dialogs}).slice(0,7000));
 assert.equal(state?.ids.length,2,"Enemy did not have enough hand cards to tag");
 assert.deepEqual([...state.recovered].sort(),[...state.ids].sort(),"Unused marked cards were not recovered");
 assert.ok(state.events.some(x=>x.type==='discard-called'&&state.ids.every(id=>x.ids.includes(id))&&x.tags.every(Boolean)),"Marked cards were not auto-discarded");
 assert.ok(state.events.some(x=>x.type==='gain-filter'&&x.ok&&x.position&&state.ids.every(id=>x.hs.some(c=>c.id===id&&c.tag.includes('dcliuzhuan_tag')))),"Tagged loseAfter recovery was not triggered");
 assert.ok(state.events.some(x=>x.type==='recovery-audio'),"Flow recovery audio not triggered");
 assert.ok(state.remaining.length>0,"Untagged cards were unexpectedly discarded");
 assert.deepEqual(errors,[],"Chrome Javascript errors");
 console.log("LIUZHUAN_TURNEND",JSON.stringify({success:true,marked:state.ids.length,recovered:state.recovered.length,untaggedPreserved:state.remaining.length,errors:errors.length}));
}catch(err){console.error("LIUZHUAN_TURNEND",JSON.stringify({success:false,error:String(err),errors,dialogs}));process.exitCode=1}finally{ws.close()}
