const Engine=(()=>{
const N=13,ROUNDS=100,MID=6,C_IN=MID*N,C_OUT=MID*N+N-1,DIRS=[[1,0],[0,-1],[0,1],[-1,0]];
let PREP=300; // bouwtijd in seconden; instelbaar via de webadmin (zie tune)
// Balans: alles wat de moeilijkheid bepaalt staat hier. startGold, lives, hpX en goldX zijn instelbaar via de webadmin (zie tune).
// Honderd rondes: de curve van vijftig is uitgerekt. Ronde 2r is nu ongeveer zo zwaar als ronde r was, en twee rondes leveren samen op wat één ronde opleverde.
const B={hp0:14,lin:.06,g:1.063,g2:1.0296,late:80,gold0:2.5,goldLin:.035,startGold:260,lives:20,hpX:1,goldX:1,
  bonA:12,bonB:4,
  // Extra zwaarte bovenop de curve: level 1-10 ongewijzigd, daarna loopt het op tot midX op level 20 (tot en met 30 gelijk),
  // en vanaf level 31 komt er elk level ramp bij (samengesteld).
  midX:1.15,rampFrom:30,ramp:.015};
const tough=r=>r<=10?1:r<20?1+(B.midX-1)*(r-10)/10:B.midX*(r>B.rampFrom?Math.pow(1+B.ramp,r-B.rampFrom):1);
// Moeilijkheidsgraden: elke speler kiest er zelf een voor het potje begint. hp en sp maken de vijanden in jouw vesting taaier en sneller,
// hurt is de extra schade die je held in minigames krijgt, score de vermenigvuldiger op alles wat je scoort.
const DIFF=[{id:'geers',n:'Geers',d:'De gewone strijd.',score:1,hp:1,sp:1,hurt:1},
 {id:'super',n:'Super Geers',d:'Vijanden hebben 35% meer levens en lopen 6% sneller. Je held krijgt 20% meer schade.',score:1.25,hp:1.35,sp:1.06,hurt:1.2},
 {id:'only',n:'Alleen voor Geers',d:'Vijanden hebben 85% meer levens en lopen 12% sneller. Je held krijgt 50% meer schade.',score:1.75,hp:1.85,sp:1.12,hurt:1.5}];
const diffIdx=v=>Math.max(0,Math.min(DIFF.length-1,Math.floor(+v||0)));
const ROCK=new Set(); // geen bomen of rotsen meer: het hele veld is vrij
// ---------- maps ----------
// Een map bepaalt hoe de vijand door een vesting loopt. Alle vestingen in een potje spelen dezelfde map.
//  in, out  het vak aan de rand waar de vijand binnenkomt en weggaat (out -1: er is geen uitgang)
//  roads    je legt in de bouwfase zelf een weg (anders loopt de vijand over het gras, om je torens heen)
//  maze     je bouwt het doolhof met je torens: ook tijdens het spel, de vijand zoekt meteen een nieuwe weg
//  loop     vaste ring: de vijand blijft rondjes lopen tot hij dood is, elk rondje kost levens
//  pass     wat erdoor komt loopt door naar de volgende vesting: 'row' naar rechts, 'col' naar beneden
//  pool     alle vestingen delen één levenspot (de spellaag telt hem op en beslist over verlies)
//  mini     de minigames na elke tiende golf doen mee
const cellAt=(x,y)=>y*N+x,GATE=8; // GATE: de kolom van de opening in de boven- en ondermuur van een vesting
// De ring van Groene Cirkel: de rand van het vierkant van (2,2) tot (10,10). De vijand komt links binnen en stapt bij (2,6) op de ring.
const RING=(()=>{const c=[cellAt(0,MID),cellAt(1,MID)],L=2,R=N-3;
  for(let y=MID;y>=L;y--)c.push(cellAt(L,y));for(let x=L+1;x<=R;x++)c.push(cellAt(x,L));
  for(let y=L+1;y<=R;y++)c.push(cellAt(R,y));for(let x=R-1;x>=L;x--)c.push(cellAt(x,R));for(let y=R-1;y>MID;y--)c.push(cellAt(L,y));
  return c;})();
const MAPS={
 classic:{id:'classic',n:'Klassiek',k:'Je eigen weg',d:'Zoals je gewend bent: de vijand komt links binnen en gaat rechts weg. In de bouwfase leg je zelf de weg. Met minigames na elke tiende golf.',in:C_IN,out:C_OUT,roads:true,mini:true},
 relay:{id:'relay',n:'Estafette',k:'Doorlopen',d:'Wat jij doorlaat, loopt verder door de vesting rechts van je. Alleen de laatste vesting op de rij verliest er levens door. Hoe verder rechts, hoe zwaarder het wordt.',in:C_IN,out:C_OUT,roads:true,pass:'row'},
 wintermaul:{id:'wintermaul',n:'Wintermaul',k:'Samenwerken',d:'De vijand komt boven binnen en zakt van vesting naar vesting naar beneden. Er is geen weg: je bouwt het doolhof met je torens. Iedereen deelt één levenspot; is die leeg, dan verliest het hele team.',in:GATE,out:(N-1)*N+GATE,maze:true,pass:'col',pool:true},
 circle:{id:'circle',n:'Groene Cirkel',k:'Rondje',d:'De vijand stapt op een vaste ring en blijft rondjes lopen tot hij dood is. Er is geen uitgang: elk rondje dat een vijand afmaakt kost levens. Bouw binnen en buiten de ring.',in:C_IN,out:-1,loop:{cells:RING,at:2}},
 maze:{id:'maze',n:'Doolhofbouwer',k:'Vrij bouwen',d:'Geen weg en geen vaste route. De vijand komt links binnen en wil onder weg. Je torens zijn je muren: maak zijn weg zo lang mogelijk, ook tijdens een golf.',in:C_IN,out:(N-1)*N+GATE,maze:true}
};
const MAP_IDS=Object.keys(MAPS),mapOf=id=>MAPS[id]||MAPS.classic;
// Het punt net buiten de rand naast vak c: daar komt de vijand vandaan of loopt hij heen.
function edgePt(c){const x=c%N,y=(c-x)/N;return x===0?[-.5,y+.5]:x===N-1?[N+.5,y+.5]:y===0?[x+.5,-.5]:[x+.5,N+.5];}
// search zoekt de kortste route over de vakken die `pass` toelaat, van de ingang naar de uitgang van map M.
function search(pass,M){M=M||MAPS.classic;const A=M.in,Z=M.out,n=N*N,dist=new Float64Array(n).fill(Infinity),prev=new Int16Array(n).fill(-1),done=new Uint8Array(n);
  if(Z<0||!pass(A)||!pass(Z))return null;dist[A]=0;
  for(;;){let u=-1,bd=Infinity;for(let i=0;i<n;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}
    if(u<0)return null;if(u===Z)break;done[u]=1;const x=u%N,y=(u-x)/N;
    for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const v=ny*N+nx;
      if(!done[v]&&pass(v)&&bd+1<dist[v]){dist[v]=bd+1;prev[v]=u;}}}
  const cells=[];for(let c=Z;c>=0;c=prev[c])cells.push(c);return cells.reverse();}
// Eerst alleen over de gelegde weg. Ligt er geen doorlopende weg, dan recht over het gras, om turrets en rotsen heen.
// Op een ringmap ligt de route altijd vast.
function route(road,taken,M){M=M||MAPS.classic;if(M.loop)return{cells:M.loop.cells.slice(),road:false};
  const free=c=>!ROCK.has(c)&&!taken(c),via=M.roads?search(c=>road.has(c)&&free(c),M):null;
  if(via)return{cells:via,road:true};const g=search(free,M);if(g)return{cells:g,road:false};
  const row=[],x0=M.in%N,y0=(M.in-x0)/N;if(x0===0)for(let x=0;x<N;x++)row.push(cellAt(x,y0));else for(let y=0;y<N;y++)row.push(cellAt(x0,y));return{cells:row,road:false};}
// pts: de punten waar de vijand langs loopt. Op een ringmap eindigt de lijn weer op het eerste ringvak; loopFrom is dat punt.
function mkPath(cells,road,M){M=M||MAPS.classic;const pts=[edgePt(M.in)];for(const c of cells){const x=c%N;pts.push([x+.5,(c-x)/N+.5]);}
  let loopFrom=null;if(M.loop){loopFrom=M.loop.at+1;pts.push(pts[loopFrom].slice());}else pts.push(edgePt(M.out));
  return{cells,set:new Set(cells),pts,len:pts.length-1,road:!!road,loopFrom};}
function posAt(P,d){d=Math.max(0,Math.min(P.len,d));const i=Math.min(P.len-1,Math.floor(d)),a=P.pts[i],b=P.pts[i+1],f=d-i;
  return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,b[0]-a[0],b[1]-a[1]];}
// Hoe ver langs pad P het punt (x,y) ligt: de dichtstbijzijnde plek op de lijn.
function nearD(P,x,y){let best=0,bd=Infinity;for(let i=0;i<P.len;i++){const a=P.pts[i],b=P.pts[i+1],vx=b[0]-a[0],vy=b[1]-a[1],L=vx*vx+vy*vy||1,
    t=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/L)),dx=a[0]+vx*t-x,dy=a[1]+vy*t-y,d=dx*dx+dy*dy;if(d<bd-1e-9){bd=d;best=i+t;}}return best;}
// De route zoals die nu zou worden: voor de voorvertoning tijdens de bouwfase.
function preview(G){if(G.pvk!==G.rv){G.pv=route(G.road,c=>!!G.map[c],G.mp);G.pvk=G.rv;}return G.pv;}
const canRoad=(G,c)=>G.mp.roads&&G.phase==='prep'&&c>=0&&c<N*N&&!ROCK.has(c)&&!G.map[c];
function setRoad(G,c,on){if(!canRoad(G,c)||on===G.road.has(c))return false;if(on)G.road.add(c);else G.road.delete(c);G.rv++;return true;}
// Doolhofmaps: na elke nieuwe of verkochte toren zoekt de vijand meteen een nieuwe weg. Wie al loopt, gaat verder vanaf waar hij staat.
function repath(G){if(!G.path||!G.mp.maze)return;const r=route(G.road,c=>!!G.map[c],G.mp),P=mkPath(r.cells,r.road,G.mp);
  for(const e of G.en)if(!e.dead)e.d=nearD(P,e.x,e.y);G.path=P;G.trail=new Set(r.cells);G.rv++;}
// Einde bouwfase: de route ligt vast. Weg die niet op de route ligt verdwijnt, zodat je daar weer kunt bouwen.
function lock(G){if(G.phase!=='prep')return;const r=route(G.road,c=>!!G.map[c],G.mp);G.path=mkPath(r.cells,r.road,G.mp);
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
 // De top van de keten. max = aantal upgrades, up = schadegroei per niveau, rl = bereikgroei per niveau, uc = [basis, stap] van de upgradeprijs.
 geers:{n:'Geers Toren',d:'Zware granaten die door pantser slaan, tegen elke vijand even sterk. 13 keer te upgraden.',cost:1200,dmg:150,rate:1.5,range:3.8,splash:1.1,max:13,up:1.22,rl:.02,uc:[.25,.06]},
 sleeper:{n:'De Slapende Geers',d:'Beslaat 3 bij 3 vakken. Zijn gesnurk vertraagt elke vijand in een groot gebied en doet zware schade.',cost:5000,dmg:1500,rate:1.25,range:5.5,slow:.65,size:3,max:0}
};
// Wakker maken: zo vaak drukken, dan is hij zo lang wakker met zoveel keer kracht en bereik. Dat kan één keer per Slapende Geers.
const WAKE={pokes:10,time:10,mul:20
};
// TYPES zijn de tien gewone torens. ALL bevat ook de twee Geers-torens die je pas later vrijspeelt.
const TYPES=['sentry','flak','cryo','toxin','tesla','prism','rocket','rail','wave','uplink'],ALL=[...TYPES,'geers','sleeper'],GEERS_NEED=4;
const EN={
 inf:{n:'Conscript',hp:1,sp:1.25,b:1},
 dog:{n:'Aanvalshond',hp:.55,sp:2.2,b:.8},
 tank:{n:'Hammer Tank',hp:3.2,sp:.8,arm:.35,b:2.6},
 drone:{n:'Terror Drone',hp:.32,sp:1.6,b:.4},
 mech:{n:'Veldmech',hp:1.8,sp:1,regen:.025,b:1.8},
 haz:{n:'Hazmat-trooper',hp:2.2,sp:1.05,immune:true,b:2.2},
 boss:{n:'Luchtschip',hp:28,sp:.55,arm:.25,b:25,leak:10,boss:true}
};
// Matchups: wat een toren tegen een vijand doet. 1.5 = sterk, .5 = zwak, niet genoemd = gewoon.
// Het getal telt voor de schade per schot, voor het gif per seconde en voor hoe lang een vijand bevroren blijft.
const VS={
 sentry:{inf:1.5,dog:1.5,tank:.5,boss:.5},
 flak:{drone:1.5,boss:1.5,tank:.5,mech:.5},
 cryo:{dog:1.5,mech:1.5,haz:.5,boss:.5},
 toxin:{inf:1.5,dog:1.5,haz:.5,drone:.5,tank:.5},
 tesla:{drone:1.5,mech:1.5,haz:.5,boss:.5},
 prism:{tank:1.5,mech:1.5,boss:1.5,drone:.5,dog:.5},
 rocket:{tank:1.5,haz:1.5,dog:.5,drone:.5},
 rail:{tank:1.5,haz:1.5,boss:1.5,inf:.5,dog:.5,drone:.5},
 wave:{inf:1.5,dog:1.5,tank:.5,boss:.5}
};
const vs=(tw,en)=>(VS[tw]&&VS[tw][en])||1;
const ENEMIES=Object.keys(EN);
// Voor de uitleg in beeld: tegen welke vijanden een toren sterk of zwak is, en welke torens goed zijn tegen een vijand.
const strongVs=tw=>ENEMIES.filter(e=>vs(tw,e)>1),weakVs=tw=>ENEMIES.filter(e=>vs(tw,e)<1);
const counters=en=>Object.keys(VS).filter(tw=>vs(tw,en)>1);
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
 {id:'link',tree:'T',t:4,c:0,max:5,ic:'link',n:'Ultra-versterker',d:'De ultra-bonus is {v}% sterker',v:10},
 {id:'interest',tree:'T',t:4,c:1,max:5,ic:'coin',n:'Oorlogsobligaties',d:'{v}% rente op je credits na elke ronde (max 100)',v:1},
 {id:'turbo',tree:'T',t:4,c:2,max:5,ic:'bolt',n:'Turbo-injectie',d:'Turbo {v}% goedkoper',v:5},
 {id:'repair',tree:'T',t:4,c:3,max:2,ic:'plus',n:'Reparatieploeg',d:'+{v} leven na elke 10 rondes',v:1},
 {id:'boss',tree:'T',t:5,c:1,max:5,ic:'skull',n:'Bazenjager',d:'Torens doen +{v}% schade tegen bazen',v:6},
 {id:'overdrive',tree:'T',t:5,c:2,max:5,ic:'star',n:'Turbo-overdrive',d:'Turbo torens doen {v}% meer schade',v:7,req:'turbo'},
 {id:'war',tree:'T',t:6,c:1,max:1,ic:'trophy',n:'Totale oorlog',d:'Alle torens: +10% schade en +10% vuursnelheid',v:0,req:'boss'},
 {id:'hdmg',tree:'H',t:0,c:0,max:5,ic:'sword',n:'Wapentraining',d:'Je held doet +{v}% schade',v:4},
 {id:'hhp',tree:'H',t:0,c:1,max:5,ic:'heart',n:'Taai',d:'+{v}% levenspunten voor je held',v:5},
 {id:'hspd',tree:'H',t:0,c:2,max:5,ic:'boot',n:'Snelle voeten',d:'Je held loopt {v}% sneller',v:2},
 {id:'pushr',tree:'H',t:0,c:3,max:3,ic:'dodge',n:'Brede schouders',d:'Duwen duwt andere spelers {v}% verder weg',v:15},
 {id:'hrate',tree:'H',t:1,c:0,max:5,ic:'clock',n:'Vuurdiscipline',d:'Je held valt {v}% sneller aan',v:3},
 {id:'harm',tree:'H',t:1,c:1,max:5,ic:'shield',n:'Dikke huid',d:'Je held krijgt {v}% minder schade',v:3},
 {id:'sprint',tree:'H',t:1,c:2,max:3,ic:'boot',n:'Lange adem',d:'Sprint duurt {v} seconde langer',v:.5},
 {id:'hrange',tree:'H',t:1,c:3,max:3,ic:'cross',n:'Verrekijker',d:'+{v}% bereik voor je held',v:4},
 {id:'hap',tree:'H',t:2,c:0,max:3,ic:'bolt',n:'Pantserdoorn',d:'Aanvallen van je held negeren {v}% pantser',v:15},
 {id:'hregen',tree:'H',t:2,c:1,max:3,ic:'plus',n:'Tweede adem',d:'In missies en de arena herstelt je held {v}% levenspunten per seconde',v:.5},
 {id:'hgold',tree:'H',t:2,c:2,max:3,ic:'coin',n:'Premiejager',d:'Kills door je held leveren {v}% extra credits op',v:10},
 {id:'hboss',tree:'H',t:2,c:3,max:5,ic:'skull',n:'Bazenbreker',d:'Je held doet +{v}% schade tegen bazen en de Kolos',v:5},
 {id:'hcrit',tree:'H',t:3,c:0,max:5,ic:'blast',n:'Zwakke plek',d:'{v}% kans op een kritieke treffer met dubbele schade',v:4},
 {id:'hdodge',tree:'H',t:3,c:1,max:3,ic:'dodge',n:'Scherpe reflexen',d:'{v}% kans om een treffer te ontwijken',v:5},
 {id:'shdur',tree:'H',t:3,c:2,max:3,ic:'shield',n:'Schildgenerator',d:'Je schild op het parcours houdt {v} seconde langer stand',v:.5},
 {id:'hpvp',tree:'H',t:3,c:3,max:5,ic:'sword',n:'Arenavechter',d:'+{v}% schade tegen monsters en torens in minigames',v:4},
 {id:'hcritd',tree:'H',t:4,c:0,max:3,ic:'star',n:'Dodelijke precisie',d:'Kritieke treffers doen nog eens {v}% extra schade',v:25,req:'hcrit'},
 {id:'sprintcd',tree:'H',t:4,c:1,max:3,ic:'clock',n:'Snel op adem',d:'Sprint laadt {v} seconde sneller op',v:1},
 {id:'shcd',tree:'H',t:4,c:2,max:3,ic:'clock',n:'Snelle lader',d:'Je schild laadt {v} seconde sneller op',v:1,req:'shdur'},
 {id:'mission',tree:'H',t:4,c:3,max:3,ic:'up',n:'Missiepremie',d:'+{v} credits als je een missie of de arena wint',v:150},
 {id:'leech',tree:'H',t:5,c:0,max:3,ic:'drop',n:'Bloeddorst',d:'Zolang je held aanvalt herstelt hij {v}% levenspunten per seconde',v:1},
 {id:'second',tree:'H',t:5,c:1,max:1,ic:'heart',n:'Tweede kans',d:'Eén keer per missie staat je held na een dodelijke klap weer op met 30% levenspunten. Werkt niet tegen de ultra-aanval van de Kolos.',v:0},
 {id:'pushcd',tree:'H',t:5,c:2,max:2,ic:'clock',n:'Elleboogwerk',d:'Duwen laadt {v} seconde sneller op',v:1},
 {id:'sprintspd',tree:'H',t:5,c:3,max:3,ic:'bolt',n:'Naverbrander',d:'Sprint geeft nog eens {v}% extra snelheid',v:10},
 {id:'legend',tree:'H',t:6,c:1,max:1,ic:'trophy',n:'Legende',d:'Je held: +15% schade, +15% levenspunten en +10% snelheid',v:0,req:'second'}
];
// Duwen en sprinten in minigames. Skills schuiven deze waarden op (zie mods: pushDist, pushCd, sprDur, sprCd, sprSpd).
const MOVES={pushCd:6,pushRange:2.4,pushDist:1.6,sprDur:3,sprCd:10,sprSpd:.6};
const SKILL_MAX=SKILLS.reduce((a,s)=>a+s.max,0),TIER=5;
function mods(sk){sk=sk&&!Array.isArray(sk)?sk:{};const r=id=>sk[id]|0,war=r('war')?1.1:1,lg=r('legend');return{
  gold:1+.04*r('bounty'),up:1-.05*r('engineer'),start:50*r('chest'),build:1-.025*r('bulk'),lives:2*r('fort'),
  dmg:(1+.03*r('dmg'))*war,rate:(1+.025*r('rate'))*war,range:1+.02*r('range'),freeze:1+.12*r('freeze'),tox:1+.14*r('toxin'),toxSlow:.035*r('toxin'),
  interest:.01*r('interest'),bonus:1+.1*r('bonus'),sell:.7+.1*r('salvage'),link:1+.1*r('link'),turbo:1-.05*r('turbo'),overdrive:1+.07*r('overdrive'),
  ap:.1*r('ap'),splash:1+.05*r('splash'),repair:r('repair'),boss:1+.06*r('boss'),
  hDmg:(1+.04*r('hdmg'))*(lg?1.15:1),hHp:(1+.05*r('hhp'))*(lg?1.15:1),hSpd:(1+.02*r('hspd'))*(lg?1.1:1),hRate:1+.03*r('hrate'),hArm:.03*r('harm'),
  hRange:1+.04*r('hrange'),hAp:.15*r('hap'),hRegen:.005*r('hregen'),hGold:.1*r('hgold'),hBoss:1+.05*r('hboss'),hCrit:.04*r('hcrit'),hCritDmg:.25*r('hcritd'),
  hDodge:.05*r('hdodge'),shDur:.5*r('shdur'),shCd:r('shcd'),hMini:1+.04*r('hpvp'),mission:150*r('mission'),leech:.01*r('leech'),second:r('second')>0,
  pushDist:1+.15*r('pushr'),pushCd:r('pushcd'),sprDur:.5*r('sprint'),sprCd:r('sprintcd'),sprSpd:.1*r('sprintspd')};}
const skillTotal=sk=>SKILLS.reduce((a,s)=>a+(sk[s.id]|0),0);
const skillSpent=(sk,tree)=>SKILLS.reduce((a,s)=>a+(s.tree===tree?(sk[s.id]|0):0),0);
// lock: 'tier' = te weinig punten in deze boom, 'req' = het talent erboven is nog niet vol
function skillState(sk,s){const rank=sk[s.id]|0,q=s.req&&SKILLS.find(x=>x.id===s.req);
  return{rank,lock:skillSpent(sk,s.tree)<TIER*s.t?'tier':q&&(sk[q.id]|0)<q.max?'req':null,q};}
// Skillpunten voor het halen van ronde r: 1 per 20 levels, 1 per miniboss (elke tiende ronde) en 3 zodra je daarmee level 100 bereikt.
const pointsFor=r=>(r%20===0?1:0)+(r%10===0?1:0)+(r===99?3:0);
const hpMul=r=>B.hpX*B.hp0*(1+B.lin*r)*Math.pow(B.g,r)*(r>B.late?Math.pow(B.g2,r-B.late):1)*tough(r);

function create(skills,diff,mapId){const m=mods(skills),di=diffIdx(diff),mp=mapOf(mapId);
  const G={m,mp,diff:di,D:DIFF[di],gold:B.startGold+m.start,lives:B.lives+m.lives,round:1,cleared:0,phase:'prep',timer:PREP,wt:0,q:[],road:new Set(),trail:new Set(),path:null,rv:0,pv:null,pvk:-1,
    tw:[],map:{},en:[],fx:[],ev:[],fxOn:false,score:0,kills:0,time:0,nid:1,pass:null};
  if(mp.loop){const r=route(G.road,()=>false,mp);G.path=mkPath(r.cells,false,mp);G.trail=new Set(r.cells);} // de ring ligt er vanaf het begin
  return G;}

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
// Wat er in ronde r aankomt: per soort het aantal en het aandeel in de totale levenspunten van de golf.
function waveMix(r){const m={};let tot=0;for(const s of makeWave(r)){const o=m[s.type]||(m[s.type]={type:s.type,n:0,hp:0}),h=EN[s.type].hp*s.hm;o.n++;o.hp+=h;tot+=h;}
  return Object.values(m).map(o=>({type:o.type,n:o.n,share:o.hp/tot}));}
// Hoe goed een toren bij ronde r past: het gemiddelde matchup-getal, gewogen naar levenspunten. Boven 1 is een goede keuze, onder 1 een slechte.
function waveFit(tw,r){let f=0;for(const o of waveMix(r))f+=o.share*vs(tw,o.type);return f;}
function startWave(G){if(G.phase!=='build')return;G.phase='wave';G.wt=0;G.q=makeWave(G.round);G.ev.push({k:'wave',r:G.round});}
function spawn(G,s){const d=EN[s.type],r=G.round,hp=d.hp*hpMul(r)*s.hm*G.D.hp,p=posAt(G.path,0);
  G.en.push({id:G.nid++,type:s.type,hp,max:hp,d:0,sp:d.sp*G.D.sp,arm:d.arm||0,regen:d.regen||0,immune:!!d.immune,boss:!!d.boss,
    big:s.hm>1,leak:d.leak||1,b:Math.max(1,Math.round(B.gold0*B.goldX*d.b*s.hm*(1+B.goldLin*r)*G.m.gold)),sc:Math.round(d.b*s.hm*r*5*G.D.score),
    x:p[0],y:p[1],dx:p[2],dy:p[3],fz:0,fi:0,sT:0,sl:0,pT:0,pD:0});}
// Een vijand die uit een andere vesting doorloopt (pass-maps): hij komt bij jou binnen met hetzelfde deel van zijn levens dat hij nog had.
function inject(G,type,frac){if(!G.path||!EN[type]||G.phase==='over'||G.phase==='won')return null;spawn(G,{type,hm:1});const e=G.en[G.en.length-1];
  e.hp=Math.max(1,e.max*Math.max(.05,Math.min(1,+frac||1)));e.passed=true;return e;}
function kill(G,e){if(e.dead)return;e.dead=true;G.gold+=e.b;G.score+=e.sc;G.kills++;if(G.fxOn)G.fx.push({k:'die',b:[e.x,e.y],boss:e.boss});}
function hit(G,e,dmg,pierce,src){if(e.dead)return;const arm=e.arm*(1-G.m.ap)*(1-(pierce||0));
  e.hp-=dmg*(1-arm)*(e.boss?G.m.boss:1)*(src?vs(src,e.type):1);if(e.hp<=0)kill(G,e);}
function aoe(G,x,y,r,fn){const r2=r*r;for(const e of G.en){if(e.dead)continue;const dx=e.x-x,dy=e.y-y;if(dx*dx+dy*dy<=r2)fn(e);}}

// De keten: 5 upgrades -> ultra -> turbo. Een turbo is ook nog steeds een ultra, dus de bonussen stapelen.
const maxLvl=t=>{const m=T[t.type].max;return m==null?5:m;};
const hasTiers=type=>TYPES.includes(type);
const tierOf=t=>t.spec==='turbo'?2:t.spec==='ultra'?1:0;
function stats(G,t){const b=T[t.type],m=G.m,au=1+(t.aura||0),tier=tierOf(t),ul=(tier?1+.6*m.link:1)*(t.spec==='awake'?WAKE.mul:1),tb=tier===2;
  if(t.type==='uplink')return{dmg:0,rate:0,range:(1.6+.15*t.lvl)*m.range*(tier?1.15:1),aura:(.18+.04*t.lvl)*(tier?1+.3*m.link:1)*(tb?1.5:1)};
  const up=Math.pow(b.up||1.4,t.lvl);
  return{dmg:b.dmg*up*m.dmg*au*ul*(tb?1.3*m.overdrive:1),rate:b.rate*(1+.05*t.lvl)*m.rate*(tier?1.15:1)*(tb?1.8:1),
    range:b.range*(1+(b.rl||.04)*t.lvl)*m.range*(tier?1.1:1)*(t.spec==='awake'?WAKE.mul:1),
    fz:b.fz?b.fz*(1+.12*t.lvl)*m.freeze:0,pd:b.pd?b.pd*up*m.tox*au*ul:0,slow:b.slow?Math.min(t.type==='sleeper'?.8:.6,b.slow+m.toxSlow+.02*t.lvl):0};}
function recalc(G){
  for(const t of G.tw)t.aura=0;
  for(const u of G.tw){if(u.type!=='uplink')continue;u.s=stats(G,u);
    for(const t of G.tw){if(t.type==='uplink')continue;const dx=t.x-u.x,dy=t.y-u.y;
      if(dx*dx+dy*dy<=u.s.range*u.s.range&&u.s.aura>t.aura)t.aura=u.s.aura;}}
  for(const t of G.tw)t.s=stats(G,t);}
// Wat er vrijgespeeld is. Turbo: er moet nog een andere toren staan die ultra (of al turbo) is.
// Geers Toren: van elk van de tien torensoorten staat er een turbo. De Slapende Geers: vier Geers Torens, en er kan er maar een staan.
const canTurbo=(G,t)=>t.spec==='ultra'&&G.tw.some(o=>o!==t&&!!o.spec);
const missingTurbo=G=>TYPES.filter(k=>!G.tw.some(t=>t.type===k&&t.spec==='turbo'));
const geersReady=G=>!missingTurbo(G).length;
const geersCount=G=>G.tw.reduce((n,t)=>n+(t.type==='geers'?1:0),0);
const sleeperReady=G=>geersCount(G)>=GEERS_NEED&&!G.tw.some(t=>t.type==='sleeper');
const unlocked=(G,type)=>type==='geers'?geersReady(G):type==='sleeper'?sleeperReady(G):true;
// De vakken die een toren beslaat als hij op vak c staat (c is het midden). null = past niet binnen het veld.
function cellsOf(c,type){const sz=(T[type]&&T[type].size)||1;if(sz===1)return[c];const x=c%N,y=(c-x)/N,h=(sz-1)/2,a=[];
  if(x-h<0||y-h<0||x+h>=N||y+h>=N)return null;
  for(let dy=-h;dy<=h;dy++)for(let dx=-h;dx<=h;dx++)a.push((y+dy)*N+x+dx);return a;}
function canBuild(G,c,type){if(!(c>=0&&c<N*N))return false;const cs=cellsOf(c,type);if(!cs)return false;
  const M=G.mp;for(const k of cs)if(ROCK.has(k)||G.map[k]||k===M.in||k===M.out)return false;
  if(M.loop)return cs.every(k=>!G.path.set.has(k)); // de ring ligt vast
  // Doolhof: overal bouwen, behalve onder een vijand, zolang er een weg van de ingang naar de uitgang overblijft.
  if(M.maze){for(const e of G.en){if(e.dead)continue;for(const k of cs){const x=k%N,y=(k-x)/N;if(Math.abs(e.x-x-.5)<.95&&Math.abs(e.y-y-.5)<.95)return false;}}
    const bl=new Set(cs);return!!search(k=>!bl.has(k)&&!ROCK.has(k)&&!G.map[k],M);}
  if(G.path)return cs.every(k=>!G.path.set.has(k));if(cs.some(k=>G.road.has(k)))return false;
  const bl=new Set(cs);return!!search(k=>!bl.has(k)&&!ROCK.has(k)&&!G.map[k],M);} // een toren mag de doorgang nooit helemaal afsluiten
const buildCost=(G,type)=>Math.round(T[type].cost*G.m.build);
const upCost=(G,t)=>{const u=T[t.type].uc||[.5,.25];return Math.round(T[t.type].cost*(u[0]+u[1]*t.lvl)*G.m.up);};
const specCost=(G,t,k)=>Math.round(T[t.type].cost*(k==='turbo'?3*G.m.turbo:2));
const sellValue=(G,t)=>Math.round(t.spent*G.m.sell);
function build(G,c,type){if(!T[type]||!unlocked(G,type)||!canBuild(G,c,type))return null;const cost=buildCost(G,type);if(G.gold<cost)return null;
  G.gold-=cost;const x=c%N,cells=cellsOf(c,type),t={id:G.nid++,c,cells,size:T[type].size||1,x:x+.5,y:(c-x)/N+.5,type,lvl:0,spec:null,cd:0,ang:.8,ramp:1,tg:0,spent:cost,aura:0};
  G.tw.push(t);for(const k of cells)G.map[k]=t;G.rv++;recalc(G);repath(G);return t;}
function upgrade(G,t){if(t.lvl>=maxLvl(t))return false;const c=upCost(G,t);if(G.gold<c)return false;
  G.gold-=c;t.spent+=c;t.lvl++;recalc(G);return true;}
function remove(G,t){G.tw.splice(G.tw.indexOf(t),1);for(const k of t.cells||[t.c])delete G.map[k];G.rv++;repath(G);}
function sell(G,t){G.gold+=sellValue(G,t);remove(G,t);recalc(G);}
// De wekknop van De Slapende Geers. spec: null = slaapt, 'awake' = wakker, 'spent' = is al een keer wakker geweest.
const canWake=t=>t.type==='sleeper'&&!t.spec;
function poke(G,t){if(!canWake(t))return false;t.pokes=(t.pokes||0)+1;
  if(t.pokes>=WAKE.pokes){t.spec='awake';t.awakeT=WAKE.time;t.cd=0;G.rv++;recalc(G);G.ev.push({k:'wake',on:true});}return true;}
// k = 'ultra' (na 5 upgrades) of 'turbo' (vanuit ultra, als er nog een andere ultra toren staat)
function spec(G,t,k){if(!hasTiers(t.type)||t.lvl<5)return false;
  if(k==='ultra'){if(t.spec)return false;}else if(k==='turbo'){if(!canTurbo(G,t))return false;}else return false;
  const c=specCost(G,t,k);if(G.gold<c)return false;
  G.gold-=c;t.spent+=c;t.spec=k;
  recalc(G);return true;}

function fire(G,t,e,s){const m=G.m,fx=G.fxOn?G.fx:null,a=[t.x,t.y],b=[e.x,e.y];
  switch(t.type){
    case'sentry':hit(G,e,s.dmg,0,'sentry');fx&&fx.push({k:'shot',a,b});break;
    case'rail':hit(G,e,s.dmg,1,'rail');fx&&fx.push({k:'rail',a,b});break;
    case'flak':case'rocket':{const r=T[t.type].splash*m.splash;aoe(G,e.x,e.y,r,x=>hit(G,x,s.dmg,0,t.type));fx&&fx.push({k:t.type==='rocket'?'rocket':'boom',a,b,r});break;}
    case'cryo':{const r=T.cryo.splash*m.splash;aoe(G,e.x,e.y,r,x=>{hit(G,x,s.dmg,0,'cryo');
      if(!x.dead&&!x.immune&&x.fi<=0){const d=s.fz*(x.boss?.4:vs('cryo',x.type));x.fz=d;x.fi=d+2.2;}});fx&&fx.push({k:'ice',a,b,r});break;}
    case'toxin':{const r=T.toxin.splash*m.splash;aoe(G,e.x,e.y,r,x=>{hit(G,x,s.dmg,0,'toxin');if(x.dead)return;
      const pd=s.pd*vs('toxin',x.type);x.pD=x.pT>0?Math.max(x.pD,pd):pd;x.pT=4;if(!x.immune){const sl=s.slow*(x.boss?.5:1);x.sl=x.sT>0?Math.max(x.sl,sl):sl;x.sT=4;}});
      fx&&fx.push({k:'tox',a,b,r});break;}
    case'tesla':{const pts=[a,b],done=new Set([e.id]);let cur=e,d=s.dmg;hit(G,e,d,.5,'tesla');
      for(let i=1;i<T.tesla.chain;i++){let nx=null,bd=3.3;for(const o of G.en){if(o.dead||done.has(o.id))continue;
          const dx=o.x-cur.x,dy=o.y-cur.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;nx=o;}}
        if(!nx)break;d*=.7;done.add(nx.id);pts.push([nx.x,nx.y]);hit(G,nx,d,.5,'tesla');cur=nx;}
      fx&&fx.push({k:'bolt',pts});break;}
    case'prism':if(t.tg!==e.id){t.tg=e.id;t.ramp=1;}hit(G,e,s.dmg*t.ramp,0,'prism');t.ramp=Math.min(2.5,t.ramp+.5/s.rate);fx&&fx.push({k:'beam',a,b});break;
    case'wave':{const L=Math.hypot(e.x-t.x,e.y-t.y)||1,ux=(e.x-t.x)/L,uy=(e.y-t.y)/L,w=.5*m.splash;
      for(const o of G.en){if(o.dead)continue;const px=o.x-t.x,py=o.y-t.y,pr=px*ux+py*uy;if(pr<0||pr>s.range)continue;
        if(Math.abs(px*uy-py*ux)<=w)hit(G,o,s.dmg,.3,'wave');}
      fx&&fx.push({k:'wave',a,b:[t.x+ux*s.range,t.y+uy*s.range]});break;}
    case'geers':{const r=T.geers.splash*m.splash;aoe(G,e.x,e.y,r,x=>hit(G,x,s.dmg,.5,'geers'));fx&&fx.push({k:'geers',a,b,r});break;}
    // De Slapende Geers snurkt: alles binnen bereik krijgt schade en wordt vertraagd. Niemand is er immuun voor; bazen merken het half.
    case'sleeper':aoe(G,t.x,t.y,s.range,x=>{hit(G,x,s.dmg,.5,'sleeper');if(x.dead)return;const sl=s.slow*(x.boss?.5:1);x.sl=x.sT>0?Math.max(x.sl,sl):sl;x.sT=Math.max(x.sT,1.6);});
      fx&&fx.push({k:t.spec==='awake'?'roar':'snore',a,b:a,r:Math.min(s.range,t.spec==='awake'?9:s.range)});break;
  }}
function step(G,dt){
  if(G.phase==='over'||G.phase==='won'||G.phase==='prep')return;
  G.time+=dt;
  if(G.phase==='build'){G.timer-=dt;if(G.timer<=0)startWave(G);}
  if(G.phase==='wave'){G.wt+=dt;while(G.q.length&&G.q[G.q.length-1].t<=G.wt)spawn(G,G.q.pop());}
  for(const e of G.en){if(e.dead)continue;
    if(e.fi>0)e.fi-=dt;
    if(e.pT>0){e.pT-=dt;e.hp-=e.pD*dt;if(e.hp<=0){kill(G,e);continue;}}
    else if(e.regen&&e.hp<e.max&&e.fz<=0)e.hp=Math.min(e.max,e.hp+e.max*e.regen*dt);
    let sp=e.sp;
    if(e.fz>0){e.fz-=dt;sp=0;}else if(e.sT>0){e.sT-=dt;sp*=1-e.sl;}
    e.d+=sp*dt;
    if(e.d>=G.path.len){
      // ringmap: een rondje erop zit, het kost levens en hij loopt gewoon door
      if(G.path.loopFrom!=null){e.d=G.path.loopFrom+(e.d-G.path.len);G.lives-=e.leak;G.ev.push({k:'leak',n:e.leak,lap:true});}
      // pass-map: de spellaag stuurt hem door naar de volgende vesting; is er geen, dan kost hij levens zoals altijd
      else{e.dead=true;if(G.pass&&G.pass(G,e))G.ev.push({k:'pass',n:e.leak});else{G.lives-=e.leak;G.ev.push({k:'leak',n:e.leak});}continue;}}
    const p=posAt(G.path,e.d);e.x=p[0];e.y=p[1];e.dx=p[2];e.dy=p[3];}
  for(const t of G.tw)if(t.spec==='awake'){t.awakeT-=dt;if(t.awakeT<=0){t.awakeT=0;t.spec='spent';G.rv++;t.s=stats(G,t);G.ev.push({k:'wake',on:false});}}
  for(const t of G.tw){if(t.type==='uplink')continue;
    t.cd-=dt;if(t.cd>0)continue;
    const s=t.s,r2=s.range*s.range,mr=T[t.type].minr||0,m2=mr*mr;
    let best=null,bv=-1;
    for(const e of G.en){if(e.dead)continue;const dx=e.x-t.x,dy=e.y-t.y,d2=dx*dx+dy*dy;if(d2>r2||d2<m2)continue;
      let v=t.type==='rail'?e.hp:e.d;
      if(t.type==='cryo'&&!e.immune&&e.fi<=0)v+=1000;else if(t.type==='toxin'&&e.pT<=.5)v+=1000;
      if(v>bv){bv=v;best=e;}}
    if(!best){t.cd=0;t.ramp=1;continue;}
    t.cd=Math.max(t.cd,-dt)+1/s.rate;t.ang=Math.atan2(best.y-t.y,best.x-t.x);
    fire(G,t,best,s);}
  let w=0;for(let i=0;i<G.en.length;i++)if(!G.en[i].dead)G.en[w++]=G.en[i];G.en.length=w;
  if(G.lives<=0&&!G.mp.pool){G.lives=0;G.phase='over';return;} // bij een gedeelde levenspot beslist de spellaag
  if(G.phase==='wave'&&!G.q.length&&!G.en.length){const r=G.round,bonus=Math.round((B.bonA+B.bonB*r)*G.m.bonus),
      int=Math.min(100,Math.floor(G.gold*G.m.interest));
    G.gold+=bonus+int;G.score+=Math.round(50*r*G.D.score);G.cleared=r;if(r%10===0)G.lives+=G.m.repair;
    G.ev.push({k:'clear',r,bonus:bonus+int});
    // Na de laatste golf wacht nog het eindmonster: de spellaag beslist daarna over winst of verlies.
    if(r>=ROUNDS){G.final=true;G.phase='wait';}else{G.round++;G.phase='wait';}}
}
function win(G){if(G.phase==='won'||G.phase==='over')return;G.phase='won';G.score+=Math.round((5000+200*G.lives)*G.D.score);}
function lose(G){if(G.phase==='won'||G.phase==='over')return;G.phase='over';}
// Instellingen van de server (webadmin) overnemen. Geldt voor potjes die hierna beginnen.
function tune(s){if(!s||typeof s!=='object')return;const n=(v,lo,hi,d)=>{v=+v;return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):d;};
  B.startGold=Math.round(n(s.startGold,0,100000,B.startGold));B.lives=Math.round(n(s.lives,1,999,B.lives));
  B.hpX=n(s.enemyHp,.25,5,B.hpX);B.goldX=n(s.goldMul,.25,5,B.goldX);PREP=API.PREP=Math.round(n(s.prepSeconds,10,1800,PREP));}
const API={MAPS,MAP_IDS,mapOf,RING,edgePt,repath,inject,nearD,WAKE,canWake,poke,MOVES,N,ROUNDS,MID,C_IN,C_OUT,PREP,DIRS,tune,B,DIFF,diffIdx,T,TYPES,ALL,GEERS_NEED,maxLvl,hasTiers,tierOf,canTurbo,missingTurbo,geersReady,geersCount,sleeperReady,unlocked,cellsOf,EN,SKILLS,ROCK,posAt,mkPath,route,preview,canRoad,setRoad,lock,next,create,step,startWave,build,upgrade,sell,spec,canBuild,
  buildCost,upCost,specCost,sellValue,stats,mods,skillTotal,skillSpent,skillState,SKILL_MAX,TIER,pointsFor,hpMul,makeWave,hit,recalc,win,lose,VS,vs,strongVs,weakVs,counters,waveMix,waveFit};
return API;
})();

// Dezelfde spelregels draaien op de server (controle van opgeslagen voortgang).
if(typeof module!=="undefined"&&module.exports)module.exports=Engine;
