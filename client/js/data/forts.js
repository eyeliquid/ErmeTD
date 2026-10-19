// ErmeTD · burchten
// Hoe een vesting eruitziet: het eiland, de muren, de hoektorens, de poorten, het hoofdkwartier, de vijandelijke fabriek,
// de lantaarns en de bruggen. Elk thema in data/themes.js kiest met `fort` een burcht uit deze lijst.
// Een burcht verandert niets aan de spelregels: waar je loopt en bouwt staat los van wat je ziet.
(function(ERME){
'use strict';

// Een burcht bestaat uit stukken. Elk stuk is een functie die bouwstenen teruggeeft (k.box, k.ball, …, zie MODELKIT in
// data/enemies.js). Het spel zet elk stuk op de goede plek en draait het mee; je tekent een stuk dus maar één keer.
//
//  base(k)          het eiland en de twee pieren, in de maten van een vesting (het speelveld is 0..13 bij 0..13)
//  wall(k, L)       een stuk muur van L lang. Het loopt langs x van -L/2 tot L/2; buiten is -z, binnen is +z.
//                   Blijf binnen z = -0.5..0.45, anders steekt de muur het speelveld in.
//  corner(k)        een hoektoren op 0,0. Buiten is -x en -z.
//  gate(k, role)    de opening in een muur (1,6 breed, midden op 0). Buiten is -z. role: 'in' (hier komt de vijand
//                   binnen), 'out' (hier gaat hij weg) of 'side' (alleen een brug). Houd x = -0.8..0.8 tot 1,5 hoog vrij.
//  hq(k)            het hoofdkwartier op de rechterpier, op 0,0. De voorkant (naar het speelveld) is -x.
//  factory(k)       de vijandelijke fabriek op de linkerpier, op 0,0. De voorkant is +x.
//  lamp(k)          een lantaarn op de muur, voet op 0,0. Binnen is +z.
//  bridge(k, L)     een brug van L lang langs x, midden op 0. Het wegdek ligt op hoogte 0.
//  hub(k)           (mag ontbreken) iets groots in het midden van de wereld, voor maps die daar plaats voor hebben (een ring).
//                   0,0 is het midden; de ruimte is ongeveer 30 bij 30.
//  core(k)          (mag ontbreken) de kern op de uitgang, als die midden in het veld ligt (Zandstorm). 0,0 is het midden van dat vak.
//  block(k)         een vast muurtje op één vak van het speelveld (alleen op maps met block), midden op 0,0, 1 bij 1.
//                   Houd het laag (tot ongeveer 0,6): je kijkt eroverheen.
//
// Extra bouwstenen voor een burcht:
//  k.lit.box(…), k.lit.ball(…), …   hetzelfde, maar het onderdeel geeft zelf licht (neon, ramen, kristallen)
//  k.light(x, y, z, kleur, grootte) een lichtgloed; kleur null = de lampkleur van het thema
//  k.fire(x, y, z, grootte)         een vuur met rook, in de vuurkleur van het thema. Gebruik er maar een paar: ze zijn zwaar.
//
// Verder:
//  mat      'stone' (metselwerk), 'metal' (platen) of 'plain' (glad)
//  band     de strook in de kleur van de speler op het hoofdkwartier: [breed, hoog, diep, hoogte], of null
//  flag     waar het vlaggetje in de kleur van de speler hangt, ten opzichte van het hoofdkwartier
//  label    hoe hoog de naam van de speler boven het hoofdkwartier zweeft

// Het eiland met de twee pieren. side = de zijkant, rim = de rand eronder.
const island=(k,side,rim)=>[k.box(14.4,1.7,14.4,side,6.5,-.86,6.5),k.box(15.2,.7,15.2,rim,6.5,-1.5,6.5),
  k.box(2.8,1.7,3.2,side,15.1,-.86,9.4),k.box(2.8,1.7,3.2,side,-2,-.86,3.8)];
// Van -L/2 tot L/2 in stappen: fn(u, i) voor elke plek.
const along=(L,step,margin,fn)=>{const a=[];let i=0;for(let u=-L/2+margin;u<L/2-margin+1e-6;u+=step)a.push(fn(u,i++));return a;};
// Blokken die een stuk muur precies vullen, met een verspringing (zoals metselwerk).
const blocks=(L,len,gap,shift,fn)=>{const a=[];let i=0;for(let x=-L/2-shift;x<L/2;x+=len+gap){const a0=Math.max(x,-L/2),a1=Math.min(x+len,L/2);if(a1-a0>.05)a.push(fn((a0+a1)/2,a1-a0,i));i++;}return a;};

ERME.FORTS={

 // ---------- Stenen burcht: de oorspronkelijke vesting (Rood Alarm) ----------
 castle:{n:'Stenen burcht',mat:'stone',band:[1.44,.14,2.14,1.0],flag:[0,2.35,1.17],label:3.1,
  base:k=>island(k,'#4f555e','#3a3f47'),
  wall:(k,L)=>[k.box(L,.36,.34,'#6c727c',0,.18,0),...along(L,1,.3,u=>k.box(.5,.24,.34,'#6c727c',u,.48,0))],
  corner:k=>[k.cyl(.62,.7,2.1,'#6c727c',0,.5,0,12),k.cyl(.72,.72,.22,'#4f555e',0,1.62,0,12),k.cone(.84,1.1,'#34507c',0,2.28,0)],
  gate:(k,role)=>{const a=[];for(const u of[-.9,.9])a.push(k.box(.36,1,.36,'#6c727c',u,.5,0),k.box(.44,.12,.44,'#4f555e',u,1.05,0));
    if(role!=='side'){const c=role==='in'?'#5a352c':'#6c727c';a.push(k.box(.4,1.3,.3,c,-.9,.65,0),k.box(.4,1.3,.3,c,.9,.65,0),k.box(2.2,.3,.42,c,0,1.42,0));}
    return a;},
  hq:k=>[k.box(1.4,1.3,2.1,'#6c727c',0,.65,0),k.cone(1.6,1,'#34507c',0,1.8,0,false,4,Math.PI/4),k.box(.1,.7,.5,'#1a1410',-.72,.35,0),k.cyl(.035,.035,1.2,'#22262b',0,2,.8,6)],
  factory:k=>[k.box(1.5,1.2,2,'#5a352c',0,.6,0),k.box(1.7,.16,2.2,'#2a2422',0,1.28,0),k.box(.1,.8,1.1,'#0c0808',.77,.4,0),
    k.cyl(.13,.17,.9,'#33373c',-.4,1.75,-.5,10),k.cyl(.13,.17,.7,'#33373c',-.4,1.65,.5,10),k.fire(-.4,2.3,-.5,.6),k.fire(.9,.5,0,.5)],
  lamp:k=>[k.cyl(.04,.06,1.3,'#1c1f24',0,1,0,6),k.box(.16,.16,.16,'#2a2d31',0,1.7,0),k.light(0,1.72,0,null,1.5)],
  bridge:(k,L)=>[k.box(L,.5,1.8,'#4f555e',0,-.26,0),k.box(L,.3,.14,'#6c727c',0,.14,-.83),k.box(L,.3,.14,'#6c727c',0,.14,.83),k.box(.6,2,1.4,'#4f555e',0,-1.4,0)],
  block:k=>[k.box(.96,.4,.96,'#6c727c',0,.2,0),k.box(.46,.2,.96,'#6c727c',-.25,.5,0)]},

 // ---------- Pitstraat: een circuit met vangrails, tribunetorens en een racetoren (Grand Prix) ----------
 pits:{n:'Pitstraat',mat:'plain',band:[1.44,.12,2.14,.2],flag:[0,2.35,1.17],label:3.1,
  base:k=>[...island(k,'#8a9098','#5a6068'),k.box(14.5,.06,14.5,'#f2f2f2',6.5,-.04,6.5)],
  // betonnen vangrail met een rood-witte rand en een vanghek erboven
  wall:(k,L)=>[k.box(L,.34,.42,'#c8ccd2',0,.17,0),k.box(L,.12,.26,'#b8bcc2',0,.4,0),
    ...blocks(L,.48,.02,0,(u,w,i)=>k.box(w,.07,.27,i%2?'#d8261c':'#f2f2f2',u,.49,0)),
    ...along(L,2,.2,u=>k.cyl(.025,.025,1.1,'#7a8088',u,1.0,-.12,6)),k.box(L,.03,.03,'#9aa0a8',0,1.52,-.12),k.box(L,.03,.03,'#9aa0a8',0,1.0,-.12)],
  // bandenstapels met een lichtmast
  corner:k=>[...[[-.25,-.25],[.25,-.25],[-.25,.25]].flatMap(([x,z],j)=>[0,1,2,3].map(i=>k.ring(.22,.09,(i+j)%2?'#d8261c':'#15171a',x,.1+i*.17,z))),
    k.cyl(.06,.08,3.4,'#c8ccd2',.3,1.7,.3,8),k.box(.8,.35,.2,'#2a2d31',.3,3.45,.3),k.lit.box(.7,.25,.04,'#fff6e0',.3,3.45,.42),k.light(.3,3.45,.5,'#fff6e0',2.6)],
  // startportaal met vijf rode lampen, finishportaal met een geblokte band, en sponsorportalen bij de bruggen
  gate:(k,role)=>{const a=[k.box(.2,2.1,.2,'#2a2d31',-1.0,1.05,0),k.box(.2,2.1,.2,'#2a2d31',1.0,1.05,0),k.box(2.3,.32,.3,'#2a2d31',0,2.2,0)];
    if(role==='in'){for(let i=0;i<5;i++)a.push(k.lit.ball(.07,'#ff3b2e',-.6+i*.3,2.2,.17),k.lit.ball(.07,'#ff3b2e',-.6+i*.3,2.2,-.17));a.push(k.light(0,2.2,.25,'#ff3b2e',1.6));}
    else if(role==='out'){for(let i=0;i<10;i++)for(let j=0;j<2;j++)for(const v of[-.17,.17])a.push(k.box(.22,.14,.03,(i+j)%2?'#15171a':'#f2f2f2',-.99+i*.22,2.13+j*.14,v));}
    else for(const v of[-.17,.17])a.push(k.box(1.8,.24,.03,'#1e6fd8',0,2.2,v),k.box(1.8,.04,.035,'#f2f2f2',0,2.2,v));
    return a;},
  // de racetoren: een wit blok met een glazen band en een donkere verdieping met verlichte ramen
  hq:k=>[k.box(1.4,.9,2.1,'#e8e8e8',0,.45,0),k.box(1.42,.25,2.12,'#3a6e9a',0,.62,0),k.box(1.7,.55,2.4,'#2a2d31',0,1.18,0),
    k.lit.box(1.72,.18,2.42,'#9fd8ff',0,1.2,0),k.box(1.8,.08,2.5,'#d8261c',0,1.5,0),k.cyl(.035,.035,1.2,'#c8ccd2',0,2,.8,6),
    k.box(.04,.6,1.6,'#15171a',-.88,1.85,0),...[0,1,2,3,4,5,6,7].map(i=>k.box(.05,.12,.2,i%2?'#f2f2f2':'#15171a',-.9,1.75+(i%2)*.12,-.7+i*.2))],
  // een pitgarage met een roldeur en uitlaten
  factory:k=>[k.box(1.6,1.1,2.2,'#c8ccd2',0,.55,0),k.box(1.8,.1,2.4,'#2a2d31',0,1.15,0),k.box(.06,.8,1.6,'#5a6068',.81,.4,0),
    ...[0,1,2,3,4].map(i=>k.box(.07,.03,1.6,'#3a3f47',.82,.12+i*.16,0)),...[0,1,2,3,4,5,6,7].map(i=>k.box(.06,.16,.2,i%2?'#15171a':'#f2f2f2',.9,1.3,-.7+i*.2)),
    k.cyl(.07,.07,.7,'#5a6068',-.4,1.45,-.5,8),k.cyl(.07,.07,.5,'#5a6068',-.4,1.35,.5,8),k.ring(.2,.08,'#15171a',1.1,.08,-.9),k.ring(.2,.08,'#15171a',1.1,.24,-.9),
    k.fire(-.4,1.9,-.5,.35),k.fire(-.4,1.7,.5,.3)],
  lamp:k=>[k.cyl(.035,.05,1.6,'#9aa0a8',0,.8,0,6),k.box(.04,.04,.45,'#9aa0a8',0,1.62,.2),k.box(.14,.06,.24,'#2a2d31',0,1.6,.4),k.lit.box(.1,.02,.2,'#fff6e0',0,1.56,.4),k.light(0,1.55,.4,null,1.5)],
  bridge:(k,L)=>[k.box(L,.5,1.8,'#33363b',0,-.26,0),k.box(L,.02,.06,'#f2f2f2',0,0,-.66),k.box(L,.02,.06,'#f2f2f2',0,0,.66),
    ...[-.83,.83].flatMap(v=>blocks(L,.48,.02,0,(u,w,i)=>k.box(w,.1,.14,i%2?'#d8261c':'#f2f2f2',u,.04,v))),k.box(.6,2,1.4,'#8a9098',0,-1.4,0)],
  // een stapel banden
  block:k=>[[-.24,-.24],[.24,-.24],[-.24,.24],[.24,.24]].flatMap(([x,z],j)=>[0,1,2].map(i=>k.ring(.2,.08,(i+j)%2?'#d8261c':'#15171a',x,.08+i*.15,z)))},

 // ---------- IJsburcht: muren van ijsblokken, sneeuw en een blokhut (Bevroren Noorden) ----------
 ice:{n:'IJsburcht',mat:'plain',band:[1.44,.1,2.14,.84],flag:[0,2.35,1.17],label:3.1,
  base:k=>[...island(k,'#8aa0b4','#5f7488'),k.box(2.8,.05,3.2,'#f4f8fb',15.1,.0,9.4),k.box(2.8,.05,3.2,'#f4f8fb',-2,.0,3.8)],
  // twee lagen ijsblokken in verband, sneeuw erop en ijspegels aan de buitenkant
  wall:(k,L)=>[...blocks(L,.86,.04,0,(u,w,i)=>k.box(w,.26,.4,i%3?'#cfe8f8':'#a9d4ee',u,.13,0)),
    ...blocks(L,.86,.04,.45,(u,w,i)=>k.box(w,.26,.4,i%3?'#a9d4ee':'#cfe8f8',u,.4,0)),
    k.box(L,.1,.46,'#f4f8fb',0,.58,0),...along(L,1.3,.4,u=>k.ball(.16,'#f4f8fb',u,.63,0,[1.4,.6,1.2])),
    ...along(L,.7,.2,(u,i)=>{const h=.16+(i%3)*.06;return k.cone(.035,h,'#cfefff',u,.53-h/2,-.22,true);})],
  // een ronde ijstoren met een sneeuwkoepel en een lichtgevend kristal
  corner:k=>[k.cyl(.58,.72,1.9,'#cfe8f8',0,.95,0,10),k.cyl(.62,.62,.1,'#a9d4ee',0,1.6,0,10),k.ball(.66,'#f4f8fb',0,1.95,0,[1,.6,1]),
    ...[0,1,2,3,4,5,6,7].map(i=>{const an=i*.785;return k.cone(.05,.25,'#cfefff',Math.cos(an)*.62,1.42,Math.sin(an)*.62,true);}),
    k.lit.gem(.16,'#9fe8ff',0,2.55,0),k.light(0,2.55,0,'#9fe8ff',1.2)],
  gate:(k,role)=>{const a=[];for(const u of[-.92,.92])a.push(k.box(.34,1.5,.34,'#a9d4ee',u,.75,0),k.ball(.24,'#f4f8fb',u,1.55,0,[1,.6,1]));
    if(role==='in')a.push(k.box(2.2,.24,.4,'#cfe8f8',0,1.62,0),k.box(2.2,.08,.44,'#f4f8fb',0,1.78,0),k.lit.gem(.18,'#9fe8ff',0,2.0,0),k.light(0,2.0,0,'#9fe8ff',1.4));
    else if(role==='out')a.push(k.box(2.2,.2,.3,'#6b4a2a',0,1.6,0),k.box(2.2,.08,.36,'#f4f8fb',0,1.74,0),
      k.lit.box(.1,.14,.1,'#ffc070',-.92,1.25,.2),k.lit.box(.1,.14,.1,'#ffc070',.92,1.25,.2),k.light(-.92,1.25,.25,'#ffc070',1),k.light(.92,1.25,.25,'#ffc070',1));
    else a.push(k.ball(.3,'#f4f8fb',-1.3,.05,-.1,[1.4,.5,1]),k.ball(.25,'#f4f8fb',1.3,.05,.1,[1.4,.5,1]));
    return a;},
  // een blokhut met een besneeuwd dak, warme ramen en een sneeuwpop ernaast
  hq:k=>[k.box(1.4,.95,2.1,'#6b4a2a',0,.48,0),...[0,1,2,3].map(i=>k.box(1.44,.06,2.14,'#5a3e26',0,.15+i*.22,0)),
    k.box(.95,.08,2.4,'#5a3e26',.4,1.25,0,0,-.7),k.box(.95,.08,2.4,'#5a3e26',-.4,1.25,0,0,.7),
    k.box(.95,.06,2.44,'#f4f8fb',.42,1.31,0,0,-.7),k.box(.95,.06,2.44,'#f4f8fb',-.42,1.31,0,0,.7),
    k.box(.06,.6,.4,'#3a2a1c',-.72,.3,0),k.lit.box(.04,.22,.3,'#ffc070',-.71,.6,-.6),k.lit.box(.04,.22,.3,'#ffc070',-.71,.6,.6),
    k.box(.2,.5,.2,'#6a6e75',.3,1.55,-.6),k.cyl(.035,.035,1.2,'#5a3e26',0,2,.8,6),
    k.ball(.3,'#f4f8fb',.95,.3,-1.3),k.ball(.21,'#f4f8fb',.95,.74,-1.3),k.ball(.14,'#f4f8fb',.95,1.05,-1.3),k.cone(.035,.16,'#ff8a2c',.82,1.05,-1.3)],
  // een ijsgrot met lichtgevende kristallen; het vuur is hier blauw
  factory:k=>[k.ball(.9,'#7f93a8',0,.4,0,[1,.8,1.3]),k.ball(.6,'#8aa0b4',-.4,.7,.5),k.ball(.8,'#f4f8fb',0,.75,0,[1,.4,1.2]),k.box(.1,.6,.7,'#1a2430',.88,.35,0),
    k.lit.gem(.2,'#9fe8ff',-.4,1.3,-.5),k.lit.gem(.15,'#9fe8ff',-.5,1.15,.6),k.fire(-.4,1.5,-.5,.4),k.fire(.95,.3,0,.35)],
  lamp:k=>[k.box(.08,1.4,.08,'#6b4a2a',0,.7,0),k.box(.06,.06,.3,'#6b4a2a',0,1.4,.12),k.lit.box(.12,.16,.12,'#bfe8ff',0,1.28,.25),k.ball(.08,'#f4f8fb',0,1.47,0),k.light(0,1.28,.25,null,1.3)],
  // een plankenbrug met touwen
  bridge:(k,L)=>[k.box(L,.12,1.7,'#6b4a2a',0,-.07,0),...blocks(L,.26,.04,0,(u,w,i)=>k.box(w,.05,1.74,i%2?'#7a5a3a':'#6b4a2a',u,0,0)),
    k.box(L,.03,.35,'#f4f8fb',0,.04,-.62),k.box(L,.03,.3,'#f4f8fb',0,.04,.65),
    ...along(L,1.5,.2,u=>[k.box(.08,.5,.08,'#6b4a2a',u,.25,-.85),k.box(.08,.5,.08,'#6b4a2a',u,.25,.85)]),
    k.box(L,.03,.03,'#c8b48a',0,.42,-.85),k.box(L,.03,.03,'#c8b48a',0,.42,.85),k.box(.5,2,1.2,'#a9d4ee',0,-1.1,0)],
  // een ijsmuurtje: twee blokken ijs met sneeuw erop
  block:k=>[k.box(.98,.26,.7,'#cfe8f8',0,.13,0),k.box(.98,.24,.62,'#a9d4ee',0,.38,0),k.box(1,.08,.66,'#f4f8fb',0,.54,0),k.ball(.14,'#f4f8fb',.2,.58,0,[1.5,.6,1.2])]},

 // ---------- Ruimtestation: metalen schotten, pylonen en een commandokoepel (Neon Nexus) ----------
 station:{n:'Ruimtestation',mat:'metal',band:[2.2,.05,2.7,.03],flag:[0,2.35,1.17],label:3.3,
  base:k=>[...island(k,'#2a3138','#151b21'),k.lit.box(14.5,.04,.04,'#5dffa0',6.5,-.2,-.72),k.lit.box(14.5,.04,.04,'#5dffa0',6.5,-.2,13.72),
    k.lit.box(.04,.04,14.5,'#5dffa0',-.72,-.2,6.5),k.lit.box(.04,.04,14.5,'#5dffa0',13.72,-.2,6.5)],
  // een schot met naden, een groene neonstrip aan de binnenkant en blauwe lichtjes aan de buitenkant
  wall:(k,L)=>[k.box(L,.46,.3,'#3a4652',0,.23,0),k.box(L,.08,.4,'#5a6a78',0,.5,0),...along(L,1.2,.3,u=>k.box(.04,.44,.32,'#2a3138',u,.23,0)),
    k.lit.box(L,.03,.04,'#5dffa0',0,.42,.16),...along(L,2.4,.6,u=>k.lit.box(.12,.05,.03,'#59c8f2',u,.3,-.16))],
  // een zeshoekige pylon met een zender en zwevende lichtringen
  corner:k=>[k.cyl(.5,.62,2.0,'#3a4652',0,1,0,6),k.cyl(.56,.56,.12,'#5a6a78',0,2.06,0,6),k.lit.cyl(.51,.51,.04,'#5dffa0',0,1.6,0,6),
    k.cyl(.12,.2,.6,'#5a6a78',0,2.4,0,8),k.lit.ball(.16,'#5dffa0',0,2.8,0),k.lit.ring(.5,.03,'#5dffa0',0,3.15,0),k.lit.ring(.32,.025,'#5dffa0',0,3.55,0),k.light(0,3,0,'#5dffa0',2)],
  // een krachtveldpoort: roze waar de vijand binnenkomt, groen waar hij weggaat, blauw bij de bruggen
  gate:(k,role)=>{const c=role==='in'?'#ff4a8a':role==='out'?'#5dffa0':'#59c8f2',a=[];
    for(const u of[-.95,.95])a.push(k.box(.3,1.7,.34,'#3a4652',u,.85,0),k.box(.38,.1,.4,'#5a6a78',u,1.74,0),k.lit.box(.04,1.4,.06,c,u*.83,.8,0));
    a.push(k.lit.box(1.6,.04,.04,c,0,1.6,0),k.light(0,1.6,0,c,1.4));return a;},
  // een commandokoepel op een landingsplatform in de kleur van de speler, met een schotelantenne
  hq:k=>[k.cyl(.95,1.05,.5,'#3a4652',0,.25,0,8),k.ball(.85,'#5a6a78',0,.5,0,[1,.75,1]),k.lit.cyl(.87,.87,.08,'#59c8f2',0,.72,0,16),
    k.cyl(.05,.08,.6,'#5a6a78',.3,1.35,-.5,6),k.cone(.3,.14,'#9fb0c0',.3,1.72,-.5,true),k.cyl(.035,.035,1.9,'#9fb0c0',0,1.6,.8,6),
    k.lit.box(2.2,.03,.05,'#5dffa0',0,.07,-1.33),k.lit.box(2.2,.03,.05,'#5dffa0',0,.07,1.33)],
  // een poort waar de vijand uit tevoorschijn komt; de pluimen uit de ventilatoren zijn groen
  factory:k=>[k.cyl(.8,.9,.2,'#2a3138',0,.1,0,8),k.box(.2,.9,.2,'#3a4652',0,.45,-.8),k.box(.2,.9,.2,'#3a4652',0,.45,.8),
    k.ring(.75,.1,'#3a4652',0,.95,0,0,Math.PI/2),k.lit.ring(.62,.05,'#ff4a8a',0,.95,0,0,Math.PI/2),k.lit.ball(.56,'#7a1a5a',0,.95,0,[.05,1,1]),
    k.cyl(.1,.14,.6,'#5a6a78',-.6,.5,-.9,8),k.cyl(.1,.14,.5,'#5a6a78',-.6,.45,.9,8),k.light(.3,.95,0,'#ff4a8a',2),k.fire(-.6,.95,-.9,.35),k.fire(-.6,.85,.9,.3)],
  lamp:k=>[k.cyl(.03,.05,1.5,'#5a6a78',0,.75,0,6),k.lit.ball(.1,'#5dffa0',0,1.6,0),k.lit.ring(.16,.015,'#5dffa0',0,1.6,0),k.light(0,1.6,0,null,1.5)],
  bridge:(k,L)=>[k.box(L,.3,1.6,'#2a3138',0,-.16,0),...along(L,.6,.3,u=>k.box(.04,.02,1.6,'#3a4652',u,0,0)),
    k.lit.box(L,.03,.04,'#5dffa0',0,.02,-.78),k.lit.box(L,.03,.04,'#5dffa0',0,.02,.78),
    ...along(L,1.2,.3,u=>[k.box(.05,.5,.05,'#5a6a78',u,.25,-.82),k.box(.05,.5,.05,'#5a6a78',u,.25,.82)]),
    k.box(L,.04,.04,'#5a6a78',0,.5,-.82),k.box(L,.04,.04,'#5a6a78',0,.5,.82),k.cyl(.35,.45,2,'#3a4652',0,-1.2,0,6)],
  // de reactor in het midden van de ring: een platform, een kern die gloeit, zwevende ringen en vier pylonen
  hub:k=>[k.cyl(9,10,1.7,'#2a3138',0,-.86,0,8),k.cyl(10.5,10.8,.7,'#151b21',0,-1.5,0,8),k.lit.ring(8.6,.06,'#5dffa0',0,.05,0),
    k.cyl(2.2,2.8,1.2,'#3a4652',0,.6,0,8),k.cyl(1.2,1.6,3.5,'#5a6a78',0,2.9,0,8),k.lit.cyl(1.25,1.25,.15,'#5dffa0',0,2.2,0,16),k.lit.cyl(1.25,1.25,.15,'#5dffa0',0,3.4,0,16),
    k.lit.ball(1.1,'#9fffd0',0,5.4,0),k.lit.ring(2.2,.08,'#5dffa0',0,5.4,0),k.lit.ring(3.2,.06,'#59c8f2',0,6.2,0),
    ...[0,1,2,3].flatMap(i=>{const an=i*Math.PI/2+Math.PI/4,x=Math.cos(an)*6,z=Math.sin(an)*6;return[k.box(.6,4,.6,'#3a4652',x,2,z),k.lit.ball(.3,'#5dffa0',x,4.2,z),k.light(x,4.2,z,'#5dffa0',2)];}),
    k.light(0,5.4,0,'#5dffa0',9)],
  // een metalen barrière met een neonrand
  block:k=>[k.box(.96,.42,.6,'#3a4652',0,.21,0),k.box(.98,.06,.66,'#5a6a78',0,.45,0),k.lit.box(.98,.03,.05,'#5dffa0',0,.38,.31),k.lit.box(.98,.03,.05,'#5dffa0',0,.38,-.31)]},

 // ---------- Ridderburcht: zandsteen, kantelen, poortgebouwen en een donjon (Koningsdoolhof) ----------
 keep:{n:'Ridderburcht',mat:'stone',band:[1.44,.12,2.14,1.25],flag:[0,2.35,1.17],label:3.2,
  base:k=>island(k,'#8a7a5a','#5a5040'),
  // een hoge muur met een weergang, kantelen aan de buitenkant, schietgaten en om en om rode en blauwe schilden
  wall:(k,L)=>[k.box(L,.62,.42,'#c8b48a',0,.31,0),k.box(L,.06,.5,'#a8946a',0,.64,0),...along(L,.9,.25,u=>k.box(.45,.3,.2,'#c8b48a',u,.82,-.11)),
    ...along(L,1.8,.7,u=>k.box(.06,.26,.02,'#1a1410',u,.35,-.22)),
    ...along(L,3.6,1.6,(u,i)=>[k.ball(.17,i%2?'#2a4a8a':'#9a1f1a',u,.38,-.24,[1,1.15,.25]),k.ball(.05,'#e6b830',u,.38,-.29)])],
  // een vierkante toren met kantelen en een rode wimpel
  corner:k=>{const a=[k.box(1.3,2.0,1.3,'#c8b48a',0,1.0,0),k.box(1.36,.08,1.36,'#a8946a',0,1.6,0),k.box(1.45,.1,1.45,'#a8946a',0,2.05,0),
      k.box(.06,.3,.02,'#1a1410',0,1.2,-.66),k.box(.02,.3,.06,'#1a1410',-.66,1.2,0),k.cyl(.03,.03,1.2,'#5a3e26',0,2.7,0,6),k.box(.03,.35,.55,'#9a1f1a',0,3.05,.29)];
    for(const i of[-.5,0,.5])a.push(k.box(.3,.3,.16,'#c8b48a',i,2.25,-.65),k.box(.3,.3,.16,'#c8b48a',i,2.25,.65),k.box(.16,.3,.3,'#c8b48a',-.65,2.25,i),k.box(.16,.3,.3,'#c8b48a',.65,2.25,i));
    return a;},
  // een poortgebouw met een opgetrokken valhek en fakkels; banieren in rood waar de vijand binnenkomt, blauw waar hij weggaat
  gate:(k,role)=>{const a=[k.box(.5,1.9,.6,'#c8b48a',-1.05,.95,0),k.box(.5,1.9,.6,'#c8b48a',1.05,.95,0),k.box(2.6,.45,.6,'#c8b48a',0,1.72,0),
      ...[-1.1,-.55,0,.55,1.1].map(u=>k.box(.3,.25,.2,'#c8b48a',u,2.07,-.2)),...[-.6,-.3,0,.3,.6].map(u=>k.box(.05,.22,.05,'#3a3e44',u,1.38,-.15)),k.box(1.4,.05,.05,'#3a3e44',0,1.28,-.15)];
    for(const u of[-.75,.75])a.push(k.cyl(.04,.05,.3,'#5a3e26',u,1.15,.34,6),k.lit.cone(.05,.14,'#ffb050',u,1.37,.34,false,6),k.light(u,1.4,.36,'#ffa040',1.2));
    if(role!=='side'){const c=role==='in'?'#9a1f1a':'#2a4a8a';for(const u of[-1.05,1.05])a.push(k.box(.36,.7,.03,c,u,1.2,-.32),k.box(.36,.06,.035,'#e6b830',u,.9,-.32));}
    return a;},
  // de donjon: een vierkante woontoren met kantelen, verlichte ramen en een banier boven de deur
  hq:k=>{const a=[k.box(1.4,1.5,2.1,'#c8b48a',0,.75,0),k.box(.06,.75,.5,'#5a3e26',-.72,.38,0),k.lit.box(.04,.22,.12,'#ffb050',-.71,1.05,-.55),k.lit.box(.04,.22,.12,'#ffb050',-.71,1.05,.55),
      k.box(.03,.5,.4,'#9a1f1a',-.72,1.1,0),k.box(.035,.06,.4,'#e6b830',-.72,.88,0),k.cyl(.035,.035,1.2,'#5a3e26',0,2,.8,6)];
    for(const z of[-.9,-.45,0,.45,.9])a.push(k.box(.18,.28,.28,'#c8b48a',-.66,1.64,z),k.box(.18,.28,.28,'#c8b48a',.66,1.64,z));
    for(const x of[-.45,0,.45])a.push(k.box(.28,.28,.18,'#c8b48a',x,1.64,-1.0),k.box(.28,.28,.18,'#c8b48a',x,1.64,1.0));
    return a;},
  // een legerkamp: tenten, een palissade, een vuurkorf en een kampvuur
  factory:k=>{const a=[k.cone(.95,1.3,'#7a2a20',0,.65,0,false,6),k.cone(.55,.8,'#c8b48a',-.6,.4,-1.05,false,6),
      k.cyl(.04,.05,1.4,'#5a3e26',-.4,.7,.9,6),k.cyl(.16,.1,.14,'#3a3e44',-.4,1.45,.9,8),k.fire(-.4,1.6,.9,.45),
      k.box(.5,.08,.08,'#4a3422',.95,.05,0,.6),k.box(.5,.08,.08,'#4a3422',.95,.05,0,-.6),k.fire(.95,.2,0,.5)];
    for(let z=-1.4;z<=1.41;z+=.28)a.push(k.box(.1,.6,.1,'#5a3e26',-1.25,.3,z),k.cone(.07,.15,'#5a3e26',-1.25,.67,z,false,4));
    return a;},
  lamp:k=>[k.box(.1,1.3,.1,'#5a3e26',0,.65,0),k.box(.06,.06,.25,'#3a3e44',0,1.25,.12),k.cyl(.1,.06,.16,'#3a3e44',0,1.35,.25,8),
    k.lit.cone(.07,.2,'#ffb050',0,1.5,.25,false,6),k.light(0,1.5,.25,null,1.4)],
  // een houten brug met planken en zware zijbalken
  bridge:(k,L)=>[k.box(L,.14,1.7,'#5a3e26',0,-.08,0),...blocks(L,.28,.04,0,(u,w,i)=>k.box(w,.05,1.74,i%2?'#6b4a2a':'#5a3e26',u,0,0)),
    k.box(L,.12,.12,'#4a3422',0,.1,-.85),k.box(L,.12,.12,'#4a3422',0,.1,.85),k.box(.7,2,1.4,'#8a7a5a',0,-1.1,0)],
  // een lage haag
  block:k=>[k.box(.96,.42,.6,'#2f4a22',0,.21,0),k.ball(.3,'#3a5a2a',-.25,.42,0,[1,.7,1]),k.ball(.3,'#355226',.25,.44,0,[1,.7,1])]},

 // ---------- Zonnetempel: zandsteen, obelisken, pylonpoorten en een trappiramide (Zandstorm) ----------
 temple:{n:'Zonnetempel',mat:'stone',band:[1.62,.08,2.22,.42],flag:[0,2.35,1.17],label:3.2,
  base:k=>island(k,'#b8925a','#8a6a40'),
  // een zandstenen muur met een kroonlijst, een blauwe band en hiërogliefen aan de buitenkant, een gouden band binnen
  wall:(k,L)=>[k.box(L,.55,.4,'#d8b880',0,.275,0),k.box(L,.1,.48,'#c09a60',0,.6,0),k.box(L,.08,.02,'#2a4a8a',0,.42,-.21),k.box(L,.05,.02,'#e8b84a',0,.3,.21),
    ...along(L,.6,.2,(u,i)=>k.box(.08,i%2?.08:.14,.02,'#5a3a1a',u,.24,-.215))],
  // een obelisk met een gouden punt
  corner:k=>[k.box(.8,.4,.8,'#c09a60',0,.2,0),k.cyl(.22,.34,2.6,'#d8b880',0,1.7,0,4),k.cone(.24,.35,'#e8b84a',0,3.17,0,false,4),k.light(0,3.2,0,'#ffd080',1.2)],
  // een pylonpoort met een gevleugelde zonneschijf; hier komt de vijand binnen, dus rode banieren
  gate:(k,role)=>{const a=[k.box(.55,1.9,.7,'#d8b880',-1.08,.95,0),k.box(.55,1.9,.7,'#d8b880',1.08,.95,0),k.box(.6,.12,.75,'#c09a60',-1.08,1.95,0),k.box(.6,.12,.75,'#c09a60',1.08,1.95,0),
      k.box(2.7,.35,.5,'#c09a60',0,1.72,0),k.ball(.13,'#e8b84a',0,1.72,-.27,[1,1,.3]),k.box(.7,.08,.02,'#2a4a8a',-.42,1.74,-.26),k.box(.7,.08,.02,'#2a4a8a',.42,1.74,-.26)];
    if(role==='in')a.push(k.box(.3,.8,.03,'#a8401a',-1.08,1.1,-.37),k.box(.3,.8,.03,'#a8401a',1.08,1.1,-.37));
    a.push(k.light(-1.08,1.4,.4,'#ffa040',1),k.light(1.08,1.4,.4,'#ffa040',1));return a;},
  // een trappiramide met een gouden top
  hq:k=>[k.box(1.6,.4,2.2,'#d8b880',0,.2,0),k.box(1.25,.4,1.8,'#d0ae74',0,.6,0),k.box(.9,.4,1.3,'#d8b880',0,1.0,0),k.cone(.62,.6,'#e8b84a',0,1.5,0,false,4,Math.PI/4),
    k.box(.06,.4,.35,'#1a1410',-.81,.2,0),k.cyl(.035,.035,2.1,'#5a3a1a',0,1.55,.8,6)],
  // de ingang van een graftombe, met jakhalsbeelden en vuurschalen
  factory:k=>[k.ball(1.0,'#c09a60',0,.2,0,[1,.9,1.3]),k.box(.12,.9,.9,'#d8b880',.85,.45,0),k.box(.1,.75,.65,'#1a1008',.9,.38,0),
    ...[-.7,.7].flatMap(z=>[k.box(.2,.5,.2,'#2a2a2a',.95,.25,z),k.ball(.1,'#2a2a2a',1.0,.58,z),k.cone(.03,.12,'#2a2a2a',1.0,.7,z+.04)]),
    ...[-1.1,1.1].flatMap(z=>[k.cyl(.04,.05,.8,'#5a3a1a',.4,.4,z,6),k.cyl(.15,.1,.12,'#3a2a1a',.4,.85,z,8),k.fire(.4,1.0,z,.4)])],
  lamp:k=>[k.cyl(.05,.07,1.2,'#c09a60',0,.6,0,6),k.cyl(.14,.08,.14,'#3a2a1a',0,1.25,0,8),k.lit.cone(.08,.18,'#ffb050',0,1.42,0,false,6),k.light(0,1.45,0,null,1.4)],
  bridge:(k,L)=>[k.box(L,.5,1.8,'#c09a60',0,-.26,0),k.box(L,.25,.16,'#d8b880',0,.12,-.83),k.box(L,.25,.16,'#d8b880',0,.12,.83),k.box(.7,2,1.4,'#a8844e',0,-1.4,0)],
  block:k=>[k.box(.96,.5,.96,'#d8b880',0,.25,0)],
  // de kern midden in de vesting: een gouden ankh op een sokkel; wat hier aankomt kost levens
  core:k=>[k.cyl(.45,.55,.3,'#c09a60',0,.15,0,8),k.box(.18,.9,.18,'#e8b84a',0,.75,0),k.box(.6,.14,.14,'#e8b84a',0,1.0,0),k.lit.ring(.2,.06,'#ffd060',0,1.32,0,0),k.light(0,1.2,0,'#ffd060',2.5)]},

 // ---------- Piratenschip: de vesting is een dek met een reling, masten en een kapiteinshut (Kaapvaart) ----------
 ship:{n:'Piratenschip',mat:'plain',band:[1.52,.1,2.22,.3],flag:[0,2.35,1.17],label:3.1,
  base:k=>[...island(k,'#3a2414','#1a0e06'),k.box(14.5,.12,14.5,'#c8a050',6.5,-.35,6.5)],
  // een houten reling met geschutspoorten en kanonnen naar buiten
  wall:(k,L)=>[k.box(L,.45,.22,'#5a3a1e',0,.22,0),k.box(L,.08,.32,'#6b4a2a',0,.5,0),
    ...along(L,2.2,.6,u=>[k.box(.22,.16,.02,'#15171a',u,.25,-.12),k.box(.1,.1,.3,'#2a2d31',u,.25,-.26)])],
  // een mast met een zeil, een kraaiennest en een piratenvlag; tonnen aan de voet
  corner:k=>[k.cyl(.08,.1,3.2,'#6b4a2a',0,1.6,0,8),k.box(.08,.08,1.6,'#6b4a2a',0,2.6,0),k.box(.03,1.0,1.4,'#efe6d0',.06,2.05,0),
    k.cyl(.25,.2,.2,'#6b4a2a',0,2.9,0,8),k.box(.02,.3,.45,'#15171a',0,3.35,.23),k.ball(.05,'#f2f2f2',.02,3.37,.2),
    k.cyl(.18,.18,.4,'#7a5a3a',.35,.2,.35,10),k.cyl(.18,.18,.4,'#7a5a3a',-.1,.2,.4,10)],
  // een opening in de reling met touwpalen en scheepslantaarns
  gate:(k,role)=>{const a=[];for(const u of[-.9,.9])a.push(k.cyl(.07,.08,1.2,'#6b4a2a',u,.6,0,8),k.ball(.09,'#c79a2a',u,1.22,0),k.lit.box(.1,.14,.1,'#ffc070',u,1.0,.15),k.light(u,1.0,.2,'#ffc070',.9));
    if(role==='in')a.push(k.box(.02,.3,.45,'#c8281e',-.9,1.45,.23));return a;},
  // de kapiteinshut achterop, met verlichte ramen en een stuurrad
  hq:k=>[k.box(1.5,1.1,2.2,'#6b4a2a',0,.55,0),k.box(1.6,.1,2.3,'#3a2414',0,1.15,0),k.box(1.52,.06,2.22,'#c79a2a',0,.95,0),
    ...[-.6,0,.6].map(z=>k.lit.box(.04,.22,.3,'#ffc070',-.76,.65,z)),k.lit.box(.14,.2,.14,'#ffc070',.4,1.32,-.7),
    k.ring(.25,.03,'#c79a2a',-.3,1.55,0,0,Math.PI/2),k.cyl(.03,.03,.3,'#6b4a2a',-.3,1.3,0,6),k.cyl(.035,.035,1.2,'#6b4a2a',0,2,.8,6)],
  // een kade met kruitvaten, kisten, een kanon en de zwarte vlag
  factory:k=>[k.box(1.4,.06,2.4,'#5a3a1e',0,.03,0),...[[-.3,-.7],[.2,-.8],[-.4,.3]].map(([x,z])=>k.cyl(.2,.2,.45,'#7a5a3a',x,.25,z,10)),k.cyl(.2,.2,.45,'#7a5a3a',-.4,.7,.3,10),
    k.box(.4,.4,.4,'#8a6a3a',.3,.2,.6),k.box(.5,.12,.3,'#6b4a2a',.4,.12,-.1),k.rod(.08,.6,'#2a2d31',.55,.3,-.1),
    k.cyl(.03,.03,1.8,'#6b4a2a',-.6,.9,1.0,6),k.box(.02,.4,.6,'#15171a',-.6,1.6,1.3),k.cyl(.04,.05,.9,'#6b4a2a',.8,.45,.9,6),k.fire(.8,1.0,.9,.35)],
  lamp:k=>[k.cyl(.04,.05,1.4,'#6b4a2a',0,.7,0,6),k.box(.04,.04,.3,'#6b4a2a',0,1.4,.12),k.box(.14,.2,.14,'#15171a',0,1.25,.27),k.lit.box(.1,.14,.1,'#ffc070',0,1.25,.27),k.light(0,1.25,.3,null,1.3)],
  // een loopplank met touwen
  bridge:(k,L)=>[k.box(L,.1,1.4,'#7a5a3a',0,-.05,0),...along(L,.35,.15,u=>k.box(.06,.04,1.4,'#5a3a1e',u,.02,0)),
    ...along(L,1.5,.2,u=>[k.box(.06,.6,.06,'#6b4a2a',u,.3,-.7),k.box(.06,.6,.06,'#6b4a2a',u,.3,.7)]),k.box(L,.03,.03,'#c8b48a',0,.56,-.7),k.box(L,.03,.03,'#c8b48a',0,.56,.7)],
  block:k=>[k.box(.8,.5,.8,'#8a6a3a',0,.25,0),k.box(.82,.04,.82,'#5a3e26',0,.5,0)]},

 // ---------- Luchthaven: een zwevend eiland met koperen relingen, propellertorens en een klokkentoren (Hemelrijk) ----------
 skyport:{n:'Luchthaven',mat:'plain',band:[1.42,.1,2.12,.6],flag:[0,2.35,1.17],label:3.4,
  // het eiland zweeft: eronder hangt een rotspunt
  base:k=>[...island(k,'#6a5a48','#4a3e30'),k.cone(9.5,9,'#5a4a3a',6.5,-6.2,6.5,true,9),k.cone(1.8,3,'#5a4a3a',15.1,-3.2,9.4,true,7),k.cone(1.8,3,'#5a4a3a',-2,-3.2,3.8,true,7)],
  // een koperen reling: luchtig, je kijkt erdoorheen
  wall:(k,L)=>[k.box(L,.12,.3,'#5a5a5e',0,.06,0),k.box(L,.06,.08,'#c8963a',0,.7,0),k.box(L,.04,.05,'#b8683a',0,.4,0),...along(L,1,.1,u=>k.cyl(.04,.05,.7,'#c8963a',u,.35,0,6))],
  // een koperen toren met een propeller erbovenop
  corner:k=>[k.cyl(.35,.45,2.2,'#b8683a',0,1.1,0,8),...[.6,1.4,2.0].map(y=>k.cyl(.38,.38,.08,'#c8963a',0,y,0,8)),k.cone(.45,.5,'#c8963a',0,2.45,0,false,8),
    k.cyl(.06,.06,.2,'#5a5a5e',0,2.75,0,6),k.box(1.4,.04,.14,'#7a5a3a',0,2.86,0),k.box(.14,.04,1.4,'#7a5a3a',0,2.86,0),k.lit.ball(.08,'#ffe8a0',0,1.8,-.36)],
  // een boog met een tandwiel; alle vier de poorten zijn gelijk, want de vijand komt uit elke richting
  gate:(k,role)=>[k.box(.25,1.7,.3,'#b8683a',-.95,.85,0),k.box(.25,1.7,.3,'#b8683a',.95,.85,0),k.box(2.2,.18,.3,'#c8963a',0,1.75,0),k.ring(.3,.06,'#c8963a',0,2.12,0,0),
    k.lit.ball(.07,'#ffe8a0',-.95,1.55,.18),k.lit.ball(.07,'#ffe8a0',.95,1.55,.18),k.light(0,1.6,.2,'#ffe8a0',1.2)],
  // een klokkentoren met een verlichte wijzerplaat
  hq:k=>[k.box(1.4,.9,2.1,'#d8c8a0',0,.45,0),k.box(.9,1.4,.9,'#d8c8a0',0,1.6,-.4),k.lit.ball(.3,'#fff6d8',-.46,1.9,-.4,[.1,1,1]),
    k.box(.02,.2,.03,'#3a2e24',-.48,1.95,-.4),k.box(.02,.03,.16,'#3a2e24',-.48,1.9,-.35),k.cone(.75,.6,'#b8683a',0,2.6,-.4,false,4,Math.PI/4),k.cyl(.035,.035,1.8,'#5a5a5e',0,1.7,.8,6)],
  // een meermast met een klein luchtschip en een stoomketel
  factory:k=>[k.cyl(.08,.1,2.2,'#5a5a5e',-.5,1.1,0,6),k.ball(.45,'#8a8a90',.3,1.8,0,[2.2,.8,.8]),k.box(.5,.15,.2,'#7a5a3a',.3,1.35,0),k.box(.04,.4,.06,'#7a5a3a',-.7,1.8,0),
    k.cyl(.3,.35,.7,'#b8683a',.6,.35,-.8,10),k.cyl(.07,.07,.6,'#5a5a5e',.6,1.0,-.8,6),k.fire(.6,1.4,-.8,.35)],
  lamp:k=>[k.cyl(.035,.05,1.5,'#5a5a5e',0,.75,0,6),k.lit.ball(.1,'#ffe8a0',0,1.55,0),k.cone(.12,.1,'#5a5a5e',0,1.68,0,false,6),k.light(0,1.55,0,null,1.4)],
  // een hangbrug van planken en touw, zonder pijlers: eronder is alleen lucht
  bridge:(k,L)=>[k.box(L,.06,1.3,'#7a5a3a',0,-.03,0),...blocks(L,.24,.06,0,(u,w,i)=>k.box(w,.04,1.34,i%2?'#8a6a48':'#6b4a2a',u,.01,0)),
    ...along(L,1.4,.2,u=>[k.box(.05,.6,.05,'#6b4a2a',u,.3,-.7),k.box(.05,.6,.05,'#6b4a2a',u,.3,.7)]),k.box(L,.03,.03,'#c8b48a',0,.58,-.7),k.box(L,.03,.03,'#c8b48a',0,.58,.7)],
  block:k=>[k.box(.8,.5,.8,'#b8683a',0,.25,0),k.box(.84,.06,.84,'#c8963a',0,.5,0)]}
};
})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
