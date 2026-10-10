const Engine=(()=>{
const N=13,ROUNDS=100,MID=6,C_IN=MID*N,C_OUT=MID*N+N-1,PREP=300,DIRS=[[1,0],[0,-1],[0,1],[-1,0]];
// Balans: alles wat de moeilijkheid bepaalt staat hier.
// Honderd rondes: de curve van vijftig is uitgerekt. Ronde 2r is nu ongeveer zo zwaar als ronde r was, en twee rondes leveren samen op wat één ronde opleverde.
const B={hp0:14,lin:.06,g:1.063,g2:1.0296,late:80,gold0:2.5,goldLin:.035,startGold:10000/* TESTWAARDE: terug naar 260 voor de definitieve versie */,lives:20,
  bonA:12,bonB:4};
const ROCK=new Set(); // geen bomen of rotsen meer: het hele veld is vrij
// Er is geen vast pad. Vijanden komen links in het midden binnen en gaan rechts in het midden weg.
// search zoekt de kortste route over de vakken die `pass` toelaat.
function search(pass){const n=N*N,dist=new Float64Array(n).fill(Infinity),prev=new Int16Array(n).fill(-1),done=new Uint8Array(n);
  if(!pass(C_IN)||!pass(C_OUT))return null;dist[C_IN]=0;
  for(;;){let u=-1,bd=Infinity;for(let i=0;i<n;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}
    if(u<0)return null;if(u===C_OUT)break;done[u]=1;const x=u%N,y=(u-x)/N;
    for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const v=ny*N+nx;
      if(!done[v]&&pass(v)&&bd+1<dist[v]){dist[v]=bd+1;prev[v]=u;}}}
  const cells=[];for(let c=C_OUT;c>=0;c=prev[c])cells.push(c);return cells.reverse();}
// Eerst alleen over de gelegde weg. Ligt er geen doorlopende weg, dan recht over het gras, om turrets en rotsen heen.
function route(road,taken){const free=c=>!ROCK.has(c)&&!taken(c),via=search(c=>road.has(c)&&free(c));
  if(via)return{cells:via,road:true};const g=search(free);if(g)return{cells:g,road:false};
  const row=[];for(let x=0;x<N;x++)row.push(MID*N+x);return{cells:row,road:false};}
function mkPath(cells,road){const pts=[[-.5,MID+.5]];for(const c of cells){const x=c%N;pts.push([x+.5,(c-x)/N+.5]);}pts.push([N+.5,MID+.5]);
  return{cells,set:new Set(cells),pts,len:pts.length-1,road:!!road};}
function posAt(P,d){d=Math.max(0,Math.min(P.len,d));const i=Math.min(P.len-1,Math.floor(d)),a=P.pts[i],b=P.pts[i+1],f=d-i;
  return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,b[0]-a[0],b[1]-a[1]];}
// De route zoals die nu zou worden: voor de voorvertoning tijdens de bouwfase.
function preview(G){if(G.pvk!==G.rv){G.pv=route(G.road,c=>!!G.map[c]);G.pvk=G.rv;}return G.pv;}
const canRoad=(G,c)=>G.phase==='prep'&&c>=0&&c<N*N&&!ROCK.has(c)&&!G.map[c];
function setRoad(G,c,on){if(!canRoad(G,c)||on===G.road.has(c))return false;if(on)G.road.add(c);else G.road.delete(c);G.rv++;return true;}
// Einde bouwfase: de route ligt vast. Weg die niet op de route ligt verdwijnt, zodat je daar weer kunt bouwen.
function lock(G){if(G.phase!=='prep')return;const r=route(G.road,c=>!!G.map[c]);G.path=mkPath(r.cells,r.road);
  G.trail=new Set(r.cells.filter(c=>!G.road.has(c)));G.road=new Set(r.cells.filter(c=>G.road.has(c)));G.rv++;G.phase='build';G.timer=10;}
// Volgende ronde: pas als iedereen klaar is (dat bepaalt de spellaag).
function next(G){if(G.phase==='wait'&&!G.final){G.phase='build';G.timer=8;}}

const T={
 sentry:{n:'Sentry Gun',d:'Snel en goedkoop. Zwak tegen pantser.',cost:60,dmg:9,rate:3,range:2.6},
 flak:{n:'Flak Kanon',d:'Explosieve schade in een gebied.',cost:110,dmg:20,rate:1,range:2.8,splash:1},
 cryo:{n:'Cryo Toren',d:'Bevriest vijanden: ze staan even stil.',cost:130,dmg:5,rate:.7,range:2.3,splash:1.1,fz:.9},
 toxin:{n:'Toxine Sproeier',d:'Gif vertraagt vijanden en vreet levens weg.',cost:120,dmg:4,rate:1.1,range:2.5,splash:.8,pd:10,slow:.3},
 tesla:{n:'Tesla Spoel',d:'Bliksem springt over naar 3 vijanden.',cost:200,dmg:32,rate:.9,range:2.6,chain:3},
 prism:{n:'Prisma Toren',d:'Straal wordt sterker op hetzelfde doel.',cost:240,dmg:5.5,rate:8,range:3.2},
 rocket:{n:'Raketbatterij',d:'Groot bereik en een grote klap.',cost:260,dmg:75,rate:.4,range:4.6,splash:1.4,minr:1.2},
 rail:{n:'Railgun',d:'Enorme schade, dwars door pantser.',cost:300,dmg:230,rate:.35,range:5},
 wave:{n:'Golfkanon',d:'Schiet door een hele rij vijanden heen.',cost:340,dmg:95,rate:.5,range:3.6},
 uplink:{n:'Commandopost',d:'Versterkt de schade van turrets in de buurt.',cost:220,range:1.6},
 geers:{n:'The Geers',d:'Drie turbo turrets, samengesmolten tot een.',cost:0,range:5.5},
 omega:{n:'Omega-toren',d:'Het ultieme wapen: vernietigende stralen die elke vijand in bereik vertragen.',cost:0,range:3.2}
};
const TYPES=['sentry','flak','cryo','toxin','tesla','prism','rocket','rail','wave','uplink'];
const EN={
 inf:{n:'Conscript',hp:1,sp:1.25,b:1},
 dog:{n:'Aanvalshond',hp:.55,sp:2.2,b:.8},
 tank:{n:'Hammer Tank',hp:3.2,sp:.8,arm:.35,b:2.6},
 drone:{n:'Terror Drone',hp:.32,sp:1.6,b:.4},
 mech:{n:'Veldmech',hp:1.8,sp:1,regen:.025,b:1.8},
 haz:{n:'Hazmat-trooper',hp:2.2,sp:1.05,immune:true,b:2.2},
 boss:{n:'Luchtschip',hp:28,sp:.55,arm:.25,b:25,leak:10,boss:true}
};
// Talenten: tree T = torens, H = held. t = rij (0-6, gaat open bij 5*t punten in die boom), c = kolom (0-3), max = aantal rangen,
// v = waarde per rang die in de tekst op {v} komt, req = talent recht erboven dat eerst vol moet zijn.
const SKILLS=[
 {id:'dmg',tree:'T',t:0,c:0,max:5,ic:'blast',n:'Holle punten',d:'+{v}% schade voor alle torens',v:3},
 {id:'bulk',tree:'T',t:0,c:1,max:5,ic:'crate',n:'Massaproductie',d:'Torens bouwen {v}% goedkoper',v:2.5},
 {id:'chest',tree:'T',t:0,c:2,max:3,ic:'coin',n:'Oorlogskas',d:'+{v} startcredits',v:50},
 {id:'rate',tree:'T',t:1,c:0,max:5,ic:'clock',n:'Overklok',d:'+{v}% vuursnelheid',v:2.5},
 {id:'bounty',tree:'T',t:1,c:1,max:5,ic:'coin',n:'Oorlogsbuit',d:'+{v}% credits per kill',v:4},
 {id:'fort',tree:'T',t:1,c:3,max:4,ic:'shield',n:'Versterkte basis',d:'+{v} levens',v:2},
 {id:'range',tree:'T',t:2,c:0,max:5,ic:'cross',n:'Lange optiek',d:'+{v}% bereik',v:2},
 {id:'engineer',tree:'T',t:2,c:1,max:3,ic:'wrench',n:'Ingenieurskorps',d:'Upgrades {v}% goedkoper',v:5},
 {id:'freeze',tree:'T',t:2,c:2,max:3,ic:'snow',n:'Diepvries',d:'Bevriezing duurt {v}% langer',v:12},
 {id:'toxin',tree:'T',t:2,c:3,max:3,ic:'drop',n:'Neurotoxine',d:'Gif doet {v}% meer schade en vertraagt sterker',v:14},
 {id:'ap',tree:'T',t:3,c:0,max:5,ic:'sword',n:'Pantserbrekers',d:'Negeert {v}% van vijandelijk pantser',v:10},
 {id:'bonus',tree:'T',t:3,c:1,max:4,ic:'up',n:'Frontpremie',d:'+{v}% rondebonus',v:10},
 {id:'splash',tree:'T',t:3,c:2,max:4,ic:'blast',n:'Brede lading',d:'Explosies {v}% groter',v:5},
 {id:'salvage',tree:'T',t:3,c:3,max:2,ic:'wrench',n:'Sloopdienst',d:'Verkopen levert {v}% meer op',v:10},
 {id:'link',tree:'T',t:4,c:0,max:5,ic:'link',n:'Linkversterker',d:'Linkbonus {v}% sterker',v:10},
 {id:'interest',tree:'T',t:4,c:1,max:5,ic:'coin',n:'Oorlogsobligaties',d:'{v}% rente op je credits na elke ronde (max 100)',v:1},
 {id:'turbo',tree:'T',t:4,c:2,max:5,ic:'bolt',n:'Turbo-injectie',d:'Turbo {v}% goedkoper',v:5},
 {id:'repair',tree:'T',t:4,c:3,max:2,ic:'plus',n:'Reparatieploeg',d:'+{v} leven na elke 10 rondes',v:1},
 {id:'boss',tree:'T',t:5,c:1,max:5,ic:'skull',n:'Bazenjager',d:'Torens doen +{v}% schade tegen bazen',v:6},
 {id:'geers',tree:'T',t:5,c:2,max:5,ic:'star',n:'Geers-overdrive',d:'The Geers doet {v}% meer schade',v:7,req:'turbo'},
 {id:'war',tree:'T',t:6,c:1,max:1,ic:'trophy',n:'Totale oorlog',d:'Alle torens: +10% schade en +10% vuursnelheid',v:0,req:'boss'},
 {id:'hdmg',tree:'H',t:0,c:0,max:5,ic:'sword',n:'Wapentraining',d:'Je held doet +{v}% schade',v:4},
 {id:'hhp',tree:'H',t:0,c:1,max:5,ic:'heart',n:'Taai',d:'+{v}% levenspunten voor je held',v:5},
 {id:'hspd',tree:'H',t:0,c:2,max:5,ic:'boot',n:'Snelle voeten',d:'Je held loopt {v}% sneller',v:2},
 {id:'hrate',tree:'H',t:1,c:0,max:5,ic:'clock',n:'Vuurdiscipline',d:'Je held valt {v}% sneller aan',v:3},
 {id:'harm',tree:'H',t:1,c:1,max:5,ic:'shield',n:'Dikke huid',d:'Je held krijgt {v}% minder schade',v:3},
 {id:'hrange',tree:'H',t:1,c:3,max:3,ic:'cross',n:'Verrekijker',d:'+{v}% bereik voor je held',v:4},
 {id:'hap',tree:'H',t:2,c:0,max:3,ic:'bolt',n:'Pantserdoorn',d:'Aanvallen van je held negeren {v}% pantser',v:15},
 {id:'hregen',tree:'H',t:2,c:1,max:3,ic:'plus',n:'Tweede adem',d:'In missies en de arena herstelt je held {v}% levenspunten per seconde',v:.5},
 {id:'hgold',tree:'H',t:2,c:2,max:3,ic:'coin',n:'Premiejager',d:'Kills door je held leveren {v}% extra credits op',v:10},
 {id:'hboss',tree:'H',t:2,c:3,max:5,ic:'skull',n:'Bazenbreker',d:'Je held doet +{v}% schade tegen bazen en de Kolos',v:5},
 {id:'hcrit',tree:'H',t:3,c:0,max:5,ic:'blast',n:'Zwakke plek',d:'{v}% kans op een kritieke treffer met dubbele schade',v:4},
 {id:'hdodge',tree:'H',t:3,c:1,max:3,ic:'dodge',n:'Scherpe reflexen',d:'{v}% kans om een treffer te ontwijken',v:5},
 {id:'shdur',tree:'H',t:3,c:2,max:3,ic:'shield',n:'Schildgenerator',d:'Je schild op het parcours houdt {v} seconde langer stand',v:.5},
 {id:'hpvp',tree:'H',t:3,c:3,max:5,ic:'sword',n:'Arenavechter',d:'+{v}% schade tegen andere helden',v:4},
 {id:'hcritd',tree:'H',t:4,c:0,max:3,ic:'star',n:'Dodelijke precisie',d:'Kritieke treffers doen nog eens {v}% extra schade',v:25,req:'hcrit'},
 {id:'shcd',tree:'H',t:4,c:2,max:3,ic:'clock',n:'Snelle lader',d:'Je schild laadt {v} seconde sneller op',v:1,req:'shdur'},
 {id:'mission',tree:'H',t:4,c:3,max:3,ic:'up',n:'Missiepremie',d:'+{v} credits als je een missie of de arena wint',v:150},
 {id:'leech',tree:'H',t:5,c:0,max:3,ic:'drop',n:'Bloeddorst',d:'Zolang je held aanvalt herstelt hij {v}% levenspunten per seconde',v:1},
 {id:'second',tree:'H',t:5,c:1,max:1,ic:'heart',n:'Tweede kans',d:'Eén keer per missie staat je held na een dodelijke klap weer op met 30% levenspunten. Werkt niet tegen de ultra-aanval van de Kolos.',v:0},
 {id:'legend',tree:'H',t:6,c:1,max:1,ic:'trophy',n:'Legende',d:'Je held: +15% schade, +15% levenspunten en +10% snelheid',v:0,req:'second'}
];
const SKILL_MAX=SKILLS.reduce((a,s)=>a+s.max,0),TIER=5;
function mods(sk){sk=sk&&!Array.isArray(sk)?sk:{};const r=id=>sk[id]|0,war=r('war')?1.1:1,lg=r('legend');return{
  gold:1+.04*r('bounty'),up:1-.05*r('engineer'),start:50*r('chest'),build:1-.025*r('bulk'),lives:2*r('fort'),
  dmg:(1+.03*r('dmg'))*war,rate:(1+.025*r('rate'))*war,range:1+.02*r('range'),freeze:1+.12*r('freeze'),tox:1+.14*r('toxin'),toxSlow:.035*r('toxin'),
  interest:.01*r('interest'),bonus:1+.1*r('bonus'),sell:.7+.1*r('salvage'),link:1+.1*r('link'),turbo:1-.05*r('turbo'),geers:1+.07*r('geers'),
  ap:.1*r('ap'),splash:1+.05*r('splash'),repair:r('repair'),boss:1+.06*r('boss'),
  hDmg:(1+.04*r('hdmg'))*(lg?1.15:1),hHp:(1+.05*r('hhp'))*(lg?1.15:1),hSpd:(1+.02*r('hspd'))*(lg?1.1:1),hRate:1+.03*r('hrate'),hArm:.03*r('harm'),
  hRange:1+.04*r('hrange'),hAp:.15*r('hap'),hRegen:.005*r('hregen'),hGold:.1*r('hgold'),hBoss:1+.05*r('hboss'),hCrit:.04*r('hcrit'),hCritDmg:.25*r('hcritd'),
  hDodge:.05*r('hdodge'),shDur:.5*r('shdur'),shCd:r('shcd'),hPvp:1+.04*r('hpvp'),mission:150*r('mission'),leech:.01*r('leech'),second:r('second')>0};}
const skillTotal=sk=>SKILLS.reduce((a,s)=>a+(sk[s.id]|0),0);
const skillSpent=(sk,tree)=>SKILLS.reduce((a,s)=>a+(s.tree===tree?(sk[s.id]|0):0),0);
// lock: 'tier' = te weinig punten in deze boom, 'req' = het talent erboven is nog niet vol
function skillState(sk,s){const rank=sk[s.id]|0,q=s.req&&SKILLS.find(x=>x.id===s.req);
  return{rank,lock:skillSpent(sk,s.tree)<TIER*s.t?'tier':q&&(sk[q.id]|0)<q.max?'req':null,q};}
// Skillpunten voor het halen van ronde r: 1 per 20 levels, 1 per miniboss (elke tiende ronde) en 3 zodra je daarmee level 100 bereikt.
const pointsFor=r=>(r%20===0?1:0)+(r%10===0?1:0)+(r===99?3:0);
const hpMul=r=>B.hp0*(1+B.lin*r)*Math.pow(B.g,r)*(r>B.late?Math.pow(B.g2,r-B.late):1);

function create(skills){const m=mods(skills);
  return{m,gold:B.startGold+m.start,lives:B.lives+m.lives,round:1,cleared:0,phase:'prep',timer:PREP,wt:0,q:[],road:new Set(),trail:new Set(),path:null,rv:0,pv:null,pvk:-1,
    tw:[],map:{},en:[],fx:[],ev:[],fxOn:false,score:0,kills:0,time:0,nid:1,geers:0};}

function makeWave(r){const q=[];let t=0;const n=8+Math.floor(r*.4),R=Math.round;
  const add=(type,cnt,gap,hm)=>{for(let i=0;i<cnt;i++){q.push({t,type,hm:hm||1});t+=gap;}t+=1.2;};
  if(r%10===0){add('inf',R(n*.5),.55);add('tank',R(n*.3),.9);add('boss',1+Math.floor(r/40),4);if(r===ROUNDS)add('boss',1,1,3);}
  else switch(r%5){
    case 1:add('inf',n,.55);break;
    case 2:add('inf',R(n*.6),.55);add('dog',R(n*.6),.4);break;
    case 3:add('drone',R(n*1.8),.25);break;
    case 4:add('tank',R(n*.4),.9);add(r>=14?'mech':'inf',R(n*.35),.7);break;
    default:add(r>=18?'haz':'inf',R(n*.4),.7);add('dog',R(n*.5),.4);add('tank',R(n*.25),.9);}
  return q.reverse();}
function startWave(G){if(G.phase!=='build')return;G.phase='wave';G.wt=0;G.q=makeWave(G.round);G.ev.push({k:'wave',r:G.round});}
function spawn(G,s){const d=EN[s.type],r=G.round,hp=d.hp*hpMul(r)*s.hm,p=posAt(G.path,0);
  G.en.push({id:G.nid++,type:s.type,hp,max:hp,d:0,sp:d.sp,arm:d.arm||0,regen:d.regen||0,immune:!!d.immune,boss:!!d.boss,
    big:s.hm>1,leak:d.leak||1,b:Math.max(1,Math.round(B.gold0*d.b*s.hm*(1+B.goldLin*r)*G.m.gold)),sc:Math.round(d.b*s.hm*r*5),
    x:p[0],y:p[1],dx:p[2],dy:p[3],fz:0,fi:0,sT:0,sl:0,pT:0,pD:0});}
function kill(G,e){if(e.dead)return;e.dead=true;G.gold+=e.b;G.score+=e.sc;G.kills++;if(G.fxOn)G.fx.push({k:'die',b:[e.x,e.y],boss:e.boss});}
function hit(G,e,dmg,pierce){if(e.dead)return;const arm=e.arm*(1-G.m.ap)*(1-(pierce||0));
  e.hp-=dmg*(1-arm)*(e.boss?G.m.boss:1);if(e.hp<=0)kill(G,e);}
function aoe(G,x,y,r,fn){const r2=r*r;for(const e of G.en){if(e.dead)continue;const dx=e.x-x,dy=e.y-y;if(dx*dx+dy*dy<=r2)fn(e);}}

function stats(G,t){const b=T[t.type],m=G.m,au=1+(t.aura||0);
  if(t.type==='geers')return{dmg:t.gdps*m.geers*m.dmg*au/5,rate:5,range:b.range*m.range};
  if(t.type==='omega')return{dmg:hpMul(G.round)*.6*m.dmg*au,rate:2,range:b.range*m.range};
  const ln=t.spec==='link'?Math.min(4,t.nb||0):0,tb=t.spec==='turbo';
  if(t.type==='uplink')return{dmg:0,rate:0,range:(1.6+.15*t.lvl)*m.range*(1+.1*ln),aura:(.18+.04*t.lvl)*(tb?1.5:1)*(1+.15*m.link*ln)};
  const up=Math.pow(1.4,t.lvl);
  return{dmg:b.dmg*up*m.dmg*au*(1+.25*m.link*ln)*(tb?1.3:1),rate:b.rate*(1+.05*t.lvl)*m.rate*(tb?1.8:1),
    range:b.range*(1+.04*t.lvl)*m.range*(1+.05*ln),
    fz:b.fz?b.fz*(1+.12*t.lvl)*m.freeze:0,pd:b.pd?b.pd*up*m.tox*au:0,slow:b.slow?Math.min(.6,b.slow+m.toxSlow+.02*t.lvl):0};}
function recalc(G){
  for(const t of G.tw){t.nb=0;t.aura=0;const x=t.c%N,y=(t.c-x)/N;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=N||ny>=N)continue;const o=G.map[ny*N+nx];if(o&&(o.lvl>=5||o.type==='geers'))t.nb++;}}
  for(const u of G.tw){if(u.type!=='uplink')continue;u.s=stats(G,u);
    for(const t of G.tw){if(t.type==='uplink')continue;const dx=t.x-u.x,dy=t.y-u.y;
      if(dx*dx+dy*dy<=u.s.range*u.s.range&&u.s.aura>t.aura)t.aura=u.s.aura;}}
  for(const t of G.tw)t.s=stats(G,t);}
function canBuild(G,c){if(!(c>=0&&c<N*N)||ROCK.has(c)||G.map[c]||c===C_IN||c===C_OUT)return false;
  if(G.path)return!G.path.set.has(c);if(G.road.has(c))return false;
  return!!search(k=>k!==c&&!ROCK.has(k)&&!G.map[k]);} // een turret mag de doorgang nooit helemaal afsluiten
const buildCost=(G,type)=>Math.round(T[type].cost*G.m.build);
const upCost=(G,t)=>Math.round(T[t.type].cost*(.5+.25*t.lvl)*G.m.up);
const specCost=(G,t,k)=>Math.round(T[t.type].cost*(k==='turbo'?3*G.m.turbo:1.5));
const sellValue=(G,t)=>Math.round(t.spent*G.m.sell);
function build(G,c,type){if(!canBuild(G,c)||!T[type]||type==='geers')return null;const cost=buildCost(G,type);if(G.gold<cost)return null;
  G.gold-=cost;const x=c%N,t={id:G.nid++,c,x:x+.5,y:(c-x)/N+.5,type,lvl:0,spec:null,cd:0,ang:.8,ramp:1,tg:0,spent:cost,nb:0,aura:0};
  G.tw.push(t);G.map[c]=t;G.rv++;recalc(G);return t;}
function upgrade(G,t){if(t.type==='geers'||t.lvl>=5)return false;const c=upCost(G,t);if(G.gold<c)return false;
  G.gold-=c;t.spent+=c;t.lvl++;recalc(G);return true;}
function remove(G,t){G.tw.splice(G.tw.indexOf(t),1);delete G.map[t.c];G.rv++;}
function sell(G,t){G.gold+=sellValue(G,t);remove(G,t);recalc(G);}
const rawDps=t=>{const b=T[t.type];return b.dmg?b.dmg*Math.pow(1.4,5)*1.3*b.rate*1.25*1.8*(t.type==='prism'?1.6:1):150;};
function spec(G,t,k){if(t.type==='geers'||t.lvl<5||t.spec||(k!=='turbo'&&k!=='link'))return false;const c=specCost(G,t,k);if(G.gold<c)return false;
  G.gold-=c;t.spent+=c;t.spec=k;
  if(k==='turbo'){const tb=G.tw.filter(o=>o.spec==='turbo'&&o!==t);
    if(tb.length>=2){const parts=[tb[0],tb[1],t];t.gdps=1.1*parts.reduce((s,o)=>s+rawDps(o),0);
      t.spent=parts.reduce((s,o)=>s+o.spent,0);remove(G,tb[0]);remove(G,tb[1]);
      t.type='geers';t.spec='geers';t.lvl=5;G.geers++;G.ev.push({k:'geers',c:t.c});
      // tien keer The Geers: het ultieme wapen vult elk vrij vak met een Omega-toren
      if(G.geers>=10&&!G.omega){G.omega=true;let n=0;for(let c=0;c<N*N;c++)if(canBuild(G,c)){const x=c%N,o={id:G.nid++,c,x:x+.5,y:(c-x)/N+.5,type:'omega',lvl:5,spec:'omega',cd:0,ang:.8,ramp:1,tg:0,spent:0,nb:0,aura:0};G.tw.push(o);G.map[c]=o;n++;}G.rv++;G.ev.push({k:'omega',n});}}}
  recalc(G);return true;}

function fire(G,t,e,s){const m=G.m,fx=G.fxOn?G.fx:null,a=[t.x,t.y],b=[e.x,e.y];
  switch(t.type){
    case'omega':hit(G,e,hpMul(G.round)*.6*m.dmg*(1+(t.aura||0)),.5);if(!e.dead){const sl=.45*(e.boss?.5:1);e.sl=e.sT>0?Math.max(e.sl,sl):sl;e.sT=2;}fx&&fx.push({k:'omega',a,b});break;
    case'sentry':hit(G,e,s.dmg,0);fx&&fx.push({k:'shot',a,b});break;
    case'rail':hit(G,e,s.dmg,1);fx&&fx.push({k:'rail',a,b});break;
    case'flak':case'rocket':{const r=T[t.type].splash*m.splash;aoe(G,e.x,e.y,r,x=>hit(G,x,s.dmg,0));fx&&fx.push({k:t.type==='rocket'?'rocket':'boom',a,b,r});break;}
    case'cryo':{const r=T.cryo.splash*m.splash;aoe(G,e.x,e.y,r,x=>{hit(G,x,s.dmg,0);
      if(!x.dead&&!x.immune&&x.fi<=0){const d=s.fz*(x.boss?.4:1);x.fz=d;x.fi=d+2.2;}});fx&&fx.push({k:'ice',a,b,r});break;}
    case'toxin':{const r=T.toxin.splash*m.splash;aoe(G,e.x,e.y,r,x=>{hit(G,x,s.dmg,0);if(x.dead)return;
      x.pD=x.pT>0?Math.max(x.pD,s.pd):s.pd;x.pT=4;if(!x.immune){const sl=s.slow*(x.boss?.5:1);x.sl=x.sT>0?Math.max(x.sl,sl):sl;x.sT=4;}});
      fx&&fx.push({k:'tox',a,b,r});break;}
    case'tesla':{const pts=[a,b],done=new Set([e.id]);let cur=e,d=s.dmg;hit(G,e,d,.5);
      for(let i=1;i<T.tesla.chain;i++){let nx=null,bd=3.3;for(const o of G.en){if(o.dead||done.has(o.id))continue;
          const dx=o.x-cur.x,dy=o.y-cur.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;nx=o;}}
        if(!nx)break;d*=.7;done.add(nx.id);pts.push([nx.x,nx.y]);hit(G,nx,d,.5);cur=nx;}
      fx&&fx.push({k:'bolt',pts});break;}
    case'prism':if(t.tg!==e.id){t.tg=e.id;t.ramp=1;}hit(G,e,s.dmg*t.ramp,0);t.ramp=Math.min(2.5,t.ramp+.5/s.rate);fx&&fx.push({k:'beam',a,b});break;
    case'wave':{const L=Math.hypot(e.x-t.x,e.y-t.y)||1,ux=(e.x-t.x)/L,uy=(e.y-t.y)/L,w=.5*m.splash;
      for(const o of G.en){if(o.dead)continue;const px=o.x-t.x,py=o.y-t.y,pr=px*ux+py*uy;if(pr<0||pr>s.range)continue;
        if(Math.abs(px*uy-py*ux)<=w)hit(G,o,s.dmg,.3);}
      fx&&fx.push({k:'wave',a,b:[t.x+ux*s.range,t.y+uy*s.range]});break;}
  }}
function step(G,dt){
  if(G.phase==='over'||G.phase==='won'||G.phase==='prep')return;
  G.time+=dt;
  if(G.phase==='build'){G.timer-=dt;if(G.timer<=0)startWave(G);}
  if(G.phase==='wave'){G.wt+=dt;while(G.q.length&&G.q[G.q.length-1].t<=G.wt)spawn(G,G.q.pop());}
  for(const e of G.en){if(e.dead)continue;
    if(e.fi>0)e.fi-=dt;
    if(e.pT>0){e.pT-=dt;e.hp-=e.pD*dt;if(e.hp<=0){kill(G,e);continue;}}
    else if(e.regen&&e.hp<e.max)e.hp=Math.min(e.max,e.hp+e.max*e.regen*dt);
    let sp=e.sp;
    if(e.fz>0){e.fz-=dt;sp=0;}else if(e.sT>0){e.sT-=dt;sp*=1-e.sl;}
    e.d+=sp*dt;
    if(e.d>=G.path.len){e.dead=true;G.lives-=e.leak;G.ev.push({k:'leak',n:e.leak});continue;}
    const p=posAt(G.path,e.d);e.x=p[0];e.y=p[1];e.dx=p[2];e.dy=p[3];}
  for(const t of G.tw){if(t.type==='uplink')continue;
    t.cd-=dt;if(t.cd>0)continue;
    const s=t.s,r2=s.range*s.range,mr=T[t.type].minr||0,m2=mr*mr;
    if(t.type==='geers'){const inr=[];for(const e of G.en){if(e.dead)continue;const dx=e.x-t.x,dy=e.y-t.y;if(dx*dx+dy*dy<=r2)inr.push(e);}
      if(!inr.length){t.cd=0;continue;}inr.sort((p,q)=>q.d-p.d);t.cd=Math.max(t.cd,-dt)+1/s.rate;
      t.ang=Math.atan2(inr[0].y-t.y,inr[0].x-t.x);
      for(let i=0;i<3&&i<inr.length;i++){const e=inr[i];if(G.fxOn)G.fx.push({k:'geers',a:[t.x,t.y],b:[e.x,e.y]});
        if(!e.immune){e.sl=Math.max(e.sT>0?e.sl:0,.25);e.sT=Math.max(e.sT,.6);}hit(G,e,s.dmg,.5);}
      continue;}
    let best=null,bv=-1;
    for(const e of G.en){if(e.dead)continue;const dx=e.x-t.x,dy=e.y-t.y,d2=dx*dx+dy*dy;if(d2>r2||d2<m2)continue;
      let v=t.type==='rail'?e.hp:e.d;
      if(t.type==='cryo'&&!e.immune&&e.fi<=0)v+=1000;else if(t.type==='toxin'&&e.pT<=.5)v+=1000;
      if(v>bv){bv=v;best=e;}}
    if(!best){t.cd=0;t.ramp=1;continue;}
    t.cd=Math.max(t.cd,-dt)+1/s.rate;t.ang=Math.atan2(best.y-t.y,best.x-t.x);
    fire(G,t,best,s);}
  let w=0;for(let i=0;i<G.en.length;i++)if(!G.en[i].dead)G.en[w++]=G.en[i];G.en.length=w;
  if(G.lives<=0){G.lives=0;G.phase='over';return;}
  if(G.phase==='wave'&&!G.q.length&&!G.en.length){const r=G.round,bonus=Math.round((B.bonA+B.bonB*r)*G.m.bonus),
      int=Math.min(100,Math.floor(G.gold*G.m.interest));
    G.gold+=bonus+int;G.score+=50*r;G.cleared=r;if(r%10===0)G.lives+=G.m.repair;
    G.ev.push({k:'clear',r,bonus:bonus+int});
    // Na de laatste golf wacht nog het eindmonster: de spellaag beslist daarna over winst of verlies.
    if(r>=ROUNDS){G.final=true;G.phase='wait';}else{G.round++;G.phase='wait';}}
}
function win(G){if(G.phase==='won'||G.phase==='over')return;G.phase='won';G.score+=5000+200*G.lives;}
function lose(G){if(G.phase==='won'||G.phase==='over')return;G.phase='over';}
return{N,ROUNDS,MID,C_IN,C_OUT,PREP,DIRS,B,T,TYPES,EN,SKILLS,ROCK,posAt,mkPath,route,preview,canRoad,setRoad,lock,next,create,step,startWave,build,upgrade,sell,spec,canBuild,
  buildCost,upCost,specCost,sellValue,stats,mods,skillTotal,skillSpent,skillState,SKILL_MAX,TIER,pointsFor,hpMul,makeWave,hit,recalc,win,lose};
})();

// Dezelfde spelregels draaien op de server (controle van opgeslagen voortgang).
if(typeof module!=="undefined"&&module.exports)module.exports=Engine;
