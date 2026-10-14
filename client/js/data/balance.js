// ErmeTD · balans
// Alle getallen die bepalen hoe zwaar het spel is. Je kunt ze hier aanpassen zonder de spelregels (engine.js) te lezen.
// startGold, lives, hpX, goldX en PREP zijn ook instelbaar in de webadmin; die waarde wint bij een potje.
(function(ERME){
'use strict';

// Hoeveel levels een potje heeft.
ERME.ROUNDS=100;

// Bouwtijd aan het begin van een potje, in seconden.
ERME.PREP=300;

// De curve van de vijanden.
//  hp0, lin, g, g2, late  levens van een vijand in ronde r: hp0 × (1 + lin·r) × g^r, en na ronde `late` nog eens × g2 per ronde
//  gold0, goldLin         credits per kill: gold0 × (1 + goldLin·r), keer de premie (b) van de vijand
//  startGold, lives       waarmee je begint
//  bonA, bonB             rondebonus: bonA + bonB·r credits
//  midX, rampFrom, ramp   extra zwaarte: level 1-10 niets, dan oplopend tot ×midX op level 20 (tot en met 30 gelijk),
//                         en vanaf level rampFrom+1 elk level ramp erbij (samengesteld)
//  hpX, goldX             vermenigvuldigers uit de webadmin
ERME.B={hp0:14,lin:.06,g:1.063,g2:1.0296,late:80,gold0:2.5,goldLin:.035,startGold:260,lives:20,hpX:1,goldX:1,
  bonA:12,bonB:4,
  // Extra zwaarte bovenop de curve: level 1-10 ongewijzigd, daarna loopt het op tot midX op level 20 (tot en met 30 gelijk),
  // en vanaf level 31 komt er elk level ramp bij (samengesteld).
  midX:1.15,rampFrom:30,ramp:.015};

// Moeilijkheidsgraden. Elke speler kiest er zelf een. hp en sp maken de vijanden in jouw vesting taaier en sneller,
// hurt is de extra schade die je held in minigames krijgt, score de vermenigvuldiger op alles wat je scoort.
ERME.DIFF=[{id:'geers',n:'Geers',d:'De gewone strijd.',score:1,hp:1,sp:1,hurt:1},
 {id:'super',n:'Super Geers',d:'Vijanden hebben 35% meer levens en lopen 6% sneller. Je held krijgt 20% meer schade.',score:1.25,hp:1.35,sp:1.06,hurt:1.2},
 {id:'only',n:'Alleen voor Geers',d:'Vijanden hebben 85% meer levens en lopen 12% sneller. Je held krijgt 50% meer schade.',score:1.75,hp:1.85,sp:1.12,hurt:1.5}];

// Duwen en sprinten in minigames. Skills schuiven deze waarden op (zie mods in engine.js).
ERME.MOVES={pushCd:6,pushRange:2.4,pushDist:1.6,sprDur:3,sprCd:10,sprSpd:.6};

// De Slapende Geers wekken: zo vaak drukken, dan is hij zo lang wakker met zoveel keer kracht en bereik. Eén keer per toren.
ERME.WAKE={pokes:10,time:10,mul:20
};

})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
