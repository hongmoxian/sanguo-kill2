// 在无尽模式实际运行一轮敌方“获得牌→转牌→弃置→回收”的端到端测试。
const base = "http://localhost:9252";
const tab = await (await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no});
let id=0;const calls=new Map(),errors=[];
function send(method,params={}) {return Promise.race([new Promise(resolve=>{const n=++id;calls.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}))}),new Promise(resolve=>setTimeout(()=>resolve({timeout:method}),9000))]);}
ws.onmessage=e=>{let d=JSON.parse(e.data);if(d.id&&calls.has(d.id)){calls.get(d.id)(d);calls.delete(d.id)}if(d.method==="Page.javascriptDialogOpening")send("Page.handleJavaScriptDialog",{accept:true});if(d.method==="Runtime.exceptionThrown")errors.push(d.params?.exceptionDetails?.exception?.description||d.params?.exceptionDetails?.text);};
for(const method of ["Page.enable","Runtime.enable"])await send(method);
async function run(expression){const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,1400));return r.result?.result?.value;}
const nap=ms=>new Promise(r=>setTimeout(r,ms));
const path="http://localhost:8089/index.html?mode=endless&build=endless-liuzhuan-runtime-20261027";
await send("Page.navigate",{url:path});await nap(4200);
let state=await run("({splash:!!document.querySelector('#splash')})");
if(state.splash){await run("document.querySelector('#splash [link=endless]')?.click()");await nap(2700);}
await run("(()=>{const a=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='开始新的无尽游戏');if(a)a.click()})()");
await nap(900);
for(let i=0;i<3;i++){const r=await run(`(()=>{const list=[...document.querySelectorAll('.dialog .button.character.selectable')];const x=list.find(x=>x.link==='diy_zhangchunhua')||list[0];if(!x)return null;x.click();return x.link})()`);if(!r)throw Error("选将失败 "+i);await nap(950);}
await nap(600);
// 流转专项测试只启用测试所需的流转/割圆/落英，避免其他主动技能的操作弹窗阻塞敌方回合。
const skillPicker=await run("(()=>{const p=document.querySelector('#endless-diy-skill-picker');if(!p)return {shown:false};const items=[...p.querySelectorAll('input.endless-diy-skill-choice')];const keep=new Set(['dcliuzhuan','diy_geiyuan','diy_luoying']);items.forEach(x=>{x.checked=keep.has(x.value);x.dispatchEvent(new Event('change',{bubbles:true}))});p.querySelector('#endless-diy-skill-confirm')?.click();return {shown:true,total:items.length,selected:items.filter(x=>x.checked).map(x=>x.value)}})()");
console.log('SKILL_PICKER',JSON.stringify(skillPicker));
await nap(700);
await run("(()=>{[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='取消')?.click();})()");
await nap(3900);
const setup=await run(`import('/noname.js').then(({lib,game,get,ui,_status})=>{
  const me=game.me;const enemy=game.players.find(p=>p!==me);
  const x=window.__liuzhuanTest={events:[],me:me.name,enemy:enemy?.name};
  const mark=lib.skill.dcliuzhuan_mark, gain=lib.skill.dcliuzhuan_gain;
  const originalTrySkillAudio=game.trySkillAudio;
  game.trySkillAudio=function(name,who,...rest){if(name==='dcliuzhuan_mark'||name==='dcliuzhuan_gain'||name==='diy_endless_liuzhuan_deathgain'){x.events.push({at:'skill-audio',skill:name,files:get.Audio.skill({skill:name,player:who}).fileList});}return originalTrySkillAudio.call(this,name,who,...rest)};
  const deathSkill=lib.skill.diy_endless_liuzhuan_deathgain;
  const tagged={hasGaintag:name=>name==='dcliuzhuan_tag'};
  const mockDeath={player:{getCards:()=>[tagged]}};
  const deathChecks={diy:deathSkill?.filter(mockDeath,me),original:deathSkill?.filter(mockDeath,{name:'dc_liuba',hasSkill:()=>true})};
  const origMarkFilter=mark.filter;
  const origGainFilter=gain.filter;
  const phaseDrawGain={player:enemy,getParent:()=>({name:'phaseDraw'})};
  const outOfDrawGain={player:enemy,getParent:()=>null};
  const previousPhase=_status.currentPhase;
  _status.currentPhase=enemy;
  const phaseDrawChecks={diy:origMarkFilter(phaseDrawGain,me),nonDiy:origMarkFilter(phaseDrawGain,{name:'liuba_test'}),outside:origMarkFilter(outOfDrawGain,me),self:origMarkFilter({player:me,getParent:()=>({name:'phaseDraw'})},me)};
  _status.currentPhase=previousPhase;
  mark.filter=function(e,p){const b=origMarkFilter.call(this,e,p);if(e.player!==game.me)x.events.push({at:'mark-filter',phase:_status.currentPhase?.name,player:e.player?.name,isDraw:e.getParent('phaseDraw')?.name==='phaseDraw',yes:!!b});return b};
  gain.filter=function(e,p){const b=origGainFilter.call(this,e,p);x.events.push({at:'gain-filter',event:e.name,phase:_status.currentPhase?.name,yes:!!b});return b};
  lib.skill.__lz_test_acquire={
     trigger:{player:'phaseUseBegin'},forced:true,priority:100,
     filter(e,p){return p!==game.me&&!p.storage.__lz_test_gained;},
     content(){player.storage.__lz_test_gained=true;let cs=get.cards(1);for(let n=0;n<14&&get.color(cs[0])!=='black';n++){ui.cardPile.appendChild(cs[0]);cs=get.cards(1);}window.__liuzhuanTest.events.push({at:'forced-gain',who:player.name,color:get.color(cs[0])});player.gain(cs);}
  };
  lib.skill.__lz_test_die={
    trigger:{player:'gainAfter'},forced:true,priority:-75,
    filter(e,p){return p===enemy&&!p.storage.__lz_test_died&&e.cards?.some(c=>c.hasGaintag('dcliuzhuan_tag'));},
    content(){player.storage.__lz_test_died=true;const marked=trigger.cards.filter(c=>c.hasGaintag('dcliuzhuan_tag'));window.__liuzhuanTest.events.push({at:'forced-die',who:player.name,marked:marked.length,cardid:marked[0]?.cardid});if(marked.length)player.die();}
  };
  lib.skill.__lz_test_throw={
    trigger:{player:'gainAfter'},forced:true,priority:-100,
    filter(e,p){return p!==game.me&&p!==enemy&&!p.storage.__lz_test_thrown&&e.cards?.some(c=>c.hasGaintag('dcliuzhuan_tag'));},
    content(){player.storage.__lz_test_thrown=true;const marked=trigger.cards.filter(c=>c.hasGaintag('dcliuzhuan_tag'));window.__liuzhuanTest.events.push({at:'forced-discard',who:player.name,stage:'gainAfter',marked:marked.length,cardid:marked[0]?.cardid});if(marked.length)player.discard(marked[0]);}
  };
  lib.skill.__lz_trace_owner_gain={trigger:{player:'gainAfter'},forced:true,silent:true,filter(e,p){return p===me},content(){window.__liuzhuanTest.events.push({at:'owner-gain',cardids:(trigger.cards||[]).map(c=>c.cardid)})}};
  me.addSkill('__lz_trace_owner_gain');
  for(const p of game.players)if(p!==me){p.addSkill('__lz_test_acquire');if(p===enemy)p.addSkill('__lz_test_die');else p.addSkill('__lz_test_throw');}
  return {mode:_status.mode,me:me.name,enemy:enemy.name,expanded:game.expandSkills(me.getSkills()).filter(s=>s.startsWith('dcliuzhuan')),deathChecks,priority:{geiyuan:get.priority('diy_geiyuan'),liuzhuan:get.priority('dcliuzhuan_gain'),luoying:get.priority('diy_luoying')},phaseDrawChecks,skillText:{diy:get.skillInfoTranslation('dcliuzhuan',me),original:get.skillInfoTranslation('dcliuzhuan',{name:'liuba_test'})},voice:{markAudio:mark.audio,markPopup:mark.popup,markSilent:mark.silent,gainAudio:gain.audio,markFiles:get.Audio.skill({skill:'dcliuzhuan_mark',player:me}).fileList,gainFiles:get.Audio.skill({skill:'dcliuzhuan_gain',player:me}).fileList},skillDefs:[!!mark,!!gain]};})`);
console.log("SETUP",JSON.stringify(setup));
let end='unresolved';for(let i=0;i<16;i++){end=await run("(()=>{const buttons=[...document.querySelectorAll('.control>div')];const done=buttons.find(x=>x.textContent.trim()==='结束回合');if(done){done.click();return 'ended turn'}const cancel=buttons.find(x=>x.textContent.trim()==='取消');if(cancel){cancel.click();return 'cancelled interactive prompt'}return buttons.map(x=>x.textContent.trim())})()");console.log('ADVANCE',i,JSON.stringify(end));if(end==='ended turn')break;await nap(800);}console.log("END",JSON.stringify(end));
for(let i=0;i<55;i++){await nap(400);await run("(()=>{const b=[...document.querySelectorAll('.control>div')];const cancel=b.find(x=>x.textContent.trim()==='取消');if(cancel){cancel.click();return 'cancelled';}const end=b.find(x=>x.textContent.trim()==='结束回合');if(end){end.click();return 'ended';}return null})()");const z=await run(`import('/noname.js').then(({_status,game})=>({phase:_status.currentPhase?.name,currentEvent:_status.event?.name,step:_status.event?.step,controls:[...document.querySelectorAll('.control>div')].map(x=>x.textContent.trim()).slice(0,9),dialogs:[...document.querySelectorAll('.dialog')].map(x=>x.innerText.slice(0,120)),events:window.__liuzhuanTest?.events?.slice(-45),ownerHand:game.me?.countCards('h'),ownerHasDiscarded:game.me?.getCards('h').some(c=>c.cardid===window.__liuzhuanTest?.events?.find(x=>x.at==='forced-discard')?.cardid),ownerHasDeadCard:game.me?.getCards('h').some(c=>c.cardid===window.__liuzhuanTest?.events?.find(x=>x.at==='forced-die')?.cardid)}))`);if(i%8===0)console.log("POLL",i,JSON.stringify({phase:z?.phase,events:z?.events?.length,discarded:z?.ownerHasDiscarded,dead:z?.ownerHasDeadCard}).slice(0,250));if(z?.events?.some(e=>e.at==='forced-discard'&&e.marked>0)&&z?.events?.filter(e=>e.at==='skill-audio'&&e.skill==='dcliuzhuan_gain').length>=2)break;}
const final=await run(`import('/noname.js').then(({game,_status})=>({phase:_status.currentPhase?.name,events:window.__liuzhuanTest?.events,ownerHand:game.me.countCards('h'),enemyHand:game.players.find(p=>p!==game.me).countCards('h'),ownerHasDiscarded:game.me.getCards('h').some(c=>c.cardid===window.__liuzhuanTest?.events?.find(x=>x.at==='forced-discard')?.cardid),ownerHasDeadCard:game.me.getCards('h').some(c=>c.cardid===window.__liuzhuanTest?.events?.find(x=>x.at==='forced-die')?.cardid)}))`);
console.log("FINAL",JSON.stringify({final,errors}).slice(0,18000));
let events=final.events||[];
const success=setup.deathChecks?.diy===true&&setup.deathChecks?.original===false&&events.filter(e=>e.at==='skill-audio'&&e.skill==='dcliuzhuan_gain'&&e.files.length===2).length>=2&&events.some(e=>e.at==='forced-die'&&e.marked>0)&&events.some(e=>e.at==='forced-discard'&&e.stage==='gainAfter'&&e.marked>0)&&setup.phaseDrawChecks.diy===true&&setup.phaseDrawChecks.nonDiy===false&&setup.phaseDrawChecks.outside===true&&setup.phaseDrawChecks.self===false&&setup.skillText.diy.includes('包括摸牌阶段')&&!setup.skillText.original.includes('包括摸牌阶段')&&setup.voice.markPopup===true&&setup.voice.markSilent===false&&setup.voice.markAudio==='dcliuzhuan'&&setup.voice.markFiles.length===2&&setup.voice.gainFiles.length===2&&events.some(e=>e.at==='skill-audio'&&e.skill==='dcliuzhuan_mark'&&e.files.length===2)&&events.some(e=>e.at==='skill-audio'&&e.skill==='dcliuzhuan_gain'&&e.files.length===2)&&events.some(e=>e.at==='mark-filter'&&e.isDraw&&e.yes)&&setup.priority.geiyuan>setup.priority.liuzhuan&&setup.priority.liuzhuan>setup.priority.luoying&&events.some(e=>e.at==="mark-filter"&&e.yes)&&events.some(e=>e.at==="forced-discard"&&e.marked>0)&&events.some(e=>e.at==="gain-filter"&&e.yes)&&events.some(e=>e.at==='owner-gain'&&e.cardids.includes(events.find(x=>x.at==='forced-die')?.cardid))&&events.some(e=>e.at==='gain-filter'&&e.yes)&&errors.length===0;
console.log("LIUZHUAN_DEATH_TEST",JSON.stringify({success,events,errors}));
ws.close();process.exit(success?0:1);
