// ErmeTD · thema's
// Hoe een map eruitziet en klinkt. Elke map in data/maps.js wijst met `theme` naar een thema hieronder.
// Een thema verandert niets aan de spelregels: alleen kleuren, licht, de burcht, de namen en modellen van de vijanden en de muziek.
// Wat je weglaat, komt uit het thema `alarm` (de oorspronkelijke look).
(function(ERME){
'use strict';

// De velden van een thema (kleuren als '#rrggbb'):
//  n, tag        naam en een korte omschrijving voor de lobby
//  sky, fog      achtergrond en mist: fog = [kleur, begint op, dicht op] in meters
//  exposure      helderheid van het hele beeld (1 = neutraal)
//  light         hemi = [lucht, grond, sterkte], sun = [kleur, sterkte], fill = [kleur, sterkte] (tegenlicht)
//  ground        het gras van een vesting. kind: 'grass' | 'lawn' (gemaaide banen) | 'snow' | 'metal' | 'meadow' (met bloemen)
//                base = grondkleur, pal = vlekken, blade = [licht, donker] sprietjes, glow = kleur van de lijnen (metal)
//  road          de weg die je legt. kind: 'cobble' | 'asphalt' | 'plate' | 'snow' | 'flagstone'; a, b = de twee hoofdkleuren
//  trail         het pad over het gras: [kleur midden, kleur rand]; trailGlow = true laat het oplichten
//  kerb          de stoeprand langs de weg; twee kleuren wisselen elkaar af
//  sea           het water rond de vestingen. kind: 'water' | 'ice' | 'void'; base, light, dark, wave; blobs = hoe sterk de vlekken (standaard .22); rough en metal voor de glans
//  wall          tint van de minigame-eilanden; metal = 0..1 (1 = staalplaat in plaats van steen). De burchten zelf staan in data/forts.js
//  lamp, fire    kleur van de lantaarns en van de vuren
//  particles     iets dat in de lucht hangt: {kind: 'snow' | 'motes' | 'sparks', color, n}
//  fort          de burcht: hoe muren, torens, poorten, hoofdkwartier, fabriek, lantaarns en bruggen eruitzien (data/forts.js)
//  enemies       per vijand: n = andere naam, paint = {oude kleur: nieuwe kleur} op het gewone model, model = een heel ander model
//  music         de muziekstijl (zie STYLES in music.js)
//  ui            accent en trim: de goudkleur en de randen van de knoppen in het spel
ERME.THEMES={

 // ---------- Rood Alarm: de oorspronkelijke look (Klassiek) ----------
 alarm:{n:'Rood Alarm',tag:'Schemering boven de vestingen',
  sky:'#070c14',fog:['#0a121c',55,150],exposure:1.25,
  light:{hemi:['#8ea4d6','#2b2432',.62],sun:['#ffd0a0',1.75],fill:['#4a6fd0',.4]},
  ground:{kind:'grass',base:'#35432a',pal:['#43552f','#2c3923','#4a4532','#3a4a2c','#514a38','#2f3d28'],blade:['rgba(150,170,90,.16)','rgba(10,20,5,.22)']},
  road:{kind:'cobble',a:'#7a4a38',b:'#4a4440'},
  trail:['rgba(78,60,38,.96)','rgba(64,52,34,.62)'],
  kerb:['#8d929b'],
  sea:{kind:'water',base:'#0c2636',light:'30,70,95',dark:'4,14,24',wave:'170,210,235',rough:.3,metal:.55},
  wall:{tint:'#ffffff',metal:0},
  lamp:'#ffc070',fire:'#ff9900',
  particles:null,fort:'castle',enemies:{},
  music:'alarm',ui:{accent:'#f6cf4d',trim:'#a8842c'}},

 // ---------- Grand Prix: auto's (Estafette) ----------
 racing:{n:'Grand Prix',tag:'Een zonnig circuit, de vijand komt op wielen',
  sky:'#86aac8',fog:['#9cb6cc',70,190],exposure:1.05,
  light:{hemi:['#cfe2f5','#4a5a3a',.95],sun:['#fff2d6',2.2],fill:['#9ec2ff',.35]},
  ground:{kind:'lawn',base:'#3f6a2c',pal:['#4c7a34','#3a6228','#46722f','#518038'],blade:['rgba(190,230,120,.16)','rgba(10,30,5,.2)']},
  road:{kind:'asphalt',a:'#3a3c40',b:'#2a2c30'},
  trail:['rgba(150,140,120,.9)','rgba(120,112,96,.55)'],
  kerb:['#d8261c','#f2f2f2'],
  sea:{kind:'water',base:'#1d5a7a',light:'70,140,180',dark:'10,40,60',wave:'230,245,255',blobs:.07,rough:.25,metal:.4},
  wall:{tint:'#d8dce2',metal:0},
  lamp:'#ffffff',fire:'#ffb347',
  particles:null,
  enemies:{
   inf:{n:'Kart',model:k=>[k.box(.36,.07,.22,'#d8261c',0,.09,0),k.box(.1,.08,.16,'#15171a',-.04,.17,0),k.ball(.07,'#f2c230',-.02,.27,0),k.box(.04,.03,.24,'#15171a',-.18,.13,0),
     ...[[.12,.13],[.12,-.13],[-.12,.13],[-.12,-.13]].map(([x,z])=>k.ring(.055,.03,'#15171a',x,.06,z,0))]},
   dog:{n:'Racemotor',model:k=>[k.box(.32,.09,.06,'#1e6fd8',0,.15,0),k.box(.1,.1,.08,'#e8e8e8',.12,.2,0),k.ball(.065,'#f2c230',-.02,.3,0),k.box(.08,.12,.07,'#15171a',-.03,.22,0),
     k.ring(.075,.028,'#15171a',.14,.08,0,0),k.ring(.075,.028,'#15171a',-.14,.08,0,0)]},
   tank:{n:'Oplegger',model:k=>[k.box(.2,.24,.3,'#d8261c',.22,.2,0),k.box(.04,.1,.26,'#9fd0ff',.32,.26,0),k.box(.46,.3,.32,'#e8e8e8',-.14,.25,0),k.box(.47,.06,.33,'#1e6fd8',-.14,.32,0),
     ...[.24,-.06,-.28].flatMap(x=>[k.ring(.07,.035,'#15171a',x,.07,.16,0),k.ring(.07,.035,'#15171a',x,.07,-.16,0)])]},
   drone:{n:'Cameradrone',paint:{'#9aa2ab':'#f2f2f2','#ff3b2e':'#1e6fd8'}},
   mech:{n:'Monstertruck',model:k=>[k.box(.38,.14,.26,'#3aa84a',0,.32,0),k.box(.16,.1,.22,'#15171a',-.02,.43,0),k.box(.4,.04,.28,'#f2c230',0,.25,0),
     ...[[.14,.17],[.14,-.17],[-.14,.17],[-.14,-.17]].map(([x,z])=>k.ring(.1,.05,'#15171a',x,.12,z,0))]},
   haz:{n:'Tankwagen',model:k=>[k.box(.16,.2,.26,'#f2c230',.22,.18,0),k.rod(.12,.42,'#c8ccd2',-.1,.24,0),k.box(.42,.04,.26,'#2a2d31',-.1,.09,0),
     ...[.22,-.02,-.24].flatMap(x=>[k.ring(.065,.03,'#15171a',x,.07,.14,0),k.ring(.065,.03,'#15171a',x,.07,-.14,0)])]},
   boss:{n:'Reclamezeppelin',paint:{'#8f2019':'#f2f2f2','#c79a2a':'#d8261c','#5a1410':'#1e6fd8','#22262b':'#15171a','#3a1512':'#1e6fd8'}}},
  fort:'pits',
  music:'racing',ui:{accent:'#ff5a3c',trim:'#b8382a'}},

 // ---------- Het Bevroren Noorden: winter (Wintermaul) ----------
 winter:{n:'Bevroren Noorden',tag:'Sneeuw, ijs en een team dat het samen moet doen',
  sky:'#3a4a5c',fog:['#8a9cb0',30,120],exposure:1.1,
  light:{hemi:['#d8e6f5','#5a6a80',.9],sun:['#e8f2ff',1.35],fill:['#7fb4ff',.5]},
  ground:{kind:'snow',base:'#dfe7ee',pal:['#c9d6e2','#f4f8fb','#d2dde8','#e8eff5']},
  road:{kind:'snow',a:'#9fb2c4',b:'#7f93a8'},
  trail:['rgba(150,170,195,.85)','rgba(170,190,210,.45)'],
  kerb:['#e8eff5'],
  sea:{kind:'ice',base:'#7fa8c4',light:'200,230,250',dark:'60,100,130',wave:'240,250,255',rough:.15,metal:.2},
  wall:{tint:'#d6dee8',metal:0},
  lamp:'#bfe8ff',fire:'#9fe8ff',
  particles:{kind:'snow',color:'#ffffff',n:1400},
  enemies:{
   inf:{n:'Sneeuwsoldaat',paint:{'#8f2a22':'#dfe6ee','#4a5530':'#eef3f8','#3a3f2a':'#9fb0c0','#2a2420':'#5a6a7a'}},
   dog:{n:'Husky',paint:{'#6a4a30':'#9aa3ad','#4d3422':'#e6ebf0'}},
   tank:{n:'Sneeuwrups',paint:{'#7a2d26':'#c9d3dc','#8a362c':'#e6ecf1'}},
   drone:{n:'IJskristal',paint:{'#9aa2ab':'#9fe8ff','#ff3b2e':'#e6fbff','#33373c':'#7fb4d8'}},
   mech:{n:'Yeti',model:k=>[k.ball(.2,'#eef3f8',0,.36,0,[1,1.15,1]),k.ball(.1,'#eef3f8',.06,.6,0),k.box(.04,.05,.12,'#7fb4d8',.15,.6,0),
     k.box(.07,.26,.07,'#e2e9f0',.02,.32,.22),k.box(.07,.26,.07,'#e2e9f0',.02,.32,-.22),k.box(.09,.16,.09,'#d2dde8',0,.08,.09),k.box(.09,.16,.09,'#d2dde8',0,.08,-.09)]},
   haz:{n:'Vorstsoldaat',paint:{'#b89a22':'#3c6f9a','#6a6a6a':'#cfe8f8'}},
   boss:{n:'IJsluchtschip',paint:{'#8f2019':'#c7d8e6','#c79a2a':'#7fb9d9','#5a1410':'#3a5a78','#3a1512':'#3a5a78'}}},
  fort:'ice',
  music:'winter',ui:{accent:'#9fe0ff',trim:'#4a88b0'}},

 // ---------- Neon Nexus: sci-fi (Groene Cirkel) ----------
 scifi:{n:'Neon Nexus',tag:'Een ruimtestation met een groene ring van licht',
  sky:'#020409',fog:['#04100c',40,140],exposure:1.2,
  light:{hemi:['#5dffa0','#0a1420',.35],sun:['#b8fff0',1.1],fill:['#2f8fff',.7]},
  ground:{kind:'metal',base:'#151b21',pal:['#1c242c','#11161b','#1a2229'],glow:'#2fff8a'},
  road:{kind:'plate',a:'#1e262e',b:'#5dffa0'},
  trail:['rgba(70,255,140,.3)','rgba(20,120,70,.1)'],trailGlow:true,
  kerb:['#5dffa0','#1e262e'],
  sea:{kind:'void',base:'#02060a',light:'20,60,50',dark:'0,0,0',wave:'70,255,150',rough:.2,metal:.85},
  wall:{tint:'#9fb0c0',metal:1},
  lamp:'#5dffa0',fire:'#4dff88',
  particles:{kind:'motes',color:'#5dffa0',n:500},
  enemies:{
   inf:{n:'Droid',model:k=>[k.box(.05,.16,.05,'#5a6a78',0,.08,.05),k.box(.05,.16,.05,'#5a6a78',0,.08,-.05),k.box(.14,.2,.16,'#b8c2cc',0,.27,0),
     k.ball(.08,'#2a3138',0,.45,0),k.box(.03,.03,.1,'#5dffa0',.07,.46,0),k.rod(.022,.24,'#2a3138',.13,.3,.1),k.box(.04,.04,.04,'#5dffa0',.25,.3,.1)]},
   dog:{n:'Scanner',model:k=>[k.cyl(.15,.12,.06,'#9fb0c0',0,.22,0,16),k.ball(.08,'#2a3138',0,.28,0,[1,.6,1]),k.box(.05,.04,.08,'#5dffa0',.08,.28,0),k.cyl(.06,.02,.08,'#5dffa0',0,.14,0,10)]},
   tank:{n:'Zweeftank',model:k=>[k.box(.62,.12,.38,'#3a4652',0,.22,0),k.box(.5,.04,.3,'#5dffa0',0,.15,0),k.box(.28,.12,.24,'#5a6a78',-.04,.34,0),
     k.rod(.03,.5,'#2a3138',.3,.35,0),k.box(.06,.06,.06,'#5dffa0',.56,.35,0)]},
   drone:{n:'Sonde',paint:{'#9aa2ab':'#c0f5ff','#ff3b2e':'#5dffa0','#33373c':'#2a3138'}},
   mech:{n:'Cyborg',paint:{'#356f40':'#5a6a78','#1f3023':'#2a3138','#e8e8e8':'#5dffa0','#15171a':'#9fb0c0'}},
   haz:{n:'Plasmasoldaat',paint:{'#b89a22':'#2f8f6a','#6a6a6a':'#9fe8ff','#101010':'#5dffa0'}},
   boss:{n:'Moederschip',model:k=>[k.ball(1,'#5a6a78',0,1.7,0,[1.3,.22,1.3]),k.ball(.42,'#9fe8ff',0,1.86,0,[1,.7,1]),k.ring(1.15,.06,'#5dffa0',0,1.66,0),
     k.cyl(.5,.3,.18,'#2a3138',0,1.48,0,16),...[0,1,2,3,4,5].map(i=>{const an=i*1.047;return k.box(.12,.06,.12,'#5dffa0',Math.cos(an)*.95,1.6,Math.sin(an)*.95);})]}},
  fort:'station',
  music:'scifi',ui:{accent:'#5dffa0',trim:'#2f8f5a'}},

 // ---------- Koningsdoolhof: ridders (Doolhofbouwer) ----------
 knights:{n:'Koningsdoolhof',tag:'Banieren, fakkels en een leger te paard en te voet',
  sky:'#1c1210',fog:['#3a2416',45,140],exposure:1.2,
  light:{hemi:['#ffd9a8','#2a1e14',.7],sun:['#ffb46a',1.9],fill:['#6a7ad0',.35]},
  ground:{kind:'meadow',base:'#3f5a28',pal:['#4a6a2e','#36502a','#55703a','#465f2c','#3a4e24'],blade:['rgba(180,200,90,.16)','rgba(10,25,5,.22)'],flowers:['#f2f2e6','#f2c230','#b07ad8','#e8603a']},
  road:{kind:'flagstone',a:'#8a8478',b:'#5a554c'},
  trail:['rgba(110,84,52,.95)','rgba(92,72,44,.6)'],
  kerb:['#6e6a62'],
  sea:{kind:'water',base:'#1a2a24',light:'50,80,60',dark:'8,16,12',wave:'170,200,170',rough:.45,metal:.35},
  wall:{tint:'#e6d2a8',metal:0},
  lamp:'#ffb050',fire:'#ff8a20',
  particles:{kind:'sparks',color:'#ffc060',n:260},
  enemies:{
   inf:{n:'Voetknecht',model:k=>[k.box(.15,.24,.14,'#9a1f1a',0,.27,0),k.box(.155,.04,.145,'#e6b830',0,.3,0),k.box(.07,.14,.07,'#5a5e64',0,.07,.04),k.box(.07,.14,.07,'#5a5e64',0,.07,-.04),
     k.ball(.08,'#c9a888',0,.47,0),k.ball(.095,'#9aa3ad',0,.51,0,[1,.75,1]),k.cyl(.012,.012,.62,'#6b4a2a',.12,.42,.11,6),k.cone(.028,.09,'#c8ccd2',.12,.78,.11),k.box(.03,.2,.16,'#2a4a8a',.02,.3,-.12)]},
   dog:{n:'Wolf',paint:{'#6a4a30':'#6d6f73','#4d3422':'#4a4c50'}},
   tank:{n:'Stormram',model:k=>[k.box(.58,.08,.34,'#6b4a2a',0,.14,0),k.box(.62,.06,.42,'#8a6a3a',0,.37,0),k.box(.62,.08,.06,'#6b4a2a',0,.42,0),k.box(.05,.22,.05,'#5a3e26',.25,.25,.15),
     k.box(.05,.22,.05,'#5a3e26',-.25,.25,.15),k.box(.05,.22,.05,'#5a3e26',.25,.25,-.15),k.box(.05,.22,.05,'#5a3e26',-.25,.25,-.15),k.rod(.05,.7,'#4a3a2a',.1,.24,0),k.ball(.08,'#5a5e64',.45,.24,0),
     ...[[.2,.19],[.2,-.19],[-.2,.19],[-.2,-.19]].map(([x,z])=>k.ring(.08,.03,'#3a2a1c',x,.08,z,0))]},
   drone:{n:'Raaf',paint:{'#9aa2ab':'#1b1c20','#ff3b2e':'#e8c040','#33373c':'#1b1c20'}},
   mech:{n:'IJzeren reus',paint:{'#356f40':'#8a8f96','#1f3023':'#5a5e64','#e8e8e8':'#e6b830','#15171a':'#5a5e64'}},
   haz:{n:'Pestdokter',paint:{'#b89a22':'#2a2420','#101010':'#d8c8a8','#6a6a6a':'#4a3a2a'}},
   boss:{n:'Draak',model:k=>[k.ball(.5,'#2f6a3a',0,1.7,0,[2,.75,.8]),k.ball(.24,'#2f6a3a',1.05,1.9,0,[1.4,.8,.8]),k.box(.2,.06,.2,'#f2c230',1.3,1.86,0),
     k.cone(.05,.22,'#d8c8a8',1.05,2.12,.1),k.cone(.05,.22,'#d8c8a8',1.05,2.12,-.1),k.box(.9,.04,1.2,'#1f4a28',-.1,1.95,.75,0,.25),k.box(.9,.04,1.2,'#1f4a28',-.1,1.95,-.75,0,.25),
     k.rod(.08,.9,'#2f6a3a',-1.2,1.6,0,-.3),k.cone(.1,.2,'#1f4a28',-1.65,1.47,0)]}},
  fort:'keep',
  music:'knights',ui:{accent:'#e6b830',trim:'#9a1f1a'}}
};
})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
