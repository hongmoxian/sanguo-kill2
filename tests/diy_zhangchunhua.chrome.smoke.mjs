const base="http://localhost:9252";const page=await (await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
console.log("TARGET",page.id);
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad});let id=0;const pend=new Map(),errors=[];
function send(method,params={}){return Promise.race([new Promise(res=>{const k=++id;pend.set(k,res);ws.send(JSON.stringify({id:k,method,params}))}),new Promise(res=>setTimeout(()=>res({timeout:method}),6000))])}
ws.addEventListener("message",e=>{const x=JSON.parse(e.data);if(x.id&&pend.has(x.id)){pend.get(x.id)(x);pend.delete(x.id)}
if(x.method==="Page.javascriptDialogOpening"){console.log("JS_DIALOG",x.params?.message?.slice(0,500));send("Page.handleJavaScriptDialog",{accept:true})}
if(x.method==="Runtime.exceptionThrown"){errors.push(x.params?.exceptionDetails?.exception?.description||x.params?.exceptionDetails?.text);console.log("JS_ERROR",errors.at(-1)?.slice(0,900))}
});
for(const m of ["Page.enable","Runtime.enable","Log.enable"])console.log("ENABLE",m,JSON.stringify(await send(m)).slice(0,160));
const e=async expression=>{const a=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});let v=a.result?.result?.value??a.result?.exceptionDetails??a;console.log("CHECK",JSON.stringify(v).slice(0,1800));return v};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
console.log("NAV",JSON.stringify(await send("Page.navigate",{url:"http://localhost:8089/index.html?mode=endless&build=discard-try-20261025"})).slice(0,200));
await sleep(4400);
let initial=await e(`({splash:!!document.querySelector('#splash'),dialog:document.querySelector('.dialog')?.innerText.slice(0,60)})`);
if(initial.splash){await e(`(()=>{document.querySelector('#splash [link=endless]')?.click();return true})()`);await sleep(2900)}
await e(`(()=>{let c=[...document.querySelectorAll('.control>div')].find(x=>x.innerText.trim()==='开始新的无尽游戏');if(c){c.click();return 'new game selected'}return 'no save prompt'})()`);
await sleep(900);
for(let i=0;i<3;i++){
let item=await e(`(()=>{const d=document.querySelector('.dialog');const opts=[...d?.querySelectorAll('.button.character.selectable')??[]];const button=opts.find(b=>b.link==='diy_zhangchunhua')||opts[0];if(!button)return {error:'no character selection',dialog:d?.innerText?.slice(0,70)};button.click();return {picked:button.link,round:d?.innerText.slice(0,40)}})()`);
if(!item.picked)break;
await sleep(1100);
}
const skillPicker=await e(`(()=>{const panel=document.querySelector('#endless-diy-skill-picker');if(!panel)return {shown:false};const total=panel.querySelectorAll('input.endless-diy-skill-choice').length;const checked=panel.querySelectorAll('input.endless-diy-skill-choice:checked').length;panel.querySelector('#endless-diy-skill-confirm')?.click();return {shown:true,total,checked}})()`);
await sleep(400);
await e(`({body:document.body.innerText.slice(0,330),dialogs:[...document.querySelectorAll('.dialog')].map(x=>x.innerText.slice(0,65))})`);
await e(`(()=>{const c=[...document.querySelectorAll('.control > div')].find(x=>x.textContent.trim()==='取消');if(c){c.click();return 'canceled hand replacement'}return 'no hand replacement dialog'})()`);
await sleep(5200);
const state=await e(`import('/noname.js').then(({game,_status,lib})=>{const mod=lib.skill.diy_wansha2?.mod;const other=game.players.find(p=>p!==game.me);return {mode:_status.mode,me:game.me?.name,skills:game.me?.skills?.length,hp:game.me?.hp,ring:game.me?.storage?.diy_geiyuan,event:_status.event?.name,roundText:document.body.innerText.slice(0,160),liuzhuan:{main:!!lib.skill.dcliuzhuan,mark:!!lib.skill.dcliuzhuan_mark,gain:!!lib.skill.dcliuzhuan_gain,tag:!!lib.skill.dcliuzhuan_tag,markVoice:lib.skill.dcliuzhuan_mark?.audio==='dcliuzhuan' && lib.skill.dcliuzhuan_mark?.popup===true && lib.skill.dcliuzhuan_mark?.silent===false},peach:{ownerUse:mod?.cardEnabled({name:'tao'},game.me)!==false,ownerSave:mod?.cardSavable({name:'tao'},game.me)!==false,otherUse:mod?.cardEnabled({name:'tao'},other)===false,otherSave:mod?.cardSavable({name:'tao'},other)===false},errors:window.__gptErrors}})`);
const voiceAudios=await e(`Promise.all([import('/noname.js'),import('/noname/get/audio.js')]).then(([{game},{Audio}])=>Object.fromEntries(['diy_geiyuan','diy_jieshu','diy_gusuan','dcliuzhuan'].map(name=>[name,Audio.skill({skill:name,player:game.me}).audioList.map(x=>({file:x.file,text:x.text}))])))`);
const voiceAudioOK=['diy_geiyuan','diy_jieshu','diy_gusuan','dcliuzhuan'].every(name=>Array.isArray(voiceAudios?.[name])&&voiceAudios[name].length===2&&voiceAudios[name].every(x=>x.file?.endsWith('.mp3')&&typeof x.text==='string'&&x.text.length>3));
const controls=await e(`(()=>({skillLabels:[...document.querySelectorAll('*')].filter(x=>x.children.length===0&&['镇魂','杀意','天启','国色'].includes(x.textContent.trim())).map(x=>({name:x.textContent,parent:x.parentElement?.outerHTML.slice(0,250)})),controls:[...document.querySelectorAll('.control')].map(c=>c.innerText.slice(0,90))}))()`);
const activation=await e(`(()=>{let x=[...document.querySelectorAll('.control>div')].find(x=>x.textContent.trim()==='镇魂');if(!x)return 'cannot find 镇魂';x.click();return 'clicked 镇魂'})()`);
await sleep(850);
const activated=await e(`import('/noname.js').then(({game,_status})=>({event:_status.event?.name,step:_status.event?.step,ring:game.me?.storage?.diy_geiyuan,hand:game.me?.countCards('h'),controls:[...document.querySelectorAll('.control')].map(x=>x.innerText.slice(0,60)),cards:[...document.querySelectorAll('.card')].slice(-8).map(x=>({text:x.innerText.slice(0,50),className:x.className})),dialogs:[...document.querySelectorAll('.dialog')].map(x=>x.innerText.slice(0,80))}))`);
const discarded=await e(`(()=>{let c=[...document.querySelectorAll('.card.selectable')].find(x=>x.closest('#handcards1,#handcards2,.handcards'));if(!c)c=[...document.querySelectorAll('.card.selectable')].at(-1);if(!c)return {error:'no selectable discard'};let text=c.innerText.slice(0,90);c.click();return {selected:text,cls:c.className,controls:[...document.querySelectorAll('.control')].map(x=>x.innerText.slice(0,40))}})()`);
await sleep(500);
const confirmed=await e(`(()=>{const arr=[...document.querySelectorAll('.control>div')];const c=arr.find(x=>['确定','弃置'].includes(x.textContent.trim()));if(c){c.click();return 'confirmed discard'}return {controls:arr.map(x=>x.textContent.trim()),dialog:document.querySelector('.dialog')?.innerText.slice(0,90)}})()`);
await sleep(2500);
const post=await e(`import('/noname.js').then(({game,_status})=>({name:game.me?.name,hand:game.me?.countCards('h'),ring:game.me?.storage?.diy_geiyuan,opponents:game.players.filter(p=>p!==game.me).map(p=>({name:p.name,seal:p.hasSkill('diy_zhenhun_fengyin')})),event:_status.event?.name,errors:window.__gptErrors,body:document.body.innerText.slice(0,180)}))`);
const success=skillPicker?.shown===true && skillPicker?.total===20 && skillPicker?.checked===20 && voiceAudioOK && state?.mode==='endless' && state?.me==='diy_zhangchunhua' && state?.skills===20 && Object.values(state?.liuzhuan??{}).length===5 && Object.values(state?.liuzhuan??{}).every(Boolean) && Object.values(state?.peach??{}).length===4 && Object.values(state?.peach??{}).every(Boolean) && state?.hp===8 && activated?.event==='chooseToDiscard' && post?.hand===activated?.hand-1 && post?.ring?.lit?.length===1 && post?.opponents?.length===3 && post.opponents.every(p=>p.seal) && errors.length===0;
console.log("BROWSER_SMOKE",JSON.stringify({success,skillPicker,chosen:state?.me,skills:state?.skills,voiceAudioOK,voiceAudios,liuzhuan:state?.liuzhuan,peach:state?.peach,discard:discarded?.selected,handBefore:activated?.hand,handAfter:post?.hand,ringAfter:post?.ring?.lit,enemySeals:post?.opponents?.map(p=>p.seal),errors}));
if(!success)process.exitCode=1;
console.log("RESULT",JSON.stringify({state,activation,activated,discarded,confirmed,post,errors}).slice(0,8000));
ws.close();process.exit(success?0:1);
