// ErmeTD · vijanden
// Alles van één vijand staat bij elkaar: zijn getallen, hoe hij eruitziet en welke letter hij over het netwerk heeft.
// Hoe een vijand er per map uitziet (een andere naam, andere kleuren of een ander model) staat in data/themes.js.
// Sterk en zwak per toren staat in data/towers.js (VS).
(function(ERME){
'use strict';

// De velden van een vijand:
//  n       naam in beeld (een thema kan hem per map anders noemen)
//  hp      levens, als factor op de levenscurve van de ronde (1 = een gewone soldaat)
//  sp      snelheid in vakken per seconde
//  arm     pantser: dit deel van de schade komt niet aan (.35 = 35% minder)
//  regen   herstelt dit deel van zijn levens per seconde
//  immune  kan niet bevroren of vergiftigd vertraagd worden
//  b       premie: credits voor een kill, als factor
//  leak    levens die het kost als hij erdoor komt (standaard 1)
//  boss    is een baas (Bazenjager en Bazenbreker werken tegen hem)
//  code    één letter voor het netwerk; elke vijand een eigen letter
//  bar     hoogte van zijn levensbalk boven de grond
//  model   hoe hij eruitziet, opgebouwd uit blokjes (zie MODELKIT onderaan)
ERME.EN={
 inf:{n:'Conscript',hp:1,sp:1.25,b:1,code:'i',bar:.75,
  model:k=>[k.box(.16,.26,.14,'#8f2a22',0,.27,0),k.box(.07,.14,.07,'#2a2420',0,.07,.04),k.box(.07,.14,.07,'#2a2420',0,.07,-.04),k.ball(.085,'#c9a888',0,.48,0),
   k.ball(.1,'#4a5530',0,.52,0,[1,.6,1]),k.rod(.02,.28,'#15171a',.14,.33,.08),k.box(.12,.16,.06,'#3a3f2a',-.08,.3,0)]},
 dog:{n:'Aanvalshond',hp:.55,sp:2.2,b:.8,code:'d',bar:.5,
  model:k=>[k.box(.36,.14,.13,'#6a4a30',0,.2,0),k.box(.13,.12,.11,'#4d3422',.22,.27,0),k.box(.1,.04,.04,'#4d3422',-.22,.26,0),
   ...[[.12,.04],[.12,-.04],[-.12,.04],[-.12,-.04]].map(([x,z])=>k.box(.05,.14,.05,'#4d3422',x,.07,z))]},
 tank:{n:'Hammer Tank',hp:3.2,sp:.8,arm:.35,b:2.6,code:'t',bar:.65,
  model:k=>[k.box(.64,.13,.13,'#1d1f22',0,.07,.2),k.box(.64,.13,.13,'#1d1f22',0,.07,-.2),k.box(.6,.16,.36,'#7a2d26',0,.2,0),k.box(.3,.14,.26,'#8a362c',-.04,.36,0),
   k.rod(.035,.44,'#1a1010',.28,.37,0),k.box(.08,.08,.08,'#2a2f35',-.1,.47,.06)]},
 drone:{n:'Terror Drone',hp:.32,sp:1.6,b:.4,code:'r',bar:.95,
  model:k=>[k.gem(.17,'#9aa2ab',0,.6,0),k.box(.06,.06,.06,'#ff3b2e',.15,.6,0),k.box(.5,.02,.06,'#33373c',0,.76,0),k.box(.06,.02,.5,'#33373c',0,.76,0),k.box(.04,.14,.04,'#33373c',0,.7,0)]},
 mech:{n:'Veldmech',hp:1.8,sp:1,regen:.025,b:1.8,code:'m',bar:.75,
  model:k=>[k.box(.08,.24,.08,'#1f3023',0,.12,.1),k.box(.08,.24,.08,'#1f3023',0,.12,-.1),k.box(.3,.26,.3,'#356f40',0,.4,0),k.box(.06,.02,.2,'#e8e8e8',0,.54,0),
   k.box(.2,.02,.06,'#e8e8e8',0,.54,0),k.rod(.03,.24,'#15171a',.2,.4,.12),k.rod(.03,.24,'#15171a',.2,.4,-.12)]},
 haz:{n:'Hazmat-trooper',hp:2.2,sp:1.05,immune:true,b:2.2,code:'h',bar:.78,
  model:k=>[k.box(.2,.34,.18,'#b89a22',0,.24,0),k.ball(.11,'#b89a22',0,.5,0),k.box(.06,.07,.14,'#101010',.09,.51,0),k.box(.1,.2,.14,'#6a6a6a',-.13,.3,0),k.rod(.025,.2,'#222',.14,.3,.09)]},
 boss:{n:'Luchtschip',hp:28,sp:.55,arm:.25,b:25,leak:10,boss:true,code:'b',bar:2.4,
  model:k=>[k.ball(.5,'#8f2019',0,1.7,0,[2.6,.9,.9]),k.box(1.3,.06,.92,'#c79a2a',0,1.7,0),k.box(.6,.22,.32,'#22262b',0,1.2,0),k.box(.4,.6,.05,'#5a1410',-1.15,1.7,0),
   k.box(.4,.05,.6,'#5a1410',-1.15,1.7,0),k.rod(.09,.34,'#2a2d31',-.3,1.32,.34),k.rod(.09,.34,'#2a2d31',-.3,1.32,-.34),k.ball(.12,'#3a1512',1.28,1.7,0)]}
};

// De golven. Voor golf r roept het spel deze functie aan; add(soort, aantal, tussenpoos in seconden, levensfactor) zet vijanden in de rij.
//  n     de basisgrootte van een golf: 8 + 0,4 per ronde
//  last  dit is de laatste golf van het potje
// Elke tiende golf is een baasgolf. Daartussen wisselen vijf soorten golven elkaar af.
ERME.WAVES=(r,{add,n,last})=>{const R=Math.round;
  if(r%10===0){add('inf',R(n*.5),.55);add('tank',R(n*.3),.9);add('boss',1+Math.floor(r/40),4);if(last)add('boss',1,1,3);return;}
  switch(r%5){
    case 1:add('inf',n,.55);break;                                                     // soldaten
    case 2:add('inf',R(n*.6),.55);add('dog',R(n*.6),.4);break;                        // soldaten met honden
    case 3:add('drone',R(n*1.8),.25);break;                                            // een zwerm drones
    case 4:add('tank',R(n*.4),.9);add(r>=14?'mech':'inf',R(n*.35),.7);break;          // tanks, later met mechs
    default:add(r>=18?'haz':'inf',R(n*.4),.7);add('dog',R(n*.5),.4);add('tank',R(n*.25),.9);}}; // gemengd

// MODELKIT: de bouwstenen voor een model. Maten in vakken (1 = één vak), y is de hoogte boven de grond.
//  k.box(breed, hoog, diep, kleur, x, y, z, draaiY, draaiZ)    een blok
//  k.ball(straal, kleur, x, y, z, [sx, sy, sz])               een bol, eventueel uitgerekt
//  k.rod(straal, lengte, kleur, x, y, z, kanteling)           een liggende staaf (loop, as)
//  k.cyl(straal boven, straal onder, hoog, kleur, x, y, z)    een staande cilinder
//  k.cone(straal, hoog, kleur, x, y, z)                       een kegel met de punt omhoog
//  k.gem(straal, kleur, x, y, z)                              een achtvlak
//  k.ring(straal, dikte, kleur, x, y, z)                      een liggende ring (wiel op zijn kant: draai met een thema-model)
// De voorkant van een vijand is +x: daar loopt hij heen.
})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
