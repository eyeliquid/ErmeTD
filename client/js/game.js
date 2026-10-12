(()=>{
const E=Engine,{N,T,TYPES,ALL,EN,SKILLS,ROUNDS}=E,T3=window.THREE;
const $=s=>document.querySelector(s);
const fmt=n=>Math.round(n).toLocaleString('nl-NL');
const STEP=1/30,FW=20,COLS=5,ROWS=5,SLOTS=COLS*ROWS;
let save={v:2,pts:0,earned:0,skills:{},games:0,best:0,hero:0,diff:0,at:0};
// gamePts: punten verdiend in dit potje. toastAdd wordt achter de eerstvolgende melding geplakt.
let gamePts=0,toastAdd='';
// HM: de talentbonussen die nu gelden. In een potje is dit G.m, dus wat je tijdens een potje leert telt pas het volgende potje.
let HM=E.mods({});
let G=null,speed=1,buildSel=null,sel=null,hover=-1,myState='lobby',ended=false,mySlot=0;
// potje: iedereen die samen startte deelt matchId; built = klaar met bouwen, nx = klaar voor ronde nx, sentWave = golf vroeg gestuurd
let matchId=0,built=false,prepEnd=0,t0=0,nx=0,sentWave=0,arenaFor=0,roadMode=false,paintLast=-1,myT=0;
// own: dit tabblad. isMe geldt ook voor je andere tabbladen, en die tellen als aparte spelers.
const own=p=>!!p&&(p.sameTab===undefined?!!p.isMe:!!p.sameTab);
// missies: schild voor het parcours, en mijn schade aan de baas (blijft meetellen nadat ik ben uitgeschakeld)
let sprintT=0,sprintCd=0,pushCd=0,pushOut=null,shieldT=0,shieldCd=0,myBm=0,myBh=0,msLast=null,finalMax=0,finalAt=0;
// Parcours: een strook naast de arena met dwarsmuren. Elke muur heeft een opening, om en om onder (1) en boven (0).
const RUN={x:60,z:ROWS*FW+6,L:38,W:10,gap:3,walls:[[5,1],[9,0],[13,1],[17,0],[21,1],[25,0],[29,1],[33,0]]};
const runGap=sd=>sd?[RUN.W-RUN.gap,RUN.W]:[0,RUN.gap];
function runFree(lx,lz){if(lx<0||lz<0||lx>RUN.L||lz>RUN.W)return false;for(const[wx,sd]of RUN.walls)if(Math.abs(lx-wx)<.45){const g=runGap(sd);if(lz<g[0]+.25||lz>g[1]-.25)return false;}return true;}
// vrij zicht tussen twee punten op het parcours: elke muur ertussen moet bij zijn opening gekruist worden
function runLos(ax,az,cx,cz){for(const[wx,sd]of RUN.walls){if((ax-wx)*(cx-wx)>=0)continue;const z=az+(cz-az)*(wx-ax)/(cx-ax),g=runGap(sd);if(z<g[0]||z>g[1])return false;}return true;}
let hero={x:0,z:0,a:0,hp:100,cd:0,atk:0,walk:0,tx:null,tz:null,moving:false},orders=[];
// lab: een losse minigame uitproberen vanuit de lobby, buiten een potje om
let lab=null;
let camMode='hero',arena=null,arSeq=0,armour=0,myPeer=null,akCount=0,heroObj=null,heroSig='';
const hcam={yaw:0,pitch:.5,d:9},joy={x:0,y:0},rheroes=new Map();
const HEROES=[
 {id:'commando',n:'Commando',role:'Afstand · twee pistolen',d:'Snelle schoten op middellange afstand.',hp:100,spd:5.2,range:4.5,dmg:7,rate:4,k:'gun'},
 {id:'shinobi',n:'Shinobi',role:'Melee · katana',d:'Razendsnel van dichtbij, maar kwetsbaar.',hp:90,spd:6.4,range:1.5,dmg:16,rate:3,k:'blade'},
 {id:'tesla',n:'Tesla-trooper',role:'Middellang · bliksem',d:'Bliksem springt over naar twee extra doelen.',hp:130,spd:4.4,range:3.2,dmg:30,rate:1.1,k:'bolt'},
 {id:'moker',n:'Moker',role:'Melee · oorlogshamer',d:'Trage klap die alles rondom raakt. Veel levenspunten.',hp:190,spd:4.2,range:1.8,dmg:55,rate:.8,k:'slam'},
 {id:'sniper',n:'Scherpschutter',role:'Lange afstand · geweer',d:'Eén zwaar schot van heel ver, dwars door pantser.',hp:80,spd:4.8,range:8,dmg:70,rate:.5,k:'snipe'},
 {id:'vlam',n:'Vlammenwerper',role:'Kort · vuurkegel',d:'Vuurstraal die alles in een kegel voor je raakt.',hp:140,spd:4.6,range:2.8,dmg:6,rate:6,k:'flame'}];
const ARMOUR=[{n:'Helm van de kampioen',d:'Turrets doen 10% meer schade.'},{n:'Borstplaat',d:'+5 levens en je held krijgt 40% meer levenspunten.'},
 {n:'Handschoenen',d:'Je held doet 30% meer schade en turrets vuren 8% sneller.'},{n:'Laarzen',d:'Je held loopt 20% sneller en kills leveren 10% meer credits op.'}];
const maxHp=()=>HEROES[save.hero].hp*HM.hHp*(armour>=2?1.4:1);
// schade aan je held: eerst ontwijken (Scherpe reflexen), dan Dikke huid. Op een hogere moeilijkheidsgraad komt elke klap harder aan.
function hurt(d){if(HM.hDodge&&Math.random()<HM.hDodge)return;hero.hp-=d*(1-HM.hArm)*(G?G.D.hurt:1);}
const mulText=v=>'×'+String(v).replace('.',',');
function revive(){if(!HM.second||!arena||arena.sc)return false;arena.sc=true;hero.hp=maxHp()*.3;toast('Tweede kans: je held staat weer op');return true;}
const keys={};
let room=null,uid=null,peers=[],board=null,connAt=0,ready=false,boardFail=false;
const seenGo=new Set(),rx=new Map();
function lcg(seed){let s=seed;return()=>(s=(s*16807)%2147483647)/2147483647;}

/* ---------- opslag ---------- */
function clean(d){if(!d||typeof d!=='object')return null;const sk={},v2=d.v===2;let pts=Math.max(0,+d.pts||0),earned=Math.max(0,+d.earned||0);
  // Oude opslag werkte met XP: 500 XP wordt 1 skillpunt. Nog oudere opslag had losse skills in een lijst; die tellen eerst mee als XP.
  if(!v2){let xp=Math.max(0,+d.xp||0);if(Array.isArray(d.skills)){const n=Math.min(20,new Set(d.skills.filter(x=>typeof x==='string')).size);for(let i=0;i<n;i++)xp+=500+550*i;}
    pts=Math.floor(xp/500);earned=Math.floor(earned/500);}
  if(d.skills&&typeof d.skills==='object'&&!Array.isArray(d.skills))for(const s of SKILLS){const r=Math.min(s.max,Math.max(0,(d.skills[s.id]||(s.id==='overdrive'&&d.skills.geers))|0));if(r)sk[s.id]=r;}
  return{v:2,pts:Math.min(E.SKILL_MAX,Math.floor(pts)),earned:Math.floor(earned),games:Math.max(0,+d.games||0),best:Math.max(0,+d.best||0),skills:sk,hero:Math.max(0,Math.min(5,d.hero|0)),diff:E.diffIdx(d.diff),at:Math.max(0,+d.at||0)};}
function award(n){if(!(n>0)||lab)return;save.pts+=n;save.earned+=n;gamePts+=n;persist();toastAdd=` · +${n} skillpunt${n>1?'en':''}`;}
const blank=()=>({v:2,pts:0,earned:0,skills:{},games:0,best:0,hero:0,diff:0,at:0});
const putLocal=()=>{try{localStorage.setItem('ratd-save',JSON.stringify(save));}catch{}};
function loadLocal(){try{const d=clean(JSON.parse(localStorage.getItem('ratd-save')));if(d)save=d;}catch{}}
// Voortgang staat altijd in de browser. Wie is ingelogd bewaart hem ook op de server; een gast speelt lokaal
// en overschrijft dus nooit accountvoortgang. Meerdere wijzigingen kort na elkaar gaan als één verzoek de deur uit.
let saveBusy=false,saveAgain=false;
function pushSave(){if(!acct||!Net.hasToken())return;if(saveBusy){saveAgain=true;return;}saveBusy=true;
  Net.api('PUT','/save',{save:{...save,skills:{...save.skills}}}).then(r=>{setCloud(true);if(r.kept){cloudSave=clean(r.save);if(adopt())refreshUI();}},authFail)
    .then(()=>{saveBusy=false;if(saveAgain){saveAgain=false;pushSave();}});}
function persist(){save.at=Date.now();putLocal();pushSave();}
const newer=d=>!!d&&(d.earned>save.earned||(d.earned===save.earned&&d.at>save.at));
function adopt(){if(newer(cloudSave)){save={...cloudSave,skills:{...cloudSave.skills}};putLocal();return true;}return false;}


/* ---------- account ---------- */
// Een account is een roepnaam met een wachtwoord en staat op de server. Na inloggen bewaart de browser een sessietoken,
// zodat je de volgende keer meteen verder kunt. cloud = de server heeft deze sessie bevestigd.
let acct=null,guest=false,cloudSave=null,gateMode='new',gateBusy=false;
function cleanName(v){const n=String(v==null?'':v).replace(/\s+/g,' ').trim();return /^[\p{L}\p{N}][\p{L}\p{N} _-]{2,15}$/u.test(n)?n:null;}
function loadAcct(){if(!Net.hasToken())return;try{const a=JSON.parse(localStorage.getItem('ratd-acct')),n=a&&cleanName(a.name);if(n&&typeof a.id==='string'){acct={id:a.id,name:n,cloud:false};uid=a.id;}}catch{}}
function storeAcct(){try{if(acct)localStorage.setItem('ratd-acct',JSON.stringify({id:acct.id,name:acct.name}));else localStorage.removeItem('ratd-acct');}catch{}}
function setCloud(on){if(acct&&acct.cloud!==on){acct.cloud=on;renderAcct();}}
// Antwoord van registreren, inloggen of /me: de server zegt wie je bent en wat er voor je is opgeslagen.
function signedIn(r){acct={id:r.user.id,name:r.user.name,cloud:true};uid=acct.id;guest=false;storeAcct();cloudSave=r.save?clean(r.save):null;if(!adopt())pushSave();refreshUI();}
function signedOut(){Net.setToken(null);acct=null;uid=null;cloudSave=null;storeAcct();if(room)room.reauth();}
// Een verzoek mislukte. Is de sessie verlopen, dan terug naar het inlogscherm; is de server weg, dan speel je door op dit apparaat.
function authFail(err){if(err&&err.status===401){const had=!!acct;signedOut();if(had&&!G){showGate('login');setText($('#gErr'),'Je sessie is verlopen. Log opnieuw in.');}}else setCloud(false);}
function showGate(mode){closePops();gateMode=mode||'new';$('#home').hidden=true;$('#gate').hidden=false;setText($('#gErr'),'');
  $('#gName').value=gateMode==='rename'&&acct?acct.name:'';$('#gPass').value='';renderGate();try{$('#gName').focus({preventScroll:true});}catch{}}
function showHome(){$('#gate').hidden=true;$('#home').hidden=false;renderHome();renderLobby();}
function refreshUI(){renderHome();if(!$('#gate').hidden)renderGate();}
function renderGate(){const ren=gateMode==='rename',login=gateMode==='login';
  setText($('#gTitle'),ren?'Roepnaam wijzigen':login?'Inloggen':'Account maken');
  setText($('#gLead'),ren?'Kies een nieuwe roepnaam. Je voortgang blijft staan.':login?'Log in met je roepnaam en wachtwoord. Je voortgang staat klaar.'
    :save.earned>0?'Kies een roepnaam en een wachtwoord. De voortgang op dit apparaat gaat mee naar je account.':'Kies een roepnaam en een wachtwoord. Vanaf dan bewaart het spel je skillpunten, skills en held.');
  $('#gPassField').hidden=ren;$('#gPass').autocomplete=login?'current-password':'new-password';$('#gPass').placeholder=login?'Je wachtwoord':'Minstens 8 tekens';
  $('#gStats').hidden=ren||login||!(save.earned>0||save.games>0);
  setText($('#gXp'),fmt(save.pts));setText($('#gSk'),E.skillTotal(save.skills)+' / '+E.SKILL_MAX);setText($('#gGm'),String(save.games));
  const go=$('#gGo');setText(go,gateBusy?'Even geduld…':ren?'Roepnaam opslaan':login?'Log in':'Maak account');go.disabled=gateBusy;
  setText($('#gGuest'),ren?'Annuleren':'Speel als gast');
  const sw=$('#gSwitch');sw.hidden=ren;setText(sw,login?'Nieuw account maken':'Ik heb al een account');
  setText($('#gNote'),ren?'':'Je account werkt op elk apparaat: log in met dezelfde roepnaam en hetzelfde wachtwoord. Een vergeten wachtwoord kan niet worden hersteld, dus bewaar het goed.');}
function renderAcct(){
  setText($('#aName'),acct?acct.name:'Gast');$('#aDot').classList.toggle('on',!!(acct&&acct.cloud));
  setText($('#aState'),acct?(acct.cloud?'Ingelogd · voortgang opgeslagen':'Ingelogd · server niet bereikbaar'):'Niet ingelogd');
  setText($('#aEdit'),acct?'Roepnaam wijzigen':'Account maken');$('#aLogin').hidden=!!acct;$('#aOut').hidden=!acct;}
function bindAccount(){
  const busy=on=>{gateBusy=on;renderGate();},fail=err=>{busy(false);setText($('#gErr'),err.message);};
  $('#gateForm').addEventListener('submit',ev=>{ev.preventDefault();if(gateBusy)return;
    const n=cleanName($('#gName').value),pw=$('#gPass').value;
    if(!n){setText($('#gErr'),'Gebruik voor je roepnaam 3 tot 16 tekens: letters, cijfers, spaties, - of _.');return;}
    if(gateMode==='rename'){if(!acct){showHome();return;}busy(true);
      Net.api('PATCH','/account',{name:n}).then(r=>{busy(false);acct.name=r.user.name;acct.cloud=true;storeAcct();showHome();},fail);return;}
    if(gateMode==='new'&&pw.length<8){setText($('#gErr'),'Kies een wachtwoord van minstens 8 tekens.');return;}
    if(!pw){setText($('#gErr'),'Vul je wachtwoord in.');return;}
    busy(true);
    Net.api('POST',gateMode==='login'?'/login':'/register',{name:n,password:pw}).then(r=>{busy(false);Net.setToken(r.token);signedIn(r);$('#gPass').value='';if(room)room.reauth();showHome();},fail);});
  for(const id of['#gName','#gPass'])$(id).addEventListener('input',()=>setText($('#gErr'),''));
  $('#gSwitch').onclick=()=>{const n=$('#gName').value;showGate(gateMode==='login'?'new':'login');$('#gName').value=n;};
  $('#gGuest').onclick=()=>{if(gateMode!=='rename')guest=true;showHome();};
  $('#aEdit').onclick=()=>showGate(acct?'rename':'new');
  $('#aLogin').onclick=()=>showGate('login');
  // Afmelden haalt ook de voortgang van dit apparaat weg: die staat op de server en komt terug als je weer inlogt.
  $('#aOut').onclick=()=>{Net.api('POST','/logout').catch(()=>{});signedOut();guest=false;save=blank();try{localStorage.removeItem('ratd-save');}catch{}showGate('login');};}

/* ================= 3D ================= */
const stage=$('#stage');
let renderer=null,scene,camera,sun,sea,ray,gl3=false,haloTex;
const cam={tx:0,tz:0,d:25,yaw:0},PITCH=.86,ACX=2*FW+6.5,ACZ=ROWS*FW+12,AR=8.6;
const slotO=s=>[(s%COLS)*FW,Math.floor(s/COLS)*FW];
const TEAM=[];
const _m=T3&&new T3.Matrix4(),_q=T3&&new T3.Quaternion(),_e=T3&&new T3.Euler(),_v=T3&&new T3.Vector3(),_s=T3&&new T3.Vector3(),_c=T3&&new T3.Color();
// kleuren worden gedempt en verdonkerd: staal en steen in plaats van speelgoedkleuren
function grit(col){const c=new T3.Color(col),l=c.r*.3+c.g*.59+c.b*.11;c.setRGB((c.r*.68+l*.32)*.8,(c.g*.68+l*.32)*.8,(c.b*.68+l*.32)*.8);return c.convertSRGBToLinear();}
function P(geo,col,x,y,z,rx,ry,rz,sc){const g=geo.index?geo.toNonIndexed():geo;sc=sc||[1,1,1];
  _m.compose(_v.set(x||0,y||0,z||0),_q.setFromEuler(_e.set(rx||0,ry||0,rz||0)),_s.set(sc[0],sc[1],sc[2]));g.applyMatrix4(_m);return{g,c:grit(col)};}
function merge(parts,wuv){let n=0;for(const p of parts)n+=p.g.attributes.position.count;
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3),uv=new Float32Array(n*2);let o=0;
  for(const p of parts){const k=p.g.attributes.position.count,pa=p.g.attributes.position.array,na=p.g.attributes.normal.array,ua=p.g.attributes.uv&&p.g.attributes.uv.array;
    pos.set(pa,o*3);nor.set(na,o*3);
    for(let i=0;i<k;i++){const j=o+i;col[j*3]=p.c.r;col[j*3+1]=p.c.g;col[j*3+2]=p.c.b;
      if(wuv){const ax=Math.abs(na[i*3]),ay=Math.abs(na[i*3+1]),az=Math.abs(na[i*3+2]),x=pa[i*3],y=pa[i*3+1],z=pa[i*3+2];
        if(ay>=ax&&ay>=az){uv[j*2]=x*wuv;uv[j*2+1]=z*wuv;}else if(az>=ax){uv[j*2]=x*wuv;uv[j*2+1]=y*wuv;}else{uv[j*2]=z*wuv;uv[j*2+1]=y*wuv;}}
      else if(ua){uv[j*2]=ua[i*2];uv[j*2+1]=ua[i*2+1];}}
    o+=k;}
  const g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(pos,3));g.setAttribute('normal',new T3.BufferAttribute(nor,3));
  g.setAttribute('color',new T3.BufferAttribute(col,3));g.setAttribute('uv',new T3.BufferAttribute(uv,2));return g;}
const bx=(w,h,d,col,x,y,z,ry,rz)=>P(new T3.BoxGeometry(w,h,d),col,x,y,z,0,ry,rz);
const cy=(rt,rb,h,col,x,y,z,seg)=>P(new T3.CylinderGeometry(rt,rb,h,seg||14),col,x,y,z);
const sp=(r,col,x,y,z,sc)=>P(new T3.SphereGeometry(r,16,12),col,x,y,z,0,0,0,sc);
const brl=(r,len,col,x,y,z,tilt)=>P(new T3.CylinderGeometry(r,r,len,10),col,x,y,z,0,0,-Math.PI/2+(tilt||0));
const tor=(r,t,col,y)=>P(new T3.TorusGeometry(r,t,8,22),col,0,y,0,Math.PI/2);
const gcache={},mcache={};let MAT,MATE,STONE;
const geo=(k,fn,wuv)=>gcache[k]||(gcache[k]=merge(fn(),wuv));
const raw=(k,fn)=>gcache[k]||(gcache[k]=fn());
const glow=c=>mcache[c]||(mcache[c]=new T3.MeshBasicMaterial({color:c,toneMapped:false}));
function halo(col,size,op){const k='h'+col+(op||'');const m=mcache[k]||(mcache[k]=new T3.SpriteMaterial({map:haloTex,color:col,blending:T3.AdditiveBlending,depthWrite:false,transparent:true,opacity:op||.75,toneMapped:false}));
  const s=new T3.Sprite(m);s.scale.set(size,size,1);return s;}
function decal(col,size,op){const m=new T3.Mesh(raw('decal',()=>new T3.PlaneGeometry(1,1).rotateX(-Math.PI/2)),new T3.MeshBasicMaterial({map:haloTex,color:col,blending:T3.AdditiveBlending,depthWrite:false,transparent:true,opacity:op,toneMapped:false}));
  m.scale.setScalar(size);return m;}
function mesh(g,mat){const m=new T3.Mesh(g,mat||MAT);m.castShadow=true;m.receiveShadow=true;return m;}
const AIM={sentry:1,flak:1,toxin:1,rocket:1,rail:1,wave:1};
function gearParts(r,h,teeth,col){const a=[cy(r*.8,r*.8,h,col,0,0,0,20)];
  for(let i=0;i<teeth;i++){const an=i/teeth*Math.PI*2;a.push(bx(r*.34,h,r*.24,col,Math.cos(an)*r*.88,0,Math.sin(an)*r*.88,-an));}return a;}
function makeTower(type,slot,lvl,spec){const g=new T3.Group(),head=new T3.Group(),th='#'+TEAM[slot].getHexString(),anims=[];g.add(head);
  const base=fn=>g.add(mesh(geo(type+'b'+slot,()=>[cy(.47,.5,.12,'#3a3f47',0,.06,0,10),cy(.4,.47,.06,'#5a616c',0,.15,0,10),...fn()])));
  const hd=fn=>head.add(mesh(geo(type+'h'+slot,fn)));
  const gl=(k,gf,col,x,y,z,par,hs)=>{const m=new T3.Mesh(raw(k,gf),glow(col));m.position.set(x,y,z);(par||g).add(m);if(hs){const h=halo(col,hs);h.position.set(x,y,z);(par||g).add(h);}return m;};
  switch(type){
    case'sentry':base(()=>[bx(.54,.26,.54,'#7f8a96',0,.3,0),bx(.6,.08,.6,'#4a515c',0,.2,0)]);hd(()=>[bx(.38,.2,.34,'#8f99a5',0,.54,0),bx(.2,.06,.36,th,-.06,.66,0),brl(.04,.52,'#2b3037',.34,.56,.09),brl(.04,.52,'#2b3037',.34,.56,-.09),bx(.1,.12,.3,'#3a4049',.2,.56,0)]);break;
    case'flak':base(()=>[bx(.66,.22,.66,'#6b7550',0,.28,0),bx(.72,.08,.72,'#444a36',0,.2,0)]);hd(()=>[bx(.44,.18,.44,'#5a6540',0,.48,0),bx(.12,.1,.32,th,-.16,.62,0),
      ...[-.2,-.07,.07,.2].map(z=>brl(.05,.48,'#23291b',.22,.66,z,.5)),bx(.16,.2,.5,'#3a402c',.02,.6,0)]);break;
    case'cryo':{base(()=>[cy(.3,.4,.3,'#5e7385',0,.33,0,10),cy(.12,.2,.25,'#9fb4c4',0,.6,0,8),tor(.34,.04,'#3a4652',.22)]);
      const c=gl('oct',()=>new T3.OctahedronGeometry(.2),'#9feeff',0,1.08,0,null,1.5);c.scale.set(1,2.1,1);gl('cring',()=>new T3.TorusGeometry(.27,.03,6,24).rotateX(Math.PI/2),'#d9f8ff',0,.76,0);
      anims.push(t=>{c.rotation.y=t*1.5;c.position.y=1.08+Math.sin(t*2.2+slot)*.05;});break;}
    case'toxin':{base(()=>[cy(.34,.42,.3,'#4d5a3a',0,.33,0,10)]);hd(()=>[sp(.25,'#4f8f2e',0,.68,0),tor(.26,.03,'#2a3320',.68),brl(.05,.46,'#2a3320',.34,.62,0),cy(.08,.08,.1,'#8a9a6a',0,.96,0),bx(.1,.08,.3,th,-.2,.54,0)]);
      gl('tox',()=>new T3.SphereGeometry(.07,8,6),'#8dff4a',0,1.04,0,null,.7);break;}
    case'tesla':{base(()=>[cy(.3,.42,.26,'#5e2b26',0,.31,0,10),cy(.05,.07,1,'#3a3f45',0,.9,0,8),tor(.3,.045,'#b06a30',.58),tor(.23,.045,'#b06a30',.83),tor(.16,.04,'#b06a30',1.08)]);
      const b=gl('ball',()=>new T3.SphereGeometry(.13,14,10),'#e6f6ff',0,1.44,0,null,1.6);anims.push(t=>b.scale.setScalar(1+.25*Math.sin(t*19+slot)));break;}
    case'prism':{base(()=>[bx(.46,.2,.46,'#6f8396',0,.29,0),cy(.09,.2,1.05,'#c5d2de',0,.92,0,6),tor(.2,.03,th,.5)]);
      const c=gl('oct',()=>new T3.OctahedronGeometry(.2),'#8ff4ff',0,1.62,0,null,1.7);c.scale.set(.85,1.3,.85);anims.push(t=>c.rotation.y=t*2);break;}
    case'rocket':base(()=>[bx(.64,.24,.64,'#6c2a25',0,.3,0),bx(.7,.08,.7,'#3a1a17',0,.2,0)]);hd(()=>[bx(.56,.28,.44,'#39424b',.02,.68,0,0,.35),bx(.2,.06,.46,th,-.18,.54,0),
      ...[[.11,.066],[-.11,.066],[.11,-.066],[-.11,-.066]].map(([z,u])=>P(new T3.ConeGeometry(.06,.18,10),'#d8452c',.32-u*.35,.79+u,z,0,0,-Math.PI/2+.35))]);break;
    case'rail':{base(()=>[bx(.52,.26,.52,'#2c4a6b',0,.3,0),bx(.58,.08,.58,'#1a2a3c',0,.2,0)]);hd(()=>[bx(.4,.22,.32,'#1f3550',-.02,.56,0),bx(1,.09,.1,'#141c24',.5,.59,0),bx(.14,.14,.2,th,-.2,.71,0),bx(.1,.16,.16,'#2a3644',.95,.59,0)]);
      gl('strip',()=>new T3.BoxGeometry(1,.03,.04),'#6fe0ff',.5,.65,0,head);break;}
    case'wave':{base(()=>[cy(.32,.4,.28,'#b9b5aa',0,.32,0,10)]);hd(()=>[bx(.32,.2,.3,'#d0ccc0',0,.55,0),brl(.07,.6,'#d0ccc0',.38,.57,0),bx(.1,.06,.32,th,-.1,.68,0)]);
      gl('wring',()=>new T3.TorusGeometry(.14,.03,6,18).rotateY(Math.PI/2),'#ff3b2e',.52,.57,0,head,.6);break;}
    case'uplink':{base(()=>[bx(.5,.3,.5,'#3b5670',0,.32,0),cy(.035,.05,.85,'#aab4be',0,.88,0,8)]);hd(()=>[P(new T3.CylinderGeometry(.32,.06,.14,18),'#c9d2da',.05,1.08,0,0,0,-.9),bx(.1,.08,.1,th,0,.94,0)]);
      gl('beacon',()=>new T3.SphereGeometry(.06,8,6),'#ff5a3c',0,1.34,0,null,.7);anims.push(t=>head.rotation.y=t*.9+slot);break;}
    // De Geers Toren: de beloning voor een turbo van elke soort. Twee losse minigames gebruiken dit model ook.
    case'geers':{base(()=>[cy(.5,.56,.28,'#5b4a1e',0,.32,0,12),cy(.1,.1,1,'#3a3f45',0,.9,0,8)]);
      const g1=mesh(geo('gear1',()=>gearParts(.56,.12,10,'#c79a2a')));g1.position.y=.68;g.add(g1);
      const g2=mesh(geo('gear2',()=>gearParts(.38,.12,8,'#e6c04a')));g2.position.y=.98;g.add(g2);
      const c=gl('core',()=>new T3.SphereGeometry(.15,14,10),'#ff7a4e',0,1.4,0,null,2.2);anims.push(t=>{g1.rotation.y=t*1.6;g2.rotation.y=-t*2.6;c.scale.setScalar(1+.15*Math.sin(t*9));});break;}
    // De Slapende Geers: 3 bij 3 vakken. Een slapend hoofd met slaapmuts boven op traag draaiende tandwielen; de Z's stijgen op.
    case'sleeper':{g.add(mesh(geo('slpb'+slot,()=>[bx(2.86,.14,2.86,'#3a3f47',0,.07,0),bx(2.62,.1,2.62,'#5a616c',0,.19,0),cy(1.12,1.24,.3,'#5b4a1e',0,.39,0,18),
        ...[[-1,-1],[1,-1],[-1,1],[1,1]].flatMap(([x,z])=>[cy(.15,.2,.56,'#4a515c',x*1.16,.5,z*1.16,8),bx(.2,.08,.2,th,x*1.16,.82,z*1.16)])])));
      const g1=mesh(geo('slg1',()=>gearParts(1.18,.16,14,'#c79a2a')));g1.position.y=.64;g.add(g1);
      const g2=mesh(geo('slg2',()=>gearParts(.82,.16,10,'#e6c04a')));g2.position.y=.86;g.add(g2);
      const up=spec==='awake',hdm=mesh(geo(up?'slheadw':'slhead',()=>[sp(.62,'#8a6a1c',0,0,0,[1,.82,1]),...(up?[bx(.3,.05,.06,'#15171a',-.23,.24,.55,-.35),bx(.3,.05,.06,'#15171a',.23,.24,.55,.35),bx(.28,.08,.06,'#15171a',0,-.18,.58)]:[bx(.24,.04,.06,'#15171a',-.23,.1,.55,.25),bx(.24,.04,.06,'#15171a',.23,.1,.55,-.25)]),sp(.09,'#6b4f14',0,-.06,.6),
        P(new T3.ConeGeometry(.4,.8,12),'#6a3d8f',-.16,.66,-.08,0,0,.5),sp(.11,'#e9e3f2',-.5,.98,-.08),tor(.44,.07,'#e9e3f2',.36)]));hdm.position.y=1.42;g.add(hdm);
      gl('slcore',()=>new T3.TorusGeometry(1,.05,6,32).rotateX(Math.PI/2),up?'#ff4a2a':'#b58cff',0,.58,0,null,3.4);
      if(up){const ey=[-.23,.23].map(x=>gl('sleye',()=>new T3.SphereGeometry(.08,10,8),'#ffdd55',x,1.5,.5,null,.7));
        anims.push(t=>{g1.rotation.y=t*4;g2.rotation.y=-t*6;const s=1+.06*Math.sin(t*14);hdm.scale.set(s,s,s);hdm.rotation.z=.12*Math.sin(t*9);hdm.position.y=1.42+.05*Math.abs(Math.sin(t*7));for(const e of ey)e.scale.setScalar(1+.3*Math.sin(t*20));});break;}
      const zs=[0,1,2].map(i=>{const z=new T3.Mesh(geo('zzz',()=>[bx(.3,.07,.07,'#fff',0,.15,0),bx(.44,.07,.07,'#fff',0,0,0,0,.76),bx(.3,.07,.07,'#fff',0,-.15,0)]),glow('#d9c2ff'));g.add(z);return z;});
      anims.push(t=>{g1.rotation.y=t*.35;g2.rotation.y=-t*.55;const br=Math.sin(t*1.3+slot);hdm.scale.set(1+.03*br,1+.07*br,1+.03*br);hdm.rotation.z=.05*Math.sin(t*.65);
        zs.forEach((z,i)=>{const u=(t*.3+i/3)%1;z.position.set(.55+u*.9+.12*Math.sin(t*2+i),2.2+u*1.7,.2);z.scale.setScalar((.5+u*1.1)*(u>.85?(1-u)/.15:1));z.rotation.y=Math.sin(t+i)*.5;});});break;}
  }
  // teamcirkel op de grond, zoals de selectiecirkels in een RTS
  const size=(T[type]&&T[type].size)||1,tcol=spec==='turbo'?'#ff8a2a':spec==='ultra'?'#b56bff':th;
  const ring=new T3.Mesh(raw('tring',()=>new T3.RingGeometry(.5,.58,36).rotateX(-Math.PI/2)),glow(tcol));ring.position.y=.03;ring.scale.setScalar(size===1?1:size*.98);g.add(ring);
  // ultra: paarse cirkel en een zwevende kroon. Turbo: oranje, met een tweede cirkel en een dubbele kroon.
  if(spec==='ultra'||spec==='turbo'){const top=type==='uplink'||type==='prism'||type==='tesla'?1.95:1.3,mk=(y,r)=>{const c=new T3.Mesh(raw('crown',()=>new T3.TorusGeometry(.26,.025,6,24).rotateX(Math.PI/2)),glow(tcol));c.position.y=y;c.scale.setScalar(r);g.add(c);return c;};
    const c1=mk(top,1),c2=spec==='turbo'?mk(top+.12,.7):null;
    if(c2){const r2=new T3.Mesh(raw('tring'),glow('#ffd23a'));r2.position.y=.032;r2.scale.setScalar(1.2);g.add(r2);}
    const hl=halo(tcol,spec==='turbo'?1.5:1.1,.5);hl.position.y=top;g.add(hl);
    anims.push(t=>{c1.position.y=top+.04*Math.sin(t*3+slot);c1.rotation.z=.18*Math.sin(t*2);if(c2){c2.position.y=top+.12+.04*Math.sin(t*3+slot+1);c2.rotation.x=.18*Math.sin(t*2.3);}});}
  if(lvl>0)g.add(new T3.Mesh(geo('pip'+lvl,()=>{const a=[];for(let i=0;i<lvl;i++){const an=Math.PI/2+(i-(lvl-1)/2)*.36;a.push(bx(.09,.09,.09,'#ffc83a',Math.cos(an)*.5,.24,Math.sin(an)*.5,-an));}return a;}),glow('#ffc83a')));
  g.scale.setScalar(type==='geers'?.88+.018*lvl:size>1?1:1+.045*lvl);g.userData={head,anims,aim:!!AIM[type]};return g;}
const ENGEO={
  inf:()=>[bx(.16,.26,.14,'#8f2a22',0,.27,0),bx(.07,.14,.07,'#2a2420',0,.07,.04),bx(.07,.14,.07,'#2a2420',0,.07,-.04),sp(.085,'#c9a888',0,.48,0),sp(.1,'#4a5530',0,.52,0,[1,.6,1]),brl(.02,.28,'#15171a',.14,.33,.08),bx(.12,.16,.06,'#3a3f2a',-.08,.3,0)],
  dog:()=>[bx(.36,.14,.13,'#6a4a30',0,.2,0),bx(.13,.12,.11,'#4d3422',.22,.27,0),bx(.1,.04,.04,'#4d3422',-.22,.26,0),...[[.12,.04],[.12,-.04],[-.12,.04],[-.12,-.04]].map(([x,z])=>bx(.05,.14,.05,'#4d3422',x,.07,z))],
  tank:()=>[bx(.64,.13,.13,'#1d1f22',0,.07,.2),bx(.64,.13,.13,'#1d1f22',0,.07,-.2),bx(.6,.16,.36,'#7a2d26',0,.2,0),bx(.3,.14,.26,'#8a362c',-.04,.36,0),brl(.035,.44,'#1a1010',.28,.37,0),bx(.08,.08,.08,'#2a2f35',-.1,.47,.06)],
  drone:()=>[P(new T3.OctahedronGeometry(.17),'#9aa2ab',0,.6,0),bx(.06,.06,.06,'#ff3b2e',.15,.6,0),bx(.5,.02,.06,'#33373c',0,.76,0),bx(.06,.02,.5,'#33373c',0,.76,0),bx(.04,.14,.04,'#33373c',0,.7,0)],
  mech:()=>[bx(.08,.24,.08,'#1f3023',0,.12,.1),bx(.08,.24,.08,'#1f3023',0,.12,-.1),bx(.3,.26,.3,'#356f40',0,.4,0),bx(.06,.02,.2,'#e8e8e8',0,.54,0),bx(.2,.02,.06,'#e8e8e8',0,.54,0),brl(.03,.24,'#15171a',.2,.4,.12),brl(.03,.24,'#15171a',.2,.4,-.12)],
  haz:()=>[bx(.2,.34,.18,'#b89a22',0,.24,0),sp(.11,'#b89a22',0,.5,0),bx(.06,.07,.14,'#101010',.09,.51,0),bx(.1,.2,.14,'#6a6a6a',-.13,.3,0),brl(.025,.2,'#222',.14,.3,.09)],
  boss:()=>[sp(.5,'#8f2019',0,1.7,0,[2.6,.9,.9]),bx(1.3,.06,.92,'#c79a2a',0,1.7,0),bx(.6,.22,.32,'#22262b',0,1.2,0),bx(.4,.6,.05,'#5a1410',-1.15,1.7,0),bx(.4,.05,.6,'#5a1410',-1.15,1.7,0),brl(.09,.34,'#2a2d31',-.3,1.32,.34),brl(.09,.34,'#2a2d31',-.3,1.32,-.34),sp(.12,'#3a1512',1.28,1.7,0)]
};
function makeHero(idx,slot){const h=HEROES[idx],g=new T3.Group(),th='#'+TEAM[slot].getHexString();
  const C={commando:['#4a5a34','#2a3320','#8a2a22'],shinobi:['#1c2230','#12161f','#b02a22'],tesla:['#6a2a24','#3a1a17','#3a3f47'],moker:['#7a828c','#4a515c','#5a616c'],sniper:['#5a5f52','#3a3f36','#3a3f36'],vlam:['#b8701e','#6a4012','#2a2f35']}[h.id];
  const big=h.id==='moker'?1.25:h.id==='tesla'?1.12:1;
  g.add(mesh(geo('hb'+idx+'_'+slot,()=>{const a=[bx(.2,.3,.3*big,C[0],0,.6,0),bx(.18,.1,.26*big,C[1],0,.42,0),sp(.1,'#c9a888',0,.87,0),bx(.06,.22,.34*big,th,-.1,.62,0)];
    if(h.id==='commando')a.push(cy(.11,.11,.05,C[2],0,.96,0,10),bx(.22,.06,.3,'#2a2f35',0,.46,0));
    if(h.id==='shinobi')a.push(sp(.105,C[0],0,.88,0),bx(.02,.04,.22,C[2],.09,.9,0),bx(.04,.5,.04,'#2a1a12',-.13,.7,.06,0,.5));
    if(h.id==='tesla')a.push(sp(.13,C[2],0,.88,0),bx(.16,.3,.24,'#2a2f35',-.2,.64,0),sp(.12,C[0],0,.78,.24),sp(.12,C[0],0,.78,-.24));
    if(h.id==='moker')a.push(sp(.12,C[2],0,.89,0),sp(.14,C[1],0,.78,.26),sp(.14,C[1],0,.78,-.26),bx(.24,.1,.4,C[1],0,.46,0));
    if(h.id==='sniper')a.push(P(new T3.ConeGeometry(.2,.3,8),C[0],-.02,.92,0),bx(.26,.36,.36,C[1],-.1,.56,0));
    if(h.id==='vlam')a.push(sp(.12,C[0],0,.88,0),bx(.05,.06,.14,'#101010',.1,.89,0),cy(.1,.1,.34,C[2],-.2,.62,0,10));
    return a;}),MATE));
  const limb=(key,fn,x,y,z)=>{const m=mesh(geo('h'+key+idx,fn),MATE);m.position.set(x,y,z);g.add(m);return m;};
  const leg=()=>[bx(.1,.38,.11,C[1],0,-.19,0),bx(.16,.06,.12,'#15171a',.03,-.37,0)];
  const arm=()=>[bx(.09,.3,.09,C[0],0,-.14,0),sp(.05,'#c9a888',0,-.31,0)];
  const legL=limb('l',leg,0,.4,.08*big),legR=limb('l',leg,0,.4,-.08*big),armL=limb('a',arm,0,.74,.2*big);
  const armR=limb('w',()=>{const a=arm();switch(h.id){
      case'commando':a.push(bx(.18,.07,.05,'#15171a',.08,-.33,0));break;
      case'shinobi':a.push(bx(.7,.03,.015,'#dfe6ec',.36,-.32,0),bx(.1,.04,.04,'#2a1a12',-.02,-.32,0));break;
      case'tesla':a.push(cy(.07,.07,.26,'#3a3f47',.06,-.3,0,8),tor(.09,.02,'#b06a30',-.3));break;
      case'moker':a.push(brl(.03,.8,'#3a2a1c',.3,-.32,0),bx(.2,.2,.34,'#4a515c',.68,-.32,0));break;
      case'sniper':a.push(brl(.025,.9,'#15171a',.4,-.3,0),bx(.2,.08,.05,'#3a2a1c',.02,-.3,0));break;
      case'vlam':a.push(brl(.04,.5,'#2a2f35',.24,-.3,0));break;}return a;},0,.74,-.2*big);
  if(h.id==='tesla'){const b=new T3.Mesh(raw('hglow',()=>new T3.SphereGeometry(.07,8,6)),glow('#9fe0ff'));b.position.set(-.3,.72,0);g.add(b);const hl=halo('#9fe0ff',.7);hl.position.copy(b.position);g.add(hl);}
  if(h.id==='vlam'){const hl=halo('#ff9a30',.4);hl.position.set(.5,-.3,0);armR.add(hl);}
  if(h.id==='commando'){const l2=mesh(geo('hw2',()=>[bx(.18,.07,.05,'#15171a',.08,-.33,0)]),MATE);armL.add(l2);}
  const ring=new T3.Mesh(raw('hring',()=>new T3.RingGeometry(.3,.36,28).rotateX(-Math.PI/2)),glow(th));ring.position.y=.03;g.add(ring);
  g.userData={legL,legR,armL,armR,melee:h.k==='blade'||h.k==='slam'};g.scale.setScalar(1.15);return g;}
function animHero(g,walk,atk){const u=g.userData,s=Math.sin(walk)*.7;u.legL.rotation.z=s;u.legR.rotation.z=-s;u.armL.rotation.z=-s*.7;
  u.armR.rotation.z=atk>0?(u.melee?2.6*atk-.5:.3*atk):s*.3;}
function nameSprite(text,col){const cv=document.createElement('canvas');cv.width=256;cv.height=48;const g=cv.getContext('2d');g.font='400 30px Marcellus,Georgia,serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=5;g.strokeStyle='#000';g.strokeText(text.slice(0,16),128,24);g.fillStyle=col;g.fillText(text.slice(0,16),128,24);
  const s=new T3.Sprite(new T3.SpriteMaterial({map:new T3.CanvasTexture(cv),transparent:true,depthWrite:false,toneMapped:false}));s.scale.set(2.2,.42,1);return s;}
// modellen die alleen in minigames voorkomen
Object.assign(ENGEO,{
  crate:()=>[bx(.5,.5,.5,'#8a6a3a',0,.25,0),bx(.56,.07,.56,'#5a4526',0,.5,0),bx(.56,.07,.56,'#5a4526',0,.035,0),bx(.07,.44,.56,'#5a4526',.25,.25,0),bx(.07,.44,.56,'#5a4526',-.25,.25,0)],
  target:()=>[cy(.03,.03,.5,'#2a2d31',0,.25,0,6),cy(.16,.2,.06,'#3a3f47',0,.03,0,10),P(new T3.CylinderGeometry(.3,.3,.05,20),'#e8e8e8',0,.72,0,0,0,Math.PI/2),P(new T3.CylinderGeometry(.2,.2,.07,20),'#c8281e',0,.72,0,0,0,Math.PI/2),P(new T3.CylinderGeometry(.08,.08,.09,12),'#e8e8e8',0,.72,0,0,0,Math.PI/2)],
  gen:()=>[cy(.4,.46,.5,'#3b5670',0,.25,0,10),cy(.12,.12,.7,'#aab4be',0,.8,0,8),tor(.3,.045,'#b06a30',.62),tor(.22,.04,'#b06a30',.86),sp(.15,'#9fe0ff',0,1.22,0)],
  sheep:()=>[sp(.24,'#e8e4d8',0,.32,0,[1.3,.9,.95]),sp(.11,'#2a2a2a',.32,.38,0),...[[.16,.09],[.16,-.09],[-.16,.09],[-.16,-.09]].map(([x,z])=>bx(.05,.18,.05,'#2a2a2a',x,.09,z))],
  cart:()=>[bx(.9,.28,.5,'#6a4a30',0,.3,0),bx(.7,.26,.44,'#8a6c16',-.04,.56,0),bx(.12,.5,.5,'#4d3422',.42,.5,0),...[[.3,.28],[.3,-.28],[-.3,.28],[-.3,-.28]].map(([x,z])=>P(new T3.CylinderGeometry(.15,.15,.08,12),'#1d1f22',x,.15,z,Math.PI/2))],
  flag:()=>[cy(.03,.03,1.1,'#2a2d31',0,.55,0,6),cy(.2,.24,.08,'#5a616c',0,.04,0,10),bx(.42,.26,.03,'#c8281e',.22,.95,0)]});
const EI={},ETOP={inf:.75,dog:.5,tank:.65,drone:.95,mech:.75,haz:.78,boss:2.4,crate:.72,target:1.1,gen:1.45,sheep:.62,cart:.9,flag:1.25};
let hpMesh,hpBack,dummy,WHITE,ICE,TOXC,cR=null;
const tobj=new Map(),bobj=new Map(),labels=[],live=[],pool={beam:[],ball:[],ring:[]},missiles=[],fires=[];
let hoverM,rangeM,selM,ghosts=[],links=[],roadM,trailM,kerbM,gateIn,gateOut,roadSig='';

/* --- texturen: allemaal procedureel getekend --- */
function texFrom(cv,rep){const t=new T3.CanvasTexture(cv);t.encoding=T3.sRGBEncoding;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(rep){t.wrapS=t.wrapT=T3.RepeatWrapping;}return t;}
function mkCanvas(S){const c=document.createElement('canvas');c.width=c.height=S;return[c,c.getContext('2d')];}
function grungeTex(){const[cv,g]=mkCanvas(256),r=lcg(11);g.fillStyle='#cfcfcf';g.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){const v=140+r()*110|0;g.fillStyle=`rgba(${v},${v},${v},.25)`;g.fillRect(r()*256,r()*256,1+r()*4,1+r()*4);}
  for(let i=0;i<26;i++){g.fillStyle=`rgba(40,36,30,${.05+r()*.1})`;g.beginPath();g.arc(r()*256,r()*256,10+r()*40,0,7);g.fill();}
  g.strokeStyle='rgba(20,20,20,.55)';g.lineWidth=5;g.strokeRect(6,6,244,244);g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.5;g.strokeRect(11,11,234,234);
  for(const[x,y]of[[20,20],[236,20],[20,236],[236,236],[128,20],[128,236]]){g.fillStyle='#555';g.beginPath();g.arc(x,y,4,0,7);g.fill();g.fillStyle='#eee';g.beginPath();g.arc(x-1,y-1,1.5,0,7);g.fill();}
  for(let i=0;i<16;i++){g.strokeStyle=r()>.5?'rgba(255,255,255,.3)':'rgba(0,0,0,.3)';g.lineWidth=1;const x=r()*256,y=r()*256;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*70,y+(r()-.5)*70);g.stroke();}
  return texFrom(cv,true);}
function masonryTex(){const[cv,g]=mkCanvas(256),r=lcg(5);g.fillStyle='#4a4a4a';g.fillRect(0,0,256,256);
  for(let row=0;row<8;row++)for(let i=-1;i<4;i++){const x=i*64+(row%2?32:0),v=150+r()*75|0;g.fillStyle=`rgb(${v},${v},${v+6})`;g.fillRect(x+2,row*32+2,60,28);
    g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x+2,row*32+2,60,3);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+2,row*32+26,60,4);}
  for(let i=0;i<2200;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.08)':'rgba(0,0,0,.14)';g.fillRect(r()*256,r()*256,2,2);}
  for(let i=0;i<14;i++){g.fillStyle=`rgba(30,40,20,${.08+r()*.1})`;g.beginPath();g.arc(r()*256,r()*256,8+r()*26,0,7);g.fill();}
  return texFrom(cv,true);}
function groundTextures(){const S=2048,[cv,g]=mkCanvas(S),[bv,b]=mkCanvas(S/2),u=S/N,r=lcg(7);b.scale(.5,.5);
  g.fillStyle='#35432a';g.fillRect(0,0,S,S);b.fillStyle='#707070';b.fillRect(0,0,S,S);
  const pal=['#43552f','#2c3923','#4a4532','#3a4a2c','#514a38','#2f3d28'];
  for(let i=0;i<420;i++){const x=r()*S,y=r()*S,rad=40+r()*170,gr=g.createRadialGradient(x,y,0,x,y,rad),c=pal[r()*pal.length|0];gr.addColorStop(0,c);gr.addColorStop(1,c+'00');g.globalAlpha=.55;g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}
  g.globalAlpha=1;
  for(let i=0;i<60000;i++){const x=r()*S,y=r()*S,l=r()>.5;g.fillStyle=l?'rgba(150,170,90,.16)':'rgba(10,20,5,.22)';g.fillRect(x,y,1+r()*3,2+r()*5);b.fillStyle=l?'rgba(255,255,255,.2)':'rgba(0,0,0,.2)';b.fillRect(x,y,3,5);}
  g.strokeStyle='rgba(0,0,0,.13)';g.lineWidth=2;for(let i=1;i<N;i++){g.beginPath();g.moveTo(i*u,0);g.lineTo(i*u,S);g.moveTo(0,i*u);g.lineTo(S,i*u);g.stroke();}
  const vg=g.createRadialGradient(S/2,S/2,S*.35,S/2,S/2,S*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.4)');g.fillStyle=vg;g.fillRect(0,0,S,S);
  const bt=new T3.CanvasTexture(bv);return[texFrom(cv),bt];}
// weg en olifantenpad: losse tegels per vak, want elke vesting heeft een eigen route
function roadTextures(){const S=256,[cv,g]=mkCanvas(S),[bv,b]=mkCanvas(S),[tv,t]=mkCanvas(S),r=lcg(13);
  g.fillStyle='#241a16';g.fillRect(0,0,S,S);b.fillStyle='#3a3a3a';b.fillRect(0,0,S,S);
  for(let row=0;row<8;row++)for(let i=-1;i<4;i++){const x=i*64+(row%2?32:0),y=row*32,q=r(),v=150+q*50|0;
    g.fillStyle=r()<.12?`rgb(${70+q*20|0},${66+q*18|0},${64+q*16|0})`:`rgb(${96+q*40|0},${62+q*24|0},${50+q*18|0})`;g.fillRect(x+2,y+2,60,28);
    b.fillStyle=`rgb(${v},${v},${v})`;b.fillRect(x+3,y+3,58,26);}
  for(let i=0;i<9;i++){const x=r()*S,y=r()*S,rad=20+r()*50,gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,'rgba(10,8,8,.3)');gr.addColorStop(1,'rgba(10,8,8,0)');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}
  const gr=t.createRadialGradient(S/2,S/2,30,S/2,S/2,S*.72);gr.addColorStop(0,'rgba(78,60,38,.96)');gr.addColorStop(1,'rgba(64,52,34,.62)');t.fillStyle=gr;t.fillRect(0,0,S,S);
  for(let i=0;i<1100;i++){t.fillStyle=r()>.5?'rgba(128,104,70,.35)':'rgba(26,20,12,.4)';t.fillRect(r()*S,r()*S,2+r()*5,2+r()*3);}
  return[texFrom(cv),new T3.CanvasTexture(bv),texFrom(tv)];}
function seaTexture(){const S=256,[cv,g]=mkCanvas(S),r=lcg(3);g.fillStyle='#0c2636';g.fillRect(0,0,S,S);
  for(let i=0;i<50;i++){g.fillStyle=`rgba(${r()>.5?'30,70,95':'4,14,24'},.22)`;g.beginPath();g.arc(r()*S,r()*S,10+r()*30,0,7);g.fill();}
  for(let i=0;i<90;i++){const x=r()*S,y=r()*S,w=10+r()*26;g.strokeStyle=`rgba(170,210,235,${.04+r()*.1})`;g.lineWidth=1+r();
    for(const ox of[-S,0,S]){g.beginPath();g.moveTo(x+ox,y);g.quadraticCurveTo(x+ox+w/2,y-4,x+ox+w,y);g.stroke();}}
  const t=texFrom(cv,true);t.repeat.set(34,34);return t;}
function haloTexture(){const[cv,g]=mkCanvas(128),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.55)');gr.addColorStop(.6,'rgba(255,255,255,.14)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);return new T3.CanvasTexture(cv);}
function labelDraw(L,title,sub,col){const k=title+'|'+sub;if(L.k===k)return;L.k=k;const g=L.g;g.clearRect(0,0,512,128);
  g.fillStyle='rgba(5,6,9,.86)';g.fillRect(4,16,504,96);g.strokeStyle='#a8842c';g.lineWidth=3;g.strokeRect(4,16,504,96);g.fillStyle=col;g.fillRect(8,20,12,88);
  g.fillStyle=col;g.font='400 44px Marcellus,"Palatino Linotype",Georgia,serif';g.textBaseline='middle';let t=title;while(g.measureText(t).width>460&&t.length>3)t=t.slice(0,-2);g.fillText(t,34,sub?50:64);
  if(sub){g.fillStyle='#f6cf4d';g.font='400 27px Marcellus,Georgia,serif';g.fillText(sub,34,90);}L.tex.needsUpdate=true;}
function addFire(x,y,z,size){const f={x,y,z,size,seed:Math.random()*9,s:[],sm:[]};
  for(let i=0;i<4;i++){const s=new T3.Sprite(new T3.SpriteMaterial({map:haloTex,color:'#ff9a30',blending:T3.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false}));scene.add(s);f.s.push(s);}
  for(let i=0;i<2;i++){const s=new T3.Sprite(new T3.SpriteMaterial({map:haloTex,color:'#0b0b0d',depthWrite:false,transparent:true,opacity:.4}));scene.add(s);f.sm.push(s);}
  f.d=decal('#ff7a20',size*5,.3);f.d.position.set(x,.04,z+.6);scene.add(f.d);fires.push(f);}
function init3D(){if(!T3)return false;
  try{renderer=new T3.WebGLRenderer({antialias:true});}catch{return false;}
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.outputEncoding=T3.sRGBEncoding;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T3.PCFSoftShadowMap;
  renderer.toneMapping=T3.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  stage.insertBefore(renderer.domElement,stage.firstChild);
  scene=new T3.Scene();scene.background=new T3.Color('#070c14');scene.fog=new T3.Fog('#0a121c',55,150);
  camera=new T3.PerspectiveCamera(42,1.6,.3,400);ray=new T3.Raycaster();dummy=new T3.Object3D();WHITE=new T3.Color(1,1,1);ICE=new T3.Color(.5,1.2,1.9);TOXC=new T3.Color(.6,1.4,.45);
  haloTex=haloTexture();const grunge=grungeTex(),mason=masonryTex();
  MAT=new T3.MeshStandardMaterial({vertexColors:true,map:grunge,bumpMap:grunge,bumpScale:.012,roughness:.55,metalness:.45});MATE=MAT.clone();MATE.metalness=.25;MATE.roughness=.7;
  STONE=new T3.MeshStandardMaterial({vertexColors:true,map:mason,bumpMap:mason,bumpScale:.03,roughness:.95,metalness:0});
  // schemering: laag warm zonlicht, koel blauw tegenlicht
  scene.add(new T3.HemisphereLight('#8ea4d6','#2b2432',.62));
  sun=new T3.DirectionalLight('#ffd0a0',1.75);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  const sc=sun.shadow.camera;sc.left=-28;sc.right=28;sc.top=28;sc.bottom=-28;sc.near=1;sc.far=130;sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
  const fill=new T3.DirectionalLight('#4a6fd0',.4);fill.position.set(30,20,-20);scene.add(fill);
  sea=new T3.Mesh(new T3.PlaneGeometry(620,620).rotateX(-Math.PI/2),new T3.MeshStandardMaterial({map:seaTexture(),roughness:.3,metalness:.55}));
  sea.position.set(COLS*FW/2,-1.25,ROWS*FW/2);sea.receiveShadow=true;scene.add(sea);
  for(let i=0;i<=SLOTS;i++)TEAM.push(i===SLOTS?new T3.Color('#3d6fa8'):new T3.Color().setHSL((i*.618034+.6)%1,.72,.5));
  const[gtex,gbump]=groundTextures(),gmat=new T3.MeshStandardMaterial({map:gtex,bumpMap:gbump,bumpScale:.05,roughness:.95,metalness:0}),ggeo=new T3.PlaneGeometry(N,N).rotateX(-Math.PI/2);
  const st='#6c727c',sd='#4f555e',roof='#34507c',LAMPS=[[3.5,-.53],[13.53,10.5],[-.53,10.5]];
  const isl=geo('island',()=>{const a=[bx(14.4,1.7,14.4,sd,6.5,-.86,6.5),bx(15.2,.7,15.2,'#3a3f47',6.5,-1.5,6.5),
      // uitgang: poort rechts in het midden, met het hoofdkwartier ernaast op een pier
      bx(.3,1.3,.4,st,13.53,.65,5.6),bx(.3,1.3,.4,st,13.53,.65,7.4),bx(.44,.3,2.2,st,13.53,1.42,6.5),
      bx(2.8,1.7,3.2,sd,15.1,-.86,9.4),bx(1.4,1.3,2.1,st,15.2,.65,9.4),P(new T3.ConeGeometry(1.6,1,4),roof,15.2,1.8,9.4,0,Math.PI/4),bx(.1,.7,.5,'#1a1410',14.48,.35,9.4),cy(.035,.035,1.2,'#22262b',15.2,2,10.2,6),
      // ingang: poort links in het midden, met de vijandelijke fabriek ernaast
      bx(2.8,1.7,3.2,sd,-2,-.86,3.8),bx(1.5,1.2,2,'#5a352c',-2.1,.6,3.8),bx(1.7,.16,2.2,'#2a2422',-2.1,1.28,3.8),bx(.1,.8,1.1,'#0c0808',-1.33,.4,3.8),
      cy(.13,.17,.9,'#33373c',-2.5,1.75,3.3,10),cy(.13,.17,.7,'#33373c',-2.5,1.65,4.3,10),bx(.3,1.3,.4,'#5a352c',-.53,.65,5.6),bx(.3,1.3,.4,'#5a352c',-.53,.65,7.4),bx(.4,.3,2.2,'#5a352c',-.53,1.42,6.5)];
    // muren met kantelen; openingen voor de poorten en de bruggen
    const wall=(horiz,fixed,gaps)=>{let p=-.7;for(const[g0,g1]of[...gaps,[13.7,13.7]]){const len=g0-p,c=p+len/2;if(len>.05){a.push(horiz?bx(len,.36,.34,st,c,.18,fixed):bx(.34,.36,len,st,fixed,.18,c));
          for(let q=p+.3;q<g0-.25;q+=1)a.push(horiz?bx(.5,.24,.34,st,q,.48,fixed):bx(.34,.24,.5,st,fixed,.48,q));}p=g1;}};
    wall(true,-.53,[[7.7,9.3]]);wall(true,13.53,[[7.7,9.3]]);wall(false,13.53,[[5.7,7.3]]);wall(false,-.53,[[5.7,7.3]]);
    for(const[x,z]of[[7.6,-.53],[9.4,-.53],[7.6,13.53],[9.4,13.53],[13.53,5.6],[13.53,7.4],[-.53,5.6],[-.53,7.4]])a.push(bx(.36,1,.36,st,x,.5,z),bx(.44,.12,.44,sd,x,1.05,z));
    for(const[x,z]of[[-.53,-.53],[13.53,-.53],[13.53,13.53],[-.53,13.53]])a.push(cy(.62,.7,2.1,st,x,.5,z,12),cy(.72,.72,.22,sd,x,1.62,z,12),P(new T3.ConeGeometry(.84,1.1,12),roof,x,2.28,z));
    for(const[x,z]of LAMPS)a.push(cy(.04,.06,1.3,'#1c1f24',x,1,z,6),bx(.16,.16,.16,'#2a2d31',x,1.7,z));
    return a;},.5);
  const bridge=(k,horiz)=>geo(k,()=>{const L=FW-13.72,c=13.36+L/2,a=[];
    if(horiz)a.push(bx(L,.5,1.8,sd,c,-.26,6.5),bx(L,.3,.14,st,c,.14,5.67),bx(L,.3,.14,st,c,.14,7.33),bx(.6,2,1.4,sd,c,-1.4,6.5));
    else a.push(bx(1.8,.5,L,sd,8.5,-.26,c),bx(.14,.3,L,st,7.67,.14,c),bx(.14,.3,L,st,9.33,.14,c),bx(1.4,2,.6,sd,8.5,-1.4,c));return a;},.5);
  const arenaGeo=geo('arena',()=>{const a=[cy(10,10.5,1.7,sd,0,-.86,0,40),cy(10.6,11,.7,'#3a3f47',0,-1.5,0,40),cy(9.1,9.1,.04,'#8f7a58',0,.02,0,40),cy(2.2,2.2,.03,'#6c2a25',0,.05,0,24),cy(1.6,1.6,.03,'#8f7a58',0,.06,0,24)];
    for(let i=0;i<30;i++){const an=i/30*Math.PI*2,x=Math.cos(an)*9.6,z=Math.sin(an)*9.6;a.push(bx(.5,i%5?1:1.9,2.05,st,x,i%5?.5:.95,z,-an));if(i%5===0)a.push(cy(.34,.2,.3,'#2a2d31',x,2.05,z,10));else a.push(bx(.5,.24,.6,st,x,1.12,z,-an));}
    return a;},.5);
  const props=geo('props',()=>{const a=[],r=lcg(21);for(const k of E.ROCK){const x=k%N,cx=x+.5,cz=(k-x)/N+.5;
      if((x+(k-x)/N)%2){a.push(cy(.07,.11,.6,'#3a2a1c',cx,.3,cz,7));for(const[y,s]of[[.75,.42],[1.05,.36],[1.32,.27]])a.push(P(new T3.IcosahedronGeometry(s,1),r()>.5?'#2a4a26':'#23401f',cx+(r()-.5)*.14,y,cz+(r()-.5)*.14,r(),r(),0,[1,.8,1]));}
      else a.push(P(new T3.DodecahedronGeometry(.3),'#6a6e75',cx-.1,.2,cz,r(),r(),0,[1,.75,1]),P(new T3.DodecahedronGeometry(.2),'#555a61',cx+.22,.13,cz+.12,r(),r(),0),bx(.24,.24,.24,'#5a4530',cx+.12,.12,cz-.26,.5),bx(.2,.2,.2,'#4a3826',cx-.2,.1,cz+.28,.2));}
    return a;});
  for(let s=0;s<SLOTS;s++){const[ox,oz]=slotO(s),th=TEAM[s];
    const i=mesh(isl,STONE);i.position.set(ox,0,oz);scene.add(i);if(E.ROCK.size){const pr=mesh(props,MATE);pr.position.set(ox,0,oz);scene.add(pr);}
    const gr=new T3.Mesh(ggeo,gmat);gr.position.set(ox+N/2,.012,oz+N/2);gr.receiveShadow=true;scene.add(gr);
    const tm=new T3.MeshStandardMaterial({color:th,roughness:.7});
    const band=new T3.Mesh(raw('band',()=>new T3.BoxGeometry(1.44,.14,2.14)),tm);band.position.set(ox+15.2,1.0,oz+9.4);scene.add(band);
    const flag=new T3.Mesh(raw('flag',()=>new T3.BoxGeometry(.03,.42,.7)),tm);flag.position.set(ox+15.2,2.35,oz+10.57);flag.castShadow=true;scene.add(flag);
    if(s%COLS<COLS-1){const b=mesh(bridge('brE',true),STONE);b.position.set(ox,0,oz);scene.add(b);}if(s<SLOTS-COLS){const b=mesh(bridge('brS',false),STONE);b.position.set(ox,0,oz);scene.add(b);}
    for(const[x,z]of LAMPS){const h=halo('#ffc070',1.5,.9);h.position.set(ox+x,1.72,oz+z);scene.add(h);const d=decal('#ff9a40',5,.22);d.position.set(ox+x+(x<0?1:x>13?-1:0),.04,oz+z+(z<0?1:0));scene.add(d);}
    addFire(ox-2.5,2.3,oz+3.3,.6);addFire(ox-1.2,.5,oz+3.8,.5);
    const cv=document.createElement('canvas');cv.width=512;cv.height=128;const tex=new T3.CanvasTexture(cv);tex.encoding=T3.sRGBEncoding;
    const spr=new T3.Sprite(new T3.SpriteMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));spr.scale.set(3.4,.85,1);spr.position.set(ox+15.2,3.1,oz+9.4);scene.add(spr);
    const L={g:cv.getContext('2d'),tex,spr,k:''};labels.push(L);labelDraw(L,'Vrije vesting','','#'+th.getHexString());}
  {const am=mesh(arenaGeo,STONE);am.position.set(ACX,0,ACZ);scene.add(am);
    for(let i=0;i<30;i+=5){const an=i/30*Math.PI*2;addFire(ACX+Math.cos(an)*9.6,2.3,ACZ+Math.sin(an)*9.6,.7);}
    const sprA=nameSprite('Arena','#f6cf4d');sprA.scale.set(5,.95,1);sprA.position.set(ACX,4.2,ACZ-9.6);scene.add(sprA);}
  {const R=RUN,cg=geo('course',()=>{const a=[bx(R.L+1.6,1.7,R.W+1.6,sd,R.L/2,-.86,R.W/2),bx(R.L+2.4,.7,R.W+2.4,'#3a3f47',R.L/2,-1.5,R.W/2),bx(R.L,.04,R.W,'#8f7a58',R.L/2,.02,R.W/2),
        bx(R.L+1.2,.4,.3,st,R.L/2,.2,-.45),bx(R.L+1.2,.4,.3,st,R.L/2,.2,R.W+.45),bx(.3,.4,R.W+1.2,st,-.45,.2,R.W/2),bx(.3,.4,R.W+1.2,st,R.L+.45,.2,R.W/2),
        bx(.4,2,.4,st,R.L-2,1,.3),bx(.4,2,.4,st,R.L-2,1,R.W-.3),bx(.5,.3,R.W,st,R.L-2,2.1,R.W/2)];
      for(const[wx,sde]of R.walls)a.push(bx(.6,1.3,R.W-R.gap,st,wx,.65,sde?(R.W-R.gap)/2:R.gap+(R.W-R.gap)/2));return a;},.5);
    const cm=mesh(cg,STONE);cm.position.set(R.x,0,R.z);scene.add(cm);
    const d1=decal('#35cf4a',4,.45);d1.position.set(R.x+1.5,.07,R.z+R.W/2);const d2=decal('#f6cf4d',5,.6);d2.position.set(R.x+R.L-1,.07,R.z+R.W/2);scene.add(d1,d2);
    const sprP=nameSprite('Doolhof','#f6cf4d');sprP.scale.set(5,.95,1);sprP.position.set(R.x+R.L/2,3.6,R.z-1);scene.add(sprP);
    addFire(R.x+R.L-2,2.5,R.z+.3,.5);addFire(R.x+R.L-2,2.5,R.z+R.W-.3,.5);}
  for(const k of Object.keys(ENGEO)){const cap=k==='boss'?80:700,m=new T3.InstancedMesh(geo('en_'+k,ENGEO[k]),MATE,cap);m.castShadow=true;m.frustumCulled=false;m.setColorAt(0,WHITE);m.count=0;scene.add(m);EI[k]={m,cap,n:0};}
  const hpm=()=>new T3.MeshBasicMaterial({depthTest:false,transparent:true,toneMapped:false});
  hpBack=new T3.InstancedMesh(new T3.PlaneGeometry(1,1),hpm(),900);hpBack.material.color.set('#000');hpBack.material.opacity=.75;hpBack.frustumCulled=false;hpBack.count=0;hpBack.renderOrder=4;scene.add(hpBack);
  hpMesh=new T3.InstancedMesh(new T3.PlaneGeometry(1,1),hpm(),900);hpMesh.frustumCulled=false;hpMesh.setColorAt(0,WHITE);hpMesh.count=0;hpMesh.renderOrder=5;scene.add(hpMesh);
  const flat=(col,op)=>new T3.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false,toneMapped:false});
  hoverM=new T3.Mesh(new T3.PlaneGeometry(1,1).rotateX(-Math.PI/2),flat('#35cf4a',.5));hoverM.visible=false;scene.add(hoverM);
  rangeM=new T3.Mesh(new T3.RingGeometry(.975,1,80).rotateX(-Math.PI/2),flat('#35cf4a',.95));rangeM.visible=false;scene.add(rangeM);
  selM=new T3.Mesh(new T3.CircleGeometry(1,80).rotateX(-Math.PI/2),flat('#35cf4a',.08));selM.visible=false;scene.add(selM);
  {const rt=roadTextures(),tile=()=>new T3.PlaneGeometry(1,1).rotateX(-Math.PI/2);
    roadM=new T3.InstancedMesh(tile(),new T3.MeshStandardMaterial({map:rt[0],bumpMap:rt[1],bumpScale:.04,roughness:.9,metalness:0}),SLOTS*N*N);
    trailM=new T3.InstancedMesh(tile(),new T3.MeshStandardMaterial({map:rt[2],transparent:true,depthWrite:false,roughness:1,metalness:0}),SLOTS*N*N);
    kerbM=new T3.InstancedMesh(new T3.BoxGeometry(1,.09,1),new T3.MeshStandardMaterial({color:grit('#8d929b'),roughness:.9,metalness:0}),SLOTS*350);
    for(const m of[roadM,trailM,kerbM]){m.count=0;m.frustumCulled=false;m.receiveShadow=true;scene.add(m);}
    gateIn=decal('#ff4a30',1,.6);gateOut=decal('#59c8f2',1,.6);gateIn.visible=gateOut.visible=false;scene.add(gateIn,gateOut);}
  cR=new T3.Vector3();gl3=true;return true;}
// Tegels opnieuw plaatsen zodra ergens een weg verandert. Stoepranden komen langs elke kant zonder aansluitende weg.
function updRoads(fs){const sig=fs.map(f=>f.slot+':'+f.psig).join('|');if(sig===roadSig)return;roadSig=sig;let r=0,t=0,k=0;
  const put=(M,i,x,y,z,sx,sz)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(sx,1,sz);dummy.updateMatrix();M.setMatrixAt(i,dummy.matrix);};
  for(const f of fs){const[ox,oz]=slotO(f.slot);
    for(const c of f.road){const x=c%N,y=(c-x)/N;put(roadM,r++,ox+x+.5,.022,oz+y+.5,1,1);
      for(const[dx,dy]of E.DIRS){const ax=x+dx,ay=y+dy,inb=ax>=0&&ay>=0&&ax<N&&ay<N,nb=ay*N+ax;
        if(inb?(f.road.has(nb)||f.trail.has(nb)):(dx&&y===E.MID))continue;if(k<SLOTS*350)put(kerbM,k++,ox+x+.5+dx*.46,.045,oz+y+.5+dy*.46,dx?.08:1,dy?.08:1);}}
    for(const c of f.trail){const x=c%N;put(trailM,t++,ox+x+.5,.02,oz+(c-x)/N+.5,1,1);}}
  roadM.count=r;trailM.count=t;kerbM.count=k;for(const m of[roadM,trailM,kerbM])m.instanceMatrix.needsUpdate=true;}
function resize(){$('#tip').style.bottom=($('#console').offsetHeight+8)+'px';if(!gl3)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const focus=()=>camMode==='hero'&&G?[hero.x,hero.z]:[cam.tx,cam.tz];
function camUpdate(){let fx,fz;
  if(camMode==='hero'&&G){hcam.d=Math.max(3.5,Math.min(26,hcam.d));hcam.pitch=Math.max(.1,Math.min(1.3,hcam.pitch));fx=hero.x;fz=hero.z;
    const cp=Math.cos(hcam.pitch)*hcam.d;camera.position.set(fx+Math.sin(hcam.yaw)*cp,1+Math.sin(hcam.pitch)*hcam.d,fz+Math.cos(hcam.yaw)*cp);camera.lookAt(fx,1,fz);}
  else{cam.d=Math.max(11,Math.min(64,cam.d));cam.tx=Math.max(-5,Math.min(COLS*FW,cam.tx));cam.tz=Math.max(-5,Math.min(ROWS*FW+24,cam.tz));fx=cam.tx;fz=cam.tz;
    const cp=Math.cos(PITCH)*cam.d;camera.position.set(fx+Math.sin(cam.yaw)*cp,Math.sin(PITCH)*cam.d,fz+Math.cos(cam.yaw)*cp);camera.lookAt(fx,0,fz);}
  sun.position.set(fx-34,24,fz+20);sun.target.position.set(fx,0,fz);}
function camTo(s){const[ox,oz]=slotO(s);cam.tx=ox+6.5;cam.tz=oz+7+cam.d*.1;}
const camHome=()=>{camMode='hero';};
function groundAt(nx,ny){_v.set(nx,ny,.5);ray.setFromCamera(_v,camera);const d=ray.ray.direction,o=ray.ray.origin;if(d.y>=-.001)return null;const t=-o.y/d.y;return{x:o.x+d.x*t,z:o.z+d.z*t};}
function pick(ev){const r=renderer.domElement.getBoundingClientRect();return groundAt((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height)*2+1);}
function pickOwn(ev){const p=pick(ev);if(!p)return null;const[ox,oz]=slotO(mySlot),x=p.x-ox,y=p.z-oz;
  const fx=Math.floor(x),fy=Math.floor(y);return{x,y,cell:fx<0||fy<0||fx>=N||fy>=N?-1:fy*N+fx};}

/* --- effecten --- */
function getFx(kind){let m=pool[kind].pop();
  if(!m){const g=kind==='beam'?raw('fxbeam',()=>new T3.BoxGeometry(1,1,1).translate(0,0,.5)):kind==='ball'?raw('fxball',()=>new T3.SphereGeometry(1,14,10)):raw('fxring',()=>new T3.RingGeometry(.82,1,44).rotateX(-Math.PI/2));
    m=new T3.Mesh(g,new T3.MeshBasicMaterial({transparent:true,depthWrite:false,blending:T3.AdditiveBlending,toneMapped:false}));m.userData.kind=kind;scene.add(m);}
  m.visible=true;return m;}
function fxBeam(a,b,col,w,life){if(live.length>340)return;const m=getFx('beam');m.material.color.set(col);m.material.opacity=1;m.position.copy(a);m.lookAt(b);
  Object.assign(m.userData,{t:0,life,w,L:a.distanceTo(b)});m.scale.set(w,w,m.userData.L);live.push(m);}
function fxBall(p,col,r0,r1,life,op){if(live.length>340)return;const m=getFx('ball');m.material.color.set(col);m.position.copy(p);Object.assign(m.userData,{t:0,life,r0,r1,op});m.scale.setScalar(r0);live.push(m);}
function fxRing(p,col,r,life,op){if(live.length>340)return;const m=getFx('ring');m.material.color.set(col);m.position.set(p.x,.06,p.z);Object.assign(m.userData,{t:0,life,r0:r*.3,r1:r,op:op||.9});m.scale.setScalar(r*.3);live.push(m);}
const V=(x,y,z)=>new T3.Vector3(x,y,z);
function spawnFx(f,ox,oz){const A=h=>V(ox+f.a[0],h,oz+f.a[1]),B=f.b?V(ox+f.b[0],.36,oz+f.b[1]):null;
  switch(f.k){
    case'shot':fxBeam(A(.62),B,'#ffd98a',.04,.08);fxBall(A(.62),'#ffe9b0',.05,.16,.07,.9);fxBall(B,'#ffb060',.04,.12,.1,.8);break;
    case'rail':fxBeam(A(.66),B,'#45c8ff',.14,.3);fxBeam(A(.66),B,'#ffffff',.05,.3);fxBall(B,'#9fe8ff',.1,.5,.25,.8);break;
    case'beam':fxBeam(A(1.66),B,'#7ff0ff',.08,.14);fxBall(B,'#bff8ff',.08,.2,.12,.6);break;
    case'wave':fxBeam(A(.59),B,'#ff3b2e',.34,.26);fxBeam(A(.59),B,'#ffffff',.1,.26);break;
    case'rocket':missiles.push({a:A(.9),b:B,r:f.r,t:0,m:null});break;
    case'boom':fxBeam(A(.84),B,'#ffd9a0',.04,.09);fxBall(B,'#ff8a2c',.2,f.r*.85,.32,.8);fxBall(B,'#fff0c0',.1,f.r*.4,.14,.9);break;
    case'ice':fxBeam(A(1.1),B,'#bff3ff',.06,.16);fxRing(B,'#9fe8ff',f.r,.42);fxBall(B,'#bff3ff',.1,f.r*.6,.3,.45);break;
    case'geers':fxBeam(A(1.25),B,'#ffc14a',.07,.12);fxBall(B,'#ff7a2c',.15,f.r*.6,.26,.55);break;
    case'snore':fxRing(B,'#7a4fd0',f.r,.8,.3);break;
    case'roar':fxRing(B,'#ff4a2a',f.r,.6,.55);fxBall(V(B.x,1.4,B.z),'#ffb060',.3,1.6,.3,.6);break;
    case'tox':fxBeam(A(1.04),B,'#8be85a',.05,.14);fxBall(B,'#5fc22e',.2,f.r*.9,.55,.5);break;
    case'bolt':{let p=V(ox+f.pts[0][0],1.46,oz+f.pts[0][1]);for(let i=1;i<f.pts.length;i++){const q=V(ox+f.pts[i][0],.38,oz+f.pts[i][1]);let a=p;
        for(let k=1;k<=3;k++){const u=k/3,j=k<3?.24:0,b=V(p.x+(q.x-p.x)*u+(Math.random()-.5)*j,p.y+(q.y-p.y)*u+(Math.random()-.5)*j,p.z+(q.z-p.z)*u+(Math.random()-.5)*j);fxBeam(a,b,'#cfefff',.06,.16);a=b;}
        fxBall(q,'#bfe9ff',.08,.3,.16,.8);p=q;}break;}
    case'die':fxBall(B,f.boss?'#ff8a2c':'#ffb070',.1,f.boss?2.2:.4,f.boss?.9:.28,.85);if(f.boss)fxRing(B,'#ffb060',3,.7);break;
    case'build':fxRing(B,'#ffc83a',.85,.5);fxBall(V(B.x,.5,B.z),'#ffe9a8',.1,.5,.3,.6);break;
  }}
function updFx(dt,time){
  for(let i=missiles.length-1;i>=0;i--){const s=missiles[i];s.t+=dt;const p=s.t/.26;
    if(p>=1){if(s.m){s.m.visible=false;pool.ball.push(s.m);}fxBall(s.b,'#ff7a2c',.25,s.r*.9,.4,.85);fxBall(s.b,'#fff0c0',.15,s.r*.45,.16,.95);fxRing(s.b,'#ffb060',s.r,.38);missiles.splice(i,1);continue;}
    if(!s.m){s.m=getFx('ball');s.m.material.color.set('#ffd28a');s.m.material.opacity=1;s.m.scale.setScalar(.12);}
    s.m.position.lerpVectors(s.a,s.b,p);s.m.position.y+=Math.sin(p*Math.PI)*1.6;}
  for(let i=live.length-1;i>=0;i--){const m=live[i],u=m.userData;u.t+=dt;const p=u.t/u.life;
    if(p>=1){m.visible=false;pool[u.kind].push(m);live.splice(i,1);continue;}
    if(u.kind==='beam'){const w=u.w*(1-p*.9);m.scale.set(w,w,u.L);}
    else{m.scale.setScalar(u.r0+(u.r1-u.r0)*(1-(1-p)*(1-p)));m.material.opacity=u.op*(1-p);}}
  const fc=focus();for(const f of fires){if(Math.abs(f.x-fc[0])+Math.abs(f.z-fc[1])>70){if(f.on!==false){f.on=false;for(const s of[...f.s,...f.sm])s.visible=false;}continue;}
    if(f.on===false){f.on=true;for(const s of[...f.s,...f.sm])s.visible=true;}
    f.s.forEach((s,i)=>{const p=(time*1.25+i/4+f.seed)%1;s.position.set(f.x+Math.sin(time*5+i*2+f.seed)*.08,f.y+p*f.size*1.6,f.z);const k=f.size*(1.5-p*.9);s.scale.set(k,k*1.3,1);s.material.opacity=(1-p)*.95;s.material.color.setHSL(.1-p*.08,1,.55-p*.15);});
    f.sm.forEach((s,i)=>{const p=(time*.33+i/2+f.seed)%1;s.position.set(f.x+p*1.2,f.y+f.size+p*3,f.z-p*.5);const k=f.size*(1.2+p*2.6);s.scale.set(k,k,1);s.material.opacity=.42*(1-p);});
    f.d.material.opacity=.26+.1*Math.sin(time*11+f.seed)+.05*Math.sin(time*23);}}

/* --- vestingen: eigen spel + andere spelers --- */
const ECODE={inf:'i',dog:'d',tank:'t',drone:'r',mech:'m',haz:'h',boss:'b'},EDEC=Object.fromEntries(Object.entries(ECODE).map(([k,v])=>[v,k]));
const b36=n=>Math.max(0,Math.min(1295,n)).toString(36).padStart(2,'0');
const encT=()=>G.tw.map(t=>b36(t.c)+ALL.indexOf(t.type).toString(36)+t.lvl.toString(36)+(t.spec?t.spec[0]:'n')).join('');
const encE=()=>G.en.slice(0,150).map(e=>ECODE[e.type]+b36(Math.round(e.d*10))+Math.max(0,Math.min(9,Math.ceil(e.hp/e.max*9)))+(e.fz>0?'f':e.pT>0?'p':'n')).join('');
// Weg in presence: tijdens de bouwfase 'P' + de wegvakken, daarna 'L' + de route op volgorde (gras = vak + 169).
const encP=()=>G.path?'L'+G.path.cells.map(c=>b36(c+(G.road.has(c)?0:N*N))).join(''):'P'+[...G.road].map(b36).join('');
const NOSET=new Set(),pcache=new Map();
function fieldPath(s){if(typeof s!=='string'||!s)return{road:NOSET,trail:NOSET,path:null};let o=pcache.get(s);if(o)return o;
  const road=new Set(),trail=new Set(),cells=[];
  for(let i=1;i+2<=s.length&&cells.length<N*N;i+=2){const v=parseInt(s.slice(i,i+2),36);if(!(v>=0&&v<2*N*N))continue;const c=v%(N*N);cells.push(c);(v<N*N?road:trail).add(c);}
  o={road,trail,path:s[0]==='L'&&cells.length?E.mkPath(cells,!trail.size):null};if(pcache.size>120)pcache.clear();pcache.set(s,o);return o;}
function decode(p){const pr=p.presence||{},fp=fieldPath(pr.pa),tw=[],en=[],s=typeof pr.tw==='string'?pr.tw:'',q=typeof pr.en==='string'?pr.en:'';
  for(let i=0;i+5<=s.length&&tw.length<170;i+=5){const k=parseInt(s.slice(i,i+2),36),type=ALL[parseInt(s[i+2],36)];if(!(k>=0&&k<N*N)||!type)continue;
    const x=k%N;tw.push({c:k,x:x+.5,y:(k-x)/N+.5,type,lvl:Math.min(E.maxLvl({type}),parseInt(s[i+3],36)||0),spec:{u:'ultra',t:'turbo',a:'awake',s:'spent'}[s[i+4]]||null,ang:null});}
  const el=Math.min(1.2,(performance.now()-(rx.get(p.peer)||0))/1000)*(pr.st==='playing'?Math.min(3,+pr.sp||1):0);
  for(let i=0;fp.path&&i+5<=q.length&&en.length<150;i+=5){const type=EDEC[q[i]];if(!type)continue;const fl=q[i+4];
    const d=parseInt(q.slice(i+1,i+3),36)/10+(fl==='f'?0:EN[type].sp*el*.85);if(!(d<fp.path.len))continue;const pp=E.posAt(fp.path,d);
    en.push({id:i,type,d,x:pp[0],y:pp[1],dx:pp[2],dy:pp[3],hp:(+q[i+3]||0)/9,max:1,boss:type==='boss',fz:fl==='f'?1:0,pT:fl==='p'?1:0});}
  for(const t of tw){let bd=11;for(const e of en){const dx=e.x-t.x,dy=e.y-t.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;t.ang=Math.atan2(dy,dx);t.tg=e;}}}
  const b=Array.isArray(pr.b)?{x:+pr.b[0]||0,y:+pr.b[1]||0,a:+pr.b[2]||0}:null;return{tw,en,builder:b,road:fp.road,trail:fp.trail};}
function fieldsNow(){const fs=[],used=new Set();
  if(G){let trail=G.trail;if(G.phase==='prep'){const pv=E.preview(G);if(pv.road)trail=NOSET;else{if(G.pvt!==pv){G.pvt=pv;G.pvs=new Set(pv.cells.filter(c=>!G.road.has(c)));}trail=G.pvs;}}
    fs.push({slot:mySlot,own:true,tw:G.tw,en:G.en,name:'Jij',r:G.round,l:G.lives,done:ended,road:G.road,trail,psig:'o'+G.rv});used.add(mySlot);}
  for(const p of peers){if(own(p)||p.bot||p.kind!=='viewer')continue;const pr=p.presence||{},sl=pr.sl;
    if((pr.st!=='playing'&&pr.st!=='done')||!Number.isInteger(sl)||sl<0||sl>=SLOTS||used.has(sl)||typeof pr.tw!=='string')continue;
    used.add(sl);const d=decode(p);fs.push({slot:sl,own:false,tw:d.tw,en:d.en,name:nameOf(p),r:+pr.r||1,l:+pr.l||0,done:pr.st==='done',road:d.road,trail:d.trail,psig:typeof pr.pa==='string'?pr.pa:''});}
  botFields(fs,used);return fs;}
const builderParts=()=>[bx(.52,.16,.32,'#b8901e',0,.2,0),bx(.2,.18,.26,'#2a2f35',.1,.36,0),bx(.44,.06,.06,'#2a2f35',-.08,.5,0,0,.5),bx(.2,.1,.3,'#8a6c16',-.18,.31,0),
    bx(.14,.14,.06,'#141414',.17,.09,.17),bx(.14,.14,.06,'#141414',-.17,.09,.17),bx(.14,.14,.06,'#141414',.17,.09,-.17),bx(.14,.14,.06,'#141414',-.17,.09,-.17)];
function makeBuilder(own){const g=new T3.Group();g.add(mesh(geo('builder',builderParts)));
  const b=new T3.Mesh(raw('beacon',()=>new T3.SphereGeometry(.06,8,6)),glow('#ff5a3c'));b.position.set(.1,.5,0);g.add(b);g.userData.b=b;
  if(own){const r=new T3.Mesh(raw('bring',()=>new T3.RingGeometry(.42,.48,32).rotateX(-Math.PI/2)),glow('#35cf4a'));r.position.y=.03;g.add(r);}return g;}
function bar(i,x,y,z,w,h,fr){dummy.quaternion.copy(camera.quaternion);dummy.position.set(x,y,z);dummy.scale.set(w+.05,h+.05,1);dummy.updateMatrix();hpBack.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x-cR.x*(1-fr)*w/2,y,z-cR.z*(1-fr)*w/2);dummy.scale.set(Math.max(.02,w*fr),h,1);dummy.updateMatrix();hpMesh.setMatrixAt(i,dummy.matrix);hpMesh.setColorAt(i,_c.set(fr>.5?'#35cf4a':fr>.25?'#f6cf4d':'#e8372a'));}
function heroShotFx(k,x,z,a,range){const A=V(x,.8,z),L=Math.min(range,6),B=V(x+Math.cos(a)*L,.5,z+Math.sin(a)*L);
  if(k==='gun')fxBeam(A,B,'#ffd98a',.04,.08);else if(k==='snipe'){fxBeam(A,B,'#ffe9b0',.08,.25);fxBeam(A,B,'#ffffff',.03,.25);}
  else if(k==='bolt')fxBeam(A,B,'#cfefff',.07,.16);else if(k==='flame'){for(let i=1;i<=3;i++)fxBall(V(x+Math.cos(a)*L*i/3,.6,z+Math.sin(a)*L*i/3),'#ff8a2c',.1,.35+i*.12,.3,.7);}
  else if(k==='slam'){fxRing(V(x,0,z),'#ffcf8a',1.9,.35);fxBall(V(x+Math.cos(a)*.8,.2,z+Math.sin(a)*.8),'#ffb060',.1,.7,.25,.7);}
  else fxRing(V(x+Math.cos(a)*.7,0,z+Math.sin(a)*.7),'#e6f0ff',.8,.18);}
function drawHeroes(time,dt,hp){
  if(G){const sig=save.hero+'_'+mySlot;if(heroSig!==sig){if(heroObj)scene.remove(heroObj);heroObj=makeHero(save.hero,mySlot);scene.add(heroObj);heroSig=sig;}
    heroObj.visible=true;heroObj.position.set(hero.x,0,hero.z);heroObj.rotation.y=-hero.a;animHero(heroObj,hero.walk,hero.atk);
    if((arena||hero.hp<maxHp()-.5)&&hp<900)bar(hp++,hero.x,1.5,hero.z,.9,.1,Math.max(0,hero.hp/maxHp()));}
  else if(heroObj)heroObj.visible=false;
  for(const r of rheroes.values()){const sig=r.idx+'_'+r.slot+'_'+r.name;
    if(r.sig!==sig){if(r.obj)scene.remove(r.obj);if(r.lab)scene.remove(r.lab);r.obj=makeHero(r.idx,r.slot);scene.add(r.obj);r.lab=nameSprite(r.name,'#'+TEAM[r.slot].getHexString());scene.add(r.lab);r.sig=sig;}
    const dx=r.tx-r.x,dz=r.tz-r.z,d=Math.hypot(dx,dz),k=Math.min(1,dt*9);r.x+=dx*k;r.z+=dz*k;if(d>.06)r.walk+=dt*10;else r.walk*=.8;r.a=r.ta;r.atk=Math.max(0,r.atk-dt*4);
    r.obj.position.set(r.x,0,r.z);r.obj.rotation.y=-r.a;animHero(r.obj,r.walk,r.atk);r.lab.position.set(r.x,1.75,r.z);
    if(r.shoot){r.shoot=false;heroShotFx(HEROES[r.idx].k,r.x,r.z,r.a,HEROES[r.idx].range);}
    if(r.ar>0&&hp<900)bar(hp++,r.x,1.5,r.z,.9,.1,Math.max(0,Math.min(1,r.hp/(r.mh||100))));}
  if(arena&&arena.g&&arena.g.hp>0&&arena.g.obj){const g=arena.g;g.obj.position.set(g.x,0,g.z);g.obj.rotation.y=-g.a;animHero(g.obj,g.walk,g.atk);if(hp<900)bar(hp++,g.x,g.by||2.1,g.z,g.bw||1.4,.12,Math.max(0,g.hp/g.max));}
  if(arena)hp=drawMission(time,hp);else hideMission();
  return hp;}
// gevarenzones van de baas, kogels en torens van het parcours, en het schild
const zoneM=[],shotM=[],safeM=[],markM=[],orbM=[],ringM=[],wedgeM=[],beamM=[],rectM=[],glowM=[];let shieldM=null,ultM=null,GOLDC=null,darkOn=false,darkL=null;
const flatMat=(col,op)=>new T3.MeshBasicMaterial({color:col,transparent:true,opacity:op==null?1:op,depthWrite:false,toneMapped:false,side:T3.DoubleSide});
const mkDisc=col=>new T3.Mesh(raw('disc64',()=>new T3.CircleGeometry(1,64).rotateX(-Math.PI/2)),flatMat(col));
// ring met een opening, en de taartpunt die de opening aanwijst; beide met de opening rond hoek 0
const ringGeo=w=>raw('ring'+w.toFixed(2),()=>new T3.RingGeometry(.93,1,72,1,w/2,TAU-w).rotateX(-Math.PI/2));
const wedgeGeo=w=>raw('wedge'+w.toFixed(2),()=>new T3.CircleGeometry(1,20,-w/2,w).rotateX(-Math.PI/2));
const hidePool=(arr,i)=>{for(;i<arr.length;i++)arr[i].visible=false;};
function hideMission(){if(ultM)ultM.visible=false;for(const p of[safeM,zoneM,shotM,markM,orbM,ringM,wedgeM,beamM,rectM,glowM])hidePool(p,0);if(shieldM)shieldM.visible=false;}
function drawMission(time,hp){const a=arena,u=a.ult;let zi=0,si=0,mi=0,oi=0,ri=0,wi=0,bi=0,gi2=0;
  if(a.marks)for(const k of a.marks){const m=poolMesh(markM,mi,()=>mkDisc('#ffffff'));m.material.color.set(k.col);m.material.opacity=k.op;m.position.set(k.x,k.y||.066+mi*.003,k.z);m.scale.setScalar(k.r);mi++;}
  hidePool(markM,mi);
  // rechthoeken op de grond (tegels, banen, platforms) en gloeiende balken (lasers)
  {let xi=0,qi=0;
    if(a.rects)for(const k of a.rects){const m=poolMesh(rectM,xi,()=>new T3.Mesh(raw('decal',()=>new T3.PlaneGeometry(1,1).rotateX(-Math.PI/2)),flatMat('#ffffff')));m.material.color.set(k.col);m.material.opacity=k.op==null?1:k.op;m.position.set(k.x,k.y||.054+xi*.0002,k.z);m.rotation.y=-(k.rot||0);m.scale.set(k.w,1,k.d);xi++;}
    hidePool(rectM,xi);
    if(a.glows)for(const k of a.glows){const m=poolMesh(glowM,qi++,()=>new T3.Mesh(raw('glowbox',()=>new T3.BoxGeometry(1,1,1)),new T3.MeshBasicMaterial({transparent:true,depthWrite:false,blending:T3.AdditiveBlending,toneMapped:false})));m.material.color.set(k.col);m.material.opacity=(k.op==null?.85:k.op)*(.9+.1*Math.sin(time*30));m.position.set(k.x,k.y||.5,k.z);m.rotation.y=-(k.rot||0);m.scale.set(k.w,k.h||.16,k.d||.16);}
    hidePool(glowM,qi);
    if(a.objs)for(const o of a.objs)for(const f of o.userData.anims||[])f(time);}
  if(a.zones)for(const z of a.zones){const m=poolMesh(zoneM,zi++,()=>new T3.Mesh(new T3.CircleGeometry(1,48).rotateX(-Math.PI/2),new T3.MeshBasicMaterial({color:'#ff3a24',transparent:true,depthWrite:false,toneMapped:false})));
    m.position.set(z.x,.075,z.z);m.scale.setScalar(z.r);m.material.opacity=.2+.4*(1-Math.max(0,z.t)/z.T)+.05*Math.sin(time*18);}
  hidePool(zoneM,zi);
  if(a.orbs)for(const o of a.orbs){const m=poolMesh(orbM,oi++,()=>new T3.Mesh(raw('fxball',()=>new T3.SphereGeometry(1,14,10)),new T3.MeshBasicMaterial({color:'#ffffff',toneMapped:false})));
    m.material.color.set(o.col);m.position.set(o.x,o.y+Math.sin(time*3+o.x)*.08,o.z);m.scale.setScalar(o.s);}
  hidePool(orbM,oi);
  if(u&&u.kind==='safe'){if(!ultM){ultM=mkDisc('#ff2a14');scene.add(ultM);}ultM.visible=true;ultM.position.set(ACX,.065,ACZ);ultM.scale.setScalar(9.1);ultM.material.opacity=.1+.45*(1-Math.max(0,u.t)/u.T);
    for(const o of u.safe){const m=poolMesh(safeM,gi2++,()=>mkDisc('#35ff5a'));m.position.set(o.x,.09,o.z);m.scale.setScalar(o.r);m.material.opacity=.6+.2*Math.sin(time*10);}}
  else if(ultM)ultM.visible=false;
  hidePool(safeM,gi2);
  if(u&&u.kind==='rings'){const el=u.T-u.t,hd=Math.hypot(hero.x-ACX,hero.z-ACZ);let nextR=null;
    for(const r of u.rings){const R=(el-r.t0)*4.2;if(R<hd&&!nextR)nextR=r;if(R<=.3||R>9.4)continue;
      const m=poolMesh(ringM,ri++,()=>new T3.Mesh(ringGeo(r.w),flatMat('#ff5a20',.9)));m.geometry=ringGeo(r.w);m.position.set(ACX,.11,ACZ);m.rotation.y=-r.g;m.scale.setScalar(R);}
    if(nextR){const m=poolMesh(wedgeM,wi++,()=>new T3.Mesh(wedgeGeo(nextR.w),flatMat('#35ff5a',.3)));m.geometry=wedgeGeo(nextR.w);m.position.set(ACX,.07,ACZ);m.rotation.y=-nextR.g;m.scale.setScalar(9.1);m.material.opacity=.26+.1*Math.sin(time*9);}}
  hidePool(ringM,ri);hidePool(wedgeM,wi);
  if(u&&u.kind==='beams'){const b=beamAng(u),on=u.T-u.t>1.5;
    for(let k=0;k<u.n;k++){const m=poolMesh(beamM,bi++,()=>new T3.Mesh(raw('beamgeo',()=>new T3.BoxGeometry(1,.3,1).translate(.5,0,0)),flatMat('#ff3a1a',.8)));
      m.position.set(ACX,.5,ACZ);m.rotation.y=-(b+k*TAU/u.n);m.scale.set(9.2,on?1:.25,on?1:.3);m.material.opacity=on?.75+.15*Math.sin(time*30):.3;}}
  hidePool(beamM,bi);
  if(a.shots)for(const o of a.shots){const m=poolMesh(shotM,si++,()=>new T3.Mesh(raw('fxball',()=>new T3.SphereGeometry(1,14,10)),glow('#ff7a3c')));m.position.set(RUN.x+o.x,.7,RUN.z+o.z);m.scale.setScalar(.16);}
  hidePool(shotM,si);
  if(a.tw)for(const t of a.tw){if(t.hp<=0||!t.obj)continue;t.obj.userData.head.rotation.y=-t.ang;if(t.hp<t.max&&hp<900)bar(hp++,RUN.x+t.x,1.6,RUN.z+t.z,.9,.1,t.hp/t.max);}
  if(!shieldM){shieldM=new T3.Mesh(raw('fxball',()=>new T3.SphereGeometry(1,14,10)),new T3.MeshBasicMaterial({color:'#59c8f2',transparent:true,opacity:.3,depthWrite:false,blending:T3.AdditiveBlending,toneMapped:false}));scene.add(shieldM);}
  shieldM.visible=shieldT>0;if(shieldT>0){shieldM.position.set(hero.x,.8,hero.z);shieldM.scale.setScalar(1.15+.05*Math.sin(time*14));}
  return hp;}
// monsters van een minigame: dezelfde modellen als de vijanden in de vesting
function drawMobs(time,hp){if(!GOLDC)GOLDC=new T3.Color('#ffd24a');
  for(const m of arena.mobs){if(m.hp<=0||(arena.dark&&Math.hypot(m.x-hero.x,m.z-hero.z)>arena.dark))continue;const I=EI[m.type];if(!I||I.n>=I.cap)continue;const i=I.n++,es=m.es||(m.big?2.1:1.45);
    dummy.position.set(m.x,m.type==='drone'?Math.sin(time*5+m.id)*.08:Math.abs(Math.sin(time*9+m.id))*.03,m.z);dummy.quaternion.identity();dummy.rotation.set(0,-m.a,0);dummy.scale.setScalar(es);dummy.updateMatrix();
    I.m.setMatrixAt(i,dummy.matrix);I.m.setColorAt(i,m.tint?_c.set(m.tint):m.gold?GOLDC:WHITE);
    if(!m.nobar&&hp<900)bar(hp++,m.x,ETOP[m.type]*es+.2,m.z,m.big?1.2:.7,.09,Math.max(0,Math.min(1,m.hp/m.max)));}
  return hp;}
// Stroomuitval: het licht gaat uit en alleen rond de held blijft een lichtkring over.
function setDark(on){if(!gl3||on===darkOn)return;darkOn=on;
  for(const o of scene.children)if(o.isLight&&o!==darkL){if(o.userData.i0==null)o.userData.i0=o.intensity;o.intensity=o.userData.i0*(on?.07:1);}
  scene.fog.near=on?5:55;scene.fog.far=on?26:150;scene.fog.color.set(on?'#010203':'#0a121c');scene.background.set(on?'#010203':'#070c14');
  if(on&&!darkL){darkL=new T3.PointLight('#ffe2b0',2.4,7.5,1.4);scene.add(darkL);}if(darkL)darkL.visible=on;}
function poolMesh(arr,i,mk){if(!arr[i]){arr[i]=mk();scene.add(arr[i]);}arr[i].visible=true;return arr[i];}
function render3D(time,dt){if(!gl3)return;
  if(camMode==='hero'){if(keys.q||keys.arrowleft)hcam.yaw+=1.9*dt;if(keys.e||keys.arrowright)hcam.yaw-=1.9*dt;}
  else{const kp=14*dt*(cam.d/25),f=[-Math.sin(cam.yaw),-Math.cos(cam.yaw)],r=[Math.cos(cam.yaw),-Math.sin(cam.yaw)];
    if(keys.arrowup){cam.tx+=f[0]*kp;cam.tz+=f[1]*kp;}if(keys.arrowdown){cam.tx-=f[0]*kp;cam.tz-=f[1]*kp;}
    if(keys.arrowright){cam.tx+=r[0]*kp;cam.tz+=r[1]*kp;}if(keys.arrowleft){cam.tx-=r[0]*kp;cam.tz-=r[1]*kp;}
    if(keys.q)cam.yaw+=1.6*dt;if(keys.e)cam.yaw-=1.6*dt;}
  camUpdate();sea.material.map.offset.set(time*.004,time*.003);setDark(!!(arena&&arena.dark));if(darkOn)darkL.position.set(hero.x,2.4,hero.z);
  const fs=fieldsNow(),seenT=new Set(),seenB=new Set();for(const k in EI)EI[k].n=0;let hp=0;updRoads(fs);
  cR.set(1,0,0).applyQuaternion(camera.quaternion);
  for(const fl of fs){const[ox,oz]=slotO(fl.slot);
    for(const t of fl.tw){const key=fl.slot*1000+t.c,sig=t.type+t.lvl+(t.spec||'');let o=tobj.get(key);
      if(!o||o.sig!==sig){if(o)scene.remove(o.g);o={g:makeTower(t.type,fl.slot,t.lvl,t.spec),sig};o.g.position.set(ox+t.x,0,oz+t.y);scene.add(o.g);tobj.set(key,o);}
      seenT.add(key);const u=o.g.userData;if(u.aim&&t.ang!=null)u.head.rotation.y=-t.ang;for(const a of u.anims)a(time);
      if(!fl.own&&!fl.bot&&t.tg&&t.type!=='uplink'&&Math.random()<dt*1.6)spawnFx({k:t.type==='rail'?'rail':t.type==='prism'?'beam':'shot',a:[t.x,t.y],b:[t.tg.x,t.tg.y]},ox,oz);}
    for(const e of fl.en){const I=EI[e.type];if(!I||I.n>=I.cap)continue;const i=I.n++,es=e.big?1.6:1.25;
      const bob=e.type==='drone'?Math.sin(time*5+e.id)*.08:e.type==='boss'?Math.sin(time*1.4)*.06:e.fz>0?0:Math.abs(Math.sin(time*9+e.id))*.03;
      dummy.position.set(ox+e.x,bob,oz+e.y);dummy.quaternion.identity();dummy.rotation.set(0,-Math.atan2(e.dy||0,e.dx||1),0);dummy.scale.setScalar(es);dummy.updateMatrix();
      I.m.setMatrixAt(i,dummy.matrix);I.m.setColorAt(i,e.fz>0?ICE:e.pT>0?TOXC:WHITE);
      const fr=Math.max(0,Math.min(1,e.hp/e.max));
      if((fr<1||e.boss)&&hp<900){const w=e.boss?1.7:.62,h=e.boss?.14:.08,y=ETOP[e.type]*es;dummy.quaternion.copy(camera.quaternion);
        dummy.position.set(ox+e.x,y,oz+e.y);dummy.scale.set(w+.05,h+.05,1);dummy.updateMatrix();hpBack.setMatrixAt(hp,dummy.matrix);
        dummy.position.set(ox+e.x-cR.x*(1-fr)*w/2,y,oz+e.y-cR.z*(1-fr)*w/2);dummy.scale.set(Math.max(.02,w*fr),h,1);dummy.updateMatrix();
        hpMesh.setMatrixAt(hp,dummy.matrix);hpMesh.setColorAt(hp,_c.set(fr>.5?'#35cf4a':fr>.25?'#f6cf4d':'#e8372a'));hp++;}}
  }
  hp=drawHeroes(time,dt,hp);if(arena&&arena.mobs)hp=drawMobs(time,hp);
  for(const[k,o]of tobj)if(!seenT.has(k)){scene.remove(o.g);tobj.delete(k);}
  for(const[k,b]of bobj)if(!seenB.has(k)){scene.remove(b);bobj.delete(k);}
  for(const k in EI){const I=EI[k];I.m.count=I.n;I.m.instanceMatrix.needsUpdate=true;if(I.m.instanceColor)I.m.instanceColor.needsUpdate=true;}
  hpMesh.count=hpBack.count=hp;hpMesh.instanceMatrix.needsUpdate=hpBack.instanceMatrix.needsUpdate=true;if(hpMesh.instanceColor)hpMesh.instanceColor.needsUpdate=true;
  hoverM.visible=rangeM.visible=selM.visible=gateIn.visible=gateOut.visible=false;let gi=0,li=0;
  if(G&&!ended){const[ox,oz]=slotO(mySlot);
    if(G.phase==='prep'){const sc=1.9+.35*Math.sin(time*4);gateIn.visible=gateOut.visible=true;gateIn.position.set(ox+.5,.05,oz+E.MID+.5);gateOut.position.set(ox+N-.5,.05,oz+E.MID+.5);gateIn.scale.setScalar(sc);gateOut.scale.setScalar(sc);}
    const showRange=(x,y,rg)=>{rg=Math.min(rg,9.5);rangeM.visible=selM.visible=true;rangeM.position.set(ox+x,.06,oz+y);rangeM.scale.setScalar(rg);selM.position.set(ox+x,.05,oz+y);selM.scale.setScalar(rg);};
    if(sel&&sel.s)showRange(sel.x,sel.y,sel.s.range);
    if(hover>=0){const x=hover%N,y=(hover-x)/N,tool=roadMode||!!buildSel,ok=roadMode?E.canRoad(G,hover):!!buildSel&&E.canBuild(G,hover,buildSel);hoverM.visible=true;hoverM.position.set(ox+x+.5,.04,oz+y+.5);hoverM.scale.setScalar(buildSel&&!roadMode?T[buildSel].size||1:1);
      hoverM.material.color.set(tool?(ok?'#35cf4a':'#e8372a'):'#ffffff');hoverM.material.opacity=tool?.5:.16;
      if(buildSel&&ok)showRange(x+.5,y+.5,T[buildSel].range*G.m.range);}
    for(const o of orders){const x=o.c%N,m=poolMesh(ghosts,gi++,()=>new T3.Mesh(new T3.CylinderGeometry(.42,.42,.9,8),new T3.MeshBasicMaterial({color:'#f6cf4d',wireframe:true,toneMapped:false})));m.position.set(ox+x+.5,.45,oz+(o.c-x)/N+.5);m.rotation.y=time;m.scale.set(T[o.type].size||1,1,T[o.type].size||1);}
  }
  for(;gi<ghosts.length;gi++)ghosts[gi].visible=false;for(;li<links.length;li++)links[li].visible=false;
  updFx(dt,time);renderer.render(scene,camera);return fs;}

/* --- iconen: 3D-portretten van turrets, getekende symbolen voor commando's --- */
const ICON={};
function renderIcons(){if(!T3)return;let r;try{r=new T3.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch{return;}
  r.setSize(256,216,false);r.outputEncoding=T3.sRGBEncoding;r.toneMapping=T3.ACESFilmicToneMapping;r.toneMappingExposure=1.3;
  const sc=new T3.Scene(),c=new T3.PerspectiveCamera(30,128/108,.1,20);c.position.set(2.1,2.3,2.6);c.lookAt(0,.68,0);
  sc.add(new T3.HemisphereLight('#9fb4e6','#2b2432',.8));const d=new T3.DirectionalLight('#ffd0a0',1.9);d.position.set(-3,4,2);sc.add(d);
  const shot=(k,o)=>{sc.add(o);r.render(sc,c);sc.remove(o);const cv=document.createElement('canvas');cv.width=256;cv.height=216;cv.getContext('2d').drawImage(r.domElement,0,0,256,216);ICON[k]=cv;};
  for(const type of ALL){const t=makeTower(type,SLOTS,0,null);t.userData.head.rotation.y=type==='uplink'?0:.5;if(type==='sleeper'){t.scale.setScalar(.42);for(const a of t.userData.anims)a(1.9);}shot(type,t);}
  HEROES.forEach((h,i)=>{const o=makeHero(i,SLOTS);o.scale.setScalar(1.45);o.rotation.y=.75;o.position.y=-.1;animHero(o,.5,0);shot('hero'+i,o);});
  r.dispose();if(r.forceContextLoss)r.forceContextLoss();}
function iconDraw(cv,ic){const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.clearRect(0,0,W,H);
  const bg=g.createRadialGradient(W/2,H*.45,2,W/2,H/2,W*.75);bg.addColorStop(0,'#3a4a66');bg.addColorStop(1,'#0a0e16');g.fillStyle=bg;g.fillRect(0,0,W,H);
  if(ICON[ic]){const s=Math.max(W/104,H/100),q=ICON[ic].width/128;g.drawImage(ICON[ic],12*q,4*q,104*q,100*q,(W-104*s)/2,(H-100*s)/2,104*s,100*s);}
  else{g.save();g.translate(W/2,H/2);g.scale(W/64,W/64);g.lineCap='round';g.lineJoin='round';
    if(ic==='up'){g.strokeStyle='#f6cf4d';g.lineWidth=7;for(const y of[-8,6]){g.beginPath();g.moveTo(-15,y+10);g.lineTo(0,y-6);g.lineTo(15,y+10);g.stroke();}}
    else if(ic==='shield'){g.beginPath();g.moveTo(0,-22);g.lineTo(18,-14);g.lineTo(16,6);g.quadraticCurveTo(10,18,0,23);g.quadraticCurveTo(-10,18,-16,6);g.lineTo(-18,-14);g.closePath();g.fillStyle='#1f6f94';g.fill();g.strokeStyle='#9fe8ff';g.lineWidth=3;g.stroke();g.beginPath();g.moveTo(0,-13);g.lineTo(0,14);g.moveTo(-10,-3);g.lineTo(10,-3);g.lineWidth=2;g.stroke();}
    else if(ic==='road'){g.beginPath();g.moveTo(-27,13);g.bezierCurveTo(-4,13,-8,-12,10,-12);g.lineTo(27,-12);g.strokeStyle='#15100c';g.lineWidth=18;g.stroke();g.strokeStyle='#8a5a44';g.lineWidth=13;g.stroke();g.strokeStyle='#f6cf4d';g.lineWidth=2;g.setLineDash([5,5]);g.stroke();g.setLineDash([]);}
    else if(ic==='ultra'){g.fillStyle='#b56bff';g.strokeStyle='#f1e2ff';g.lineWidth=1.5;g.beginPath();for(let i=0;i<10;i++){const an=-Math.PI/2+i*Math.PI/5,r=i%2?9:22;g.lineTo(Math.cos(an)*r,Math.sin(an)*r);}g.closePath();g.fill();g.stroke();}
    else if(ic==='wake'){g.fillStyle='#ffd23a';g.beginPath();g.moveTo(-6,-20);g.quadraticCurveTo(-14,-20,-14,-4);g.lineTo(-14,6);g.lineTo(-19,12);g.lineTo(19,12);g.lineTo(14,6);g.lineTo(14,-4);g.quadraticCurveTo(14,-20,6,-20);g.closePath();g.fill();g.beginPath();g.arc(0,16,4,0,7);g.fill();g.strokeStyle='#fff3c4';g.lineWidth=3;for(const sx of[-1,1]){g.beginPath();g.arc(0,-2,25,sx<0?Math.PI+.35:-.35,sx<0?Math.PI-.35:.35,sx>0);g.stroke();}}
    else if(ic==='push'){g.strokeStyle='#ffe9a8';g.lineWidth=5;g.beginPath();g.arc(-14,0,7,0,7);g.stroke();for(const y of[-12,0,12]){g.beginPath();g.moveTo(0,y*.6);g.lineTo(18,y);g.moveTo(11,y-5+y*.1);g.lineTo(19,y);g.lineTo(11,y+5+y*.1);g.stroke();}}
    else if(ic==='sprint'){g.strokeStyle='#ffd23a';g.lineWidth=6;for(const x of[-14,-1,12]){g.beginPath();g.moveTo(x-6,-14);g.lineTo(x+7,0);g.lineTo(x-6,14);g.stroke();}}
    else if(ic==='link'){g.strokeStyle='#59c8f2';g.lineWidth=6;g.beginPath();g.ellipse(-8,0,12,9,0,0,7);g.stroke();g.beginPath();g.ellipse(8,0,12,9,0,0,7);g.stroke();}
    else if(ic==='turbo'){g.fillStyle='#ff8a2a';g.beginPath();g.moveTo(6,-22);g.lineTo(-14,4);g.lineTo(-2,4);g.lineTo(-7,22);g.lineTo(14,-5);g.lineTo(2,-5);g.closePath();g.fill();g.strokeStyle='#fff0b0';g.lineWidth=1.5;g.stroke();}
    else if(ic==='sell'){for(const y of[10,3,-4]){g.fillStyle='#8a5a08';g.beginPath();g.ellipse(0,y+3,17,7,0,0,7);g.fill();g.fillStyle='#e6a91e';g.beginPath();g.ellipse(0,y,17,7,0,0,7);g.fill();}g.fillStyle='#fff3b0';g.beginPath();g.ellipse(-3,-6,7,2.5,0,0,7);g.fill();}
    else if(ic==='cancel'){g.strokeStyle='#e8372a';g.lineWidth=8;g.beginPath();g.moveTo(-14,-14);g.lineTo(14,14);g.moveTo(14,-14);g.lineTo(-14,14);g.stroke();}
    else if(ic==='back'){g.strokeStyle='#c9cdd4';g.lineWidth=7;g.beginPath();g.moveTo(14,12);g.lineTo(14,-4);g.lineTo(-12,-4);g.moveTo(-3,-14);g.lineTo(-13,-4);g.lineTo(-3,6);g.stroke();}
    else if(ic.startsWith('arm')){const st=g.createLinearGradient(0,-18,0,18);st.addColorStop(0,'#dfe6ee');st.addColorStop(1,'#6a7380');g.fillStyle=st;g.strokeStyle='#f6cf4d';g.lineWidth=2.5;g.beginPath();
      if(ic==='arm0'){g.arc(0,2,17,Math.PI,0);g.lineTo(17,12);g.lineTo(6,12);g.lineTo(6,4);g.lineTo(-6,4);g.lineTo(-6,12);g.lineTo(-17,12);g.closePath();}
      else if(ic==='arm1'){g.moveTo(-18,-14);g.lineTo(-7,-17);g.lineTo(0,-12);g.lineTo(7,-17);g.lineTo(18,-14);g.lineTo(13,17);g.lineTo(-13,17);g.closePath();}
      else if(ic==='arm2'){g.moveTo(-10,-16);g.lineTo(10,-16);g.lineTo(12,4);g.lineTo(14,16);g.lineTo(-14,16);g.lineTo(-12,4);g.closePath();}
      else{g.moveTo(-9,-17);g.lineTo(4,-17);g.lineTo(4,5);g.lineTo(17,9);g.lineTo(17,17);g.lineTo(-9,17);g.closePath();}
      g.fill();g.stroke();}
    g.restore();}
  g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=2;g.strokeRect(1,1,W-2,H-2);}

/* --- minimap en wereld-UI --- */
const MW=COLS*FW+2,MH=ROWS*FW+26,MX=-4,MZ=-3;
function drawMini(fs){const cv=$('#mini'),g=cv.getContext('2d'),k=cv.width/MW,by=new Map(fs.map(f=>[f.slot,f]));
  g.fillStyle='#071620';g.fillRect(0,0,cv.width,cv.height);const X=x=>(x-MX)*k,Z=z=>(z-MZ)*k;
  for(let s=0;s<SLOTS;s++){const[ox,oz]=slotO(s),f=by.get(s),col='#'+TEAM[s].getHexString();
    g.fillStyle=f?'#2f3d26':'#1c2620';g.fillRect(X(ox),Z(oz),N*k,N*k);
    if(f){g.fillStyle='#4f4632';for(const c of f.trail){const x=c%N;g.fillRect(X(ox+x),Z(oz+(c-x)/N),k+.5,k+.5);}g.fillStyle='#8a5a44';for(const c of f.road){const x=c%N;g.fillRect(X(ox+x),Z(oz+(c-x)/N),k+.5,k+.5);}}
    g.strokeStyle=f?col:'#39414c';g.lineWidth=f&&f.own?3:1.5;g.strokeRect(X(ox)-1,Z(oz)-1,N*k+2,N*k+2);
    if(f){g.fillStyle=col;for(const t of f.tw)g.fillRect(X(ox+t.x)-2.5,Z(oz+t.y)-2.5,5,5);g.fillStyle='#ff4034';for(const e of f.en)g.fillRect(X(ox+e.x)-1.5,Z(oz+e.y)-1.5,e.boss?6:3,e.boss?6:3);}}
  g.fillStyle='#3a3226';g.strokeStyle=arena?'#f6cf4d':'#7a6a48';g.lineWidth=2;g.beginPath();g.arc(X(ACX),Z(ACZ),9.5*k,0,7);g.fill();g.stroke();g.fillRect(X(RUN.x),Z(RUN.z),RUN.L*k,RUN.W*k);g.strokeRect(X(RUN.x),Z(RUN.z),RUN.L*k,RUN.W*k);
  for(const r of rheroes.values()){g.fillStyle='#'+TEAM[r.slot].getHexString();g.strokeStyle='#fff';g.lineWidth=1;g.beginPath();g.arc(X(r.x),Z(r.z),4,0,7);g.fill();g.stroke();}
  if(G){g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=1.5;g.beginPath();g.arc(X(hero.x),Z(hero.z),5,0,7);g.fill();g.stroke();}
  if(gl3){const pts=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([x,y])=>groundAt(x,y));if(pts.every(Boolean)){g.strokeStyle='#fff';g.lineWidth=1.5;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p.x),Z(p.z)):g.moveTo(X(p.x),Z(p.z)));g.closePath();g.stroke();}}}
function miniGo(ev){const cv=$('#mini'),r=cv.getBoundingClientRect();if(camMode==='hero'){camMode='free';cam.d=30;cam.yaw=0;}cam.tx=MX+(ev.clientX-r.left)/r.width*MW;cam.tz=MZ+(ev.clientY-r.top)/r.height*MH+cam.d*.1;}
function updWorldUi(fs){if(!fs)return;const by=new Map(fs.map(f=>[f.slot,f]));
  if(gl3)for(let s=0;s<SLOTS;s++){const f=by.get(s);labelDraw(labels[s],f?f.name:'Vrije vesting',f?(f.done?'Uitgespeeld · ronde '+f.r:`Ronde ${f.r} · ${f.l} levens`):'','#'+TEAM[s].getHexString());labels[s].spr.material.opacity=f?1:.45;}
  if(TEAM.length)drawMini(fs);
  const ul=$('#qPlayers'),top=[...fs].sort((a,b)=>b.r-a.r).slice(0,6),sig=top.map(f=>f.slot+':'+f.name+':'+f.r).join();
  if(ul.dataset.k!==sig){ul.dataset.k=sig;ul.textContent='';for(const f of top){const li=document.createElement('li'),a=document.createElement('span'),b=document.createElement('b');a.textContent=f.name;if(TEAM[f.slot])a.style.color='#'+TEAM[f.slot].getHexString();b.textContent=f.r;b.className='num';li.append(a,b);ul.append(li);}}}

/* ================= spel ================= */
let toastT=0;
function toast(msg,ms){const t=$('#toast');t.textContent=msg+toastAdd;toastAdd='';t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,ms||2400);}
function setText(el,v){if(el.textContent!==v)el.textContent=v;}
function takenSlots(){const s=new Set();for(const p of peers){if(own(p))continue;const pr=p.presence||{};if(pr.st!=='playing'&&pr.st!=='done')continue;if(Number.isInteger(pr.sl))s.add(pr.sl);if(Array.isArray(pr.bs))for(const v of pr.bs)if(Number.isInteger(v))s.add(v);}return s;}
function freeSlot(idx){const t=takenSlots(),free=[];for(let i=0;i<SLOTS;i++)if(!t.has(i))free.push(i);return free.length?free[(idx||0)%free.length]:0;}
let waveTotal=1,nextRound=0;
// solo: je begint alleen, dus acht bots doen mee
function beginGame(idx,mid,solo){closePops();clearBots();mySlot=freeSlot(idx);E.tune(gameCfg);G=E.create(save.skills,save.diff);HM=G.m;gamePts=0;toastAdd='';G.fxOn=true;G.maxLives=G.lives;orders=[];sel=null;buildSel=null;ended=false;speed=1;
  matchId=mid||Date.now();myBm=0;myBh=0;msLast=null;finalMax=0;finalAt=0;built=false;nx=0;sentWave=0;arenaFor=0;roadMode=false;t0=performance.now();prepEnd=t0+E.PREP*1000;
  {const[ox,oz]=slotO(mySlot);hero={x:ox+6.5,z:oz+5.5,a:-1.57,hp:0,cd:0,atk:0,walk:0,tx:null,tz:null,moving:false};}armour=0;arena=null;camMode='hero';hero.hp=maxHp();hcam.yaw=0;hcam.pitch=.62;hcam.d=stage.clientWidth<760?13:10;myState='playing';ready=false;
  $('#home').hidden=true;$('#game').hidden=false;$('#result').hidden=true;
  document.querySelectorAll('#speed button').forEach(b=>b.classList.toggle('on',b.dataset.s==='1'));
  $('#nogl').hidden=gl3;resize();cam.d=stage.clientWidth<760?46:24;cam.yaw=0;camHome();nextRound=0;if(solo)spawnBots();refresh();pushPresence(true);
  iconDraw($('#heroCv'),'hero'+save.hero);
  setText($('#hScoreL'),G.D.score>1?'Score '+mulText(G.D.score):'Score');$('#hScoreL').parentNode.title=`Score · ${G.D.n}`+(G.D.score>1?`, alles wat je scoort telt ${mulText(G.D.score)}`:'');
  if(G.diff)toast(`${G.D.n}: taaiere vijanden, score ${mulText(G.D.score)}`,3600);}
function endGame(){ended=true;const won=G.phase==='won';
  save.games++;save.best=Math.max(save.best,G.score);persist();
  if(acct&&Net.hasToken())Net.api('POST','/scores',{score:G.score,round:G.cleared,won}).catch(authFail);
  myState='done';pushPresence(true);
  setText($('#rTitle'),won?'Overwinning':G.final?'De Titaan wint':'Basis gevallen');
  setText($('#rText'),won?`Alle ${ROUNDS} golven afgeslagen en de Titaan is geveld. Het hoofdkwartier staat nog.`:G.final?`Alle ${ROUNDS} golven afgeslagen, maar de Titaan bleef overeind.${save.pts?' Besteed je skillpunten en probeer het opnieuw.':' Probeer het opnieuw.'}`:`Je hield stand tot en met ronde ${G.cleared}.${save.pts?' Besteed je skillpunten en probeer het opnieuw.':' Probeer het opnieuw.'}`);
  setText($('#rDiff'),G.D.n+(G.D.score>1?' · score '+mulText(G.D.score):''));
  setText($('#rRound'),G.cleared+'/'+ROUNDS);setText($('#rScore'),fmt(G.score));setText($('#rXp'),'+'+gamePts);$('#result').hidden=false;}
function toLobby(){if(arena)labClear(arena);arena=null;if(lab){lab=null;$('#labEnd').hidden=true;$('#game').classList.remove('lab');setText($('#quitBtn'),'Opgeven');}G=null;clearBots();myState='lobby';ready=false;$('#result').hidden=true;$('#game').hidden=true;$('#home').hidden=false;
  if(room)room.presence({st:'lobby',rd:false,df:save.diff,tw:null,en:null,b:null,go:null,sl:null,p:null,ar:null,pu:null,dm:null,mt:null,bd:null,ps:null,cl:null,nx:null,sw:null,pa:null,am:null,bm:null,bh:null,bp:null,ba:null,ms:null,mg:null,sd:null,sc:null,dn:null,kb:null,wn:null,bs:null}).catch(()=>{});renderHome();renderLobby();}
function events(){const[ox,oz]=slotO(mySlot);for(const e of G.ev){
    if(e.k==='clear'){award(E.pointsFor(e.r));toast(`Ronde ${e.r} afgeslagen · +${fmt(e.bonus)} credits`);}
    else if(e.k==='wave'&&e.r%10===0)toast('Een luchtschip nadert de vesting');
    else if(e.k==='wake')toast(e.on?`De Slapende Geers is wakker! ${E.WAKE.time} seconden lang ${E.WAKE.mul}× zo sterk.`:'De Slapende Geers valt weer in slaap. Voorgoed.',3500);
    else if(e.k==='leak'){stage.classList.add('leak');setTimeout(()=>stage.classList.remove('leak'),300);}}
  G.ev.length=0;if(gl3&&!document.hidden)for(const f of G.fx)spawnFx(f,ox,oz);G.fx.length=0;}
/* --- samen spelen: bouwfase, snelheid en rondes lopen gelijk --- */
// De andere spelers in mijn potje die nog meedoen.
function mates(){return peers.filter(p=>!own(p)&&p.kind==='viewer'&&p.presence&&p.presence.mt===matchId&&p.presence.st==='playing');}
// Speler 1 is wie het langst in de lobby was. Geeft null als ik dat zelf ben. Valt speler 1 af, dan schuift de volgende door.
function lead(){let b=null;const rk=p=>+p.presence.t||0;for(const p of mates())if(!b||rk(p)<rk(b)||(rk(p)===rk(b)&&p.peer<b.peer))b=p;
  if(!b)return null;return rk(b)<myT||(rk(b)===myT&&(!myPeer||b.peer<myPeer))?b:null;}
function endPrep(){if(!G||G.phase!=='prep')return;E.lock(G);roadMode=false;built=true;pushPresence(true);
  toast(G.path.road?'De bouwfase is voorbij. De vijand volgt jouw weg.':'De bouwfase is voorbij. Zonder doorlopende weg steekt de vijand het gras over.');refresh();}
function sync(){const now=performance.now(),ms=mates(),L=lead(),settled=!room||now-t0>4000;
  if(L){const sp=Math.max(1,Math.min(3,Math.round(+L.presence.sp)||1));if(sp!==speed){speed=sp;paintSpeed();}}
  if(G.phase==='prep'){G.timer=Math.max(0,(prepEnd-now)/1000);
    // na vijf minuten, zodra iemand anders al gestart is, of eerder als iedereen klaar is met bouwen
    if(G.timer<=0||(settled&&ms.some(p=>p.presence.ps===1))||(built&&settled&&ms.every(p=>p.presence.bd===true)))endPrep();}
  else if(G.phase==='wait'){const r=G.cleared;if(!ms.every(p=>(+p.presence.cl||0)>=r))return;
    {const md=MINI[r];if(md&&arenaFor<r){arenaFor=r;enterArena(md,r);return;}}
    if(arena)return;if(G.final){finalWatch();return;}nx=G.round;if(ms.every(p=>(+p.presence.nx||0)>=G.round))E.next(G);}
  else if(G.phase==='build'&&L&&+L.presence.sw===G.round)E.startWave(G);}
function waveAct(){if(!G||ended||arena)return;
  if(G.phase==='prep'){built=!built;pushPresence(true);return;}
  if(G.phase!=='build')return;if(lead()){toast('Alleen speler 1 kan de golf eerder sturen');return;}
  sentWave=G.round;E.startWave(G);pushPresence(true);}
function paintSpeed(){const L=G&&!ended?lead():null;document.querySelectorAll('#speed button').forEach(b=>{b.classList.toggle('on',+b.dataset.s===speed);b.disabled=!!L;
    b.title=L?'Alleen speler 1 kiest de snelheid':'Snelheid voor alle spelers';});}
/* --- weg leggen: slepen over de eigen vesting --- */
function roadSet(c,on){if(orders.some(o=>o.c===c))return;E.setRoad(G,c,on);}
function paintTo(c,on){const pc=paintLast;paintLast=c;if(pc<0||pc===c){roadSet(c,on);return;}
  let x=pc%N,y=(pc-x)/N;const tx=c%N,ty=(c-tx)/N; // tussenliggende vakken meenemen, zodat de weg aaneengesloten blijft
  while(x!==tx||y!==ty){if(Math.abs(tx-x)>=Math.abs(ty-y))x+=Math.sign(tx-x);else y+=Math.sign(ty-y);roadSet(y*N+x,on);}}
function roadTool(){roadMode=!roadMode;buildSel=null;sel=null;if(roadMode){camMode='free';cam.yaw=0;cam.d=stage.clientWidth<760?44:23;camTo(mySlot);}}
/* --- held: lopen, botsen, aanvallen --- */
function walkable(x,z){if(arena&&arena.block&&arena.block(x,z))return false;if(Math.hypot(x-ACX,z-ACZ)<=AR)return true;if(runFree(x-RUN.x,z-RUN.z))return true;
  const c=Math.floor((x+3.5)/FW),r=Math.floor((z+3.5)/FW);if(c<0||r<0||c>=COLS||r>=ROWS)return false;const lx=x-c*FW,lz=z-r*FW;
  if(lx>=-.15&&lx<=13.15&&lz>=-.15&&lz<=13.15)return true;
  if(lz>=5.85&&lz<=7.15&&((lx>13&&c<COLS-1)||(lx<0&&c>0)))return true;
  if(lx>=7.85&&lx<=9.15&&((lz>13&&r<ROWS-1)||(lz<0&&r>0)))return true;return false;}
function towerAt(x,z){if(!G)return false;const[ox,oz]=slotO(mySlot),lx=x-ox,lz=z-oz,cx=Math.floor(lx),cz=Math.floor(lz);if(cx<0||cz<0||cx>=N||cz>=N)return false;
  const t=G.map[cz*N+cx];return!!t&&Math.hypot(lx-t.x,lz-t.y)<(t.size>1?t.size*.47:.5);}
function stepHero(dx,dz,manual){const h=hero,ok=(x,z)=>walkable(x,z)&&!(manual&&towerAt(x,z)&&!towerAt(h.x,h.z));
  if(ok(h.x+dx,h.z+dz)){h.x+=dx;h.z+=dz;return true;}if(ok(h.x+dx,h.z)){h.x+=dx;return true;}if(ok(h.x,h.z+dz)){h.z+=dz;return true;}return false;}
function updHero(dt){sprintT=Math.max(0,sprintT-dt);sprintCd=Math.max(0,sprintCd-dt);pushCd=Math.max(0,pushCd-dt);
  const h=hero,H=HEROES[save.hero],v1=H.spd*HM.hSpd*(armour>=4?1.2:1)*(arena&&arena.slow||1)*(arena&&sprintT>0?1+E.MOVES.sprSpd+HM.sprSpd:1),sp=v1*dt,yaw=camMode==='hero'?hcam.yaw:cam.yaw,f=[-Math.sin(yaw),-Math.cos(yaw)],r=[Math.cos(yaw),-Math.sin(yaw)];
  let fw=joy.y,rt=joy.x;if(keys.w||(camMode==='hero'&&keys.arrowup))fw+=1;if(keys.s||(camMode==='hero'&&keys.arrowdown))fw-=1;if(keys.d)rt+=1;if(keys.a)rt-=1;
  if(arena&&arena.flip){fw=-fw;rt=-rt;} // spiegelwereld: de besturing staat omgekeerd
  const kx=f[0]*fw+r[0]*rt,kz=f[1]*fw+r[1]*rt,kl=Math.hypot(kx,kz);h.moving=false;
  if(arena&&arena.ice){ // ijs: de held komt traag op gang en glijdt door
    let wx=0,wz=0;if(kl>.05){camMode='hero';const m=Math.min(1,kl);wx=kx/kl*m;wz=kz/kl*m;h.tx=null;}
    else if(h.tx!=null){const dx=h.tx-h.x,dz=h.tz-h.z,d=Math.hypot(dx,dz);if(d<.5)h.tx=null;else{wx=dx/d;wz=dz/d;}}
    const k=Math.min(1,arena.ice*dt);h.vx=(h.vx||0)+(wx*v1-(h.vx||0))*k;h.vz=(h.vz||0)+(wz*v1-(h.vz||0))*k;
    if(!stepHero(h.vx*dt,h.vz*dt,true)){h.vx*=-.3;h.vz*=-.3;}
    if(wx||wz){h.a=Math.atan2(wz,wx);h.moving=true;}}
  else if(kl>.05){camMode='hero';const m=Math.min(1,kl);stepHero(kx/kl*sp*m,kz/kl*sp*m,true);h.a=Math.atan2(kz,kx);h.tx=null;h.moving=true;}
  else{let tg=null;const o=arena?null:orders[0];
    if(o){const[ox,oz]=slotO(mySlot),x=o.c%N;tg=[ox+x+.5,oz+(o.c-x)/N+.5];}else if(h.tx!=null)tg=[h.tx,h.tz];
    if(tg){const dx=tg[0]-h.x,dz=tg[1]-h.z,d=Math.hypot(dx,dz);
      if(o&&d<1.6){orders.shift();const t=E.build(G,o.c,o.type);if(t){G.fx.push({k:'build',a:[t.x,t.y],b:[t.x,t.y]});h.atk=1;}else toast(!E.unlocked(G,o.type)?T[o.type].n+' is niet meer vrijgespeeld':E.canBuild(G,o.c,o.type)?'Te weinig credits voor '+T[o.type].n:'Hier kun je niet meer bouwen');}
      else if(d<=sp){if(walkable(tg[0],tg[1])){h.x=tg[0];h.z=tg[1];}h.tx=null;}
      else{h.a=Math.atan2(dz,dx);h.moving=true;if(!stepHero(dx/d*sp,dz/d*sp,false)){h.tx=null;if(o){orders.shift();toast('Je held kan daar niet komen');}}}}}
  if(h.moving)h.walk+=dt*H.spd*2.1;else h.walk*=.8;h.atk=Math.max(0,h.atk-dt*4);
  if(!arena&&h.hp<maxHp())h.hp=Math.min(maxHp(),h.hp+maxHp()*.06*dt);
  if(arena&&HM.hRegen&&h.hp>0&&h.hp<maxHp())h.hp=Math.min(maxHp(),h.hp+maxHp()*HM.hRegen*dt);
  heroAttack(dt);}
const heroScale=()=>Math.pow(E.hpMul(G.round)/E.hpMul(1),.75);
function heroAttack(dt){const h=hero,H=HEROES[save.hero],HR=H.range*HM.hRange,rate=H.rate*HM.hRate;h.cd-=dt*(arena?1:speed);if(h.cd>0)return;const ts=[];
  if(arena){const a=arena; // helden kunnen elkaar niet raken: alleen de baas, monsters en torens zijn een doelwit
    if(a.g&&a.g.hp>0)ts.push({x:a.g.x,z:a.g.z,g:a.g,big:a.B?a.B.big:0});
    if(a.mobs)for(const m of a.mobs)if(m.hp>0&&!m.pass)ts.push({x:m.x,z:m.z,mob:m,big:m.big?.5:0});
    if(a.tw)for(const t of a.tw)if(t.hp>0&&runLos(h.x-RUN.x,h.z-RUN.z,t.x,t.z))ts.push({x:RUN.x+t.x,z:RUN.z+t.z,tw:t});}
  else if(G&&!ended){const[ox,oz]=slotO(mySlot);for(const e of G.en)if(!e.dead)ts.push({x:ox+e.x,z:oz+e.y,e});}
  let best=null,bv=1e18;const inr=[];
  for(const t of ts){t.d=Math.hypot(t.x-h.x,t.z-h.z);if(t.d<=HR+(t.e&&t.e.boss?.7:t.big||0)){inr.push(t);const v=H.k==='snipe'&&t.e?-t.e.hp:t.d;if(v<bv){bv=v;best=t;}}}
  if(!best){h.cd=0;return;}
  h.cd=1/(rate*(arena&&arena.haste||1));if(HM.leech&&h.hp>0)h.hp=Math.min(maxHp(),h.hp+maxHp()*HM.leech/rate);h.atk=1;akCount++;const ta=Math.atan2(best.z-h.z,best.x-h.x);if(!h.moving)h.a=ta;
  const base=H.dmg*HM.hDmg*(armour>=3?1.3:1)*(Math.random()<HM.hCrit?2+HM.hCritDmg:1),cs=arena?1:heroScale();
  const hit=(t,d,pierce)=>{if(t.e){const was=t.e.dead;E.hit(G,t.e,d*cs*(t.e.boss?HM.hBoss:1),1-(1-(pierce||0))*(1-HM.hAp));if(t.e.dead&&!was&&HM.hGold)G.gold+=Math.round(t.e.b*HM.hGold);}else if(t.g){if(arena&&arena.mode==='boss')d*=HM.hBoss;t.g.hp-=d;if(arena&&arena.mode==='boss')myBh+=d;}else if(t.tw)runHit(t.tw,d*HM.hMini);else if(t.mob)mobHit(t.mob,d*HM.hMini);};
  const A=V(h.x,.8,h.z),B=t=>V(t.x,t.e&&t.e.boss?1.8:.5,t.z);
  switch(H.k){
    case'gun':hit(best,base);if(gl3){fxBeam(A,B(best),'#ffd98a',.04,.08);fxBall(B(best),'#ffb060',.04,.14,.1,.8);}break;
    case'blade':hit(best,base);if(gl3){fxRing(V(best.x,0,best.z),'#e6f0ff',.7,.16);fxBeam(A,B(best),'#ffffff',.05,.1);}break;
    case'snipe':hit(best,base,1);if(gl3){fxBeam(A,B(best),'#ffe9b0',.09,.28);fxBeam(A,B(best),'#ffffff',.03,.28);fxBall(B(best),'#fff0c0',.1,.5,.2,.8);}break;
    case'bolt':{let cur=best,d=base,p=A;const done=new Set([best]);for(let i=0;i<3&&cur;i++){hit(cur,d,.5);if(gl3){fxBeam(p,B(cur),'#cfefff',.07,.16);fxBall(B(cur),'#bfe9ff',.08,.3,.16,.8);}p=B(cur);d*=.7;
        let nx=null,bd=2.4;for(const t of ts){if(done.has(t))continue;const dd=Math.hypot(t.x-cur.x,t.z-cur.z);if(dd<bd){bd=dd;nx=t;}}if(nx)done.add(nx);cur=nx;}break;}
    case'slam':for(const t of ts)if(t.d<=1.9+(t.e&&t.e.boss?.7:t.big||0))hit(t,base);if(gl3){fxRing(V(h.x,0,h.z),'#ffcf8a',1.9,.35);fxBall(V(h.x+Math.cos(ta)*.8,.2,h.z+Math.sin(ta)*.8),'#ffb060',.1,.8,.25,.7);}break;
    case'flame':for(const t of inr){let da=Math.abs(Math.atan2(t.z-h.z,t.x-h.x)-ta);if(da>Math.PI)da=2*Math.PI-da;if(da<.6)hit(t,base);}
      if(gl3)for(let i=1;i<=3;i++)fxBall(V(h.x+Math.cos(ta)*HR*i/3,.6,h.z+Math.sin(ta)*HR*i/3),i<3?'#ff8a2c':'#ff5a20',.1,.35+i*.14,.3,.7);break;
  }}
/* --- arena: na elke tiende ronde --- */
function applyArmour(n,g){g=g||G;if(n===1)g.m.dmg*=1.1;else if(n===2){g.lives+=5;g.maxLives+=5;}else if(n===3)g.m.rate*=1.08;else if(n===4)g.m.gold*=1.1;E.recalc(g);}
// Na elke tiende ronde volgt een minigame. Level 10 is de baas, level 20 het doolhof, level 30 en 50 de stoelendans, level 100 het eindmonster.
// Helden kunnen elkaar nergens raken: je wint op score, of door als laatste over te blijven.
const MINI={10:'boss',20:'run',30:'chairs',40:'hill',50:'chairs',60:'hunt',70:'cores',80:'storm',90:'duel',100:'titan'};
// m: spelvorm, T: duur in seconden, goal: score die je alleen spelend moet halen
const KIND={
 boss:{m:'boss',T:120,n:'Missie: de Kolos',go:'Missie: versla samen de Kolos en win een stuk harnas'},
 run:{m:'run',T:90,n:'Doolhof',go:'Doolhof: haal de overkant. F zet je schild op'},
 chairs:{m:'chairs',T:1,n:'Stoelendans',go:'Stoelendans: er is één groen veld minder dan er spelers zijn. Sta op een veld als de tijd stopt'},
 hill:{m:'mini',T:80,n:'Heuvelkoning',goal:35,go:'Heuvelkoning: sta alleen op de gouden plek om te scoren. Mechs bewaken hem'},
 hunt:{m:'mini',T:80,n:'Premiejacht',goal:40,go:'Premiejacht: elk monster is premie waard, het gouden het meest'},
 cores:{m:'mini',T:90,n:'Kernroof',goal:7,go:'Kernroof: haal een kern aan de rand en breng hem naar het midden. Wie draagt loopt trager en ligt onder vuur'},
 storm:{m:'mini',T:75,n:'Vuurstorm',goal:74,go:'Vuurstorm: blijf in de groene kring en ontwijk de inslagen. Wie het langst overeind blijft wint'},
 duel:{m:'boss',T:150,n:'Kolosjacht',go:'Kolosjacht: de Kolos is terug. Wie hem de meeste schade toebrengt wint'},
 titan:{m:'boss',T:300,n:'De Titaan',go:'De Titaan is ontwaakt. Bij elke 10% levens die hij verliest volgt een speciale aanval'}};
// th: levensdrempels waarop een speciale aanval volgt, mv: de aanvallen die dan om de beurt komen
const BOSS={
 boss:{N:'De Kolos',hp:2200,sc:2.6,by:3.3,bw:3,big:1.3,th:[.75,.5],mv:['safe'],z0:38,z1:30,xk:0,ct:15,cr:1.5,stop:2.4,sp:2.5,cd:2.4,cd2:8},
 duel:{N:'De Kolos',hp:3400,sc:2.9,by:3.7,bw:3.2,big:1.4,th:[.7,.4],mv:['safe'],z0:44,z1:34,xk:2,ct:18,cr:1.6,stop:2.5,sp:2.9,cd:2.2,cd2:7},
 titan:{N:'De Titaan',hp:7000,sc:4.6,by:5.7,bw:5,big:2.3,th:[.9,.8,.7,.6,.5,.4,.3,.2,.1],mv:['safe','rings','beams'],z0:48,z1:38,xk:4,ct:22,cr:2.6,stop:3.3,sp:2.7,cd:2,cd2:6}};
const TAU=6.2832;
function enterArena(kind,r){if(arena||!G||ended||!KIND[kind])return;const K=KIND[kind],mode=K.m;arSeq++;const an=Math.random()*6.28;hero.tx=null;orders=[];buildSel=null;sel=null;roadMode=false;hero.hp=maxHp();shieldT=0;shieldCd=0;sprintT=0;sprintCd=0;pushCd=0;msLast=null;
  if(mode==='run'){hero.x=RUN.x+1.5;hero.z=RUN.z+2+Math.random()*(RUN.W-4);hero.a=0;hcam.yaw=-Math.PI/2;}
  else{const d=kind==='titan'?7.2:6.2;hero.x=ACX+Math.cos(an)*d;hero.z=ACZ+Math.sin(an)*d;hero.a=an+Math.PI;hcam.yaw=Math.PI/2-an;} // camera achter de held, met het midden van de arena in beeld
  arena={mode,kind,K,r:r||0,t:K.T,T:K.T,age:0,seq:arSeq,kills:0,g:null,score:0,rivals:false,ms:mode==='mini'||mode==='lab'||mode==='chairs'||kind==='duel'}; // ms: de score telt mee tegen die van de anderen
  if(mode==='boss')bossInit(arena);else if(mode==='run')runInit(arena);else if(mode==='chairs')chairsInit(arena);else if(mode==='lab')labInit(arena);else miniInit(arena);
  camMode='hero';toast(K.go,6000);
  if(gl3){fxRing(V(hero.x,0,hero.z),'#8fb6ff',2,.8);fxBall(V(hero.x,1,hero.z),'#bfd4ff',.3,2.2,.6,.8);}botsEnter(kind,arena.r);pushHero(true);refresh();}
// Beloning: een stuk harnas, of credits als het harnas al compleet is.
function reward(a,txt){if(armour<4){armour++;applyArmour(armour);hero.hp=maxHp();toast(txt+`${ARMOUR[armour-1].n}. ${ARMOUR[armour-1].d}`,5000);}
  else{const c=300+10*a.r;G.gold+=c;toast(txt+`+${c} credits`,4000);}}
function leaveArena(res){const a=arena,K=a.K;arena=null;if(!lab)botsDone(a,res);if(a.g&&a.g.obj)scene.remove(a.g.obj);if(a.tw)for(const t of a.tw)if(t.obj)scene.remove(t.obj);if(a.objs)for(const o of a.objs)scene.remove(o);shieldT=0;sprintT=0;
  if(lab){labEnd(a,res);return;}
  if(a.ms)msLast=[a.r,Math.floor(a.score||0),res==='dead'||res==='out'?2:1];
  const[ox,oz]=slotO(mySlot);hero.x=ox+6.5;hero.z=oz+5.5;hero.tx=null;hero.hp=maxHp();hcam.yaw=0;if(res==='win'&&HM.mission)G.gold+=HM.mission;if(res==='win'&&a.mode==='boss')award(1);
  if(a.kind==='titan'){if(res==='win')E.win(G);else if(res==='dead')toast('Je bent uitgeschakeld. Wie nog staat vecht door tegen de Titaan.',5000);else E.lose(G);}
  else if(res==='win'&&a.kind==='run'){G.gold+=400;toast('Doolhof gehaald · +400 credits');}
  else if(res==='win')reward(a,a.kind==='boss'?'De Kolos is verslagen: ':K.n+' gewonnen: ');
  else if(res==='lose')toast(a.winner?`${K.n}: ${a.winner} wint deze keer.`:`${K.n}: te weinig gescoord voor een beloning.`,4000);
  else if(res==='out')toast(a.late?'Stoelendans: je hebt een ronde gemist en ligt eruit. Je bent terug in je vesting.':'Stoelendans: je stond niet op een groen veld toen de tijd stopte. Je bent terug in je vesting.',5000);
  else if(res==='dead')toast('Je bent uitgeschakeld. Je bent terug in je vesting en kunt verder bouwen.');
  else toast(a.mode==='boss'?`De tijd is om. ${a.B.N} houdt stand.`:a.mode==='run'?'De tijd is om. Je hebt de overkant niet gehaald.':K.n+' eindigt zonder winnaar.');
  if(gl3)fxRing(V(hero.x,0,hero.z),'#8fb6ff',2,.8);pushHero(true);refresh();}
// De andere spelers in dezelfde minigame: hun score en of ze nog meedoen (0 bezig, 1 klaar, 2 uitgeschakeld).
function rivals(a){const o=[];for(const p of mates()){const ms=p.presence.ms;if(Array.isArray(ms)&&ms[0]===a.r)o.push({p,sc:+ms[1]||0,st:ms[2]|0});}if(o.length)a.rivals=true;return o;}
// Wie wint: de hoogste score van wie nog overeind staat. Speel je alleen, dan moet je het doel halen.
function rankEnd(a){const sc=Math.floor(a.score);let top=null;for(const o of rivals(a))if(o.st!==2&&(!top||o.sc>top.sc))top=o;
  if(top&&top.sc>sc){a.winner=nameOf(top.p);return'lose';}
  return(a.rivals?sc>0:sc>=(a.K.goal||0))?'win':'lose';}
/* --- de bazen: de Kolos op level 10 en 90, de Titaan op level 100 --- */
// De baas heeft één levensbalk voor iedereen: maximum min de schade die alle spelers melden. Zo telt ook de schade van wie al is uitgeschakeld.
function makeTitan(){const g=makeHero(3,SLOTS),add=(m,x,y,z)=>{m.position.set(x,y,z);g.add(m);};
  const eye=()=>new T3.Mesh(raw('hglow',()=>new T3.SphereGeometry(.07,8,6)),glow('#ff3a1a'));
  for(const z of[.05,-.05]){const e=eye();e.scale.setScalar(.45);add(e,.1,.9,z);}
  g.add(mesh(geo('titanx',()=>[P(new T3.ConeGeometry(.05,.3,6),'#2a1a12',0,1.1,.1),P(new T3.ConeGeometry(.05,.3,6),'#2a1a12',0,1.1,-.1),
    P(new T3.ConeGeometry(.07,.26,6),'#3a1a17',0,.98,.3),P(new T3.ConeGeometry(.07,.26,6),'#3a1a17',0,.98,-.3),bx(.1,.34,.44,'#3a1a17',-.14,.64,0)]),MATE));
  add(halo('#ff5a20',1.5,.5),0,.7,0);return g;}
function bossInit(a){const B=a.B=BOSS[a.kind]||BOSS.boss;a.n=1+mates().length;a.max=Math.round(B.hp*Math.pow(a.n,1.1));myBm=a.r;myBh=0;a.zones=[];a.seen=0;a.ult=null;a.ultN=0;if(a.kind==='titan')finalMax=a.max;
  a.g={x:ACX,z:ACZ,a:0,hp:a.max,max:a.max,walk:0,atk:0,obj:null,cd:3,cd2:9,ct:0,by:B.by,bw:B.bw,tx:ACX,tz:ACZ,last:null};
  if(gl3){a.g.obj=a.kind==='titan'?makeTitan():makeHero(3,SLOTS);a.g.obj.scale.setScalar(B.sc);scene.add(a.g.obj);}}
// Eén speler stuurt de baas aan: de eerste die nog in de missie staat. De rest volgt zijn positie en aanvallen. Geeft null als ik dat ben.
function missionLead(a){let b=null;const rk=p=>+p.presence.t||0;for(const p of mates()){const pr=p.presence;if(pr.am!==a.r||!(+pr.ar>0)||!(+pr.hp>0))continue;if(!b||rk(p)<rk(b)||(rk(p)===rk(b)&&p.peer<b.peer))b=p;}
  if(!b)return null;return rk(b)<myT||(rk(b)===myT&&(!myPeer||b.peer<myPeer))?b:null;}
// aanval: [volgnummer, soort, zaad]. Soort 0 is een klap onder de voeten van elke held, soort 1 een regen van inslagen over de hele arena.
function bossAttack(a,ev){const seq=+ev[0],kind=+ev[1],B=a.B;if(!(seq>a.seen))return;a.seen=seq;a.g.atk=1;
  if(kind===0){a.zones.push({x:hero.x,z:hero.z,r:3,t:1.1,T:1.1,dmg:B.z0});for(const o of rheroes.values())if(o.ar>0&&o.hp>0)a.zones.push({x:o.x,z:o.z,r:3,t:1.1,T:1.1,dmg:B.z0});}
  else{const rnd=lcg(Math.max(1,Math.min(2147483646,ev[2]|0))),k=Math.min(18,4+a.n+B.xk);for(let i=0;i<k;i++){const an=rnd()*6.283,d=Math.sqrt(rnd())*7.6,T=1.3+i*.13;a.zones.push({x:ACX+Math.cos(an)*d,z:ACZ+Math.sin(an)*d,r:2.3,t:T,T,dmg:B.z1});}}}
// Speciale aanvallen. De Kolos kent alleen de ultra-aanval; de Titaan wisselt er drie af, steeds een tikje zwaarder.
//  safe  ultra-aanval: alleen op een groene plek overleef je de klap
//  rings schokgolven: ringen rollen vanuit het midden naar buiten, alleen de opening is veilig
//  beams doodsstralen: stralen draaien rond het midden en keren halverwege om
// Alles volgt uit het potje en het volgnummer, zodat iedereen hetzelfde ziet.
function startUlt(a){const B=a.B,i=a.ultN++,kind=B.mv[i%B.mv.length],lvl=B.mv.length>1?Math.floor(i/B.mv.length):i,far=B.cr>2,
    rnd=lcg(1+(Math.abs(Math.floor(matchId))+7919*(i+1)+131*a.r)%2147483000),b0=rnd()*TAU;let u;
  if(kind==='rings'){const n=3+lvl,w=1.15-.15*lvl;u={kind,rings:[],T:3+(n-1)*1.7+2.3};let g=b0;
    for(let j=0;j<n;j++){u.rings.push({t0:3+j*1.7,g,w,pR:0});g+=(rnd()<.5?-1:1)*(.7+rnd()*.5);}
    toast('Schokgolven! Ga bij elke ring in de groene opening staan.',3500);}
  else if(kind==='beams'){u={kind,n:lvl?3:2,w:.5+.12*lvl,b0,T:8,im:0};toast('Doodsstralen! Loop mee tussen de stralen.',3500);}
  else{const k=lvl?2:3,T=lvl>1?3.6:lvl?4:4.5;u={kind:'safe',T,safe:[]};
    for(let j=0;j<k;j++){const an=b0+j*TAU/k,d=(far?4.8:4)+rnd()*(far?2:2.5);u.safe.push({x:ACX+Math.cos(an)*d,z:ACZ+Math.sin(an)*d,r:lvl>1?1.6:1.9});}
    toast(`${B.N} laadt een ultra-aanval op. Ren naar een groene plek!`,3500);}
  u.t=u.T;a.ult=u;a.zones.length=0;}
const beamAng=u=>{const s=Math.max(0,u.T-u.t-1.5),H=(u.T-1.5)/2;return u.b0+u.w*(s<H?s:2*H-s);};
function updBoss(a,dt){const g=a.g,h=hero,B=a.B,L=missionLead(a);let sum=myBh;for(const p of mates())if(p.presence.bm===a.r)sum+=Math.max(0,+p.presence.bh||0);
  g.hp=Math.max(0,a.max-sum);g.atk=Math.max(0,g.atk-dt*2.5);if(a.kind==='duel'){a.score=myBh;rivals(a);}
  if(g.hp<=0){a.kills=1;if(gl3){fxBall(V(g.x,1.6,g.z),'#ff8a2c',.4,4,.9,.9);fxRing(V(g.x,0,g.z),'#ffb060',5,.8);}leaveArena(a.kind==='duel'?rankEnd(a):'win');return;}
  if(!a.ult&&a.ultN<B.th.length&&g.hp<=a.max*B.th[a.ultN])startUlt(a);
  if(a.ult){const u=a.ult,dx=ACX-g.x,dz=ACZ-g.z,d=Math.hypot(dx,dz);
    if(d>.1){const mv=Math.min(d,7*dt);g.x+=dx/d*mv;g.z+=dz/d*mv;g.walk+=dt*8;g.a=Math.atan2(dz,dx);}else g.atk=.4+.6*(1-u.t/u.T);
    g.tx=g.x;g.tz=g.z;const ba=L&&L.presence.ba;if(Array.isArray(ba)&&+ba[0]>a.seen)a.seen=+ba[0]; // gewone aanvallen vervallen zolang hij bezig is
    u.t-=dt;const el=u.T-u.t,hx=h.x-ACX,hz=h.z-ACZ;
    if(u.kind==='rings'){const hd=Math.hypot(hx,hz),ha=Math.atan2(hz,hx);
      for(const r of u.rings){const R=(el-r.t0)*4.2;if(R<=0)continue;if(r.pR<=0&&gl3)fxRing(V(ACX,0,ACZ),'#ffb060',3,.4);
        if(r.pR<hd&&R>=hd){let da=Math.abs(ha-r.g)%TAU;if(da>Math.PI)da=TAU-da;if(da>r.w/2){hurt(60);if(gl3)fxBall(V(h.x,.8,h.z),'#ff5a20',.2,1.3,.3,.85);}}
        r.pR=R;}}
    else if(u.kind==='beams'){u.im-=dt;if(el>1.5&&u.im<=0){const b=beamAng(u);
        for(let k=0;k<u.n;k++){const an=b+k*TAU/u.n,c=Math.cos(an),s=Math.sin(an);if(hx*c+hz*s>1&&Math.abs(hz*c-hx*s)<.55){hurt(34);u.im=.7;if(gl3)fxBall(V(h.x,.8,h.z),'#ff3a1a',.2,1,.25,.85);break;}}}}
    if(u.t<=0){a.ult=null;g.cd=2;g.cd2=5;g.atk=1;
      if(u.kind==='safe'){if(gl3){fxBall(V(ACX,.6,ACZ),'#ff5a20',.6,9.2,.6,.9);fxRing(V(ACX,0,ACZ),'#ffd9a0',9.2,.5);}
        if(!u.safe.some(o=>Math.hypot(h.x-o.x,h.z-o.z)<=o.r)){h.hp=0;a.sc=true;}}} // a.sc: hiertegen helpt Tweede kans niet
    return;}
  const rage=g.hp<a.max*.3?1.3:1; // onder de 30% wordt hij sneller
  if(L){const bp=L.presence.bp;if(Array.isArray(bp)&&isFinite(+bp[0])&&isFinite(+bp[1])){g.tx=+bp[0];g.tz=+bp[1];g.a=+bp[2]||0;}
    const k=Math.min(1,dt*8),dx=g.tx-g.x,dz=g.tz-g.z;if(Math.hypot(dx,dz)>.05)g.walk+=dt*6;g.x+=dx*k;g.z+=dz*k;
    const ba=L.presence.ba;if(Array.isArray(ba))bossAttack(a,ba);}
  else{const hs=[{x:h.x,z:h.z}];for(const r of rheroes.values())if(r.ar>0&&r.hp>0)hs.push({x:r.x,z:r.z});
    let tg=hs[0],bd=1e9;for(const o of hs){const d=Math.hypot(o.x-g.x,o.z-g.z);if(d<bd){bd=d;tg=o;}}
    const dx=tg.x-g.x,dz=tg.z-g.z;g.a=Math.atan2(dz,dx);if(bd>B.stop){const sp2=B.sp*rage*dt;g.x+=dx/bd*sp2;g.z+=dz/bd*sp2;g.walk+=dt*6;}
    g.cd-=dt*rage;g.cd2-=dt*rage;
    if(g.cd<=0){g.cd=B.cd;g.last=[a.seen+1,0,0];bossAttack(a,g.last);}
    else if(g.cd2<=0){g.cd2=B.cd2/(1+.12*(a.n-1));g.last=[a.seen+1,1,1+Math.floor(Math.random()*1e9)];bossAttack(a,g.last);}}
  stepZones(a,dt);
  g.ct-=dt;if(g.ct<=0&&Math.hypot(h.x-g.x,h.z-g.z)<B.cr){g.ct=.9;hurt(B.ct);if(gl3)fxRing(V(h.x,0,h.z),'#ff6a4e',1,.25);}}
function stepZones(a,dt){const h=hero;for(let i=a.zones.length-1;i>=0;i--){const z=a.zones[i];z.t-=dt;if(z.t>0)continue;a.zones.splice(i,1);
    if(gl3){fxBall(V(z.x,.3,z.z),'#ff6a2c',.3,z.r,.35,.8);fxRing(V(z.x,0,z.z),'#ffb060',z.r,.3);}
    if(Math.hypot(h.x-z.x,h.z-z.z)<=z.r)hurt(z.dmg);botsZone(a,z);}}
// Na het eindmonster: wie is uitgeschakeld wacht in zijn vesting af of de rest de Titaan velt.
function finalWatch(){let sum=myBh,won=false,fighting=false;
  for(const p of peers){const pr=p.presence;if(own(p)||!pr||pr.mt!==matchId)continue;if(pr.bm===ROUNDS)sum+=Math.max(0,+pr.bh||0);if(pr.wn===1)won=true;
    if(pr.st==='playing'&&pr.am===ROUNDS&&+pr.ar>0&&+pr.hp>0)fighting=true;}
  if(won||(finalMax&&sum>=finalMax)){E.win(G);return;}
  const now=performance.now();if(fighting||!finalAt){finalAt=now;return;}if(now-finalAt>3000)E.lose(G);}
/* --- doolhof na ronde 20 --- */
// Elke speler loopt zijn eigen doolhof: je ziet de anderen rennen, maar torens en kogels zijn van jou alleen.
function runInit(a){const hp=110;a.shots=[];a.shotDmg=15;a.shotCd=.9;
  a.tw=[[7,1.6],[11,8.4],[15,1.6],[15,8.6],[19,8.4],[19,1.4],[23,1.6],[27,8.4],[27,1.4],[31,1.6],[31,8.6],[35,8.4]].map(([x,z],i)=>{const t={x,z,hp,max:hp,cd:.6+i*.17,ang:Math.PI,obj:null};
    if(gl3){t.obj=makeTower('sentry',SLOTS,0,null);t.obj.scale.setScalar(1.35);t.obj.position.set(RUN.x+x,0,RUN.z+z);scene.add(t.obj);}return t;});}
function runHit(t,d){if(t.hp<=0)return;t.hp-=d;if(t.hp<=0){arena.kills++;if(t.obj)scene.remove(t.obj);if(gl3)fxBall(V(RUN.x+t.x,.6,RUN.z+t.z),'#ff8a2c',.2,1.4,.5,.85);}}
/* --- duwen en sprinten: in elke minigame --- */
const sprintLen=()=>E.MOVES.sprDur+HM.sprDur,sprintWait=()=>E.MOVES.sprCd-HM.sprCd,pushWait=()=>E.MOVES.pushCd-HM.pushCd,pushLen=()=>E.MOVES.pushDist*HM.pushDist;
function useSprint(){if(!arena||sprintCd>0||hero.hp<=0)return;sprintT=sprintLen();sprintCd=sprintWait();if(gl3){fxRing(V(hero.x,0,hero.z),'#ffd23a',1.3,.35);fxBall(V(hero.x,.6,hero.z),'#fff0b0',.1,.9,.3,.6);}}
// Verplaatst een punt in kleine stapjes, zodat niemand door een muur of de arenarand heen geduwd wordt.
function shove(o,dx,dz){for(let i=0;i<8;i++){const x=o.x+dx/8,z=o.z+dz/8;if(walkable(x,z)){o.x=x;o.z=z;}else if(walkable(x,o.z))o.x=x;else if(walkable(o.x,z))o.z=z;else break;}}
// Duwt iedere andere speler binnen bereik een klein stukje van je af. Bots verplaats je zelf; een mens krijgt de duw via presence (pu).
function usePush(){const a=arena,h=hero;if(!a||pushCd>0||h.hp<=0)return;const R=E.MOVES.pushRange,D=pushLen(),out=[];let n=0;
  const dir=(x,z)=>{const dx=x-h.x,dz=z-h.z,d=Math.hypot(dx,dz);return d>R?null:d<.05?[Math.cos(h.a)*D,Math.sin(h.a)*D]:[dx/d*D,dz/d*D];};
  for(const b of bots){if(!b.ar||b.ar.r!==a.r||b.ar.kind!==a.kind||!(b.h.hp>0))continue;const v=dir(b.h.x,b.h.z);if(!v)continue;shove(b.h,v[0],v[1]);n++;if(gl3)fxBall(V(b.h.x,.8,b.h.z),'#ffe9a8',.1,.6,.25,.7);}
  for(const r of rheroes.values()){if(!(r.ar>0)||!(r.hp>0))continue;const v=dir(r.x,r.z);if(!v)continue;out.push([r.peer,rd1(v[0]),rd1(v[1])]);n++;if(gl3)fxBall(V(r.x,.8,r.z),'#ffe9a8',.1,.6,.25,.7);}
  if(!n){toast('Niemand dichtbij genoeg om te duwen',1500);return;}
  pushCd=pushWait();h.atk=1;if(gl3)fxRing(V(h.x,0,h.z),'#ffe9a8',R,.3);
  if(out.length){pushOut=[Math.floor(Date.now()/100)%1e8,a.r,out.slice(0,24)];pushHero(true);}}
// Een duw van een andere speler: alleen als hij in dezelfde minigame staat en jij in zijn lijst staat.
function gotPush(pu){const a=arena;if(!a||hero.hp<=0||pu[1]!==a.r||!Array.isArray(pu[2]))return;const m=pu[2].find(e=>Array.isArray(e)&&e[0]===myPeer);if(!m)return;
  let dx=+m[1]||0,dz=+m[2]||0;const d=Math.hypot(dx,dz),mx=E.MOVES.pushDist*1.5;if(!d)return;if(d>mx){dx*=mx/d;dz*=mx/d;}
  shove(hero,dx,dz);hero.tx=null;hero.vx=hero.vz=0;if(gl3)fxBall(V(hero.x,.8,hero.z),'#ffe9a8',.1,.7,.25,.7);toast('Je wordt opzij geduwd',1200);}
const pushSlot=()=>({ic:'push',key:'C',n:'Duwen',d:`Duwt andere spelers binnen ${nl1(E.MOVES.pushRange)} meter een klein stukje van je af. Laadt ${nl1(pushWait())} seconden op.`,wait:Math.ceil(pushCd),act:usePush});
const sprintSlot=()=>({ic:'sprint',key:'Shift',n:'Sprint',d:`${nl1(sprintLen())} seconden lang ${Math.round((E.MOVES.sprSpd+HM.sprSpd)*100)}% sneller. Laadt ${nl1(sprintWait())} seconden op.`,on:sprintT>0,wait:Math.ceil(sprintCd),act:useSprint});
const nl1=v=>String(Math.round(v*10)/10).replace('.',',');
function useShield(){if(!arena||(arena.mode!=='run'&&!arena.shield)||shieldCd>0)return;shieldT=2.5+HM.shDur;shieldCd=9-HM.shCd;if(gl3)fxRing(V(hero.x,0,hero.z),'#59c8f2',1.6,.3);}
function updRun(a,dt){const h=hero,lx=h.x-RUN.x,lz=h.z-RUN.z;shieldT=Math.max(0,shieldT-dt);shieldCd=Math.max(0,shieldCd-dt);
  if(lx>=RUN.L-2){leaveArena('win');return;}
  for(const t of a.tw){if(t.hp<=0)continue;const dx=lx-t.x,dz=lz-t.z,d=Math.hypot(dx,dz);if(d>9||d<.01||!runLos(t.x,t.z,lx,lz)){t.cd=Math.max(t.cd,.35);continue;}
    t.ang=Math.atan2(dz,dx);t.cd-=dt;if(t.cd<=0){t.cd=a.shotCd;a.shots.push({x:t.x,z:t.z,vx:dx/d*11,vz:dz/d*11,life:1.2});if(gl3)fxBall(V(RUN.x+t.x,.7,RUN.z+t.z),'#ffd98a',.08,.3,.1,.9);}}
  for(let i=a.shots.length-1;i>=0;i--){const o=a.shots[i];let dead=false;
    for(let k=0;k<3&&!dead;k++){const px=o.x;o.x+=o.vx*dt/3;o.z+=o.vz*dt/3;
      for(const[wx,sd]of RUN.walls)if((px-wx)*(o.x-wx)<=0){const g=runGap(sd);if(o.z<g[0]||o.z>g[1])dead=true;}
      if(!dead&&Math.hypot(o.x-lx,o.z-lz)<.5){dead=true;if(shieldT>0){if(gl3)fxRing(V(h.x,0,h.z),'#59c8f2',1.2,.2);}else{hurt(a.shotDmg);if(gl3)fxBall(V(h.x,.8,h.z),'#ff5a4a',.1,.5,.2,.7);}}}
    o.life-=dt;if(dead||o.life<=0||o.x<0||o.x>RUN.L||o.z<0||o.z>RUN.W)a.shots.splice(i,1);}}
/* --- stoelendans na ronde 30 en 50 --- */
// Er ligt één groen veld minder dan er spelers zijn, en op elk veld past één held. Na een verborgen tijd van 10 tot 20 seconden stopt de ronde:
// wie dan een veld heeft blijft, de rest ligt eruit. Zolang de tijd loopt kost op een veld staan levenspunten. Dat herhaalt zich tot er één speler over is.
// Eén speler leidt (de eerste die nog meedoet): hij kiest het zaad van de ronde en meldt wanneer de tijd om is, zodat iedereen dezelfde velden en hetzelfde einde ziet.
// Elke speler meldt zelf welk veld hij heeft. Claimen twee helden hetzelfde veld, dan telt de vroegste claim en wordt de ander eraf geduwd.
// intro: aanloop, open: zo lang na het verschijnen kun je een veld nog niet pakken, stop: bevroren tot de uitslag, gap: pauze tussen rondes, wait: zo lang wacht je op een leider die niets meldt, solo: rondes die je alleen spelend moet halen
const CH={intro:4,open:2,stop:1.2,gap:2.5,wait:3,solo:3,drain:.12,regen:.03,cap:900};
function chairsInit(a){a.D=a.r>=50?1.3:1;a.rd=0;a.n=0;a.seed=0;a.ph=0;a.phase='intro';a.pt=CH.intro;a.rt=0;a.dur=0;a.R=1.25;a.spots=[];a.marks=[];a.my=null;a.ok=0;a.inSet=null;a.solo=false;a.slow=1;a.bt=0;}
// De anderen die nog meedoen: in deze minigame, overeind, en na de eerste ronde alleen wie een veld had.
function chOthers(a){return mates().filter(p=>{const pr=p.presence;return pr.am===a.r&&+pr.ar>0&&+pr.hp>0&&(!a.inSet||a.inSet.has(p.peer));});}
// De leider, of null als ik dat zelf ben.
function chLead(a){let b=null;const rk=p=>+p.presence.t||0;for(const p of chOthers(a))if(!b||rk(p)<rk(b)||(rk(p)===rk(b)&&p.peer<b.peer))b=p;
  if(!b)return null;return rk(b)<myT||(rk(b)===myT&&(!myPeer||b.peer<myPeer))?b:null;}
// De beste claim van de anderen per veld: de vroegste, en bij gelijke tijd de laagste peer.
function chClaims(a){const o=new Map();for(const p of chOthers(a)){const c=p.presence.sc;if(!Array.isArray(c)||c[0]!==a.r||c[1]!==a.rd)continue;
    const i=c[2]|0,t=+c[3]||0,b=o.get(i);if(!b||t<b.t||(t===b.t&&p.peer<b.peer))o.set(i,{t,peer:p.peer});}return o;}
const chBeats=(c,my)=>!!c&&(c.t<my.t||(c.t===my.t&&(!myPeer||c.peer<myPeer)));
function chSpots(n,seed){const rnd=lcg(Math.max(1,Math.min(2147483646,seed|0))),dur=10+10*rnd(),R=n>12?.95:n>6?1.1:1.25,spots=[];
  for(let i=0;i<n;i++){let best=null,bd=-1;
    for(let k=0;k<120;k++){const an=rnd()*TAU,d=(AR-R-.3)*Math.sqrt(rnd()),x=ACX+Math.cos(an)*d,z=ACZ+Math.sin(an)*d;let m=1e9;for(const s of spots)m=Math.min(m,Math.hypot(x-s.x,z-s.z));
      if(m>bd){bd=m;best={x,z};}if(m>=2*R+1.2)break;}
    spots.push(best);}
  return{dur,R,spots};}
function chStart(a,rd,n,seed){const o=chSpots(n,seed);a.rd=rd;a.n=n;a.seed=seed;a.ph=0;a.phase='run';a.rt=0;a.dur=o.dur;a.R=o.R;a.spots=o.spots;a.my=null;hero.hp=maxHp();
  toast(a.solo?`Ronde ${rd} van ${CH.solo}: sta op het groene veld als de tijd stopt`:`Ronde ${rd}: ${n} ${n===1?'veld':'velden'} voor ${n+1} spelers`,3500);
  if(gl3)for(const s of a.spots)fxRing(V(s.x,0,s.z),'#35ff5a',a.R*1.3,.5);pushHero(true);}
function chStop(a){a.ph=1;a.phase='stop';a.pt=CH.stop;hero.tx=null;toast('Stop! De tijd is om.',2000);if(gl3)fxRing(V(ACX,0,ACZ),'#ffffff',AR,.5);pushHero(true);}
// Van een bezet veld af: naar de rand, en als daar de arena ophoudt naar het midden toe.
function chPush(a,i){const s=a.spots[i],h=hero;let dx=h.x-s.x,dz=h.z-s.z,d=Math.hypot(dx,dz);if(d<.01){dx=1;dz=0;d=1;}
  let x=s.x+dx/d*(a.R+.06),z=s.z+dz/d*(a.R+.06);if(!walkable(x,z)){const cx=ACX-s.x,cz=ACZ-s.z,c=Math.hypot(cx,cz)||1;x=s.x+cx/c*(a.R+.06);z=s.z+cz/c*(a.R+.06);}
  h.x=x;h.z=z;h.tx=null;if(a.bt<=0){a.bt=2.5;toast('Dit veld is bezet');if(gl3)fxRing(V(s.x,0,s.z),'#ff8a2c',a.R,.3);}}
// De uitslag van een ronde: heb ik een veld, en wie nog meer.
function chJudge(a){const occ=chClaims(a);if(!a.my||chBeats(occ.get(a.my.i),a.my)){leaveArena('out');return;}
  const S=new Set();for(const[i,c]of occ)if(i!==a.my.i)S.add(c.peer);
  a.ok=a.rd;a.score=a.rd;a.inSet=S;a.phase='gap';a.pt=CH.gap;hero.hp=maxHp();
  if(gl3){const s=a.spots[a.my.i];fxRing(V(s.x,0,s.z),'#35ff5a',a.R*1.6,.6);}
  if(!a.solo)toast(S.size?`Je hebt een veld. Nog ${S.size+1} spelers over.`:'Je hebt het laatste veld.',3000);}
function updChairs(a,dt){const h=hero,L=chLead(a),seed=()=>1+Math.floor(Math.random()*2147483000);a.marks.length=0;a.slow=1;a.bt-=dt;
  if(a.age>CH.cap){leaveArena('draw');return;}
  // de leider volgen: een nieuwe ronde, of het einde van de lopende
  const sd=L&&L.presence.sd;
  if(Array.isArray(sd)&&sd[0]===a.r){const rd=sd[1]|0,n=sd[2]|0,sv=sd[3]|0;
    if(rd>a.rd||(rd===a.rd&&rd>0&&sv!==a.seed&&a.phase==='run')){
      if(rd>1&&a.ok!==rd-1){a.late=true;leaveArena('out');return;} // een ronde gemist: de rest is zonder mij verder gegaan
      if(n>0)chStart(a,rd,n,sv);}
    if(rd===a.rd&&sd[4]===1&&a.phase==='run')chStop(a);}
  const occ=chClaims(a);let at=-1;for(let i=0;i<a.spots.length;i++)if(Math.hypot(h.x-a.spots[i].x,h.z-a.spots[i].z)<a.R){at=i;break;}
  if(a.phase==='intro'){a.pt-=dt;
    if(a.pt<=0&&(!L||a.pt<-CH.wait)){const n=chOthers(a).length;a.solo=n===0;chStart(a,1,Math.max(1,n),seed());}}
  else if(a.phase==='run'){a.rt+=dt;const had=a.my;
    if(at<0||a.rt<CH.open)a.my=null;
    else if(a.my&&a.my.i===at){if(chBeats(occ.get(at),a.my)){a.my=null;chPush(a,at);}}
    else if(occ.has(at)){a.my=null;chPush(a,at);}
    else a.my={i:at,t:Math.round(a.rt*100)/100};
    if(a.my!==had)pushHero(true);
    if(a.my)h.hp-=maxHp()*CH.drain*a.D*dt;else if(h.hp>0)h.hp=Math.min(maxHp(),h.hp+maxHp()*CH.regen*dt);
    if(a.rt>=a.dur&&(!L||a.rt>=a.dur+CH.wait+1))chStop(a);}
  else if(a.phase==='stop'){a.slow=1e-6;a.pt-=dt;if(a.my&&chBeats(occ.get(a.my.i),a.my)){a.my=null;pushHero(true);}
    if(a.pt<=0){chJudge(a);if(arena!==a)return;}}
  else if(a.phase==='gap'){a.pt-=dt;
    if(a.pt<=0){const n=chOthers(a).length;
      if(a.solo?a.rd>=CH.solo:n===0){leaveArena('win');return;}
      if(!L||a.pt<-CH.wait)chStart(a,a.rd+1,a.solo?1:n,seed());}}
  // de velden: groen is vrij, fel groen is van mij, oranje is van een ander
  const live=a.phase==='run'||a.phase==='stop',soon=a.phase==='run'&&a.rt<CH.open;
  for(let i=0;i<a.spots.length;i++){const s=a.spots[i],mine=!!a.my&&a.my.i===i,taken=!mine&&occ.has(i);
    if(!live&&!mine&&!taken)continue;
    a.marks.push({x:s.x,z:s.z,r:a.R,col:mine?'#7dff3a':taken?'#ff8a2c':'#35ff5a',op:soon?.2:mine?.85:taken?.55:.6});}}
function chairsSub(a){const n=a.n,who=a.solo?'':` · ${n+1} spelers`;
  if(a.phase==='intro')return'Straks verschijnen de groene velden · de klok zie je niet';
  if(a.phase==='run')return a.my?`Ronde ${a.rd} · je staat op een veld en verliest levenspunten`:`Ronde ${a.rd} · ${n} ${n===1?'veld':'velden'}${who} · de tijd stopt onverwacht`;
  if(a.phase==='stop')return a.my?'Stop! Je hebt een veld':'Stop! Je hebt geen veld';
  return a.solo?`Ronde ${a.rd} van ${CH.solo} gehaald`:`Ronde ${a.rd} gehaald · de volgende ronde komt eraan`;}
// sd: [level, ronde, aantal velden, zaad, 1 als de tijd om is], sc: mijn claim [level, ronde, veld, moment]
function chairsPatch(){const a=arena;if(!a||a.mode!=='chairs')return{sd:null,sc:null};return{sd:[a.r,a.rd,a.n,a.seed,a.ph],sc:a.my?[a.r,a.rd,a.my.i,a.my.t]:null};}
/* --- minigames in de arena, level 40 tot en met 80 --- */
// Iedereen speelt in dezelfde arena tegen monsters, inslagen en doelen, en de hoogste score wint. Wie sneuvelt ligt eruit.
// Kernen volgen uit het potje, zodat iedereen dezelfde ziet; wie er een pakt meldt dat, en dan verdwijnt hij bij de rest.
function arPt(rnd,r0,r1){const an=rnd()*TAU,d=r0+(r1-r0)*Math.sqrt(rnd());return[ACX+Math.cos(an)*d,ACZ+Math.sin(an)*d];}
function miniInit(a){const rnd=a.rnd=lcg(1+(Math.abs(Math.floor(matchId))+7919*a.r)%2147483000),k=a.kind;a.D=Math.max(1,Math.min(2,1+(a.r-30)/60));
  a.pts=0;a.mid=0;a.mobs=[];a.zones=[];a.marks=[];a.orbs=[];a.claim=[];a.gone=new Set();a.sp=2;a.sp2=8;a.mi=0;a.hi=0;a.carry=false;a.slow=1;a.items=[];
  if(k==='hill')for(let i=0;i*16<a.T;i++)a.items.push(arPt(rnd,2,AR-2.6));
  else if(k==='cores'){a.home=[ACX,ACZ];for(let i=0;i<40;i++){const an=rnd()*TAU;a.items.push({i,x:ACX+Math.cos(an)*(AR-1),z:ACZ+Math.sin(an)*(AR-1),t0:i<3?0:(i-2)*4.5});}}}
function addMob(a,type,o){const an=Math.random()*TAU;a.mobs.push(Object.assign({id:++a.mid,type,x:ACX+Math.cos(an)*(AR-.4),z:ACZ+Math.sin(an)*(AR-.4),a:an+Math.PI,cd:.6,every:1,reach:1.25,max:o.hp},o));}
function mobHit(m,d){if(m.hp<=0)return;m.hp-=d;if(m.hp>0)return;const a=arena;if(m.die)m.die(m);
  if(a&&m.val){a.pts+=m.val;hero.hp=Math.min(maxHp(),hero.hp+3*m.val);}
  if(gl3)fxBall(V(m.x,.6,m.z),m.gold?'#ffd24a':'#ff8a2c',.15,m.big?1.8:.9,.4,.85);}
// Een monster jaagt op de held. Met `aggro` blijft het bij zijn post (a.home) tot de held dichtbij komt.
function stepMobs(a,dt){const h=hero;for(const m of a.mobs){if(m.hp<=0)continue;if(m.ai){m.ai(m,dt);continue;}const dh=Math.hypot(h.x-m.x,h.z-m.z),post=m.aggro&&dh>m.aggro&&a.home;
    const gx=post?a.home[0]+Math.cos(m.id*2.4)*1.1:h.x,gz=post?a.home[1]+Math.sin(m.id*2.4)*1.1:h.z,dx=gx-m.x,dz=gz-m.z,d=Math.hypot(dx,dz);
    if(d>(post?.3:m.reach*.8)){const mv=Math.min(d,m.sp*dt);m.x+=dx/d*mv;m.z+=dz/d*mv;m.a=Math.atan2(dz,dx);}
    for(const o of a.mobs){if(o===m||o.hp<=0)continue;const ex=m.x-o.x,ez=m.z-o.z,e=Math.hypot(ex,ez);if(e<.8&&e>.001){m.x+=ex/e*(.8-e)*.5;m.z+=ez/e*(.8-e)*.5;}}
    m.cd-=dt;if(dh<=m.reach&&m.cd<=0){m.cd=m.every;hurt(m.dmg);if(gl3)fxRing(V(h.x,0,h.z),'#ff6a4e',1,.25);}}
  for(let i=a.mobs.length-1;i>=0;i--)if(a.mobs[i].hp<=0)a.mobs.splice(i,1);}
function updMini(a,dt){const h=hero,D=a.D,k=a.kind,rv=rivals(a),got=(x,z,col)=>{if(gl3){fxRing(V(x,0,z),col,1.2,.3);fxBall(V(x,.6,z),col,.1,.6,.25,.8);}};
  a.marks.length=0;a.orbs.length=0;a.slow=1;a.sp-=dt;a.sp2-=dt;
  for(const o of rv){const mg=o.p.presence.mg;if(Array.isArray(mg))for(const i of mg)a.gone.add(i);}
  if(k==='hill'){ // level 40: alleen op de heuvel staan levert punten op; de heuvel verhuist
    const i=Math.min(a.items.length-1,Math.floor(a.age/16)),p=a.items[i],R=2.4,inn=Math.hypot(h.x-p[0],h.z-p[1])<=R;let foe=false;
    if(i!==a.hi){a.hi=i;toast('De heuvel is verhuisd');}a.home=p;
    for(const r of rheroes.values())if(r.ar>0&&r.hp>0&&Math.hypot(r.x-p[0],r.z-p[1])<=R)foe=true;
    if(inn&&!foe)a.pts+=dt;
    a.marks.push({x:p[0],z:p[1],r:R,col:inn?(foe?'#ff8a2c':'#35ff5a'):'#f6cf4d',op:.4});
    if(a.sp<=0&&a.mobs.length<2+1.5*D){a.sp=6/D;addMob(a,'mech',{hp:90,sp:2.6,dmg:11,aggro:3.4});}}
  else if(k==='hunt'){ // level 60: premie per gedood monster
    if(a.sp<=0&&a.mobs.length<7){a.sp=1.8/D;const q=Math.random();
      if(q<.55)addMob(a,'dog',{hp:35,sp:4.4,dmg:5,val:1});else if(q<.85)addMob(a,'inf',{hp:60,sp:3,dmg:7,val:2,every:1.3});
      else addMob(a,'tank',{hp:200,sp:1.9,dmg:12,val:5,reach:1.6,every:1.8});}
    if(a.sp2<=0){a.sp2=20;addMob(a,'mech',{hp:320,sp:2.3,dmg:14,val:12,big:true,gold:true,reach:1.7,every:1.5});toast('Een gouden doelwit: 12 premie');}}
  else if(k==='cores'){ // level 70: kernen van de rand naar het midden dragen
    let n=0;for(const c of a.items){if(c.t0>a.age||a.gone.has(c.i))continue;if(++n>3)break;
      if(!a.carry&&Math.hypot(h.x-c.x,h.z-c.z)<1.1){a.gone.add(c.i);a.claim.push(c.i);a.carry=true;a.sp2=1;got(c.x,c.z,'#c58bff');continue;}
      a.orbs.push({x:c.x,z:c.z,y:.6,s:.36,col:'#c58bff'});}
    a.marks.push({x:ACX,z:ACZ,r:1.8,col:a.carry?'#35ff5a':'#c58bff',op:.38});
    if(a.carry){a.slow=.72;a.orbs.push({x:h.x,z:h.z,y:2,s:.28,col:'#c58bff'});
      if(Math.hypot(h.x-ACX,h.z-ACZ)<1.8){a.carry=false;a.pts++;got(ACX,ACZ,'#35ff5a');}
      else if(a.sp2<=0){a.sp2=1.5/D;a.zones.push({x:h.x,z:h.z,r:1.9,t:.9,T:.9,dmg:26});}}
    if(a.sp<=0&&a.mobs.length<2){a.sp=10;addMob(a,'mech',{hp:160,sp:3,dmg:12,aggro:4.5,x:ACX,z:ACZ});}}
  else if(k==='storm'){ // level 80: de veilige kring krimpt en het regent inslagen
    const R=AR-(AR-4.2)*Math.min(1,a.age/55),iv=1/D;a.marks.push({x:ACX,z:ACZ,r:9.1,col:'#ff2a14',op:.2},{x:ACX,z:ACZ,r:R,col:'#35ff5a',op:.2});
    if(Math.hypot(h.x-ACX,h.z-ACZ)>R)h.hp-=22*dt;
    while(a.mi*iv<a.age-1.5){a.mi++;const an=a.rnd()*TAU,d=Math.sqrt(a.rnd())*R,me=a.mi%5===0;a.zones.push({x:me?h.x:ACX+Math.cos(an)*d,z:me?h.z:ACZ+Math.sin(an)*d,r:1.6,t:1.3,T:1.3,dmg:36});}}
  if(k!=='storm'&&h.hp>0)h.hp=Math.min(maxHp(),h.hp+maxHp()*.015*dt);
  stepMobs(a,dt);stepZones(a,dt);
  a.score=k==='storm'?Math.min(a.T-1,a.age):a.pts;
  if(a.age>4&&rv.length&&rv.every(o=>o.st===2))leaveArena('win');} // als laatste overeind
function updArena(dt){const a=arena;a.age+=dt;if(a.mode!=='chairs')a.t-=dt; // de stoelendans heeft geen klok in beeld
  if(a.mode==='boss')updBoss(a,dt);else if(a.mode==='run')updRun(a,dt);else if(a.mode==='chairs')updChairs(a,dt);else if(a.mode==='lab')updLab(a,dt);else updMini(a,dt);
  if(arena!==a)return;if(hero.hp<=0&&!revive())leaveArena('dead');else if(a.t<=0)leaveArena(a.mode==='mini'?rankEnd(a):a.mode==='lab'?labRank(a):'draw');}
/* --- minigames uitproberen (lab) --- */
// De minigames in minigames.js zitten nog niet in het potje: ze staan niet in MINI en zijn alleen via de knop Minigames in de lobby te spelen.
// Elke minigame is een beschrijving met init(a) en upd(a,dt). Hij vult a.pts (de score) en tekent via a.marks, a.orbs, a.rects, a.glows en a.mobs.
// Zo werkt hij later ook in een potje: de score gaat dan via `ms` naar de anderen en rankEnd kiest de winnaar.
function labClear(a){if(a.g&&a.g.obj)scene.remove(a.g.obj);if(a.tw&&Array.isArray(a.tw))for(const t of a.tw)if(t&&t.obj)scene.remove(t.obj);if(a.objs)for(const o of a.objs)scene.remove(o);}
function labInit(a){const K=a.K;a.D=Math.max(1,Math.min(2,1+(a.r-30)/60));a.rnd=lcg(1+(Math.abs(Math.floor(matchId))+7919*(a.r+1)+104729*K.nr)%2147483000);
  Object.assign(a,{pts:0,mid:0,mobs:[],zones:[],marks:[],orbs:[],rects:[],glows:[],slow:1,fin:false,fail:false,hit:false});hero.vx=hero.vz=0;K.init(a);a.hp0=hero.hp;}
function updLab(a,dt){const h=hero;a.marks.length=a.orbs.length=a.rects.length=a.glows.length=0;a.slow=1;shieldT=Math.max(0,shieldT-dt);shieldCd=Math.max(0,shieldCd-dt);
  a.hit=h.hp<a.hp0-.001; // geraakt sinds het vorige beeld
  a.K.upd(a,dt);if(arena!==a)return;stepMobs(a,dt);stepZones(a,dt);
  if(a.K.regen&&h.hp>0)h.hp=Math.min(maxHp(),h.hp+maxHp()*a.K.regen*dt);
  a.hp0=h.hp;a.score=a.pts;rivals(a);if(a.fin&&h.hp>0)leaveArena(labRank(a));}
const labRank=a=>a.fail?'lose':rankEnd(a);
const LABAPI={ACX,ACZ,AR,TAU,lcg,get hero(){return hero;},get HM(){return HM;},maxHp,hurt,walkable,addMob,mobHit,
  toast:(m,ms)=>toast(m,ms),speed:()=>HEROES[save.hero].spd*HM.hSpd*(armour>=4?1.2:1),
  ring:(x,z,col,r,life)=>{if(gl3)fxRing(V(x,0,z),col,r,life||.4);},
  ball:(x,y,z,col,r0,r1,life,op)=>{if(gl3)fxBall(V(x,y,z),col,r0,r1,life||.3,op==null?.8:op);},
  beam:(x1,y1,z1,x2,y2,z2,col,w,life)=>{if(gl3)fxBeam(V(x1,y1,z1),V(x2,y2,z2),col,w,life||.15);},
  push:(dx,dz)=>{for(let i=0;i<8;i++)stepHero(dx/8,dz/8,false);hero.tx=null;hero.vx=hero.vz=0;},
  // de held neerzetten; met een kijkrichting erbij komt de camera er recht achter
  place:(x,z,a)=>{hero.x=x;hero.z=z;hero.tx=null;hero.vx=hero.vz=0;if(a!=null){hero.a=a;hcam.yaw=-Math.PI/2-a;}},
  tower:(type,x,z,sc)=>{if(!gl3||!arena)return null;const o=makeTower(type,SLOTS,0,null);o.scale.setScalar(sc||1.3);o.position.set(x,0,z);scene.add(o);(arena.objs||(arena.objs=[])).push(o);return o;},
  drop:o=>{if(o&&gl3)scene.remove(o);},
  shield:{get on(){return shieldT>0;},slot:()=>shieldSlot()}};
const LAB=typeof window.RATD_LAB==='function'?window.RATD_LAB(LABAPI):[];
LAB.forEach((d,i)=>{d.nr=i+1;d.m='lab';KIND[d.id]=d;});
const TIERS=['','Redelijk makkelijk','Gemiddeld','Uitdagend','Heel uitdagend'];
function startLab(kind){if(!KIND[kind]||(G&&!lab))return;closePops();$('#labEnd').hidden=true;
  if(!G){lab={kind,over:false};beginGame(0,Date.now());myState='test';if(room)room.presence({st:'test',rd:false}).catch(()=>{});E.lock(G);G.phase='wait';
    $('#game').classList.add('lab');setText($('#quitBtn'),'Stoppen');}
  if(arena){labClear(arena);arena=null;}lab.kind=kind;lab.over=false;armour=0;enterArena(kind,0);}
function labEnd(a,res){const K=a.K,sc=Math.floor(a.score||0),won=res==='win';lab.over=true;lab.res=res;lab.score=sc;hero.tx=null;
  setText($('#lTitle'),won?'Gehaald':res==='dead'?'Uitgeschakeld':'Niet gehaald');
  setText($('#lName'),(K.nr?K.nr+'. ':'')+K.n);
  setText($('#lText'),K.m==='lab'?(won?'Je hebt het doel gehaald. ':res==='dead'?'Je held is gesneuveld. ':'Het doel is niet gehaald. ')+K.win:won?'Gewonnen.':res==='dead'?'Je held is gesneuveld.':'Niet gewonnen.');
  setText($('#lScore'),String(sc));setText($('#lTime'),Math.round(a.age)+' s');$('#labEnd').hidden=false;try{$('#lAgain').focus({preventScroll:true});}catch{}}
function buildLabList(){const ul=$('#miniList');if(ul.children.length)return;
  const head=t=>{const li=document.createElement('li');li.className='mh';li.textContent=t;ul.append(li);};
  const item=(K,id,nr,chip)=>{const li=document.createElement('li'),n=document.createElement('span'),tx=document.createElement('span'),b=document.createElement('b'),d=document.createElement('span'),go=document.createElement('button');
    n.className='rk num';n.textContent=nr;tx.className='tx';b.textContent=K.n;d.className='sub';d.textContent=chip;tx.append(b,d);go.type='button';go.textContent='Speel';go.dataset.k=id;go.setAttribute('aria-label',K.n+' spelen');li.append(n,tx,go);ul.append(li);};
  for(let t=1;t<TIERS.length;t++){const ds=LAB.filter(d=>d.tier===t);if(!ds.length)continue;head(TIERS[t]);for(const d of ds)item(d,d.id,String(d.nr),d.d+' '+d.win);}
  head('Zit al in het spel');for(const[lv,id]of Object.entries(MINI)){if(id==='chairs'&&+lv!==30)continue;const K=KIND[id];item(K,id,'L'+(id==='chairs'?'30/50':lv),K.go);}
  ul.addEventListener('click',ev=>{const b=ev.target.closest('button[data-k]');if(b)startLab(b.dataset.k);});}

// De regel onder de titel in het opdrachtvenster.
function arenaSub(a,sec){const best=()=>{let b=-1;for(const o of rivals(a))if(o.st!==2&&o.sc>b)b=o.sc;return b;};
  if(a.mode==='boss'){const u=a.ult;if(u)return u.kind==='safe'?`Ultra-aanval over ${Math.max(1,Math.ceil(u.t))} s · ren naar groen`:u.kind==='rings'?'Schokgolven · ga in de groene opening staan':'Doodsstralen · loop mee tussen de stralen';
    let s=`Nog ${sec} seconden · ${a.B.N.slice(3)} ${Math.ceil(a.g.hp/a.max*100)}%`;if(a.kind==='duel'){const b=best();s+=` · jouw schade ${fmt(myBh)}`+(b>=0?` · beste ander ${fmt(b)}`:'');}return s;}
  if(a.mode==='run')return`Nog ${sec} seconden · ${a.tw.filter(t=>t.hp>0).length} torens over`;
  if(a.mode==='chairs')return chairsSub(a);
  if(a.mode==='lab'){const b=best();return a.K.sub(a,sec)+(b>=0?` · beste ander ${b}`:'');}
  if(a.mode==='mini'){const b=best();return`Nog ${sec} s · jij ${Math.floor(a.score)}`+(b>=0?` · beste ander ${b}`:a.rivals?'':` · doel ${a.K.goal}`)+(a.carry?' · breng de kern naar het midden':'');}
  return`Nog ${sec} seconden · ${a.kills} verslagen`;}
function hud(){if(!G)return;setText($('#hGold'),fmt(G.gold));setText($('#hLives'),String(G.lives));setText($('#hRound'),G.round+'/'+ROUNDS);setText($('#hScore'),fmt(G.score));setText($('#hRoundBig'),String(G.round));
  const wb=$('#waveBtn'),left=G.en.length+G.q.length;let fr;
  const ms=mates(),qr=$('#qRoad'),prep=G.phase==='prep'&&!arena;qr.hidden=!prep;
  if(arena){const a=arena,sec=Math.max(0,Math.ceil(a.t));wb.disabled=true;setText(wb,'Minigame bezig');setText($('#qTitle'),a.K.n);
    setText($('#qSub'),arenaSub(a,sec));fr=1-a.t/a.T;}
  else if(prep){const t=Math.ceil(G.timer),pv=E.preview(G),n=ms.filter(p=>p.presence.bd===true).length+(built?1:0);
    wb.disabled=false;setText(wb,built?'Toch niet klaar':'Klaar met bouwen');setText($('#qTitle'),'Bouwfase');
    setText($('#qSub'),`Nog ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`+(ms.length?` · ${n} van ${ms.length+1} klaar`:''));
    qr.classList.toggle('ok',pv.road);setText(qr,pv.road?`Je weg loopt door van poort tot poort: ${pv.cells.length} vakken.`:'Nog geen doorlopende weg van de linkerpoort naar de rechterpoort. Zonder weg steekt de vijand het gras over.');
    fr=1-G.timer/E.PREP;waveTotal=0;}
  else if(G.phase==='wait'){const w=ms.filter(p=>(+p.presence.cl||0)<G.cleared).length,fin=G.final&&arenaFor>=ROUNDS;wb.disabled=true;setText(wb,'Wachten');setText($('#qTitle'),fin?'De Titaan':`Ronde ${G.cleared} afgeslagen`);
    setText($('#qSub'),fin?'Je bent uitgeschakeld. De rest vecht door.':w?`Wachten op ${w} speler${w===1?'':'s'}`:'Iedereen is klaar');fr=1;waveTotal=0;}
  else if(G.phase==='build'){const L=lead();wb.disabled=!!L;setText(wb,L?'Speler 1 stuurt de golf':'Stuur golf (spatie)');setText($('#qTitle'),'Golf '+G.round+' nadert');setText($('#qSub'),`Begint over ${Math.ceil(G.timer)} seconden`);fr=1-Math.max(0,G.timer)/(G.cleared?8:10);waveTotal=0;}
  else{wb.disabled=true;setText(wb,'Golf bezig');if(left>waveTotal)waveTotal=left;setText($('#qTitle'),'Golf '+G.round);setText($('#qSub'),`Nog ${left} vijand${left===1?'':'en'}`);fr=waveTotal?1-left/waveTotal:0;}
  $('#arc').style.strokeDashoffset=String(138.2*(1-Math.max(0,Math.min(1,fr))));
  $('#heroHp').style.width=Math.max(0,Math.min(100,hero.hp/maxHp()*100))+'%';}
/* commandokaart: 12 vakken, inhoud hangt af van wat geselecteerd is */
let cur=[],tipIdx=-1;
const shieldSlot=()=>({ic:'shield',key:'F',n:'Schild',d:`Houdt ${String(2.5+HM.shDur).replace('.',',')} seconden alle kogels tegen. Daarna laadt het ${9-HM.shCd} seconden op.`,on:shieldT>0,wait:Math.ceil(shieldCd),act:useShield});
function cardSlots(){const a=[];if(!G)return a;
  if(arena){let c=a;if(arena.mode==='run')a[0]=shieldSlot();else if(arena.K.card)c=arena.K.card(arena)||a;c[9]=pushSlot();c[10]=sprintSlot();return c;}
  if(sel){const t=sel;
    const mx=E.maxLvl(t),pay=fn=>()=>{if(!fn())toast('Te weinig credits');};
    if(t.type==='sleeper'){const W=E.WAKE,n=t.pokes||0;
      a[0]={ic:'wake',key:'P',n:'Wek poppetje Geers',tag:t.spec==='awake'?Math.ceil(t.awakeT)+' s':t.spec?'':n+'/'+W.pokes,on:t.spec==='awake',poor:t.spec==='spent',
        d:t.spec==='awake'?`Hij is wakker! Nog ${Math.ceil(t.awakeT)} seconden ${W.mul}× zo veel kracht en bereik.`:t.spec==='spent'?'Hij is al een keer wakker geweest en slaapt nu voorgoed. De knop werkt niet meer.':`Druk ${W.pokes} keer om hem te wekken. Dan is hij ${W.time} seconden wakker met ${W.mul}× zo veel kracht en bereik. Dat kan maar één keer. Nu ${n} van ${W.pokes}.`,
        act:()=>{if(t.spec==='spent'){toast('De Slapende Geers is al een keer wakker geweest');return;}if(!E.poke(G,t))return;
          if(gl3){const[ox,oz]=slotO(mySlot);fxBall(V(ox+t.x,1.6,oz+t.y),'#e6d8ff',.1,.5+.08*(t.pokes||0),.25,.7);}
          if(t.spec!=='awake'&&t.pokes>=W.pokes-3)toast(`Hij beweegt… nog ${W.pokes-t.pokes}`,900);}};}
    if(t.lvl<mx)a[0]={ic:'up',key:'U',n:'Upgrade naar niveau '+(t.lvl+1),cost:E.upCost(G,t),d:t.type==='geers'?'22% meer schade, en iets meer bereik en vuursnelheid.':'40% meer schade, en iets meer bereik en vuursnelheid.',act:pay(()=>E.upgrade(G,t))};
    else if(E.hasTiers(t.type)){
      if(!t.spec)a[0]={ic:'ultra',key:'U',n:'Ultra '+T[t.type].n,cost:E.specCost(G,t,'ultra'),d:(t.type==='uplink'?'De ultra versie: groter bereik en een sterkere versterking.':'De ultra versie: flink meer schade, 15% sneller en 10% meer bereik.')+' Daarna kan hij turbo worden.',act:pay(()=>E.spec(G,t,'ultra'))};
      else if(t.spec==='ultra'){const ok=E.canTurbo(G,t),c=E.specCost(G,t,'turbo');
        a[0]={ic:'turbo',key:'T',n:'Turbo '+T[t.type].n,cost:c,poor:!ok||G.gold<c,d:ok?(t.type==='uplink'?'De turbo versie: anderhalf keer zo veel versterking.':'De turbo versie: 80% sneller en 30% meer schade, boven op ultra.'):'Nog niet mogelijk: er moet eerst een andere ultra toren staan.',
          act:()=>{if(!ok)toast('Maak eerst nog een andere toren ultra');else if(!E.spec(G,t,'turbo'))toast('Te weinig credits');}};}}
    a[8]={ic:'sell',key:'V',n:'Verkopen',gain:E.sellValue(G,t),d:'Sloop deze toren en krijg een deel van je credits terug.',act:()=>{E.sell(G,t);sel=null;}};
    a[11]={ic:'back',key:'Esc',n:'Terug',d:'Terug naar de bouwkaart.',act:()=>{sel=null;}};return a;}
  TYPES.forEach((type,i)=>a[i]={ic:type,key:String((i+1)%10),n:T[type].n,cost:E.buildCost(G,type),d:T[type].d,vs:type,fit:E.VS[type]?E.waveFit(type,G.round):1,on:buildSel===type,act:()=>{buildSel=buildSel===type?null:type;roadMode=false;}});
  if(G.phase==='prep')a[10]={ic:'road',key:'R',n:'Weg',free:true,d:'Sleep over je vesting om weg te leggen van de linkerpoort naar de rechterpoort. Sleep over bestaande weg om die weer weg te halen.',on:roadMode,act:roadTool};
  else{ // na de bouwfase komt hier de Geers Toren; hij gaat open als elke torensoort een turbo heeft
    const miss=E.missingTurbo(G),ok=!miss.length,c=E.buildCost(G,'geers');
    a[10]={ic:'geers',key:'G',n:T.geers.n,cost:c,poor:!ok||G.gold<c,on:buildSel==='geers',d:T.geers.d+(ok?'':` Komt vrij als elke torensoort een turbo heeft. Nog nodig: ${miss.map(k=>SHORT[k]).join(', ')}.`),
      act:()=>{if(!ok){toast(`Nog ${miss.length} turbo${miss.length===1?'':'’s'} nodig: ${miss.map(k=>SHORT[k]).join(', ')}`);return;}buildSel=buildSel==='geers'?null:'geers';roadMode=false;}};}
  // rechtsonder: annuleren zolang er iets te annuleren valt, anders De Slapende Geers
  if(buildSel||roadMode||orders.length||G.phase==='prep')a[11]={ic:'cancel',key:'Esc',n:'Annuleer',d:'Stop met bouwen en wis alle bouwopdrachten.',act:()=>{buildSel=null;roadMode=false;orders=[];}};
  else{const n=E.geersCount(G),has=G.tw.some(t=>t.type==='sleeper'),ok=E.sleeperReady(G),c=E.buildCost(G,'sleeper');
    a[11]={ic:'sleeper',key:'Z',n:T.sleeper.n,cost:has?null:c,poor:!ok||G.gold<c,d:T.sleeper.d+(has?' Hij staat er al; er kan er maar één zijn.':ok?' Klik op het middelste van 3 bij 3 vrije vakken.':` Komt vrij bij ${E.GEERS_NEED} Geers Torens. Je hebt er ${n}.`),
      act:()=>{if(has)toast('De Slapende Geers staat er al');else if(!ok)toast(`Bouw eerst ${E.GEERS_NEED} Geers Torens. Je hebt er ${n}`);else{buildSel='sleeper';roadMode=false;}}};}
  return a;}
const r1=n=>(Math.round(n*10)/10).toLocaleString('nl-NL');
/* matchups: korte torennamen voor in de golfvoorvertoning, en de regels "sterk tegen / zwak tegen" */
const SHORT={sentry:'Sentry',flak:'Flak',cryo:'Cryo',toxin:'Toxine',tesla:'Tesla',prism:'Prisma',rocket:'Raket',rail:'Railgun',wave:'Golfkanon',uplink:'Commandopost'};
const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
// Wat komt eraan, en welke torens werken daar goed tegen.
function paintNext(){const q=$('#qNext');q.textContent='';q.append(mk('b','hd','Golf '+G.round+' bestaat uit'));
  for(const o of E.waveMix(G.round)){const li=mk('span','en');li.append(mk('b',null,o.n+'× '+EN[o.type].n),mk('i','good',E.counters(o.type).map(t=>SHORT[t]).join(', ')));q.append(li);}
}
function paintVs(p,type){const k=E.VS[type]?type:'';if(p.dataset.v===k)return;p.dataset.v=k;p.textContent='';p.hidden=!k;if(!k)return;
  const a=mk('span','good'),b=mk('span','bad');a.append(mk('b',null,'Sterk tegen '),E.strongVs(type).map(e=>EN[e].n).join(', '));b.append(mk('b',null,'Zwak tegen '),E.weakVs(type).map(e=>EN[e].n).join(', '));p.append(a,b);}
function refresh(){if(!G)return;if(sel&&!G.tw.includes(sel))sel=null;cur=cardSlots();const card=$('#card');
  for(let i=0;i<12;i++){const b=card.children[i],s=cur[i];b.classList.toggle('empty',!s);if(!s){b.tabIndex=-1;continue;}b.tabIndex=0;
    if(b.dataset.ic!==s.ic){b.dataset.ic=s.ic;iconDraw(b.firstChild,s.ic);}
    setText(b.children[1],s.key);setText(b.children[2],s.tag!=null?s.tag:s.wait?s.wait+' s':s.free?'gratis':s.cost!=null?String(s.cost):s.gain!=null?'+'+s.gain:'');
    b.classList.toggle('on',!!s.on);b.classList.toggle('good',s.fit>1.12);b.classList.toggle('bad',s.fit<.88);b.classList.toggle('poor',(s.poor!=null?s.poor:s.cost!=null&&G.gold<s.cost)||(!!s.wait&&!s.on));b.setAttribute('aria-label',s.n+(s.cost!=null?', '+s.cost+' credits':'')+(s.fit>1.12?', sterk tegen de komende golf':s.fit<.88?', zwak tegen de komende golf':''));}
  const tip=$('#tip'),ts=cur[tipIdx];tip.hidden=!ts;
  if(ts){setText($('#tipN'),ts.n+' ('+ts.key+')');const c=$('#tipC'),txt=ts.free?'gratis':ts.cost!=null?String(ts.cost):ts.gain!=null?'+'+ts.gain:'';c.hidden=!txt;if(c.dataset.v!==txt){c.dataset.v=txt;c.textContent='';const i=document.createElement('i');i.className='coin';c.append(i,document.createTextNode(txt));}setText($('#tipD'),ts.d);paintVs($('#tipVs'),ts.vs);}
  // portret + infopaneel
  const st=$('#iStats'),pc=$('#pcv'),show=(s,type)=>{st.hidden=false;setText($('#iDmg'),type==='uplink'?'+'+Math.round(s.aura*100)+'%':fmt(s.dmg));setText($('#iRate'),type==='uplink'?'–':r1(s.rate));setText($('#iRange'),r1(s.range));};
  paintVs($('#iVs'),sel?sel.type:roadMode?'':buildSel||'');
  const face=sel?sel.type:roadMode?'road':buildSel||'hero'+save.hero;if(pc.dataset.ic!==face){pc.dataset.ic=face;iconDraw(pc,face);}
  if(sel){const t=sel,b=T[t.type];setText($('#iName'),b.n);
    const mx=E.maxLvl(t),tiers=E.hasTiers(t.type),step=t.lvl+E.tierOf(t),steps=mx+(tiers?2:0);
    setText($('#iSub'),t.type==='sleeper'?(t.spec==='awake'?'Wakker!':'3 bij 3 vakken'):`Niveau ${t.lvl}${t.spec==='turbo'?' · turbo':t.spec==='ultra'?' · ultra':''}`);show(t.s,t.type);
    setText($('#iDesc'),t.type==='sleeper'?`Vertraagt alles binnen bereik met ${Math.round(t.s.slow*100)}%. ${b.d}`:t.spec==='turbo'?'Turbo: de hoogste trap van deze toren. '+b.d:t.spec==='ultra'?(E.canTurbo(G,t)?'Ultra: klaar voor turbo. ':'Ultra: voor turbo moet er nog een andere ultra toren staan. ')+b.d:b.d);
    $('#pBar').style.width=(t.type==='sleeper'?(t.spec==='awake'?t.awakeT/E.WAKE.time*100:t.spec?0:(t.pokes||0)/E.WAKE.pokes*100):steps?step/steps*100:100)+'%';setText($('#pBarT'),t.type==='sleeper'?(t.spec==='awake'?`Wakker · nog ${Math.ceil(t.awakeT)} s`:t.spec==='spent'?'Slaapt voorgoed':`Wekken ${t.pokes||0}/${E.WAKE.pokes}`):t.spec?(t.spec==='turbo'?'Turbo':'Ultra'):`Niveau ${t.lvl}/${mx}`);}
  else if(roadMode){const pv=E.preview(G);setText($('#iName'),'Weg');setText($('#iSub'),'Gratis · alleen in de bouwfase');st.hidden=true;
    setText($('#iDesc'),'Sleep over je vesting om weg te leggen. De vijand komt binnen bij de rode poort links en loopt naar de blauwe poort rechts.');$('#pBar').style.width=(pv.road?100:0)+'%';setText($('#pBarT'),pv.road?'Weg loopt door':G.road.size+' vakken gelegd');}
  else if(buildSel){const b=T[buildSel];setText($('#iName'),b.n);setText($('#iSub'),`Bouwen · ${E.buildCost(G,buildSel)} credits`);show(E.stats(G,{type:buildSel,lvl:0,spec:null,aura:0}),buildSel);
    setText($('#iDesc'),b.d+(b.size>1?' Klik op het middelste van 3 bij 3 vrije vakken.':' Klik op een vrij vak om te bouwen.'));$('#pBar').style.width='0%';setText($('#pBarT'),'Bouwplan');}
  else{const H=HEROES[save.hero];setText($('#iName'),H.n);setText($('#iSub'),arena?arena.K.n:orders.length?`${orders.length} bouwopdracht${orders.length===1?'':'en'} in de rij`:H.role);
    st.hidden=false;setText($('#iDmg'),fmt(H.dmg*HM.hDmg*(armour>=3?1.3:1)*(arena?1:heroScale())));setText($('#iRate'),r1(H.rate*HM.hRate));setText($('#iRange'),r1(H.range*HM.hRange));
    setText($('#iDesc'),H.d+' Je held valt vanzelf aan binnen bereik.');$('#pBar').style.width=Math.max(0,hero.hp/maxHp()*100)+'%';setText($('#pBarT'),Math.max(0,Math.ceil(hero.hp))+' / '+Math.round(maxHp()));}
  const nk=G.round;if(nextRound!==nk){nextRound=nk;paintNext();}
  paintSpeed();
  const inv=$('#invGrid');for(let i=0;i<4;i++){const c=inv.children[i],has=i<armour,k=has?'arm'+i:'slot';if(c.dataset.ic!==k){c.dataset.ic=k;iconDraw(c,k);c.classList.toggle('has',has);c.title=has?ARMOUR[i].n+': '+ARMOUR[i].d:'Leeg. Win een minigame om een stuk harnas te krijgen.';}}}
let last=0,acc=0,slow=0;
function frame(ts){requestAnimationFrame(frame);const dt=Math.min(.1,(ts-last)/1000||0);last=ts;logic(dt);
  if(G){const fs=render3D(ts/1000,dt)||fieldsNow();hud();slow+=dt;if(slow>.25){slow=0;refresh();pushPresence();updWorldUi(fs);}}}
function logic(dt){if(window.__ratdPause)return;
  if(G&&lab){if(!lab.over){if(arena)updArena(dt);G.ev.length=0;G.fx.length=0;updHero(dt);}return;}
  if(G&&!ended){sync();if(arena)updArena(dt);else if(G.phase!=='prep'){acc+=dt*speed;let n=0;while(acc>=STEP&&n<14){E.step(G,STEP);acc-=STEP;n++;}if(n>=14)acc=0;}
    botsTick(dt);events();updHero(dt);pushHero();if(G.phase==='over'||G.phase==='won')endGame();}
  // muziek: rustig tijdens het potje, sneller en voller in een minigame; stil in de lobby en na afloop
  Music.sync(G&&!ended?{level:arena?arena.r:G.round,mini:!!arena}:null);}
// Een tabblad op de achtergrond krijgt geen frames meer. Het spel loopt dan hier door, anders wacht iedereen op jou.
setInterval(()=>{const now=performance.now();if(now-last<600)return;let dt=Math.min(3,(now-last)/1000);last=now;
  while(dt>.001){const d=Math.min(.1,dt);logic(d);dt-=d;}if(G)pushPresence();},500);

/* ================= bots ================= */
// Start je alleen, dan vullen acht bots de wereld. Een bot wordt in deze browser nagespeeld: hij heeft een eigen vesting met dezelfde spelregels
// (Engine), een andere held dan jij en precies jouw talenten. Voor de rest van het spel is hij een medespeler: hij staat in `peers` met dezelfde
// presence als een mens, zodat rondes, minigames en de wereld zonder uitzonderingen werken. Zijn t is hoger dan de jouwe, dus jij blijft speler 1.
const BOTN=8,BOTNAMES=['Tanya','Boris','Natasha','Yuriko','Giles','Zhana','Warren','Moskvin'];
// De volgorde waarin een bot torens bouwt, en de kolommen waarlangs zijn weg kan slingeren.
const BSEQ=['flak','sentry','cryo','tesla','sentry','rocket','toxin','rail','flak','prism','wave','uplink','tesla','rail','rocket','prism'],BROADS=[[0,3,6,9,12],[0,4,8,12],[0,6,12]];
// BF: het baasgevecht van de bots, voor als ze zonder jou verder vechten.
let bots=[],netPeers=[],bacc=0,bslow=0,BF=null;
const botLive=b=>b.G.phase!=='over'&&b.G.phase!=='won';
const botMax=b=>HEROES[b.idx].hp*b.G.m.hHp*(b.armour>=2?1.4:1);
function mergePeers(){peers=bots.length?netPeers.concat(bots):netPeers;}
function clearBots(){if(!bots.length)return;bots=[];BF=null;mergePeers();syncPeers();}
function botHurt(b,d){const m=b.G.m;if(m.hDodge&&Math.random()<m.hDodge)return;b.h.hp-=d*(1-m.hArm);}
function botGo(b,x,z,step){const h=b.h,dx=x-h.x,dz=z-h.z,d=Math.hypot(dx,dz);if(d<.03)return;if(d<=step){h.x=x;h.z=z;}else{h.x+=dx/d*step;h.z+=dz/d*step;}h.a=Math.atan2(dz,dx);}
function inArena(x,z){const d=Math.hypot(x-ACX,z-ACZ),m=AR-.4;return d>m?[ACX+(x-ACX)/d*m,ACZ+(z-ACZ)/d*m]:[x,z];}
// De weg van een bot: een slinger van de linkerpoort naar de rechterpoort. Daarna de bouwplekken, de beste eerst: hoe meer weg in de buurt, hoe beter.
function botRoad(b){const g=b.G,M=E.MID,cols=BROADS[Math.random()*BROADS.length|0],flip=Math.random()<.5,cells=[],add=(x,y)=>cells.push((flip?N-1-y:y)*N+x);let y=M,up=true;
  cols.forEach((x,k)=>{const to=k===cols.length-1?M:up?1:N-2;for(;y!==to;y+=Math.sign(to-y))add(x,y);add(x,y);
    if(k<cols.length-1){for(let u=x+1;u<cols[k+1];u++)add(u,y);up=!up;}});
  for(const c of cells)E.setRoad(g,c,true);
  const on=new Set(cells),sc=[];
  for(let c=0;c<N*N;c++){if(on.has(c)||c===E.C_IN||c===E.C_OUT)continue;const x=c%N,cy2=(c-x)/N;let n=0;
    for(const r of cells){const dx=r%N-x,dy=(r-r%N)/N-cy2;if(dx*dx+dy*dy<=6.5)n++;}sc.push([c,n+Math.random()]);}
  b.cells=sc.sort((p,q)=>q[1]-p[1]).map(p=>p[0]);}
function spawnBots(){const hs=HEROES.map((h,i)=>i).filter(i=>i!==save.hero).sort(()=>Math.random()-.5),used=takenSlots(),free=[],mc=mySlot%COLS,mr=Math.floor(mySlot/COLS);
  const far=s=>Math.hypot(s%COLS-mc,Math.floor(s/COLS)-mr);
  for(let s=0;s<SLOTS;s++)if(s!==mySlot&&!used.has(s))free.push(s);
  free.sort((p,q)=>far(p)-far(q)); // de vestingen rond die van jou
  bots=free.slice(0,BOTN).map((slot,i)=>{const g=E.create(save.skills),[ox,oz]=slotO(slot);g.maxLives=g.lives;
    const b={peer:'bot-'+(i+1),kind:'viewer',by:null,name:'Bot '+BOTNAMES[i%BOTNAMES.length],sameTab:false,isMe:false,bot:true,presence:{},G:g,idx:hs[i%hs.length],slot,t:myT+1+i,
      h:{x:ox+6.5,z:oz+5.5,a:-1.57,hp:0,cd:0},ak:0,as:0,armour:0,built:false,readyAt:4+Math.random()*10,nx:0,arenaFor:0,ar:null,order:null,think:1+Math.random()*2,seq:0,cells:[],
      bh:0,bm:0,ms:null,react:.25+Math.random()*.5,skill:.3+Math.random()*.3};
    botRoad(b);b.h.hp=botMax(b);botPres(b);return b;});
  bacc=0;BF=null;mergePeers();syncPeers();}
// Wat een mens van een medespeler ziet, vult een bot zelf in.
function botPres(b){const g=b.G,h=b.h,a=b.ar,pr=b.presence;pr.st=botLive(b)?'playing':'done';pr.t=b.t;pr.mt=matchId;pr.sl=b.slot;pr.r=g.round;pr.l=g.lives;pr.s=g.score;pr.sp=speed;
  pr.bd=b.built;pr.ps=g.phase==='prep'?0:1;pr.cl=g.cleared;pr.nx=b.nx;pr.sw=0;pr.wn=g.phase==='won'?1:0;
  pr.h=b.idx;pr.p=[h.x,h.z,h.a];pr.hp=Math.max(0,Math.round(h.hp));pr.mh=Math.round(botMax(b));pr.ar=a?a.seq:0;pr.ak=b.ak;pr.am=a?a.r:0;pr.bm=b.bm;pr.bh=Math.round(b.bh);
  pr.ms=a&&a.ms?[a.r,Math.floor(a.score),0]:b.ms;pr.sc=a&&a.sc||null;}
function botFields(fs,used){for(const b of bots){if(used.has(b.slot))continue;used.add(b.slot);const g=b.G;
    fs.push({slot:b.slot,own:false,bot:true,tw:g.tw,en:g.en,name:b.name,r:g.round,l:g.lives,done:!botLive(b),road:g.road,trail:g.trail,psig:'b'+g.rv});}}
/* --- een bot in zijn vesting: bouwen, upgraden en meevechten --- */
// Eén besluit per keer: een toren erbij zolang de vesting daar ruimte voor heeft, en anders de goedkoopste stap in de keten:
// upgrade, ultra, turbo. Staat van elke soort een turbo, dan bouwt hij Geers Torens en daarna De Slapende Geers.
function botThink(b){const g=b.G;
  if(g.phase==='wave'&&g.en.some(e=>e.boss))for(const t of g.tw)if(E.canWake(t))while(E.canWake(t))E.poke(g,t); // een bot wekt hem als er een baas loopt
  if(b.order)return;
  if(g.tw.length<Math.min(b.cells.length,5+Math.floor(g.round*.7))){const type=BSEQ[b.seq%BSEQ.length],c=b.cells.find(k=>E.canBuild(g,k));
    if(c!==undefined&&g.gold>=E.buildCost(g,type)){b.order={c,type};b.seq++;return;}}
  if(E.sleeperReady(g)){if(g.gold>=E.buildCost(g,'sleeper')){for(let c=0;c<N*N;c++)if(E.canBuild(g,c,'sleeper')){b.order={c,type:'sleeper'};return;}}}
  else if(E.geersReady(g)&&E.geersCount(g)<E.GEERS_NEED){if(g.gold>=E.buildCost(g,'geers')){const c=b.cells.find(k=>E.canBuild(g,k));if(c!==undefined){b.order={c,type:'geers'};return;}}}
  let best=null,kind='',bc=1e9;
  for(const t of g.tw){let k,c;
    if(t.lvl<E.maxLvl(t)){k='up';c=E.upCost(g,t);}else if(!E.hasTiers(t.type))continue;
    else if(!t.spec){k='ultra';c=E.specCost(g,t,k);}else if(E.canTurbo(g,t)){k='turbo';c=E.specCost(g,t,k);}else continue;
    if(c<bc){bc=c;best=t;kind=k;}}
  if(best&&g.gold>=bc){if(kind==='up')E.upgrade(g,best);else E.spec(g,best,kind);}}
// De held van een bot valt aan zoals die van een speler. Geeft de dichtstbijzijnde vijand terug, zodat hij erheen kan lopen.
function botShoot(b,dt){const g=b.G,h=b.h,H=HEROES[b.idx],m=g.m,[ox,oz]=slotO(b.slot),HR=H.range*m.hRange,inr=[];h.cd-=dt*speed;
  let best=null,bv=1e18,near=null,nd=1e9;
  for(const e of g.en){if(e.dead)continue;const d=Math.hypot(ox+e.x-h.x,oz+e.y-h.z);if(d<nd){nd=d;near=e;}
    if(d<=HR+(e.boss?.7:0)){inr.push(e);const v=H.k==='snipe'?-e.hp:d;if(v<bv){bv=v;best=e;}}}
  const out=near?{e:near,d:nd}:null;if(!best||h.cd>0)return out;
  h.cd=1/(H.rate*m.hRate);b.ak++;const ta=Math.atan2(oz+best.y-h.z,ox+best.x-h.x);h.a=ta;
  const base=H.dmg*m.hDmg*(b.armour>=3?1.3:1)*(Math.random()<m.hCrit?2+m.hCritDmg:1)*Math.pow(E.hpMul(g.round)/E.hpMul(1),.75);
  const hit=(e,d,p)=>{const was=e.dead;E.hit(g,e,d*(e.boss?m.hBoss:1),1-(1-(p||0))*(1-m.hAp));if(e.dead&&!was&&m.hGold)g.gold+=Math.round(e.b*m.hGold);};
  if(H.k==='slam'){for(const e of g.en)if(!e.dead&&Math.hypot(ox+e.x-h.x,oz+e.y-h.z)<=1.9+(e.boss?.7:0))hit(e,base);}
  else if(H.k==='flame'){for(const e of inr){let da=Math.abs(Math.atan2(oz+e.y-h.z,ox+e.x-h.x)-ta);if(da>Math.PI)da=TAU-da;if(da<.6)hit(e,base);}}
  else if(H.k==='bolt'){let cur=best,d=base;const done=new Set();
    for(let i=0;i<3&&cur;i++){done.add(cur);hit(cur,d,.5);d*=.7;let nxt=null,bd=2.4;for(const e of g.en){if(e.dead||done.has(e))continue;const dd=Math.hypot(e.x-cur.x,e.y-cur.y);if(dd<bd){bd=dd;nxt=e;}}cur=nxt;}}
  else hit(best,base,H.k==='snipe'?1:0);
  return out;}
function botHome(b,dt){const g=b.G,h=b.h,H=HEROES[b.idx],m=g.m,[ox,oz]=slotO(b.slot);h.hp=botMax(b);
  b.think-=dt*speed;if(b.think<=0){b.think=.7+Math.random()*.9;botThink(b);}
  let tx=null,tz=0;
  if(b.order){const c=b.order.c,x=c%N;tx=ox+x+.5;tz=oz+(c-x)/N+.5;
    if(Math.hypot(tx-h.x,tz-h.z)<1.6){E.build(g,c,b.order.type);b.order=null;tx=null;}} // net als bij een speler loopt de held eerst naar het vak
  const tg=botShoot(b,dt);
  if(tx===null&&tg&&tg.d>H.range*m.hRange*.8){tx=ox+tg.e.x;tz=oz+tg.e.y;}
  if(tx!==null)botGo(b,Math.max(ox+.3,Math.min(ox+N-.3,tx)),Math.max(oz+.3,Math.min(oz+N-.3,tz)),H.spd*m.hSpd*(b.armour>=4?1.2:1)*dt);}
// Bouwfase, golven en rondes lopen gelijk met die van jou, precies zoals bij een medespeler.
function botSync(b){const g=b.G,ok=f=>bots.every(o=>o===b||!botLive(o)||f(o));
  if(g.phase==='prep'){g.timer=G.timer;if(!b.built&&performance.now()-t0>b.readyAt*1000)b.built=true;if(G.phase!=='prep'){E.lock(g);b.built=true;}}
  else if(g.phase==='build'){if(G.round===g.round&&(G.phase==='wave'||sentWave===g.round))E.startWave(g);}
  else if(g.phase==='wait'){const r=g.cleared;if(G.cleared<r||!ok(o=>o.G.cleared>=r))return;
    if(MINI[r]&&b.arenaFor<r)return; // de minigame begint voor iedereen tegelijk, zodra jij erin stapt
    if(b.ar||g.final)return;b.nx=g.round;if(nx>=g.round&&ok(o=>o.nx>=g.round))E.next(g);}}
/* --- bots in de minigames --- */
// Bots stappen tegelijk met jou een minigame in en spelen hem echt mee: ze lopen, ontwijken, scoren en kunnen sneuvelen.
function botsEnter(kind,r){const K=KIND[kind],inn=bots.filter(botLive);BF=null;if(!K||!inn.length)return;
  // ga: de kant van de baas waar de bots bij elkaar staan. Na elke klap schuift de groep een stuk op, zodat ze samen uit de rode cirkels lopen.
  if(K.m==='boss')BF={r,kind,max:arena&&arena.max||Math.round((BOSS[kind]||BOSS.boss).hp*Math.pow(1+inn.length,1.1)),t:K.T,ga:Math.random()*TAU,dir:Math.random()<.5?1:-1,seen:0};
  inn.forEach((b,i)=>{const h=b.h,an=TAU*i/inn.length+Math.random()*.5;b.arenaFor=r;b.order=null;h.hp=botMax(b);h.cd=.5+Math.random();
    b.ar={r,kind,mode:K.m,seq:++b.as,age:0,t:K.T,score:0,ms:K.m==='mini'||K.m==='chairs'||kind==='duel',an,rr:3.2+Math.random()*2.2,sw:2+Math.random()*16,inn:false,
      wait:1+Math.random()*8,wp:0,pa:BF?BF.ga+Math.atan2(Math.sin(an-BF.ga),Math.cos(an-BF.ga)):an,hit:1,im:0,rp:[],u:null,ud:0,rd:0,jd:0,spot:-1,go:0,sc:null,carry:false,pt:null,skip:new Map(),miss:new Map(),hitK:null};
    if(K.m==='run'){h.x=RUN.x+1.5;h.z=RUN.z+1.5+Math.random()*(RUN.W-3);h.a=0;}
    else{const d=5+Math.random()*2.5;h.x=ACX+Math.cos(an)*d;h.z=ACZ+Math.sin(an)*d;h.a=an+Math.PI;}
    if(K.m==='boss'){b.bm=r;b.bh=0;}});}
// Staat er nog een andere held op deze plek?
function heroOn(a,x,z,R,b){if(hero.hp>0&&Math.hypot(hero.x-x,hero.z-z)<=R)return true;
  for(const o of bots)if(o!==b&&o.ar&&o.ar.r===a.r&&o.h.hp>0&&Math.hypot(o.h.x-x,o.h.z-z)<=R)return true;return false;}
function botDown(b,final){const a=b.ar;if(!final&&b.G.m.second&&!a.sc2){a.sc2=true;b.h.hp=botMax(b)*.3;return;}botLeave(b,'dead');}
// Terug naar de eigen vesting, met de beloning van een winnaar.
function botLeave(b,res){const a=b.ar,g=b.G,[ox,oz]=slotO(b.slot);if(!a)return;b.ar=null;if(a.ms)b.ms=[a.r,Math.floor(a.score),res==='dead'||res==='out'?2:1];
  b.h.x=ox+6.5;b.h.z=oz+5.5;b.h.a=-1.57;b.h.hp=botMax(b);if(res!=='win')return;g.gold+=g.m.mission;
  if(a.kind==='run')g.gold+=400;else if(a.kind!=='titan'){if(b.armour<4){applyArmour(++b.armour,g);b.h.hp=botMax(b);}else g.gold+=300+10*a.r;}}
function botArena(b,dt){const a=b.ar,h=b.h,H=HEROES[b.idx],m=b.G.m,mx=botMax(b),pa=arena&&arena.r===a.r&&arena.kind===a.kind?arena:null; // pa: jij staat nog in dezelfde minigame
  const rate=H.rate*m.hRate,dmg=H.dmg*m.hDmg*(b.armour>=3?1.3:1)*(1+m.hCrit*(1+m.hCritDmg));let step=H.spd*m.hSpd*(b.armour>=4?1.2:1)*dt,tx=h.x,tz=h.z;a.age+=dt;h.cd-=dt;
  if(m.hRegen&&h.hp>0)h.hp=Math.min(mx,h.hp+mx*m.hRegen*dt);
  if(a.mode==='run'){ // ieder zijn eigen doolhof: van opening naar opening, onder vuur van de torens
    const k=a.wp>>1,lx=h.x-RUN.x;a.t-=dt;
    if(k<RUN.walls.length){const[wx,sd]=RUN.walls[k],g=runGap(sd);tx=RUN.x+wx+(a.wp&1?.7:-.9);tz=RUN.z+(g[0]+g[1])/2;}else{tx=RUN.x+RUN.L-1;tz=RUN.z+RUN.W/2;}
    if(Math.hypot(tx-h.x,tz-h.z)<.2)a.wp++;botGo(b,tx,tz,step*.85);
    a.hit-=dt;if(a.hit<=0){a.hit=.8+Math.random()*.8;if(Math.random()<.22)botHurt(b,15);}
    if(lx>=RUN.L-2)botLeave(b,'win');else if(h.hp<=0)botDown(b);else if(a.t<=0)botLeave(b,'draw');return;}
  if(a.mode==='boss'){const u=pa?pa.ult:null; // een ultra-aanval die net afliep: wie niet op groen stond is dood
    if(a.u!==u){const o=a.u;a.u=u;a.rp=[];a.im=0;a.ud=b.react+Math.random()*.8;
      if(o&&o.kind==='safe'&&o.t<=0&&!o.safe.some(s=>Math.hypot(h.x-s.x,h.z-s.z)<=s.r)){h.hp=0;botDown(b,true);return;}}
    if(!pa){ // jij bent uitgeschakeld: de bots vechten versneld door
      b.bh+=dmg*rate*m.hBoss*.8*dt*4;a.score=b.bh;h.hp-=.5*(1-m.hArm)*dt*4;if(h.hp<=0)botDown(b);return;}}
  if(!pa)return; // wie de andere minigames zonder jou afmaakt, staat in botsDone
  if(h.hp<=0){botDown(b);if(!b.ar)return;}
  // Inslagen ontwijken: eruit lopen, en er niet in lopen. Per aanval (z.k: alle inslagen die tegelijk verschenen) heeft een bot hem door of niet;
  // alleen een aanval die hij mist kan hem raken (zie botsZone). Zo hangt zijn lot niet af van het gedrang tussen negen overlappende cirkels.
  let flee=null;const zs=pa.zones||[],odds=a.kind==='titan'?.02:a.mode==='boss'?.04:a.kind==='storm'?.33:.2;
  for(const z of zs){const d=Math.hypot(h.x-z.x,h.z-z.z);if(z.k===undefined)z.k=Math.round((pa.age-(z.T-z.t))*4);if(!a.miss.has(z.k))a.miss.set(z.k,Math.random()<odds);
    if(flee||d>z.r+.4||a.miss.get(z.k)||z.T-z.t<b.react*.3)continue;
    const kx=d<.05?Math.cos(a.an):(h.x-z.x)/d,kz=d<.05?Math.sin(a.an):(h.z-z.z)/d;flee=[z.x+kx*(z.r+.9),z.z+kz*(z.r+.9)];}
  const move=(x,z,st)=>{[x,z]=inArena(x,z);const dx=x-h.x,dz=z-h.z,d=Math.hypot(dx,dz)||1,k=Math.min(d,1.2),px=h.x+dx/d*k,pz=h.z+dz/d*k;
    if(!flee&&zs.some(q=>!a.miss.get(q.k)&&Math.hypot(px-q.x,pz-q.z)<q.r+.3))return;botGo(b,x,z,st);};
  if(a.mode==='boss'){const g=pa.g,B=pa.B,u=pa.ult,HR=H.range*m.hRange,db=Math.hypot(h.x-g.x,h.z-g.z),hx=h.x-ACX,hz=h.z-ACZ,hd=Math.hypot(hx,hz);
    if(u){const el=u.T-u.t;
      if(el<a.ud){} // even schrikken
      else if(u.kind==='safe'){let s=u.safe[0],bd=1e9;for(const o of u.safe){const d=Math.hypot(h.x-o.x,h.z-o.z);if(d<bd){bd=d;s=o;}}tx=s.x+Math.cos(a.an)*s.r*.5;tz=s.z+Math.sin(a.an)*s.r*.5;}
      else if(u.kind==='rings'){let nr=null;for(const r of u.rings)if((el-r.t0)*4.2<hd){nr=r;break;}if(nr){const an=nr.g+(a.rr-4.3)*.1;tx=ACX+Math.cos(an)*a.rr;tz=ACZ+Math.sin(an)*a.rr;}}
      else{const st=TAU/u.n,an=beamAng(u)+st*(.5+Math.floor(a.an/st));tx=ACX+Math.cos(an)*(a.rr+.6);tz=ACZ+Math.sin(an)*(a.rr+.6);}
      if(u.kind==='rings'){const ha=Math.atan2(hz,hx);u.rings.forEach((r,j)=>{const R=(el-r.t0)*4.2,p=a.rp[j]||0;
          if(R>0&&p<hd&&R>=hd){let da=Math.abs(ha-r.g)%TAU;if(da>Math.PI)da=TAU-da;if(da>r.w/2)botHurt(b,60);}a.rp[j]=Math.max(0,R);});}
      else if(u.kind==='beams'){a.im-=dt;if(el>1.5&&a.im<=0){const bb=beamAng(u);
          for(let k=0;k<u.n;k++){const an=bb+k*TAU/u.n,c=Math.cos(an),s=Math.sin(an);if(hx*c+hz*s>1&&Math.abs(hz*c-hx*s)<.55){botHurt(b,34);a.im=.7;break;}}}}}
    else{ // bij de groep blijven, vlak bij de baas; ligt die plek onder vuur, dan eerst de cirkel uit
      const R=Math.min(B.cr+1.1+((a.an*5)%1)*.6,HR+B.big-.25),jit=((a.an*3)%1-.5)*.5,ga=BF?BF.ga:a.pa,dA=ga-a.pa,ex=g.x+Math.cos(ga+jit)*R,ez=g.z+Math.sin(ga+jit)*R;
      a.pa+=Math.sign(dA)*Math.min(Math.abs(dA),step/R);tx=g.x+Math.cos(a.pa+jit)*R;tz=g.z+Math.sin(a.pa+jit)*R;
      if(flee&&zs.some(q=>Math.hypot(ex-q.x,ez-q.z)<q.r+.3)){tx=flee[0];tz=flee[1];}}
    if(flee){[tx,tz]=inArena(tx,tz);botGo(b,tx,tz,step);}else move(tx,tz,step);
    {const ex=h.x-g.x,ez=h.z-g.z,e=Math.hypot(ex,ez)||1,min=B.cr+.3;if(e<min&&!u){h.x=g.x+ex/e*min;h.z=g.z+ez/e*min;}} // niet door de baas heen lopen
    if(db<=HR+B.big&&h.cd<=0&&g.hp>0){h.cd=1/rate;b.ak++;b.bh+=dmg*m.hBoss;h.a=Math.atan2(g.z-h.z,g.x-h.x);if(m.leech)h.hp=Math.min(mx,h.hp+mx*m.leech/rate);}
    a.score=b.bh;return;}
  if(a.mode==='chairs'){const ph=pa.phase,mineP=i=>!!pa.my&&pa.my.i===i;
    if(ph==='run'){if(a.rd!==pa.rd){a.rd=pa.rd;a.sc=null;a.spot=-1;a.go=8.5+Math.random()*3;h.hp=mx;}
      // een veld kiezen dat nog niemand heeft, en er pas laat op gaan staan: voor de tiende seconde stopt de tijd nooit. Pak jij het veld eerst, dan zoekt de bot een ander
      if(a.spot<0||(!a.sc&&mineP(a.spot))){a.spot=-1;let bd=1e9;pa.spots.forEach((s,i)=>{if(mineP(i)||bots.some(o=>o!==b&&o.ar&&o.ar.mode==='chairs'&&o.ar.spot===i))return;const d=Math.hypot(h.x-s.x,h.z-s.z);if(d<bd){bd=d;a.spot=i;}});}
      const s=pa.spots[a.spot];
      if(!s){tx=ACX+Math.cos(a.an)*2;tz=ACZ+Math.sin(a.an)*2;} // geen veld vrij: in het midden wachten tot er een vrijkomt
      else if(pa.rt>=Math.max(CH.open,a.go)){tx=s.x;tz=s.z;if(!a.sc&&Math.hypot(h.x-s.x,h.z-s.z)<pa.R*.7)a.sc=[pa.r,pa.rd,a.spot,Math.round(pa.rt*100)/100];}
      else{let dx=ACX-s.x,dz=ACZ-s.z,d=Math.hypot(dx,dz);if(d<.1){dx=Math.cos(a.an);dz=Math.sin(a.an);d=1;}tx=s.x+dx/d*(pa.R+.8);tz=s.z+dz/d*(pa.R+.8);}
      // op een veld staan kost levenspunten: wie bijna leeg is stapt er even af
      if(a.sc){h.hp-=mx*CH.drain*pa.D*dt;if(h.hp<mx*.06){a.sc=null;a.go=pa.rt+2.5+Math.random()*3;}}else h.hp=Math.min(mx,h.hp+mx*CH.regen*dt);
      [tx,tz]=inArena(tx,tz);botGo(b,tx,tz,step);}
    else if(ph==='gap'){if(a.jd!==pa.rd){a.jd=pa.rd;if(!a.sc||a.sc[1]!==pa.rd){botLeave(b,'out');return;}a.score=pa.rd;h.hp=mx;}}
    else if(ph==='intro'){const an=a.an+a.age*.25;botGo(b,ACX+Math.cos(an)*5,ACZ+Math.sin(an)*5,step*.5);}
    return;}
  const k=a.kind;
  if(k==='hill'){ // af en toe de heuvel op; staat er al iemand, dan scoort niemand
    const p=pa.home||[ACX,ACZ],f=(a.an*7)%1,d=a.inn?.4+f*1.4:3.6+f*1.6;a.sw-=dt;if(a.sw<=0){a.inn=!a.inn;a.sw=a.inn?1.5+Math.random()*1.5:12+Math.random()*14;}
    tx=p[0]+Math.cos(a.an)*d;tz=p[1]+Math.sin(a.an)*d;if(Math.hypot(h.x-p[0],h.z-p[1])<=2.4&&!heroOn(a,p[0],p[1],2.4,b))a.score+=dt;}
  else if(k==='hunt'){ // premiejacht: de monsters van een bot zie jij niet, zijn premie wel
    a.wp-=dt;if(a.wp<=0||!a.pt){a.wp=1.5+Math.random()*2.5;a.pt=arPt(Math.random,1,AR-1.5);}tx=a.pt[0];tz=a.pt[1];
    if(h.cd<=0){h.cd=1/rate;b.ak++;}a.score+=Math.min(1.1,dmg*rate*m.hMini/34*b.skill*(H.k==='blade'||H.k==='slam'?.75:1))*dt;h.hp-=2.2*(1-m.hArm)*dt;}
  else if(k==='cores'){ // kernroof: een kern halen en naar het midden brengen
    if(a.carry){step*=.72;tx=ACX;tz=ACZ;h.hp-=4*(1-m.hArm)*dt;if(Math.hypot(h.x-ACX,h.z-ACZ)<1.6){a.carry=false;a.score++;a.wait=5+Math.random()*7;}}
    else{let c=null,bd=1e9,n=0;tx=ACX+Math.cos(a.an)*4.5;tz=ACZ+Math.sin(a.an)*4.5;a.wait-=dt;
      if(a.wait<=0)for(const o of pa.items){if(o.t0>pa.age||pa.gone.has(o.i))continue;if(++n>3)break;
          let no=a.skip.get(o.i);if(no===undefined){no=Math.random()<.6;a.skip.set(o.i,no);}if(no)continue; // niet elke bot gaat achter elke kern aan
          const d=Math.hypot(h.x-o.x,h.z-o.z);if(d<bd){bd=d;c=o;}}
      if(c){tx=c.x;tz=c.z;if(bd<1.1){pa.gone.add(c.i);a.carry=true;}}}}
  else if(k==='storm'){ // vuurstorm: binnen de krimpende kring blijven
    const R=AR-(AR-4.2)*Math.min(1,pa.age/55);a.wp-=dt;
    if(a.wp<=0||!a.pt){a.wp=2+Math.random()*3;const an=Math.random()*TAU,d=Math.sqrt(Math.random())*Math.max(.5,R-1.3);a.pt=[ACX+Math.cos(an)*d,ACZ+Math.sin(an)*d];}
    const pd=Math.hypot(a.pt[0]-ACX,a.pt[1]-ACZ),lim=Math.max(.3,R-1);if(pd>lim)a.pt=[ACX+(a.pt[0]-ACX)*lim/pd,ACZ+(a.pt[1]-ACZ)*lim/pd];
    tx=a.pt[0];tz=a.pt[1];if(Math.hypot(h.x-ACX,h.z-ACZ)>R)h.hp-=22*dt;a.score=Math.min(pa.T-1,pa.age);}
  if(flee){tx=flee[0];tz=flee[1];}
  if(k!=='storm'&&h.hp>0)h.hp=Math.min(mx,h.hp+mx*.015*dt);
  move(tx,tz,step);}
// Een inslag in de arena raakt ook een bot die erin staat, als hij de aanval niet zag aankomen. Eén aanval raakt hem hooguit één keer.
function botsZone(a,z){for(const b of bots){const o=b.ar;if(o&&o.r===a.r&&o.mode!=='run'&&o.miss.get(z.k)&&o.hitK!==z.k&&Math.hypot(b.h.x-z.x,b.h.z-z.z)<=z.r){o.hitK=z.k;botHurt(b,z.dmg);}}}
// De minigame is afgelopen voor de bots die er nog in staan. over: de baas is geveld. ps: jouw score als je tot het eind meedeed, anders -1.
// Net als bij spelers wint de hoogste score van wie nog staat, en bij gelijke stand wint iedereen die bovenaan staat.
function botsFinish(kind,over,ps,only){const K=KIND[kind],inn=bots.filter(b=>b.ar&&b.ar.kind===kind);BF=null;
  if(kind==='titan'){for(const b of bots){if(!botLive(b))continue;botLeave(b,over?'win':'draw');if(over)E.win(b.G);else E.lose(b.G);}return;}
  let top=ps;for(const b of inn)top=Math.max(top,Math.floor(b.ar.score));
  for(const b of inn){const sc=Math.floor(b.ar.score);botLeave(b,(K.m==='boss'?over&&(kind!=='duel'||sc>=top):only?b===only:sc>0&&sc>=top)?'win':'lose');}}
// Jij verlaat een minigame. In het doolhof loopt ieder voor zich, en een baas bevechten de bots desnoods zonder jou. De rest houdt op zodra jij weg bent.
function botsDone(a,res){if(!bots.length)return;const out=res==='dead'||res==='out';
  if(a.mode==='run')return;
  if(a.mode==='boss'){if(a.g.hp<=0)botsFinish(a.kind,true,a.kind==='duel'?Math.floor(myBh):-1);else if(!out)botsFinish(a.kind,false,-1);return;}
  if(a.mode==='chairs'){ // lig jij eruit, dan gaat het laatste veld naar een van de bots die er nog een had
    const inn=bots.filter(b=>b.ar&&b.ar.mode==='chairs'),had=inn.filter(b=>b.ar.sc&&b.ar.sc[1]===a.rd),from=had.length?had:inn;
    botsFinish(a.kind,false,-1,out&&from.length?from[Math.random()*from.length|0]:{});return;}
  botsFinish(a.kind,false,out?-1:Math.floor(a.score));}
function botsTick(dt){if(!bots.length)return;
  // doet er toch een mens mee in dit potje, dan maken de bots plaats
  if(netPeers.some(p=>!own(p)&&p.presence&&p.presence.mt===matchId)){clearBots();return;}
  bacc+=dt*speed;let n=0;while(bacc>=STEP&&n<14){bacc-=STEP;n++;}if(n>=14)bacc=0;
  const fc=focus(),show=gl3&&!document.hidden;
  for(const b of bots){const g=b.G,[ox,oz]=slotO(b.slot);
    if(botLive(b)){botSync(b);
      if(g.phase==='build'||g.phase==='wave'){g.fxOn=show&&Math.abs(ox+6.5-fc[0])+Math.abs(oz+6.5-fc[1])<34;for(let i=0;i<n;i++)E.step(g,STEP);}
      if(b.ar)botArena(b,dt);else if(botLive(b))botHome(b,dt);}
    g.ev.length=0;if(g.fx.length){if(show&&live.length<220)for(const f of g.fx)spawnFx(f,ox,oz);g.fx.length=0;}
    botPres(b);}
  if(BF){const inn=arena&&arena.r===BF.r&&arena.mode==='boss';
    if(inn){const l=arena.g.last;BF.max=arena.max;BF.t=arena.t;if(l&&l[0]!==BF.seen){BF.seen=l[0];if(l[1]===0)BF.ga+=BF.dir*2.2;}}
    else{let sum=myBm===BF.r?myBh:0;for(const b of bots)if(b.bm===BF.r)sum+=b.bh;BF.t-=dt*4;
      if(sum>=BF.max)botsFinish(BF.kind,true,-1);else if(BF.t<=0||!bots.some(b=>b.ar))botsFinish(BF.kind,false,-1);}}
  // komt een mens uit een ander potje op de plek van een bot te staan, dan verhuist de bot
  bslow-=dt;if(bslow<=0){bslow=1;const hum=new Set();
    for(const p of netPeers){const pr=p.presence||{};if(!own(p)&&(pr.st==='playing'||pr.st==='done')&&Number.isInteger(pr.sl))hum.add(pr.sl);}
    for(const b of bots){if(!hum.has(b.slot))continue;const used=takenSlots();used.add(mySlot);let s=0;while(s<SLOTS&&used.has(s))s++;if(s>=SLOTS)continue;
      const[ax,az]=slotO(b.slot),[cx,cz]=slotO(s);b.slot=s;if(!b.ar){b.h.x+=cx-ax;b.h.z+=cz-az;}}}
  syncPeers();}

/* ---------- invoer ---------- */
const ptr=new Map();let drag=null,pinch=0;
function bindCanvas(){const el=renderer.domElement,jv=$('#joy');
  const endJoy=()=>{joy.x=joy.y=0;jv.hidden=true;};
  el.addEventListener('pointerdown',ev=>{try{el.setPointerCapture(ev.pointerId);}catch{}ptr.set(ev.pointerId,[ev.clientX,ev.clientY]);
    if(ptr.size===1){const r=el.getBoundingClientRect();drag={x:ev.clientX,y:ev.clientY,sx:ev.clientX,sy:ev.clientY,moved:false,btn:ev.button,
        joy:ev.pointerType==='touch'&&camMode==='hero'&&ev.clientX-r.left<r.width*.42&&ev.clientY-r.top>r.height*.3};
      if(roadMode&&G&&!ended&&!arena&&G.phase==='prep'&&ev.button===0){const p=pickOwn(ev);
        if(p&&p.cell>=0&&E.canRoad(G,p.cell)&&!orders.some(o=>o.c===p.cell)){drag.joy=false;drag.paint=!G.road.has(p.cell);paintLast=-1;paintTo(p.cell,drag.paint);}}
      if(drag.joy){jv.hidden=false;jv.style.left=(ev.clientX-r.left)+'px';jv.style.top=(ev.clientY-r.top)+'px';jv.firstChild.style.transform='';}}
    else{drag=null;endJoy();const p=[...ptr.values()];pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);}});
  el.addEventListener('pointermove',ev=>{if(ptr.has(ev.pointerId))ptr.set(ev.pointerId,[ev.clientX,ev.clientY]);
    if(ptr.size===2){const p=[...ptr.values()],d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(pinch>0&&d>0){if(camMode==='hero')hcam.d*=pinch/d;else cam.d*=pinch/d;}pinch=d;return;}
    if(drag&&drag.paint!=null){const p=pickOwn(ev);if(p&&p.cell>=0&&G)paintTo(p.cell,drag.paint);hover=p?p.cell:-1;return;}
    if(drag){const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;if(!drag.moved&&Math.hypot(ev.clientX-drag.sx,ev.clientY-drag.sy)>6)drag.moved=true;
      if(drag.joy){const jx=ev.clientX-drag.sx,jy=ev.clientY-drag.sy,l=Math.hypot(jx,jy),m=Math.min(1,l/46);joy.x=l?jx/l*m:0;joy.y=l?-jy/l*m:0;jv.firstChild.style.transform=`translate(${joy.x*30}px,${-joy.y*30}px)`;return;}
      if(drag.moved){if(camMode==='hero'){hcam.yaw-=dx*.006;hcam.pitch+=dy*.004;}
        else{const k=cam.d*2*Math.tan(camera.fov*Math.PI/360)/el.clientHeight,f=[-Math.sin(cam.yaw),-Math.cos(cam.yaw)],r=[Math.cos(cam.yaw),-Math.sin(cam.yaw)];
          cam.tx+=-r[0]*dx*k+f[0]*dy*k/Math.sin(PITCH);cam.tz+=-r[1]*dx*k+f[1]*dy*k/Math.sin(PITCH);}
        drag.x=ev.clientX;drag.y=ev.clientY;hover=-1;return;}}
    if(ev.pointerType==='mouse'&&G&&!arena){const p=pickOwn(ev);hover=p?p.cell:-1;}});
  const up=ev=>{const was=drag;ptr.delete(ev.pointerId);if(ptr.size<2)pinch=0;drag=null;endJoy();if(was&&was.paint!=null){refresh();return;}if(ev.type==='pointerup'&&was&&!was.moved){if(was.btn===0)click(ev);else if(was.btn===2)rclick(ev);}};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  el.addEventListener('pointerleave',()=>hover=-1);
  el.addEventListener('wheel',ev=>{ev.preventDefault();const k=Math.exp(ev.deltaY*.0012);if(camMode==='hero')hcam.d*=k;else cam.d*=k;},{passive:false});
  el.addEventListener('contextmenu',ev=>ev.preventDefault());}
// rechtermuisknop zoals in een RTS: bouwmodus annuleren, anders de builder ergens heen sturen
function moveTo(w){if(arena&&arena.flip)w={x:2*hero.x-w.x,z:2*hero.z-w.z};hero.tx=w.x;hero.tz=w.z;camMode='hero';if(gl3)fxRing(V(w.x,0,w.z),'#35cf4a',.5,.4);}
function rclick(ev){if(!G||ended)return;if(buildSel||roadMode){buildSel=null;roadMode=false;refresh();return;}const w=pick(ev);if(w)moveTo(w);}
function click(ev){if(!G||ended)return;const w=pick(ev);if(!w)return;if(arena){moveTo(w);return;}const p=pickOwn(ev);
  if(!p||p.cell<0){if(buildSel||roadMode)toast('Je kunt alleen binnen je eigen vesting bouwen');else moveTo(w);return;}
  const k=p.cell,t=G.map[k];
  if(t){sel=t;buildSel=null;roadMode=false;refresh();return;}
  if(roadMode){toast(G.phase==='prep'?'Hier kan geen weg liggen':'De bouwfase is voorbij');return;}
  if(buildSel){const cs=E.cellsOf(k,buildSel);if(!cs||!E.canBuild(G,k,buildSel)||orders.some(o=>(E.cellsOf(o.c,o.type)||[]).some(c=>cs.includes(c)))){toast(T[buildSel].size>1?'Hier is geen 3 bij 3 vakken vrij':'Hier kun je niet bouwen');return;}
    if(buildSel==='sleeper'&&orders.some(o=>o.type==='sleeper')){toast('Er kan maar één Slapende Geers staan');return;}
    const pend=orders.reduce((s,o)=>s+E.buildCost(G,o.type),0);if(G.gold<pend+E.buildCost(G,buildSel)){toast('Te weinig credits');return;}
    orders.push({c:k,type:buildSel});refresh();return;}
  if(sel){sel=null;refresh();return;}
  moveTo(w);}
addEventListener('keydown',ev=>{if(!G||ev.target.tagName==='INPUT')return;const k=ev.key.toLowerCase();
  if((k.length===1&&'wasdqe'.includes(k))||k.startsWith('arrow')){keys[k]=true;if(k.startsWith('arrow'))ev.preventDefault();return;}
  if(k==='h'||k==='home'){camHome();return;}
  if(k===' '){ev.preventDefault();if(G.phase==='build')waveAct();return;}
  const s=cur.find(s=>s&&s.key.toLowerCase()===(k==='escape'?'esc':k));if(s&&!ended){s.act();refresh();}});
addEventListener('keyup',ev=>{keys[ev.key.toLowerCase()]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
addEventListener('resize',()=>{if(G)resize();});
const cc=()=>camMode==='hero'?hcam:cam;$('#cRotL').onclick=()=>cc().yaw+=Math.PI/4;$('#cRotR').onclick=()=>cc().yaw-=Math.PI/4;$('#cIn').onclick=()=>cc().d*=.8;$('#cOut').onclick=()=>cc().d*=1.25;
$('#hero').onclick=()=>{sel=null;buildSel=null;camHome();refresh();};
$('#waveBtn').onclick=waveAct;
$('#speed').onclick=ev=>{const b=ev.target.closest('button');if(!b||!G||ended)return;if(lead()){toast('Alleen speler 1 kiest de snelheid');return;}speed=+b.dataset.s;paintSpeed();pushPresence(true);};
let quitArm=0;$('#quitBtn').onclick=()=>{const b=$('#quitBtn');if(lab){toLobby();openMini();return;}if(!G||ended)return;if(Date.now()-quitArm<3000){quitArm=0;b.textContent='Opgeven';G.phase='over';}
  else{quitArm=Date.now();b.textContent='Zeker weten?';setTimeout(()=>{if(quitArm){quitArm=0;b.textContent='Opgeven';}},3000);}};
{const mb=$('#musicBtn'),show=()=>{const o=Music.isOn();mb.textContent=o?'Muziek aan':'Muziek uit';mb.setAttribute('aria-pressed',o);};mb.onclick=()=>{Music.setOn(!Music.isOn());show();mb.blur();};show();}
$('#rBack').onclick=toLobby;
function buildHud(){const card=$('#card');for(let i=0;i<12;i++){const b=document.createElement('button');b.id='card-'+i;b.className='empty';
    const cv=document.createElement('canvas');cv.width=116;cv.height=108;const k=document.createElement('span');k.className='k';const c=document.createElement('span');c.className='c num';b.append(cv,k,c);
    b.onclick=()=>{const s=cur[i];if(s&&G&&!ended){s.act();refresh();}};
    const on=()=>{tipIdx=i;refresh();},off=()=>{if(tipIdx===i){tipIdx=-1;refresh();}};
    b.addEventListener('pointerenter',ev=>{if(ev.pointerType==='mouse')on();});b.addEventListener('pointerleave',off);b.addEventListener('focus',on);b.addEventListener('blur',off);card.append(b);}
  const inv=$('#invGrid');for(let i=0;i<4;i++){const c=document.createElement('canvas');c.width=100;c.height=92;inv.append(c);}
  const mini=$('#mini');let md=false;mini.addEventListener('pointerdown',ev=>{md=true;try{mini.setPointerCapture(ev.pointerId);}catch{}miniGo(ev);});
  mini.addEventListener('pointermove',ev=>{if(md)miniGo(ev);});mini.addEventListener('pointerup',()=>md=false);mini.addEventListener('pointercancel',()=>md=false);
  // steentextuur voor de kaders
  try{const[cv,g]=mkCanvas(96),r=lcg(9);g.fillStyle='#1a1f28';g.fillRect(0,0,96,96);for(let i=0;i<900;i++){const v=20+r()*40|0;g.fillStyle=`rgba(${v},${v+4},${v+10},.5)`;g.fillRect(r()*96,r()*96,1+r()*3,1+r()*3);}
    for(let i=0;i<8;i++){g.strokeStyle='rgba(0,0,0,.35)';g.beginPath();const x=r()*96,y=r()*96;g.moveTo(x,y);g.lineTo(x+(r()-.5)*40,y+(r()-.5)*40);g.stroke();}
    document.documentElement.style.setProperty('--stonetex','url('+cv.toDataURL()+')');}catch{}}

/* ---------- lobby, leaderboard, skills ---------- */
const nameOf=p=>own(p)?'Jij':p.name||'Commandant '+String(p.peer).slice(-3).toUpperCase();
const lobbyPeers=()=>peers.filter(p=>p.kind==='viewer'&&p.presence&&p.presence.st==='lobby').sort((a,b)=>((+a.presence.t||0)-(+b.presence.t||0))||(a.peer<b.peer?-1:1)).slice(0,SLOTS);
function row(cells,cls){const li=document.createElement('li');if(cls)li.className=cls;for(const[k,v,cl]of cells){const s=document.createElement('span');s.className=k+(cl?' '+cl:'');s.textContent=v;li.append(s);}return li;}
/* Lobbychat: berichten gaan via de server. Die bewaart de laatste zestig, zodat ook wie net binnenkomt ze ziet. */
let chatLog=[];const chatSeen=new Set();
// Spelinstellingen uit de webadmin. Ze gelden voor het potje dat hierna begint; een lopend potje verandert niet.
let gameCfg=null;const prepTxt=()=>{const s=Math.round((gameCfg&&+gameCfg.prepSeconds)||E.PREP);return s%60?s+' seconden':s===60?'1 minuut':s/60+' minuten';};const chatOn=()=>!gameCfg||gameCfg.chatEnabled!==false;
function onSettings(s){if(!s||typeof s!=='object')return;gameCfg=s;const m=$('#motd'),t=typeof s.motd==='string'?cleanMsg(s.motd):'';m.hidden=!t;setText(m,t);setText($('#prepTxt'),prepTxt());renderLobby();}
const cleanMsg=s=>String(s).replace(/[\u0000-\u001f\u007f\u2028-\u202e]/g,' ').trim().slice(0,160);
function onChat(list,history){let add=false;for(const m of list){if(!m||chatSeen.has(m.id))continue;const text=typeof m.text==='string'?cleanMsg(m.text):'';if(!text)continue;
    chatSeen.add(m.id);chatLog.push({ts:+m.ts||Date.now(),text,by:m.by||null,peer:m.peer||'',name:typeof m.name==='string'?m.name:''});add=true;}
  if(!add)return;chatLog.sort((a,b)=>a.ts-b.ts);if(chatLog.length>80)chatLog=chatLog.slice(-80);renderChat(history);}
function renderChat(toEnd){const box=$('#chatLog'),stick=toEnd||box.scrollHeight-box.scrollTop-box.clientHeight<40;box.textContent='';
  if(!chatLog.length){const p=document.createElement('p');p.className='empty';p.textContent=room?'Nog geen berichten. Zeg hallo tegen de andere commandanten.':connAt===-1?'De chat is nu niet bereikbaar.':'Chat verbinden…';box.append(p);return;}
  for(const m of chatLog){const me=(uid&&m.by===uid)||(!!room&&m.peer===room.peer),d=document.createElement('div');d.className='msg'+(me?' me':'');const dt=new Date(m.ts),t=document.createElement('time');
    t.textContent=String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
    const b=document.createElement('b');b.textContent=me?'Jij':m.name||'Commandant';
    const x=document.createElement('span');x.textContent=m.text;d.append(t,b,x);box.append(d);}
  if(stick)box.scrollTop=box.scrollHeight;}
$('#chatForm').onsubmit=ev=>{ev.preventDefault();const inp=$('#chatIn'),text=cleanMsg(inp.value);if(!text||!room)return;if(room.chat(text)){inp.value='';const box=$('#chatLog');box.scrollTop=box.scrollHeight;}};
const heroOf=p=>own(p)?save.hero:Math.max(0,Math.min(5,(p.presence&&p.presence.h)|0));
// De moeilijkheidsgraad van een speler: van mezelf in een potje die van het potje, anders wat er gekozen is.
const diffOf=p=>own(p)?(G?G.diff:save.diff):E.diffIdx(p.presence&&p.presence.df);
function paintRoster(list){const ul=$('#lobby'),sig=JSON.stringify(list);if(ul.dataset.k===sig)return;ul.dataset.k=sig;ul.textContent='';
  for(const r of list){const li=document.createElement('li');li.className=(r.me?'me ':'')+(r.cl==='host'?'host':'');const cv=document.createElement('canvas');cv.width=92;cv.height=78;iconDraw(cv,'hero'+r.h);
    const nm=document.createElement('span');nm.className='nm';nm.textContent=r.name;const sub=document.createElement('span');sub.className='sub';sub.textContent=HEROES[r.h].n+' · '+E.DIFF[r.df].n+(r.score?' · '+r.score+' punten':'');nm.append(sub);
    const ch=document.createElement('span');ch.className='chip'+(r.cl?' '+r.cl:'');ch.textContent=r.chip;li.append(cv,nm,ch);ul.append(li);}}
function paintMap(cells){const el=$('#world'),sig=JSON.stringify(cells);if(el.dataset.k===sig)return;el.dataset.k=sig;el.textContent='';let n=0;
  cells.forEach((c,i)=>{const d=document.createElement('div');d.className='cell'+(c?' '+c.st+(c.me?' me':''):'');const k=document.createElement('span');k.className='n';k.textContent=String(i+1);d.append(k);
    if(c){n++;const w=document.createElement('span');w.className='who';w.textContent=c.name;const s=document.createElement('span');s.className='st';s.textContent=c.sub;d.append(w,s);d.title=`Vesting ${i+1}: ${c.name}, ${c.sub}`;}else d.title=`Vesting ${i+1}: vrij`;el.append(d);});
  setText($('#worldNote'),`${n} van ${SLOTS} vestingen bezet`);}
function renderLobby(){const btn=$('#startBtn'),help=$('#lobbyHelp'),cells=Array(SLOTS).fill(null);$('#chatIn').disabled=$('#chatSend').disabled=!room||!chatOn();$('#chatIn').placeholder=chatOn()?'Typ een bericht…':'De chat staat tijdelijk uit.';$('#lobbyDot').className='live'+(room&&room.open?'':' off');
  if(!room){paintRoster([{name:'Jij',chip:connAt===-1?'Solo':'Verbinden',cl:'',score:'',h:save.hero,df:save.diff,me:true}]);cells[0]={name:'Jij',st:'lobby',me:true,sub:'jouw vesting'};paintMap(cells);
    setText($('#lobbyNote'),connAt===-1?'solo':'verbinden…');
    setText(btn,'Start spel');btn.disabled=false;setText(help,connAt===-1?'De gezamenlijke lobby is hier niet bereikbaar. Je speelt met acht bots.':'');return;}
  const lp=lobbyPeers(),host=lp[0],me=lp.find(p=>own(p)),others=lp.filter(p=>!own(p)),all=peers.filter(p=>p.kind==='viewer'),list=[];
  setText($('#lobbyNote'),room.open?`${all.length} speler${all.length===1?'':'s'} online`:'verbinding verbroken, opnieuw verbinden…');
  [...lp,...all.filter(p=>!lp.includes(p))].forEach(p=>{const pr=p.presence||{};let chip,cl='';
    if(pr.st==='lobby'){if(p===host){chip='Eerste speler';cl='host';}else if(pr.rd){chip='Klaar';cl='ok';}else chip='Wacht';}
    else if(pr.st==='playing'){chip='Ronde '+(+pr.r||1);cl='play';}else chip=pr.st==='done'?'Uitgespeeld':pr.st==='test'?'Test minigames':'Kijkt';
    list.push({name:nameOf(p),chip,cl,score:pr.s?fmt(+pr.s):'',h:heroOf(p),df:diffOf(p),me:!!own(p)});});
  if(!all.length)list.push({name:'Jij',chip:'Verbinden',cl:'',score:'',h:save.hero,df:save.diff,me:true});
  paintRoster(list);
  const taken=takenSlots(),free=[];for(let i=0;i<SLOTS;i++)if(!taken.has(i))free.push(i);
  for(const p of all){const pr=p.presence||{};if(!own(p)&&(pr.st==='playing'||pr.st==='done')&&Number.isInteger(pr.sl)&&pr.sl>=0&&pr.sl<SLOTS)cells[pr.sl]={name:nameOf(p),st:'play',me:false,sub:pr.st==='done'?'uitgespeeld':'ronde '+(+pr.r||1)};}
  lp.forEach((p,i)=>{if(!free.length)return;const s=free[i%free.length];if(!cells[s]||own(p))cells[s]={name:nameOf(p),st:'lobby',me:!!own(p),sub:own(p)?'jouw vesting':'in de lobby'};});
  paintMap(cells);
  if(taken.size>=SLOTS||(!me&&lp.length>=SLOTS)){setText(btn,'Wereld vol');btn.disabled=true;setText(help,`Alle ${SLOTS} vestingen zijn bezet. Wacht tot er een vrijkomt.`);return;}
  btn.disabled=false;
  if(!others.length){setText(btn,'Start spel');setText(help,'Je bent alleen in de lobby. Start direct en acht bots doen mee, of wacht tot er meer spelers zijn. Elk potje begint met '+prepTxt()+' bouwen.');}
  else if(host&&own(host)){setText(btn,'Start spel');const n=others.filter(p=>p.presence.rd).length;setText(help,`${n} van ${others.length} andere spelers klaar. Jij bent de eerste speler en kunt altijd starten.`);}
  else{setText(btn,ready?'Toch niet klaar':'Ik ben klaar');setText(help,'Het spel start als de eerste speler start, of als alle andere spelers klaar zijn. Daarna heeft iedereen '+prepTxt()+' om een weg te bouwen.');}}
const myIdx=()=>Math.max(0,lobbyPeers().findIndex(p=>own(p)));
function hostStart(){const go=Date.now(),i=myIdx();seenGo.add(go);if(room){room.presence({go}).catch(()=>{});setTimeout(()=>room.presence({go:null}).catch(()=>{}),6000);}beginGame(i,go,!lobbyPeers().some(p=>!own(p)));}
$('#startBtn').onclick=()=>{if(!room){beginGame(0,Date.now(),true);return;}const lp=lobbyPeers(),others=lp.filter(p=>!own(p));
  if(!others.length||(lp[0]&&own(lp[0]))){hostStart();return;}
  ready=!ready;room.presence({rd:ready}).catch(()=>{});renderLobby();};
function onPeers(ch){netPeers=ch.peers;mergePeers();const now=performance.now();syncPeers();for(const p of ch.joined)rx.set(p.peer,now);for(const p of ch.updated)rx.set(p.peer,now);for(const p of ch.left)rx.delete(p.peer);
  
  const settled=now-connAt>3000;let start=0;
  for(const p of peers){const g=p.presence&&p.presence.go;if(typeof g==='number'&&!seenGo.has(g)){seenGo.add(g);if(!own(p)&&settled)start=g;}}
  const lp=lobbyPeers(),me=lp.find(p=>own(p));
  if(myState==='lobby'&&me){if(start)beginGame(myIdx(),start);
    else if(settled&&own(lp[0])){const o=lp.filter(p=>!own(p));if(o.length&&o.every(p=>p.presence.rd))hostStart();}}
  if(myState==='playing'){const mine=peers.find(p=>own(p));
    if(mine&&peers.some(p=>!own(p)&&p.presence&&p.presence.st==='playing'&&p.presence.sl===mySlot&&p.peer<mine.peer)){const[ax,az]=slotO(mySlot);mySlot=freeSlot(0);const[bx2,bz2]=slotO(mySlot);if(!arena){hero.x+=bx2-ax;hero.z+=bz2-az;hero.tx=null;}orders=[];pushPresence(true);}}
  if($('#game').hidden)renderLobby();}
let lastPush=0;
function pushPresence(force){if(!room||lab)return;const now=performance.now();if(!force&&now-lastPush<320)return;lastPush=now;
  const p={st:myState,rd:ready};if(G){p.sl=mySlot;p.r=G.round;p.l=G.lives;p.s=G.score;p.sp=speed;p.tw=encT();p.mt=matchId;p.bd=built;p.ps=G.phase==='prep'?0:1;p.cl=G.cleared;p.nx=nx;p.sw=sentWave;p.pa=encP();p.wn=G.phase==='won'?1:0;p.bs=bots.length?bots.map(b=>b.slot):null;
    if(myState==='playing')p.en=encE();else p.en='';Object.assign(p,heroPatch());}
  room.presence(p).catch(()=>{});}
const rd1=v=>Math.round(v*10)/10;
function heroPatch(){return{h:save.hero,df:G.diff,p:[rd1(hero.x),rd1(hero.z),rd1(hero.a)],hp:Math.max(0,Math.round(hero.hp)),mh:Math.round(maxHp()),ar:arena?arena.seq:0,ak:akCount,am:arena?arena.r:0,bm:myBm,bh:Math.round(myBh),ms:arena&&arena.ms?[arena.r,Math.floor(arena.score||0),0]:msLast,mg:arena&&arena.claim?arena.claim.slice(-16):null,pu:arena?pushOut:null,...chairsPatch(),...bossPatch()};}
function bossPatch(){const a=arena;if(!a||a.mode!=='boss'||missionLead(a))return{bp:null,ba:null};return{bp:[rd1(a.g.x),rd1(a.g.z),rd1(a.g.a)],ba:a.g.last};}
let lastHero=0;
function pushHero(force){if(!room||!G||lab)return;const now=performance.now();if(!force&&now-lastHero<100)return;lastHero=now;room.presence(heroPatch()).catch(()=>{});}
function syncPeers(){const mine=peers.find(p=>own(p));if(mine)myPeer=mine.peer;const seen=new Set();
  for(const p of peers){if(own(p)||p.kind!=='viewer')continue;const pr=p.presence||{};
    if(!Array.isArray(pr.p)||(pr.st!=='playing'&&pr.st!=='done'))continue;const x=+pr.p[0],z=+pr.p[1];if(!isFinite(x)||!isFinite(z))continue;seen.add(p.peer);
    let r=rheroes.get(p.peer);if(!r){r={x,z,a:0,walk:0,atk:0,ak:pr.ak|0,pu:Array.isArray(pr.pu)?pr.pu[0]:0,obj:null,lab:null,sig:'',peer:p.peer};rheroes.set(p.peer,r);}
    if(Array.isArray(pr.pu)&&pr.pu[0]!==r.pu){r.pu=pr.pu[0];if(+pr.ar>0)gotPush(pr.pu);}
    if(Math.hypot(x-r.x,z-r.z)>10){r.x=x;r.z=z;}
    r.tx=x;r.tz=z;r.ta=+pr.p[2]||0;r.idx=Math.max(0,Math.min(5,pr.h|0));r.slot=Number.isInteger(pr.sl)&&pr.sl>=0&&pr.sl<SLOTS?pr.sl:SLOTS;r.hp=+pr.hp||0;r.mh=+pr.mh||100;r.ar=+pr.ar||0;r.name=nameOf(p);
    if((pr.ak|0)!==r.ak){r.ak=pr.ak|0;r.atk=1;r.shoot=true;}}
  for(const[k,r]of rheroes)if(!seen.has(k)){if(r.obj)scene.remove(r.obj);if(r.lab)scene.remove(r.lab);rheroes.delete(k);}}
function renderBoard(){const ul=$('#board');ul.textContent='';
  if(!board||!board.length){const p=document.createElement('p');p.className='empty';
    p.textContent=board?'Nog geen scores. Speel het eerste potje en zet je naam bovenaan.':boardFail?`Het leaderboard is nu niet bereikbaar. Jouw beste score: ${fmt(save.best)}.`:'Scores laden…';ul.append(p);return;}
  board.forEach((r,i)=>ul.append(row([['rk',String(i+1)],['nm',(r.name||'Commandant')+(r.id===uid?' (jij)':'')],['chip',r.won?'Gewonnen':'Ronde '+(+r.round||0),r.won?'ok':''],['num',fmt(r.score)]],r.id===uid?'me':'')));}
// Het leaderboard komt van de server: bij het verbinden, en opnieuw zodra iemand een betere score zet.
function onBoard(rows){board=(Array.isArray(rows)?rows:[]).filter(r=>r&&typeof r.score==='number').slice(0,20);boardFail=false;renderBoard();}
const TICON={sword:'M5 19 17 7M14 4h6v6M4 15l5 5',bolt:'M13 2 5 14h6l-1 8 8-12h-6z',coin:'M12 4a8 8 0 100 16 8 8 0 000-16zM12 9a3 3 0 100 6 3 3 0 000-6z',
 cross:'M12 5a7 7 0 100 14 7 7 0 000-14zM12 2v5M12 17v5M2 12h5M17 12h5',shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
 heart:'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z',wrench:'M14 6a4 4 0 00-5 5l-6 6 3 3 6-6a4 4 0 005-5l-3 3-2-2z',
 snow:'M12 2v20M3.5 7l17 10M20.5 7l-17 10',drop:'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',blast:'M12 2l2 6 6-2-4 5 5 4-6 1 1 6-4-5-4 5 1-6-6-1 5-4-4-5 6 2z',
 crate:'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',up:'M12 20V5M6 11l6-6 6 6',skull:'M6 11a6 6 0 1112 0v4h-2v3H8v-3H6zM9.5 11.5h.01M14.5 11.5h.01',
 boot:'M8 3v10l-3 3v4h14v-3l-6-3V3z',clock:'M12 4a8 8 0 100 16 8 8 0 000-16zM12 7v5l3 2',star:'M12 3l2.6 6 6.4.6-4.9 4.2 1.5 6.2L12 16.7 6.4 20l1.5-6.2L3 9.6 9.4 9z',
 link:'M9 15l6-6M10 6l1-1a4 4 0 016 6l-1 1M14 18l-1 1a4 4 0 01-6-6l1-1',plus:'M12 5v14M5 12h14',trophy:'M7 4h10v5a5 5 0 01-10 0zM12 14v4M8 20h8',dodge:'M5 6l6 6-6 6M13 6l6 6-6 6'};
const TREES={T:'Arsenaal',H:'Veldheer'};
let selTal=SKILLS[0].id,resetArm=0;
const nlv=v=>String(Math.round(v*100)/100).replace('.',',');
const talText=(s,r)=>s.d.replace('{v}',nlv(s.v*r));
function buySkill(s){const st=E.skillState(save.skills,s);if(st.lock||st.rank>=s.max||save.pts<1)return;
  save.pts--;save.skills[s.id]=st.rank+1;persist();renderHome();}
function buildTrees(){for(const s of SKILLS){const b=document.createElement('button');b.type='button';b.className='tal'+(s.req?' req':'');b.id='sk-'+s.id;b.style.gridArea=(s.t+1)+'/'+(s.c+1);
    const NS='http://www.w3.org/2000/svg',sv=document.createElementNS(NS,'svg'),p=document.createElementNS(NS,'path');sv.setAttribute('viewBox','0 0 24 24');sv.setAttribute('aria-hidden','true');p.setAttribute('d',TICON[s.ic]);sv.append(p);
    b.append(sv,document.createElement('i'));
    // muis: aanwijzen toont het talent, klikken leert een rang. Aanraken: eerste tik toont, tweede tik leert.
    b.addEventListener('pointerenter',ev=>{if(ev.pointerType==='mouse'&&selTal!==s.id){selTal=s.id;renderTrees();}});
    b.onclick=()=>{if(selTal===s.id)buySkill(s);else{selTal=s.id;renderTrees();}};
    $(s.tree==='T'?'#treeT':'#treeH').append(b);}
  $('#tiBuy').onclick=()=>{const s=SKILLS.find(x=>x.id===selTal);if(s)buySkill(s);};
  $('#tReset').onclick=()=>{const n=E.skillTotal(save.skills);if(!n)return;
    if(Date.now()>resetArm){resetArm=Date.now()+4000;renderTrees();setTimeout(renderTrees,4100);return;}
    resetArm=0;save.pts+=E.skillTotal(save.skills);save.skills={};persist();renderHome();};}
function renderTrees(){const sk=save.skills,tot=E.skillTotal(sk);
  if(!$('#treeT').children.length)buildTrees();
  for(const s of SKILLS){const b=$('#sk-'+s.id),st=E.skillState(sk,s),mx=st.rank>=s.max;
    b.className='tal'+(s.req?' req':'')+(st.q&&(sk[st.q.id]|0)>=st.q.max?' ok':'')+(mx?' max':st.lock?' lock':' open')+(st.rank&&!mx?' has':'')+(selTal===s.id?' sel':'');
    setText(b.lastChild,st.rank+'/'+s.max);b.setAttribute('aria-label',`${s.n}, rang ${st.rank} van ${s.max}`);b.setAttribute('aria-pressed',String(selTal===s.id));}
  setText($('#ptsT'),String(E.skillSpent(sk,'T')));setText($('#ptsH'),String(E.skillSpent(sk,'H')));
  const s=SKILLS.find(x=>x.id===selTal)||SKILLS[0],st=E.skillState(sk,s),mx=st.rank>=s.max,buy=$('#tiBuy');
  setText($('#tiName'),s.n);setText($('#tiRank'),`${TREES[s.tree]} · rang ${st.rank}/${s.max}`);
  const now=$('#tiNow'),nx=$('#tiNext'),rq=$('#tiReq');
  now.hidden=!st.rank&&s.max>1&&!!s.v;setText(now,s.v&&st.rank?'Nu: '+talText(s,st.rank):talText(s,1));
  nx.hidden=mx||!s.v;setText(nx,(st.rank?'Volgende rang: ':'Rang 1: ')+talText(s,st.rank+1));
  rq.hidden=!st.lock||mx;setText(rq,st.lock==='tier'?`Vereist ${E.TIER*s.t} punten in ${TREES[s.tree]} (je hebt er ${E.skillSpent(sk,s.tree)}).`:st.lock==='req'?`Vereist ${st.q.n} ${st.q.max}/${st.q.max}.`:'');
  buy.disabled=mx||!!st.lock||save.pts<1;
  setText(buy,mx?'Maximale rang':st.lock?'Nog op slot':save.pts>0?`Leer rang ${st.rank+1} · 1 punt`:'Geen punten over');
  const rs=$('#tReset');rs.hidden=!tot;setText(rs,Date.now()<resetArm?`Klik nogmaals: ${tot} ${tot===1?'punt':'punten'} terug`:'Alle punten terugzetten');}
// Moeilijkheidsgraad: drie knoppen boven de startknop. De keuze geldt alleen voor jou en ligt vast zodra het potje begint.
function renderDiff(){const box=$('#diff');
  if(!box.children.length)E.DIFF.forEach((d,i)=>{const b=document.createElement('button');b.type='button';const n=document.createElement('b');n.textContent=d.n;const s=document.createElement('small');s.className='num';s.textContent='score '+mulText(d.score);b.append(n,s);b.title=d.d;
    b.onclick=()=>{if(save.diff===i)return;save.diff=i;persist();if(room&&!G)room.presence({df:i}).catch(()=>{});renderDiff();renderLobby();};box.append(b);});
  [...box.children].forEach((b,i)=>{const on=save.diff===i;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
  const d=E.DIFF[save.diff];setText($('#diffNote'),d.d+(d.score>1?` Alles wat je scoort telt ${mulText(d.score)}.`:''));}
function renderHome(){renderAcct();const tot=E.skillTotal(save.skills),sdone=tot>=E.SKILL_MAX,free=save.pts;
  setText($('#xp'),String(free));setText($('#skn'),tot+' / '+E.SKILL_MAX);setText($('#gms'),String(save.games));
  setText($('#skNote'),sdone?'Je hebt alles geleerd.':'');
  renderTrees();
  setText($('#skHint'),free&&!sdone?free+(free===1?' punt':' punten'):'');$('#skillsBtn').classList.toggle('can',!sdone&&free>0);setText($('#heroNow'),HEROES[save.hero].n);renderDiff();
  setText($('#xpNote'),sdone?'Alle rangen geleerd.':free?`Je hebt ${free} ${free===1?'skillpunt':'skillpunten'} te besteden.`:'Geen punten over. Haal levels en minibosses om er meer te verdienen.');
  const hg=$('#heroes');if(!hg.children.length)HEROES.forEach((h,i)=>{const b=document.createElement('button');b.className='hero';b.id='hero-'+i;b.title=h.role;const cv=document.createElement('canvas');cv.width=128;cv.height=108;iconDraw(cv,'hero'+i);
    const n=document.createElement('b');n.textContent=h.n;b.append(cv,n);b.onclick=()=>{save.hero=i;persist();if(room)room.presence({h:i}).catch(()=>{});renderHome();renderLobby();};hg.append(b);});
  HEROES.forEach((h,i)=>{const b=$('#hero-'+i);b.classList.toggle('on',save.hero===i);b.setAttribute('aria-pressed',String(save.hero===i));});
  const h=HEROES[save.hero],nl=v=>String(v).replace('.',','),dps=Math.round(h.dmg*h.rate);iconDraw($('#heroBig'),'hero'+save.hero);setText($('#hName'),h.n);setText($('#hRole'),h.role);setText($('#hDesc'),h.d);
  const st=[['Levenspunten',h.hp/190,String(h.hp)],['Schade per sec',dps/48,String(dps)],['Bereik',h.range/8,nl(h.range)],['Snelheid',h.spd/6.4,nl(h.spd)]],sb=$('#hStats');
  if(!sb.children.length)st.forEach(()=>{const d=document.createElement('div');d.className='stat';const i=document.createElement('i');i.append(document.createElement('b'));d.append(document.createElement('span'),i,document.createElement('em'));sb.append(d);});
  st.forEach((s,i)=>{const d=sb.children[i];setText(d.children[0],s[0]);d.children[1].firstChild.style.width=Math.round(Math.min(1,s[1])*100)+'%';setText(d.children[2],s[2]);});
  renderBoard();}

/* ---------- pop-ups: skills en held, spelinfo ---------- */
function closePops(){document.querySelectorAll('dialog.pop[open]').forEach(d=>{try{d.close();}catch{d.removeAttribute('open');}});}
function openPop(id,tab){const d=$(id);if(tab){const b=d.querySelector('[data-t="'+tab+'"]');if(b)b.click();}if(d.open)return;try{d.showModal();}catch{d.setAttribute('open','');}}
document.querySelectorAll('dialog.pop').forEach(d=>{
  d.addEventListener('click',ev=>{if(ev.target===d||ev.target.closest('.pop-x'))closePops();});
  const tabs=[...d.querySelectorAll('.tabs button')];
  tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.setAttribute('aria-selected',String(x===b)));d.querySelectorAll('.tab').forEach(t=>t.hidden=t.id!==b.dataset.t);d.querySelector('.pop-body').scrollTop=0;});});
$('#skillsBtn').onclick=()=>openPop('#popSkills','tSkills');$('#infoBtn').onclick=()=>openPop('#popInfo');$('#heroBtn').onclick=()=>openPop('#popSkills','tHero');
const openMini=()=>{buildLabList();openPop('#popMini');};
$('#miniBtn').onclick=openMini;$('#lAgain').onclick=()=>{if(lab)startLab(lab.kind);};$('#lOther').onclick=()=>{toLobby();openMini();};$('#lBack').onclick=toLobby;

/* ---------- vonken achter de lobby ---------- */
(function(){const cv=$('#embers');if(!cv||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;const g=cv.getContext('2d');let W=0,H=0,last=0;const ps=[];
  const fit=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight;};fit();addEventListener('resize',fit);
  const mk=init=>({x:Math.random()*W,y:init?Math.random()*H:H+10,r:.6+Math.random()*1.7,vy:12+Math.random()*34,vx:-8+Math.random()*16,ph:Math.random()*6.3,l:.25+Math.random()*.6});
  for(let i=0;i<64;i++)ps.push(mk(true));
  function tick(t){requestAnimationFrame(tick);if(($('#home').hidden&&$('#gate').hidden)||document.hidden){last=t;return;}const dt=Math.min(.05,(t-last)/1000);last=t;g.clearRect(0,0,W,H);g.globalCompositeOperation='lighter';
    for(let i=0;i<ps.length;i++){const p=ps[i];p.y-=p.vy*dt;p.x+=(p.vx+Math.sin(t/900+p.ph)*10)*dt;if(p.y<-10)ps[i]=mk(false);
      const a=p.l*Math.max(0,Math.min(1,p.y/H*1.5))*(.6+.4*Math.sin(t/300+p.ph));g.fillStyle=`rgba(255,${120+p.r*40|0},50,${a.toFixed(3)})`;g.beginPath();g.arc(p.x,p.y,p.r,0,7);g.fill();}}
  requestAnimationFrame(tick);})();

/* ---------- start ---------- */
loadLocal();loadAcct();bindAccount();buildHud();
try{if(init3D()){bindCanvas();renderIcons();}}catch(err){gl3=false;console.error(err);}
renderHome();renderLobby();renderChat();if(!acct)showGate('new');requestAnimationFrame(frame);
if(location.hash==='#dev')window.__ratd={E,g:()=>G,waveAct,roadTool,endPrep,paint:(cs,on)=>{paintLast=-1;for(const c of cs)paintTo(c,on!==false);},sync:()=>({matchId,built,nx,speed,lead:!lead(),mates:mates().length,phase:G&&G.phase,timer:G&&G.timer,cleared:G&&G.cleared}),setPrep:s=>{prepEnd=performance.now()+s*1000;},mission:(m,r)=>enterArena(m,r),bots:()=>bots,MINI,KIND,LAB,startLab,lab:()=>lab,setHero:i=>{save.hero=i;},setDiff:i=>{save.diff=E.diffIdx(i);renderDiff();},dmg:d=>{myBh+=d;},arena:()=>arena,hero:()=>hero,useShield,enterArena,tick:n=>{const p=window.__ratdPause;window.__ratdPause=false;for(let t=0;t<n;t+=.05)logic(.05);window.__ratdPause=p;},keys,state:()=>({hero,arena,armour,gold:G&&G.gold,round:G&&G.round,camMode,tw:G&&G.tw.length})};
// Sessie controleren: klopt het token nog, dan komt de voortgang van de server binnen.
if(Net.hasToken())Net.api('GET','/me').then(r=>{const known=!!acct;signedIn(r);if(!known&&!G&&gateMode!=='rename')showHome();},authFail);
// Lobby verbinden. Lukt dat niet, dan kun je alleen spelen; de verbinding blijft het op de achtergrond proberen.
myT=Date.now();
const lobby=Net.connect({onPeers,onChat,onBoard,onSettings,
  onOpen(r){room=r;connAt=performance.now();renderChat();renderLobby();},
  onFail(){if(!room){connAt=-1;renderLobby();renderChat();}},
  onClose(){renderLobby();}});
lobby.presence({t:myT,st:myState,rd:false,h:save.hero,df:save.diff});
Net.api('GET','/settings').then(r=>{if(!gameCfg)onSettings(r.settings);},()=>{});
Net.api('GET','/scores').then(r=>{if(!board)onBoard(r.rows);},()=>{if(!board){boardFail=true;renderBoard();}});

})();
