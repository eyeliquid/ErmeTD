// ErmeTD · torens
// Wat elke toren kost en doet, en tegen welke vijanden hij sterk of zwak is.
// Het uiterlijk van een toren staat in makeTower in game.js; de werking (wie hij raakt en hoe) in fire in engine.js.
(function(ERME){
'use strict';

// De velden van een toren:
//  n, d     naam en uitleg in beeld
//  cost     bouwprijs in credits
//  dmg      schade per schot          rate   schoten per seconde        range  bereik in vakken
//  splash   straal van de explosie    fz     bevriezen (seconden)       pd, slow  gif per seconde en vertraging
//  chain    aantal vijanden waar bliksem op overspringt                 minr   minimale afstand
//  max      aantal upgrades (standaard 5)   up  schadegroei per upgrade (standaard ×1,4)
//  rl       bereikgroei per upgrade         uc  [basis, stap] van de upgradeprijs als deel van cost
//  size     vakken in het vierkant (3 = 3 bij 3)
ERME.T={
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

// De tien gewone torens, in de volgorde van de commandokaart (toets 1 tot 0).
ERME.TYPES=['sentry','flak','cryo','toxin','tesla','prism','rocket','rail','wave','uplink'];
// Zoveel Geers Torens heb je nodig voor De Slapende Geers.
ERME.GEERS_NEED=4;

// Sterk en zwak: wat een toren tegen een vijand doet. 1.5 = sterk, .5 = zwak, niet genoemd = gewoon.
// Het getal telt voor de schade per schot, voor het gif per seconde en voor hoe lang een vijand bevroren blijft.
ERME.VS={
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

})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
