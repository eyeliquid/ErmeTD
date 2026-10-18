// Achtergrondmuziek voor tijdens een potje. Alles wordt in de browser opgebouwd met Web Audio, er zijn geen audiobestanden.
// Eén rustige track ("Kazerne") van acht maten. Het tempo gaat elke 20 levels een stapje omhoog.
// In een minigame speelt dezelfde track sneller en met een vollere bezetting.
const Music=(()=>{
const BASE=84,      // tempo in BPM op level 1 tot en met 20
      PER_TIER=6,   // erbij per 20 levels: 84, 90, 96, 102, 108
      MINI_MUL=1.25,// minigames: tempo van dat moment maal dit getal
      VOL=.45;
const KEY='ratd-music';
let on=true;try{on=localStorage.getItem(KEY)!=='0';}catch{}
let ctx=null,master,out,wet,noiseBuf,timer=null,step=0,nextT=0,want=null,mini=false,bpm=BASE;

const hz=m=>440*Math.pow(2,(m-69)/12);
const tierOf=l=>Math.max(0,Math.min(4,Math.floor(((+l||1)-1)/20)));
const tempo=(l,m,st)=>(BASE+((STYLES[st]||STYLES.alarm).bpm||0)+PER_TIER*tierOf(l))*(m?MINI_MUL:1);

function init(){
  if(ctx)return true;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  ctx=new AC();
  master=ctx.createGain();master.gain.value=VOL;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;
  master.connect(comp);comp.connect(ctx.destination);
  out=ctx.createGain();out.gain.value=0;out.connect(master);
  // galm: een zelfgemaakte uitstervende ruis als impulsrespons
  const L=Math.floor(ctx.sampleRate*2.2),imp=ctx.createBuffer(2,L,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=imp.getChannelData(c);for(let i=0;i<L;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/L,3);}
  const conv=ctx.createConvolver(),wg=ctx.createGain();conv.buffer=imp;wg.gain.value=.4;
  wet=ctx.createGain();wet.connect(out);wet.connect(conv);conv.connect(wg);wg.connect(out);
  const n=ctx.sampleRate;noiseBuf=ctx.createBuffer(1,n,n);
  const nd=noiseBuf.getChannelData(0);for(let i=0;i<n;i++)nd[i]=Math.random()*2-1;
  return true;
}
// Browsers laten pas geluid toe na een klik of toets. Een potje kan ook via het netwerk starten, dus hier nog eens proberen.
function unlock(){if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});}
addEventListener('pointerdown',unlock,true);addEventListener('keydown',unlock,true);

function env(a,t,d,g,o){
  const at=o.a||.005,r=o.r||.06;
  a.gain.setValueAtTime(.0001,t);a.gain.linearRampToValueAtTime(g,t+at);
  if(o.pluck){const e=t+Math.max(d,at+.02);a.gain.exponentialRampToValueAtTime(.0001,e);return e+.02;}
  const h=t+Math.max(d,at+.01);a.gain.setValueAtTime(g,h);a.gain.linearRampToValueAtTime(0,h+r);return h+r+.02;
}
function tone(dest,type,f,t,d,g,o={}){
  const os=ctx.createOscillator(),a=ctx.createGain();os.type=type;os.frequency.setValueAtTime(f,t);
  if(o.det)os.detune.value=o.det;
  if(o.slide)os.frequency.exponentialRampToValueAtTime(o.slide,t+(o.st||d));
  let node=os;
  if(o.cut){const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.Q.value=o.q||1;fl.frequency.value=o.cut;os.connect(fl);node=fl;}
  node.connect(a);a.connect(dest);os.start(t);os.stop(env(a,t,d,g,o));
}
function noise(dest,t,d,g,type,f,q){
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),a=ctx.createGain();
  s.buffer=noiseBuf;s.loop=true;fl.type=type;fl.frequency.value=f;fl.Q.value=q||1;
  s.connect(fl);fl.connect(a);a.connect(dest);s.start(t,Math.random()*.9);s.stop(env(a,t,d,g,{pluck:1,a:.002}));
}
const kick=(t,g)=>tone(out,'sine',115,t,.3,g,{slide:42,st:.12,pluck:1,a:.002});
const hat=(t,g)=>noise(out,t,.04,g,'highpass',7500);
const rim=(t,g)=>noise(wet,t,.05,g,'bandpass',2600,5);
const snare=(t,g)=>{noise(wet,t,.15,g,'bandpass',1900,.7);tone(wet,'triangle',200,t,.08,g*.6,{pluck:1,slide:140});};
const keys=(ch,t,g)=>ch.forEach(m=>{tone(wet,'triangle',hz(m+12),t,1.1,g,{pluck:1,a:.006});tone(wet,'sine',hz(m+12),t,1.4,g*.9,{pluck:1});});

// Muziekstijlen: elk thema (data/themes.js, veld music) kiest er een. Alles wat een stijl weglaat, komt uit alarm.
//  tr    transponeren in halve tonen          bpm   tempo erbij of eraf
//  CH    vier akkoorden (MIDI-noten)          MEL   per akkoord drie melodienoten
//  lead  golfvorm van de melodie              en lagen die je aan of uit zet:
//  drive kick op elke tel en een stuwende bas (racen)     bells  hoge klokjes, geen hi-hat (winter)
//  arp   een snel arpeggio (sci-fi)                        lute   getokkelde akkoorden en een bourdon (ridders)
const STYLES={
 alarm:{tr:0,bpm:0,lead:'sine',CH:[[52,55,59,62],[48,52,55,59],[55,59,62,66],[50,54,57,60]],MEL:[[71,74,76],[76,74,71],[74,71,67],[69,66,69]]}, // Em7, Cmaj7, Gmaj7, D7
 racing:{tr:2,bpm:22,lead:'square',drive:true,CH:[[52,56,59,63],[57,61,64,68],[59,63,66,69],[49,52,56,59]],MEL:[[71,75,76],[73,76,80],[78,75,71],[73,71,68]]}, // Emaj7, Amaj7, B7, C#m7
 winter:{tr:-3,bpm:-14,lead:'triangle',bells:true,CH:[[57,60,64,67],[53,57,60,64],[48,52,55,59],[52,55,59,62]],MEL:[[76,72,69],[72,69,65],[71,67,64],[71,74,76]]}, // Am7, Fmaj7, Cmaj7, Em7
 scifi:{tr:-5,bpm:6,lead:'sawtooth',arp:true,CH:[[57,60,64,67],[53,57,60,64],[50,53,57,60],[52,56,59,62]],MEL:[[76,79,81],[77,76,72],[74,77,76],[71,68,71]]}, // Am7, Fmaj7, Dm7, E7
 knights:{tr:-2,bpm:-8,lead:'triangle',lute:true,CH:[[50,53,57,62],[48,52,55,60],[46,50,53,58],[48,52,55,60]],MEL:[[74,72,69],[72,71,67],[70,69,65],[67,69,72]]}, // Dm, C, Bb, C (dorisch)
 desert:{tr:-1,bpm:-4,lead:'sawtooth',arp:true,CH:[[52,56,59,64],[53,56,60,65],[52,56,59,64],[50,53,57,62]],MEL:[[76,77,80],[77,76,73],[71,72,76],[74,72,71]]}, // E, F, E, Dm (frygisch dominant)
 pirates:{tr:0,bpm:14,lead:'square',lute:true,drive:true,CH:[[50,53,57,62],[48,52,55,60],[46,50,53,58],[45,49,52,57]],MEL:[[74,76,77],[76,74,72],[70,72,74],[73,72,69]]}, // Dm, C, Bb, A7 (een shanty)
 steam:{tr:3,bpm:2,lead:'triangle',bells:true,arp:true,CH:[[48,52,55,60],[43,47,50,55],[45,48,52,57],[41,45,48,53]],MEL:[[72,76,79],[74,71,67],[72,69,76],[77,76,72]]} // C, G, Am, F
};
let S=STYLES.alarm;
const has=(a,s)=>a.indexOf(s)>-1;

// Eén zestiende noot. s = stap in de maat (0-15), bar = maat (0-7), sp = duur van een zestiende in seconden.
function play(s,bar,t,sp){
  const ch=S.CH[bar%4].map(m=>m+S.tr),mel=S.MEL[bar%4].map(m=>m+S.tr),k=[2,8,11].indexOf(s);
  if(!mini){
    if(S.lute){if(has([0,3,6,8,10,13],s))tone(wet,'triangle',hz(ch[[0,2,1,3,2,1][[0,3,6,8,10,13].indexOf(s)]]+12),t,.6,.05,{pluck:1,a:.003});
      if(s===0)[ch[0]-12,ch[0]-5].forEach(m=>tone(wet,'sawtooth',hz(m),t,sp*16,.012,{cut:700,a:.3,r:.5}));}
    else if(has([0,6,10],s))keys(ch,t,.045);
    if(S.drive){if(s%2===0)tone(out,'sawtooth',hz(ch[0]-12+(s%8===6?7:0)),t,sp*1.6,.16,{cut:900,q:2,pluck:1});}
    else if(has([0,6,8,14],s))tone(out,'sine',hz(ch[0]-12),t,sp*2.5,.3,{a:.01,r:.1});
    if(S.drive?s%4===0:(s===0||s===10))kick(t,S.drive?.6:.5);
    if(s===4||s===12)rim(t,S.bells?.1:.18);
    if(!S.bells&&s%2===0)hat(t,S.drive?.06:.04);
    if(S.bells&&has([0,7,10],s))tone(wet,'sine',hz(ch[[0,7,10].indexOf(s)+1]+24),t,1.6,.035,{pluck:1,a:.004});
    if(S.arp)tone(wet,'triangle',hz(ch[[0,1,2,3,2,1][s%6]]+24),t,sp*1.1,.022,{pluck:1,a:.003,cut:2400});
    if(bar>=4&&k>-1)tone(wet,S.lead||'sine',hz(mel[k]+12),t,.9,S.lead&&S.lead!=='sine'?.035:.07,{pluck:1,a:.01,cut:S.lead==='sine'?0:2200});
    return;
  }
  // minigame: rechte kick, echte snare, doorlopende bas, arpeggio en de melodie in elke maat
  if(has([0,3,6,10,13],s))keys(ch,t,.04);
  if(s%2===0)tone(out,'sawtooth',hz(ch[0]-(s%4===2?0:12)),t,sp*1.7,.2,{cut:650,q:3,pluck:1});
  if(s%4===0||s===14)kick(t,.75);
  if(s===4||s===12)snare(t,.3);
  hat(t,s%4===2?.1:.035);
  tone(wet,'triangle',hz(ch[[0,1,2,3,2,1,3,2][s%8]]+24),t,sp*1.3,.03,{pluck:1,a:.004});
  if(s===0)ch.slice(0,3).forEach(m=>{tone(wet,'sawtooth',hz(m),t,sp*16,.018,{det:-8,cut:1200,a:.2,r:.4});tone(wet,'sawtooth',hz(m),t,sp*16,.018,{det:8,cut:1200,a:.2,r:.4});});
  if(k>-1)[-6,6].forEach(dt=>tone(wet,'sawtooth',hz(mel[k]+12),t,sp*2.5,.035,{det:dt,cut:2600,a:.01,r:.1}));
}

function tick(){
  if(!want||ctx.state!=='running'){nextT=0;return;}
  const now=ctx.currentTime;
  if(nextT<now)nextT=now+.08;
  // Een tabblad op de achtergrond krijgt maar eens per seconde een tik, dus dan verder vooruit plannen.
  const ahead=document.hidden?1.6:.3;
  while(nextT<now+ahead){
    const s=step%16;
    if(s%4===0){                       // wisselen gebeurt op de tel, zodat het niet midden in een noot verspringt
      const m=!!want.mini;
      if(m&&!mini)noise(wet,nextT,1.2,.1,'highpass',5000);   // bekkenslag bij het begin van een minigame
      mini=m;S=STYLES[want.style]||STYLES.alarm;bpm=tempo(want.level,m,want.style);
    }
    const sp=60/bpm/4;
    play(s,Math.floor(step/16)%8,nextT,sp);
    step++;nextT+=sp;
  }
}
function fade(to,sec){const g=out.gain,n=ctx.currentTime;g.cancelScheduledValues(n);g.setValueAtTime(g.value,n);g.linearRampToValueAtTime(to,n+sec);}
function start(){
  if(!init())return;
  unlock();step=0;nextT=0;mini=!!want.mini;S=STYLES[want.style]||STYLES.alarm;bpm=tempo(want.level,mini,want.style);
  fade(1,.8);timer=setInterval(tick,50);tick();
}
function stop(){clearInterval(timer);timer=null;if(ctx)fade(0,.6);}

// Elke frame aangeroepen door het spel. s = null (stil) of {level, mini, style}.
function sync(s){
  want=on&&s?s:null;
  if(want&&!timer)start();else if(!want&&timer)stop();
}
function setOn(v){on=!!v;try{localStorage.setItem(KEY,on?'1':'0');}catch{}if(!on)sync(null);return on;}

return{sync,setOn,isOn:()=>on,tempo,STYLES,
  state:()=>({on,playing:!!timer,bpm,mini,audio:ctx?ctx.state:'none'})};
})();
if(typeof module!=='undefined')module.exports=Music;
