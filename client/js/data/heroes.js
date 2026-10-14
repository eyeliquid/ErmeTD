// ErmeTD · helden en harnas
// De helden waaruit je kiest. Hoe ze aanvallen staat in heroAttack in game.js (per soort aanval k), hoe ze eruitzien in makeHero.
(function(ERME){
'use strict';
//  id     sleutel           n, role, d  naam, rol en uitleg in beeld
//  hp     levenspunten      spd   loopsnelheid in vakken per seconde
//  range  bereik in vakken  dmg   schade per aanval      rate  aanvallen per seconde
//  k      soort aanval: 'gun' | 'blade' | 'bolt' | 'slam' | 'snipe' | 'flame'
// De volgorde is de volgorde in het keuzescherm; opgeslagen voortgang bewaart het nummer, dus voeg nieuwe helden achteraan toe.
ERME.HEROES=[
 {id:'commando',n:'Commando',role:'Afstand · twee pistolen',d:'Snelle schoten op middellange afstand.',hp:100,spd:5.2,range:4.5,dmg:7,rate:4,k:'gun'},
 {id:'shinobi',n:'Shinobi',role:'Melee · katana',d:'Razendsnel van dichtbij, maar kwetsbaar.',hp:90,spd:6.4,range:1.5,dmg:16,rate:3,k:'blade'},
 {id:'tesla',n:'Tesla-trooper',role:'Middellang · bliksem',d:'Bliksem springt over naar twee extra doelen.',hp:130,spd:4.4,range:3.2,dmg:30,rate:1.1,k:'bolt'},
 {id:'moker',n:'Moker',role:'Melee · oorlogshamer',d:'Trage klap die alles rondom raakt. Veel levenspunten.',hp:190,spd:4.2,range:1.8,dmg:55,rate:.8,k:'slam'},
 {id:'sniper',n:'Scherpschutter',role:'Lange afstand · geweer',d:'Eén zwaar schot van heel ver, dwars door pantser.',hp:80,spd:4.8,range:8,dmg:70,rate:.5,k:'snipe'},
 {id:'vlam',n:'Vlammenwerper',role:'Kort · vuurkegel',d:'Vuurstraal die alles in een kegel voor je raakt.',hp:140,spd:4.6,range:2.8,dmg:6,rate:6,k:'flame'}];

// Het harnas dat je in minigames wint, in deze volgorde. Wat elk stuk doet, rekent applyArmour in game.js uit; de tekst hier is wat je ziet.
ERME.ARMOUR=[{n:'Helm van de kampioen',d:'Turrets doen 10% meer schade.'},{n:'Borstplaat',d:'+5 levens en je held krijgt 40% meer levenspunten.'},
 {n:'Handschoenen',d:'Je held doet 30% meer schade en turrets vuren 8% sneller.'},{n:'Laarzen',d:'Je held loopt 20% sneller en kills leveren 10% meer credits op.'}];
})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
