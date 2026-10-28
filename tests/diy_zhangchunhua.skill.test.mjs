// 自定义张春华：执行原始技能函数的回归测试，不模拟真实回合队列。
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const lib={skill:{},inpile:["sha","shan","tao","wuzhong"],inpile_nature:["fire"],filter:{filterCard:()=>false}};
const ui={discardPile:{childNodes:[]},cardPile:{childNodes:[]},window:null};
const _status={event:{},currentPhase:null};
const get={
name:c=>c?.name,number:c=>c?.number??0,suit:c=>c?.suit,
position:c=>c?.position??"d",color:c=>c?.color??(c?.suit==="spade"||c?.suit==="club"?"black":"red"),
type:c=>(typeof c==="string"?({sha:"basic",shan:"basic",tao:"basic",wuzhong:"trick"}[c]):c?.type)||"basic",
type2:c=>(c?.type??(c?.name==="wuzhong"?"trick":"basic")),
autoViewAs:x=>x,translation:x=>x?.name??x,cnNumber:x=>String(x),value:()=>5,
attitude:()=>-3,prompt:x=>x,subtype:()=>null
};
const game={
players:[],me:null,logs:[],log(...args){this.logs.push(args)},countPlayer(fn){if(fn){this.players.forEach(fn)}return this.players.length},
filterPlayer(fn){return this.players.filter(fn)},hasPlayer(fn){return this.players.some(fn)},
cardsDiscard:c=>{c.position="d"},trySkillAudio(){},delay:async()=>{},checkMod:()=> "unchanged"
};
const ctx=vm.createContext({lib,game,ui,get,ai:{},_status,console,setInterval,clearInterval,document:{},trigger:null,player:null,result:{},event:{}});
vm.runInContext("Array.prototype.randomSort=function(){return this}; Array.prototype.addArray=function(x){this.push(...x);return this}; Array.prototype.removeArray=function(x){for(const c of x){let i=this.indexOf(c);if(i!==-1)this.splice(i,1)}return this}",ctx);
function load(path){let s=fs.readFileSync(path,"utf8").replace(/^import[^\n]*\n/,"").replace(/export default skills;?\s*$/,"globalThis.__skills = skills;"); vm.runInContext('(function(){\n'+s+'\n})();',ctx,{filename:path,timeout:3000}); Object.assign(lib.skill,ctx.__skills);return ctx.__skills;}
const main=load("character/diy/skill.js");
const guzheng=load("character/shenhua/skill.js").guzheng;
const yijiang=load("character/yijiang/skill.js");
const liuzhuan=load("character/huicui/skill.js").dcliuzhuan;
const guose=load("character/standard/skill.js").guose;
const skill=(n)=>main[n];
const results=[]; const card=(n,s="spade",t="basic")=>({number:n,suit:s,type:t,name:n===1?"sha":"shan",position:"d",original:"h"});
function mkPlayer(cards=[], hp=5,maxHp=8){return {
hp,maxHp,hand:cards,skills:[],storage:{},skipped:[],drawn:0,loss:0,gained:[],tmp:[],flipped:false,
countCards(where,filter){let arr=this.getCards(where);return typeof filter==="function"?arr.filter(filter).length:filter?.suit?arr.filter(c=>c.suit===filter.suit).length:arr.length;},
getCards(where){if(where==="h"||where==="hes"||where==="he")return this.hand;return []},
getDamagedHp(){return this.maxHp-this.hp},draw(n=1){this.drawn+=n},
loseHp(n=1){this.loss+=n;this.hp-=n},loseMaxHp(n=1){this.maxHp-=n},
hasSkill:n=>false,hasCard(fn){return this.hand.some(fn)},
isPhaseUsing:()=>true,isIn:()=>true,canCompare:()=>true,isTurnedOver(){return this.flipped},
turnOver(){this.flipped=!this.flipped},skip(name){this.skipped.push(name)},
addTempSkill(name){this.tmp.push(name)},awakenSkill(name){this.awakened=name},
gain:async function(cs){this.gained.push(...(Array.isArray(cs)?cs:[cs]))},
respond:async()=>{},$gain2:()=>{},logSkill:()=>{},popup:()=>{},
showCards:()=>{},addSkillBlocker:()=>{},removeSkillBlocker:()=>{},addTip:()=>{},removeTip:()=>{},
chooseToDiscard(){return {set(){return this},forResult:async()=>({bool:true,cards:[card(1)]})}},
chooseTarget(){return {set(){return this},forResult:async()=>({bool:true,targets:[]})}},
chooseButton(){return {set(){return this},forResult:async()=>({bool:true,links:[card(1)]})}}
}};
async function test(name,fn,level="execution"){try{await fn();results.push({name,status:"PASS",level})}catch(e){results.push({name,status:"FAIL",level,error:String(e.stack||e).slice(0,350)})}}
lib.diyGeiyuanUI.ensure=()=>{};lib.diyGeiyuanUI.refresh=()=>{};lib.diyGeiyuanUI.stop=()=>{};
await test("绝情",()=>{let p=mkPlayer(),t=mkPlayer();ctx.player=p;ctx.trigger={card:{name:"sha"},source:{isPhaseUsing:()=>true},player:t,num:1,cancel(){this.cancelled=true}};skill("diy_zch_jueqing").content();assert.equal(ctx.trigger.cancelled,true);assert.equal(t.loss,2)});
await test("伤逝",()=>{const p=mkPlayer([card(1)],4,8);assert.equal(skill("diy_zch_shangshi").filter({getl:()=>true},p),true);ctx.player=p;skill("diy_zch_shangshi").content();assert.equal(p.drawn,3)});
await test("知命",()=>{const p=mkPlayer([card(1)]),op=mkPlayer([card(2)]);assert.equal(skill("diy_zch_zhiming").filter({player:op},p),true);assert.equal(skill("diy_zch_zhiming").filter({player:p},p),false)},"filter-only");
await test("夙隐",()=>{const p=mkPlayer([]);_status.currentPhase={};let e={cards:[{original:"h"}]};assert.equal(skill("diy_zch_suyin").filter(e,p),true);_status.currentPhase=p;assert.equal(skill("diy_zch_suyin").filter(e,p),false);_status.currentPhase=null},"filter-only");
await test("变天",()=>{const p=mkPlayer(),t=mkPlayer();t.judge=fn=>({judge2:null,score:fn(card(5))});t.damage=(num,nature,source)=>{t.damageRec=[num,nature,source]};ctx.player=p;ctx.trigger={player:t};ctx.result={judge:-5};assert.equal(skill("diy_zch_biantian").filter(ctx.trigger,p),true);skill("diy_zch_biantian").content();assert.equal(t.damageRec[0],8);assert.equal(t.damageRec[1],"thunder")});
await test("天启",()=>{const p=mkPlayer();const s=skill("diy_zch_tianqi");_status.event={};const e={type:"phase",filterCard:()=>true};assert.equal(s.filter(e,p),true);const a=s.chooseButton.backup([["基本","","sha"]],p);assert.equal(a.viewAs.name,"sha");get.cards=()=>[{type:"equip",number:1}];_status.event={name:"phaseUse",getParent:()=>null};a.onuse({card:{name:"sha",type:"basic"}},p);assert.equal(p.loss,1);assert.ok(p.tmp.includes("diy_zch_tianqi_used"))});
await test("神道",async()=>{const p=mkPlayer([card(8)]),t=mkPlayer(),old=card(3);t.judging=[old];game.players=[p,t];const s=skill("diy_zch_shendao");assert.equal(s.filter({player:t},p),true);const newer=card(9);const evt={cards:[newer]};const trig={player:t,orderingCards:{addArray(cs){this.added=cs}}};await s.content(evt,trig,p);assert.equal(t.judging[0],newer);assert.equal(p.gained[0],old)});
await test("隐世",()=>{const p=mkPlayer();ctx.player=p;ctx.trigger={num:3,cancel(){this.cancelled=true}};skill("diy_zch_yinshi").content();assert.equal(ctx.trigger.cancelled,true);assert.equal(p.drawn,3)});
await test("落英",async()=>{const p=mkPlayer(),t=mkPlayer(),black=card(7,"club"),red=card(9,"heart");let e={name:"lose",type:"discard",cards:[black,red],player:t,getl:()=>null};assert.equal(skill("diy_luoying").filter(e,p),true);await skill("diy_luoying").content({},e,p);assert.equal(p.gained.length,1);assert.equal(p.gained[0],black)});
await test("固政",()=>{const p=mkPlayer(),t=mkPlayer();t.getHistory=()=>[{type:"discard"}];const e={player:t};assert.equal(guzheng.filter(e,p),true);assert.equal(guzheng.filter({player:p},p),false)},"filter-only");
await test("完杀：持有者可用桃、其他人不可用桃",()=>{const owner=mkPlayer(),other=mkPlayer();owner.hasSkill=n=>n==="diy_wansha";game.players=[owner,other];for(const method of ["cardSavable","cardEnabled"]){assert.equal(skill("diy_wansha2").mod[method]({name:"tao"},owner),undefined);assert.equal(skill("diy_wansha2").mod[method]({name:"tao"},other),false);assert.equal(skill("diy_wansha2").mod[method]({name:"sha"},other),undefined)}game.players=[other];assert.equal(skill("diy_wansha2").mod.cardEnabled({name:"tao"},other),undefined)});
await test("流转：原版子技能与摸牌阶段判定",()=>{assert.deepEqual(Array.from(liuzhuan.group),["dcliuzhuan_mark","dcliuzhuan_gain"]);const owner=mkPlayer(),other=mkPlayer();_status.currentPhase=other;const normalGain={player:other,getParent:()=>null};assert.equal(liuzhuan.subSkill.mark.filter(normalGain,owner),true);assert.equal(liuzhuan.subSkill.mark.filter(normalGain,other),false);assert.equal(liuzhuan.subSkill.mark.filter({player:other,getParent:()=>({name:"phaseDraw"})},owner),false);_status.currentPhase=null;});
await test("流转：带转标记的实体牌不能指定持有者",()=>{const tagged={hasGaintag:n=>n==="dcliuzhuan_tag"};const plain={hasGaintag:()=>false};assert.equal(liuzhuan.mod.targetEnabled({cards:[tagged]}),false);assert.equal(liuzhuan.mod.targetEnabled({cards:[plain]}),undefined)});
await test("杀意",()=>{const p=mkPlayer([card(1,"spade")]);const s=skill("diy_shayi");assert.equal(s.mod.cardUsable({name:"sha"},p),Infinity);assert.equal(s.mod.targetInRange({name:"sha"},p),true);assert.equal(s.filter({filterCard:()=>true},p),true);assert.equal(s.filterCard(card(2,"heart")),false)});
await test("镇魂",async()=>{const p=mkPlayer([card(2)]),t=mkPlayer(),u=mkPlayer();game.players=[p,t,u];await skill("diy_zhenhun").content({},null,p);assert.deepEqual(t.tmp,["diy_zhenhun_fengyin"]);assert.deepEqual(u.tmp,["diy_zhenhun_fengyin"])});
await test("惴恐",()=>{const s=yijiang.oldzhuikong.inherit==="zhuikong"?yijiang.zhuikong:yijiang.oldzhuikong;const p=mkPlayer([card(1)],3,8),t=mkPlayer();assert.equal(s.filter({player:t},p),true);assert.equal(s.filter({player:t},mkPlayer([card(1)],8,8)),false)},"filter-only");
await test("国色",()=>{const p=mkPlayer([card(4,"diamond")]);assert.equal(guose.filter({},p),true);assert.equal(guose.filterCard(card(4,"diamond")),true);assert.equal(guose.viewAs.name,"lebu")});
await test("割圆",async()=>{const p=mkPlayer(),t=mkPlayer();game.players=[p,t];game.me=p;skill("diy_geiyuan").init(p);assert.equal(p.storage.diy_geiyuan.order.length,13);p.storage.diy_geiyuan={order:[1,2,3,4],lit:[1,2,3]};const c=card(4,"club");ui.discardPile.childNodes=[c];const e={name:"cardsDiscard",cards:[c]};assert.equal(skill("diy_geiyuan").filter(e,p),true);await skill("diy_geiyuan").content({},e,p);assert.equal(p.storage.diy_geiyuan.order.length,2);assert.equal(p.storage.diy_geiyuan.lit.length,0); const c2=card(2);await skill('diy_geiyuan').content({}, {name:'cardsDiscard',cards:[c2]}, p); assert.equal(p.storage.diy_geiyuan.lit.length,1);await skill('diy_geiyuan').content({}, {name:'cardsDiscard',cards:[c2]}, p);assert.equal(p.storage.diy_geiyuan.lit.length,1)});
await test("解术",()=>{const p=mkPlayer([card(7),card(3)]);p.storage.diy_geiyuan={order:[1,2,3],lit:[1]};const s=skill("diy_jieshu");assert.equal(s.mod.maxHandcard(p,4),5);assert.equal(s.filter({name:"useCard",card:card(2)},p),true);ctx.player=p;ctx.trigger={name:"useCard",card:card(2)};s.content();assert.equal(p.drawn,1)});
await test("股算",()=>{const p=mkPlayer();p.storage.diy_geiyuan={order:[1,2,3],lit:[]};const s=skill("diy_gusuan");assert.equal(s.filter({},p),true);ctx.player=p;s.content();assert.equal(p.maxHp,7);assert.equal(p.storage.diy_gusuan,true);assert.equal(p.awakened,"diy_gusuan")});
await test("自动跳过",()=>{const p=mkPlayer([]);const s=skill("diy_autoskip_phase");lib.filter.filterCard=()=>false;get.skill=n=>({trigger:{}});assert.equal(s.filter({},p),true);ctx.player=p;s.content();assert.ok(p.skipped.includes("phaseUse"));p.hand=[card(1)];lib.filter.filterCard=()=>true;assert.equal(s.filter({},p),false)});
await test("割圆：完整13点到3点的多轮结算",async()=>{
  const p=mkPlayer(); game.players=[p]; game.me=p;
  p.storage.diy_geiyuan={order:Array.from({length:13},(_,i)=>i+1),lit:[]};
  const s=skill("diy_geiyuan");
  for(let round=0;round<5;round++){
    const oldOrder=p.storage.diy_geiyuan.order.slice();
    for(const num of oldOrder){
      const c=card(num);
      await s.content({}, {name:"cardsDiscard",cards:[c]}, p);
    }
    assert.equal(p.storage.diy_geiyuan.order.length,13-2*(round+1));
    assert.equal(p.storage.diy_geiyuan.lit.length,0);
  }
  assert.equal(p.storage.diy_geiyuan.order.length,3);
  assert.equal(skill("diy_gusuan").filter({},p),true);
  const finalOrder=p.storage.diy_geiyuan.order.slice();
  for(const num of finalOrder) await s.content({}, {name:"cardsDiscard",cards:[card(num)]}, p);
  assert.equal(p.storage.diy_geiyuan.order.length,3);
  assert.equal(p.storage.diy_geiyuan.lit.length,0);
});
await test("割圆：不在弃牌堆的卡不应点亮",async()=>{
  const p=mkPlayer(); game.players=[p]; game.me=p;
  p.storage.diy_geiyuan={order:[1,2,3,4,5],lit:[1]};
  const s=skill("diy_geiyuan");
  const withdrawn=card(2);withdrawn.position="h";
  await s.content({}, {name:"cardsDiscard",cards:[withdrawn]},p);
  assert.equal(p.storage.diy_geiyuan.lit.length,1);
  const valid=card(2);
  await s.content({}, {name:"cardsDiscard",cards:[valid]},p);
  assert.equal(p.storage.diy_geiyuan.lit.length,2);
});
await test("刘徽三技能及刘巴流转：配音文件与字幕完整",()=>{const voiceSource=fs.readFileSync("character/diy/voices.js","utf8");for(const [skillName,prefix] of [["diy_geiyuan","dcgeyuan"],["diy_jieshu","dcjieshu"],["diy_gusuan","dcgusuan"]]){const audios=Array.from(skill(skillName).audio);assert.equal(audios.length,2);for(let i=1;i<=2;i++){const filename=`${prefix}${i}.mp3`;assert.equal(audios[i-1],filename);assert.ok(fs.statSync(`audio/skill/${filename}`).size>0);assert.ok(voiceSource.includes(`"#${prefix}${i}"`))}}assert.equal(liuzhuan.audio,2);for(let i=1;i<=2;i++){const filename=`dcliuzhuan${i}.mp3`;assert.ok(fs.statSync(`audio/skill/${filename}`).size>0);assert.ok(voiceSource.includes(`"#dcliuzhuan${i}"`))}});
console.log(JSON.stringify({type:"raw-skill-function-execution",total:results.length,passed:results.filter(x=>x.status==="PASS").length,failed:results.filter(x=>x.status==="FAIL").length,results},null,2));
if(results.some(x=>x.status==="FAIL"))process.exitCode=1;
