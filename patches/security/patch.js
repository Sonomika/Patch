/* SECURITY (patch id: olympus) — Mars, 3029. Four screens stand on a crater rim. Something approaches.
   They power on, open their eyes, stare at the visitor and start to talk. The talking screen
   becomes a mouth; the others watch it. They throw data packets across the seams, become one face,
   one giant eye, ripple a phrase round the wall, corrupt each other, catch Earth radio, and sleep. */
const olUnits=[
  {id:'phobos', title:'Phobos', pitch:66, formant:.86,pan:-.62,hue:'#ffb347',ring:0, wave:'sawtooth',pupil:'round'},
  {id:'deimos', title:'Deimos', pitch:124,formant:1.1,pan:.62, hue:'#ff4f2e',ring:38,wave:'square',  pupil:'bar'},
  {id:'tharsis',title:'Tharsis',pitch:46, formant:.72,pan:-.34,hue:'#7fe9ff',ring:0, wave:'sawtooth',pupil:'triple'},
  {id:'hellas', title:'Hellas', pitch:176,formant:1.26,pan:.34,hue:'#b4ff6a',ring:61,wave:'square',  pupil:'slit'}
];
// grid order: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right
const olClockwise=[0,1,3,2]; // round the wall
const olSnake=[0,1,3,2];     // the path a beam takes: along the top row, down, back along the bottom
const olSections=[
  {name:'Wake',       bars:4,mode:'wake',     energy:.35,desc:'The screens power on, open their eyes, and a human is injected.'},
  {name:'First words',bars:5,mode:'talk',     energy:.55,desc:'They take turns. Whoever speaks becomes a mouth.'},
  {name:'Handshake',  bars:4,mode:'handshake',energy:.45,desc:'Packets fly between the screens, faster and faster. A beam scans the wall.'},
  {name:'Crosstalk',  bars:5,mode:'cross',    energy:.9, desc:'Everyone speaks at once. Feedback squeals, data tears.'},
  {name:'Face',       bars:5,mode:'face',     energy:.7, desc:'The wall becomes one face. Then it flips.'},
  {name:'Sync',       bars:2,mode:'sync',     energy:1,  desc:'The four eyes merge into one and speak in unison.'},
  {name:'Stagger',    bars:5,mode:'canon',    energy:.85,desc:'One phrase is passed clockwise, mouth to mouth.'},
  {name:'Corruption', bars:2,mode:'corrupt',  energy:.95,desc:'Identities leak between screens. Signal integrity collapses.'},
  {name:'Intercept',  bars:4,mode:'radio',    energy:.6, desc:'Intercepted radio. A numbers station from Earth.'},
  {name:'Shutdown',   bars:4,mode:'close',    energy:.2, desc:'The eyes close one by one.'}
];
const olMouthModes=['talk','cross','canon','corrupt','radio','close'];
const olHexLevels={handshake:.22,cross:.3,corrupt:.75,radio:.45,face:.08};
const OL={units:null,views:null,outputs:[],air:null,events:[],nextSpeech:null,clocks:[0,0,0,0],
  last:-1,speaker:-1,stage:-1,mode:'dormant',giant:0,giantTarget:0,face:0,faceTarget:0,faceRow:1,
  wave:0,waveTarget:0,beam:null,packets:[],tickers:[],hearts:[],human:null,humanAmt:0,humanTarget:0,ghostUntil:-9,holder:0,corruptBase:0,swap:0,freeze:false,
  hud:'',reversed:null,frame:0,lastFrame:0};

const OL_JP_FONT='"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Kosugi Maru","Yu Gothic UI","Yu Gothic",Meiryo,"Noto Sans CJK JP","Noto Sans JP",ui-monospace,sans-serif';
const olGlyphSet='▖▗▘▙▚▛▜▝▞▟░▒▓◢◣◤◥⌁⌇⏃⏚⍜⟟⊑⋔⟒⏁⎍⋏⌖⍾⎓⏄⏆ΔΞΣΨ01234567893029';
const olWords=()=>Array.from({length:16},()=>Math.floor(Math.random()*256));
const olGlyphs=words=>words.map(w=>olGlyphSet[w%olGlyphSet.length]).join('');
const olLerp=(a,b,k)=>a+(b-a)*k;
const olPos=i=>[(i%2)*2-1,(i>>1)*2-1];
function olRgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a))})`;}
function olUnitState(){
  return olUnits.map(()=>({power:0,powerTarget:0,lid:0,lidTarget:0,blinkAt:-9,blinkDur:.16,speakAt:-9,speakUntil:-9,
    glitchUntil:-9,flash:0,border:0,intrude:null,corrupt:0,mouth:0,mouthTarget:0,gx:0,gy:0,gtx:0,gty:0,jx:0,jy:0,
    nextBlink:0,nextSaccade:0,level:0,words:olWords(),text:''}));
}
OL.units=olUnitState();

/* ---------- visual event queue (audio-clock time) ---------- */
function olAt(at,fn){OL.events.push({at,fn});}
function olLook(i,k){ // unit i looks at unit k (null = the visitor, in front of the wall)
  const u=OL.units[i];
  if(k==null||k===i){u.gtx=(Math.random()-.5)*.3;u.gty=.1+Math.random()*.2;return;}
  const [ax,ay]=olPos(i),[bx,by]=olPos(k),dx=bx-ax,dy=by-ay,m=Math.hypot(dx,dy)||1;
  u.gtx=dx/m*.95;u.gty=dy/m*.95;
}
function olSpeaking(i,at,until,words,mouthOk=true,text){
  const mouth=mouthOk&&olMouthModes.includes(OL.mode); // the talking screen turns into a mouth
  olAt(at,()=>{
    const u=OL.units[i];
    u.speakAt=at;u.speakUntil=until;u.words=words;u.text=text??olGlyphs(words);
    if(mouth)u.mouthTarget=1;
    OL.speaker=i;
  });
  if(mouth)olAt(until+.12,()=>{const u=OL.units[i];if(u.speakUntil<=until+.01&&OL.mode!=='face')u.mouthTarget=0;});
}
function olGlitch(i,at,dur){olAt(at,()=>{const u=OL.units[i];u.glitchUntil=at+dur;u.corrupt=Math.min(1,u.corrupt+.5);});}
function olBlink(i,at,dur=.16){olAt(at,()=>{const u=OL.units[i];u.blinkAt=at;u.blinkDur=dur;});}
function olPunch(i,at){olAt(at,()=>{OL.units[i].punch=1;OL.units[i].border=1;});}
function olRotate(at){ // every character hops one screen clockwise, with a whoosh and a thump
  olAt(at,()=>{OL.rot=((OL.rot||0)+1)%4;OL.rotAt=at;});
  olUnits.forEach((u,i)=>{
    if(MUTE[u.id])return;
    const dest=olOutputs()[i].input;
    olBurst(dest,at,.28,500,1.4,.14,'bandpass',3600);
  });
  if(!MUTE.air){const o=ctx.createOscillator(),g=ctx.createGain(),d=olAir().dest;
    o.frequency.setValueAtTime(90,at);o.frequency.exponentialRampToValueAtTime(40,at+.2);
    g.gain.setValueAtTime(.5,at);g.gain.exponentialRampToValueAtTime(.001,at+.25);
    o.connect(g);g.connect(d);o.start(at);o.stop(at+.3);o.onended=()=>{o.disconnect();g.disconnect();};}
}
// Who is on screen i: normally its own character; rotated round the wall in Stagger; scrambled in Corruption.
function olIdentity(i){
  if(OL.rot)return olClockwise[(olClockwise.indexOf(i)-OL.rot+4)%4];
  return (i+OL.swap)%4;
}
function olFlash(i,at,amount=1){olAt(at,()=>{OL.units[i].border=Math.max(OL.units[i].border,amount);});}
function olPacket(from,to,at,until){ // a packet of data visibly crosses the seams; every eye follows it
  olAt(at,()=>{
    OL.packets.push({from,to,at,until,words:olWords()});
    OL.units.forEach((_,k)=>{if(k!==from)olLook(k,to);});
  });
  olAt(until,()=>{OL.units[to].border=1;OL.units[to].corrupt=Math.min(1,OL.units[to].corrupt+.25);});
  olBlink(to,until,.1);
}

// A line of text that scrolls right to left across a row of two screens.
function olTicker(text,at,row,dur=4){olAt(at,()=>OL.tickers.push({text,at,row,dur}));}
// Hearts rise from the bottom of the wall through all four screens. Positions are in screen units (0..2).
function olHearts(at,count,spread=2){
  for(let n=0;n<count;n++){
    const t=at+Math.random()*spread;
    olAt(t,()=>OL.hearts.push({at:t,x:.1+Math.random()*1.8,y:2.05+Math.random()*.2,vy:.32+Math.random()*.22,
      s:.07+Math.random()*.08,sw:1.5+Math.random()*2,ph:Math.random()*6,life:4+Math.random()*2}));
  }
}
function olHumanChirp(i,at){olSpeak(i,at,{syllables:2,style:'whine',syl:.14,gap:.04,energy:.4,gain:.75,stab:0});} // "hu-man?"

// Memory leaks: for a moment a screen shows something else: real photos of everyday things on Earth.
// Each photo is shown at most once per play-through; after that the glitches are only static and test cards.
// Any photo saved in patches/security/images/leaks/ under one of these names joins in; missing ones are skipped.
const olLeakPhotos=['leaks/cat.jpg','leaks/coffee.jpg','leaks/clock.jpg','leaks/camera.jpg','leaks/rocket.jpg',
  'leaks/raccoon.jpg','leaks/stairs.jpg','leaks/brick.jpg','leaks/grass.jpg',
  'leaks/dog.jpg','leaks/bird.jpg','leaks/fish.jpg','leaks/horse.jpg','leaks/owl.jpg','leaks/spaghetti.jpg','leaks/person.jpg'];
const olPhotos={};
function olPhoto(name){
  if(!olPhotos[name]){const im=new Image();im.src=assetURL('patches/security/images/'+name);olPhotos[name]=im;}
  return olPhotos[name];
}
function olLoadPhotos(){olLeakPhotos.forEach(olPhoto);}
function olShuffleDeck(){ // a fresh, shuffled deck of everything that can be shown once
  const d=[...olLeakPhotos,'earth'];
  for(let k=d.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[d[k],d[j]]=[d[j],d[k]];}
  OL.deck=d;
}
function olNextKind(){
  while(OL.deck?.length){
    const k=OL.deck.shift();
    if(k==='earth'||(olPhotos[k]?.complete&&olPhotos[k].naturalWidth>0))return k;
  }
  return Math.random()<.5?'bars':'static';
}
function olFlashImage(i,at,dur,loud){ // i = -1: one image across the whole wall
  if(!loud){if((OL.earlyShown||0)>=3)return;OL.earlyShown=(OL.earlyShown||0)+1;} // only a few slip in before the Corruption scene
  const kind=olNextKind(),seed=Math.random(),wall=i<0;
  const who=wall?[0,1,2,3]:[i];
  olAt(at,()=>who.forEach(k=>{const u=OL.units[k];u.intrude={kind,until:at+dur,wall,seed,invert:Math.random()<.25};u.glitchUntil=Math.max(u.glitchUntil,at+.06);}));
  who.forEach(k=>{
    if(MUTE[olUnits[k].id])return;
    if(loud){olData(k,at,Math.min(dur,.15),.03);if(k===who[0])olStab(k,at,Math.min(dur*.6,.12),.3);}
    else olBurst(olOutputs()[k].input,at,.025,3500,.8,.12,'highpass');
  });
}

/* ---------- audio ---------- */
let olNoiseBuf=null;
function olNoise(){
  if(!olNoiseBuf){
    const n=ctx.sampleRate*2;olNoiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);
    const d=olNoiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  }
  return olNoiseBuf;
}
function olOutputs(){
  if(OL.outputs.length)return OL.outputs;
  OL.outputs=olUnits.map(({id,pan})=>{
    const input=ctx.createGain(),panner=ctx.createStereoPanner(),scope=ctx.createAnalyser(),gate=ctx.createGain();
    const delay=ctx.createDelay(.1),feedback=ctx.createGain(),tone=ctx.createBiquadFilter(),shaper=ctx.createWaveShaper(),wet=ctx.createGain();
    const soften=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor(),grit=ctx.createWaveShaper(),gritGain=ctx.createGain();
    // a wavefold path that is silent until olStab snaps it open for an instant
    grit.curve=Float32Array.from({length:2049},(_,i)=>{const x=(i/1024-1)*3;return Math.tanh(Math.sin(x*Math.PI*1.5)*2.5);});
    gritGain.gain.value=0;
    soften.type='lowpass';soften.frequency.value=4200;soften.Q.value=.5;
    comp.threshold.value=-20;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.15;
    scope.fftSize=512;panner.pan.value=pan;
    shaper.curve=Float32Array.from({length:1025},(_,i)=>Math.tanh((i/512-1)*2.2));
    tone.type='bandpass';tone.Q.value=3;tone.frequency.value=900;
    delay.delayTime.value=.012;feedback.gain.value=0;wet.gain.value=0;
    // dry voice, plus a short comb loop that rings and screams when its feedback is pushed
    input.connect(gate);input.connect(delay);delay.connect(tone);tone.connect(shaper);
    shaper.connect(feedback);feedback.connect(delay);shaper.connect(wet);wet.connect(gate);
    gate.connect(soften);soften.connect(comp);comp.connect(panner);
    input.connect(grit);grit.connect(gritGain);gritGain.connect(panner);panner.connect(scope);scope.connect(chan(id));
    return {input,gate,scope,delay,feedback,tone,wet,gritGain,
      nodes:[input,panner,scope,delay,feedback,tone,shaper,wet,gate,soften,comp,grit,gritGain],
      wave:new Float32Array(scope.fftSize),spectrum:new Uint8Array(scope.frequencyBinCount)};
  });
  return OL.outputs;
}
const OL_MARS=.25; // level of the Mars background: wind, hiss, rumble, hum
function olBurst(dest,at,dur,freq,q,level,type='bandpass',sweepTo){
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=olNoise();f.type=type;f.Q.value=q;
  f.frequency.setValueAtTime(freq,at);if(sweepTo)f.frequency.exponentialRampToValueAtTime(sweepTo,at+dur);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+Math.min(.004,dur*.2));
  g.gain.exponentialRampToValueAtTime(.0001,at+dur);
  s.connect(f);f.connect(g);g.connect(dest);
  s.start(at,Math.random()*1.5);s.stop(at+dur+.02);
  s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
}
const olFormants=[[730,1090,2440],[530,1840,2480],[270,2290,3010],[570,840,2410],[300,870,2240],[660,1700,2400]];
function olVowel(dest,at,dur,{pitch,glide,vowel,formant,level,crush,ring,wave}){
  const o=ctx.createOscillator(),sh=ctx.createWaveShaper(),env=ctx.createGain(),nodes=[o,sh,env];
  o.type=wave||'sawtooth';
  o.frequency.setValueAtTime(pitch,at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20,pitch*glide),at+dur);
  sh.curve=crushCurve(crush);o.connect(sh);
  let out=env;
  if(ring){ // ring modulation: the voice times a low sine, a metallic robot throat
    const rm=ctx.createGain(),lfo=ctx.createOscillator();
    rm.gain.value=0;lfo.frequency.value=ring;lfo.connect(rm.gain);env.connect(rm);out=rm;
    lfo.start(at);lfo.stop(at+dur+.02);nodes.push(rm,lfo);
  }
  olFormants[vowel].forEach((fr,k)=>{
    const f=ctx.createBiquadFilter(),target=fr*formant;
    f.type='bandpass';f.Q.value=4+k*2;
    f.frequency.setValueAtTime(target*.72,at);f.frequency.exponentialRampToValueAtTime(target,at+dur*.4);
    sh.connect(f);f.connect(env);nodes.push(f);
  });
  env.gain.setValueAtTime(0,at);
  env.gain.linearRampToValueAtTime(level,at+Math.min(.01,dur*.25));
  env.gain.setValueAtTime(level,at+dur*.7);
  env.gain.linearRampToValueAtTime(0,at+dur);
  out.connect(dest);
  o.start(at);o.stop(at+dur+.02);
  o.onended=()=>nodes.forEach(n=>n.disconnect());
}
// A very short burst of hard distortion and comb scream, with the screen tearing on the same frame.
function olStab(i,at,dur=.05+Math.random()*.12,amount=.35){
  olGlitch(i,at,dur+.06);
  if(MUTE[olUnits[i].id])return;
  const out=olOutputs()[i],g=out.gritGain.gain;
  g.setValueAtTime(0,at);g.linearRampToValueAtTime(amount,at+.004);
  g.setValueAtTime(amount,at+dur);g.linearRampToValueAtTime(0,at+dur+.012);
  out.feedback.gain.setValueAtTime(.86,at);out.feedback.gain.setTargetAtTime(.15,at+dur,.015);
}
// Garbled speech. Returns the time the phrase ends. Visuals follow even when the unit is muted.
function olSpeak(i,at,o={}){
  const u=olUnits[i],silent=MUTE[u.id],out=silent?null:olOutputs()[i],dest=out?.input;
  const e=o.energy??.6,words=o.words||olWords(),n=o.syllables??3+Math.floor(Math.random()*4);
  const style=o.style||'speak',pitchMul=o.pitchMul??1;
  let t=at;
  for(let k=0;k<n;k++){
    const w=words[k%16],w2=words[(k+5)%16];
    const dur=Math.max(.05,o.syl??.08+w/255*.16);
    const reps=style==='stutter'&&w2>100?2+(w2%4):1;
    const vowel=(w+k)%6;
    const pitch=u.pitch*pitchMul*(1+(w2-128)/600)*(style==='shout'?1.6:1);
    for(let r=0;r<reps;r++){
      const d=reps>1?Math.max(.04,dur*.45):dur,cons=Math.min(.035,d*.3);
      if(!silent){
        if(w%3)olBurst(dest,t,cons+.012,1800+w2*14,2+w%5,.07*e+.03);
        if(style==='whisper')olBurst(dest,t,d,700+w*9,1.6,.1*(o.gain??1));
        else olVowel(dest,t+cons,d-cons,{pitch,
          glide:style==='whine'?2.3:style==='sing'?1.1:.68+w2/300,vowel,formant:u.formant,
          level:.27*(.55+e*.6)*(o.gain??1),crush:style==='shout'?6:w2>180?8:14,
          ring:u.ring&&(w%2||style==='sync')?u.ring*(1+w2/255):0,wave:u.wave});
      }
      t+=d+(reps>1?.012:o.gap??(.02+w2/255*.05));
    }
  }
  if(out){ // the comb loop rings under the phrase, then lets go
    out.delay.delayTime.setTargetAtTime(.004+words[3]/255*.03,at,.01);
    out.tone.frequency.setTargetAtTime(u.pitch*6+words[4]*12,at,.02);
    out.feedback.gain.setTargetAtTime(Math.min(.7,o.feedback??(.12+e*.25)),at,.01);
    out.wet.gain.setTargetAtTime(.15+e*.35,at,.01);
    out.feedback.gain.setTargetAtTime(0,t,.04);out.wet.gain.setTargetAtTime(0,t,.06);
  }
  if(style==='shout')olStab(i,at,.06+Math.random()*.08);
  else if(style!=='whisper'&&Math.random()<(o.stab??.22))olStab(i,at+Math.random()*(t-at)*.8);
  olSpeaking(i,at,t,words,o.mouth!==false);
  return t;
}
// The one word they all know. A sawtooth throat through three formant filters that glide
// h → yu → m → a → n, with the stress on HU. A question ends rising.
const olHumanShape=[ // time (fraction of the word), F1, F2, F3, loudness
  [0,   500,1500,2500,0], [.1, 320,2100,2700,.35], [.22,300,1500,2400,1], [.4, 310,900,2300,.9],
  [.46, 260,1100,2300,.3],[.55,260,1150,2350,.32], [.62,680,1650,2450,1], [.82,640,1600,2450,.85],
  [.9,  280,1700,2600,.3],[1,  280,1700,2600,0]];
// c (optional) corrupts the word: {crush, reverse, flip, dive, ring, chop}
function olSayHuman(i,at,{dur=.5,pitchMul=1,gain=1,ask=false,mouth=true,c={}}={}){
  const u=olUnits[i],until=at+dur;
  if(!MUTE[u.id]){
    const out=olOutputs()[i],dest=out.input,o=ctx.createOscillator(),sh=ctx.createWaveShaper(),env=ctx.createGain();
    const p=u.pitch*pitchMul,L=.5*gain,m=Math.sqrt(u.formant);
    o.type='sawtooth';sh.curve=crushCurve(c.crush||16);o.connect(sh);
    o.frequency.setValueAtTime(p*1.06,at);o.frequency.linearRampToValueAtTime(p*1.16,at+dur*.3);
    if(c.flip){o.frequency.setValueAtTime(p*1.16*c.flip,at+dur*.32);}                       // octave flip mid-word
    o.frequency.linearRampToValueAtTime(p*(ask?1:.95)*(c.flip||1),at+dur*.6);
    if(c.dive)o.frequency.exponentialRampToValueAtTime(p*.18,until);                         // tape stop
    else o.frequency.linearRampToValueAtTime(p*(ask?1.5:.76)*(c.flip||1),until);
    const fs=[5,9,11].map(q=>{const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=q;sh.connect(f);f.connect(env);return f;});
    const shape=c.reverse?[...olHumanShape].reverse().map(([x,...r])=>[1-x,...r]):olHumanShape; // backwards: nam-uh
    shape.forEach(([x,f1,f2,f3,lv],n)=>{
      const tt=at+x*dur;
      [f1,f2,f3].forEach((fr,k)=>n?fs[k].frequency.linearRampToValueAtTime(fr*m,tt):fs[k].frequency.setValueAtTime(fr*m,tt));
      n?env.gain.linearRampToValueAtTime(lv*L,tt):env.gain.setValueAtTime(0,tt);
    });
    let tail=env;const extra=[];
    if(c.ring){const rm=ctx.createGain(),lfo=ctx.createOscillator();rm.gain.value=0;lfo.frequency.value=c.ring;lfo.connect(rm.gain);
      tail.connect(rm);tail=rm;lfo.start(at);lfo.stop(until+.02);extra.push(rm,lfo);}                   // robot
    if(c.chop){const gt=ctx.createGain();for(let tt=at,on=1;tt<until;tt+=1/c.chop/2,on^=1)gt.gain.setValueAtTime(on,tt);
      tail.connect(gt);tail=gt;extra.push(gt);}                                                         // chopped gate
    tail.connect(dest);
    o.addEventListener('ended',()=>extra.forEach(n=>n.disconnect()));
    olBurst(dest,c.reverse?until-dur*.16:at,dur*.16,1700,1.1,.13*gain); // the breathy h
    out.feedback.gain.setTargetAtTime(.22,at,.01);out.wet.gain.setTargetAtTime(.3,at,.01);
    out.feedback.gain.setTargetAtTime(0,until,.04);out.wet.gain.setTargetAtTime(0,until,.06);
    o.start(at);o.stop(until+.02);
    o.onended=()=>[o,sh,env,...fs].forEach(n=>n.disconnect());
  }
  olSpeaking(i,at,until,olWords(),mouth,OL.mode==='sync'?(ask?'にんげん？':'にんげん♡'):undefined); // the word is only written in Sync
  return until;
}
// The hacker's greeting: a very low "Hi" (h → a → i), spoken through all four screens at once.
function olSayHi(at,dur=1.1){
  const outs=olOutputs().filter((_,i)=>!MUTE[olUnits[i].id]);if(!outs.length)return;
  const bus=ctx.createGain(),o=ctx.createOscillator(),sub=ctx.createOscillator(),sg=ctx.createGain(),sh=ctx.createWaveShaper(),env=ctx.createGain(),lp=ctx.createBiquadFilter();
  const until=at+dur,p=58;
  o.type='sawtooth';sh.curve=crushCurve(24);o.connect(sh);
  o.frequency.setValueAtTime(p*1.08,at);o.frequency.linearRampToValueAtTime(p,at+dur*.5);o.frequency.linearRampToValueAtTime(p*.82,until);
  sub.frequency.setValueAtTime(p/2*1.08,at);sub.frequency.linearRampToValueAtTime(p/2*.82,until);sub.connect(sg);sg.connect(env);
  sg.gain.value=.35;
  // formants glide from a (F1 750, F2 1150) to i (F1 290, F2 2250), a little lower than a normal throat
  const shape=[[0,750,1150,2400],[.42,760,1200,2450],[.85,300,2150,2900],[1,290,2250,3000]];
  const fs=[5,8,10].map(q=>{const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=q;sh.connect(f);f.connect(env);return f;});
  shape.forEach(([x,...F],n)=>F.forEach((fr,k)=>n?fs[k].frequency.linearRampToValueAtTime(fr*.88,at+x*dur):fs[k].frequency.setValueAtTime(fr*.88,at)));
  env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(.9,at+dur*.18);env.gain.setValueAtTime(.9,at+dur*.7);env.gain.linearRampToValueAtTime(0,until);
  lp.type='lowpass';lp.frequency.value=2600;
  env.connect(lp);lp.connect(bus);bus.gain.value=.55/outs.length*2;
  outs.forEach(out=>bus.connect(out.input));
  olBurst(outs[0].input,at-.02,dur*.22,1200,1,.35); // the breathy h
  o.start(at);sub.start(at);o.stop(until+.02);sub.stop(until+.02);
  o.onended=()=>[o,sub,sg,sh,env,lp,bus,...fs].forEach(n=>n.disconnect());
}
// The human voice clips from DIALOGUE, chopped, reversed and pushed through a radio band.
function olClips(){
  loadDialogueHumanClips();
  const b=dialogueHumanClips.buffers;
  if(b&&!OL.reversed)OL.reversed=b.map(buf=>{
    const r=ctx.createBuffer(buf.numberOfChannels,buf.length,buf.sampleRate);
    for(let c=0;c<buf.numberOfChannels;c++){const s=buf.getChannelData(c),d=r.getChannelData(c);for(let j=0;j<s.length;j++)d[j]=s[s.length-1-j];}
    return r;
  });
  return b?{fwd:b,rev:OL.reversed}:null;
}
function olChop(dest,at,dur,{reverse=Math.random()<.5,rate=.65+Math.random()*.85,level=.6,band=1200,clip,offset}={}){
  const c=olClips();if(!c)return false;
  const set=reverse?c.rev:c.fwd,buf=set[clip??Math.floor(Math.random()*set.length)];
  const s=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),bp=ctx.createBiquadFilter(),sh=ctx.createWaveShaper(),g=ctx.createGain();
  s.buffer=buf;s.playbackRate.value=rate;
  hp.type='highpass';hp.frequency.value=380;
  bp.type='peaking';bp.frequency.value=band;bp.gain.value=9;bp.Q.value=1.2;
  sh.curve=crushCurve(10);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+.004);
  g.gain.setValueAtTime(level,at+Math.max(.005,dur-.008));g.gain.linearRampToValueAtTime(0,at+dur);
  s.connect(hp);hp.connect(bp);bp.connect(sh);sh.connect(g);g.connect(dest);
  s.start(at,Math.min(offset??Math.random()*Math.max(0,buf.duration-dur*rate),Math.max(0,buf.duration-.05)));s.stop(at+dur+.02);
  s.onended=()=>[s,hp,bp,sh,g].forEach(n=>n.disconnect());
  return true;
}
function olWhistle(dest,at,dur){ // heterodyne whistle as a receiver drifts through a carrier
  const o=ctx.createOscillator(),g=ctx.createGain(),f0=500+Math.random()*1500;
  o.frequency.setValueAtTime(f0,at);o.frequency.exponentialRampToValueAtTime(f0*(Math.random()<.5?2.4:.45),at+dur);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.045,at+dur*.3);g.gain.linearRampToValueAtTime(0,at+dur);
  o.connect(g);g.connect(dest);o.start(at);o.stop(at+dur+.02);
  o.onended=()=>{o.disconnect();g.disconnect();};
}
function olTransmission(i,at,len){ // squelch → chopped human radio → squelch
  const words=olWords();
  if(MUTE[olUnits[i].id]){olSpeaking(i,at,at+len,words);return at+len;}
  const dest=olOutputs()[i].input;
  olBurst(dest,at,.07,3200,.8,.32,'highpass');
  let t=at+.05;
  while(t<at+len){
    const d=.05+Math.random()*.18;
    olChop(dest,t,d,{level:.4,band:900+Math.random()*1400});
    if(Math.random()<.25)olBurst(dest,t,d*.6,2400,1,.07);
    t+=d*(Math.random()<.3?.6:1);
  }
  olBurst(dest,t,.12,3000,.8,.28,'highpass');
  if(Math.random()<.6)olWhistle(dest,at+Math.random()*len*.5,.5+Math.random()*.6);
  olSpeaking(i,at,t,words);
  return t+.1;
}
function olSqueal(i,at,dur){ // feedback howl with a nervous vibrato
  if(MUTE[olUnits[i].id])return;
  const out=olOutputs()[i],o=ctx.createOscillator(),v=ctx.createOscillator(),vg=ctx.createGain(),g=ctx.createGain();
  const f=1700+Math.random()*2600;
  o.frequency.value=f;v.frequency.value=5+Math.random()*9;vg.gain.value=f*.02;
  v.connect(vg);vg.connect(o.frequency);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.022,at+dur*.6);g.gain.linearRampToValueAtTime(0,at+dur);
  o.connect(g);g.connect(out.input);
  [o,v].forEach(n=>{n.start(at);n.stop(at+dur+.02);});
  o.onended=()=>[o,v,vg,g].forEach(n=>n.disconnect());
}
function olThunk(i,at,down=false){ // relay clunk and tube warm-up as a screen powers on (or off)
  if(MUTE[olUnits[i].id])return;
  const dest=olOutputs()[i].input,o=ctx.createOscillator(),g=ctx.createGain();
  o.frequency.setValueAtTime(down?60:130,at);o.frequency.exponentialRampToValueAtTime(down?24:40,at+.3);
  g.gain.setValueAtTime(.55,at);g.gain.exponentialRampToValueAtTime(.001,at+.4);
  o.connect(g);g.connect(dest);o.start(at);o.stop(at+.45);
  o.onended=()=>{o.disconnect();g.disconnect();};
  olBurst(dest,at,.03,5000,.7,.4,'highpass');
  olBurst(dest,at+.02,down?.5:.9,down?3000:300,3,.08,'bandpass',down?200:4200);
}
function olBlip(i,at,mul=1,dur=.07){ // the coin sound: only for the packet-throwing game in Handshake
  if(MUTE[olUnits[i].id])return;
  const dest=olOutputs()[i].input,o=ctx.createOscillator(),sh=ctx.createWaveShaper(),g=ctx.createGain();
  o.type='square';o.frequency.setValueAtTime(olUnits[i].pitch*8*mul,at);o.frequency.setValueAtTime(olUnits[i].pitch*12*mul,at+dur*.5);
  sh.curve=crushCurve(4);
  g.gain.setValueAtTime(.06,at);g.gain.exponentialRampToValueAtTime(.001,at+dur);
  o.connect(sh);sh.connect(g);g.connect(dest);o.start(at);o.stop(at+dur+.01);
  o.onended=()=>[o,sh,g].forEach(n=>n.disconnect());
}
const olDataTones=[980,1200,1650,2100,2400,3100];
function olCrackle(i,at,dur){ // broken data without pitch: dry ticks of static
  const dest=olOutputs()[i].input;
  for(let t=at;t<at+dur;t+=.015+Math.random()*.035)olBurst(dest,t,.008+Math.random()*.02,2000+Math.random()*6000,.7,.1+Math.random()*.12,'highpass');
}
function olData(i,at,dur,level=.028){ // modem chatter: a burst of stepped square tones
  if(MUTE[olUnits[i].id])return;
  if(OL.mode!=='handshake'){olCrackle(i,at,dur);return;} // the beepy tones belong to the packet game only
  const dest=olOutputs()[i].input,o=ctx.createOscillator(),sh=ctx.createWaveShaper(),g=ctx.createGain();
  o.type='square';sh.curve=crushCurve(3);
  for(let t=at;t<at+dur;t+=.012+Math.random()*.02)o.frequency.setValueAtTime(olDataTones[Math.floor(Math.random()*olDataTones.length)],t);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+.005);g.gain.setValueAtTime(level,at+Math.max(.006,dur-.01));g.gain.linearRampToValueAtTime(0,at+dur);
  o.connect(sh);sh.connect(g);g.connect(dest);o.start(at);o.stop(at+dur+.02);
  o.onended=()=>[o,sh,g].forEach(n=>n.disconnect());
}
function olRepeat(i,at,count){ // buffer-repeat glitch: one shard retriggered, shorter and higher each time
  let t=at,len=.11,rate=.8;
  if(MUTE[olUnits[i].id]){for(let r=0;r<count;r++){t+=len;len=Math.max(.025,len*.82);}return t;}
  const dest=olOutputs()[i].input,clip=Math.floor(Math.random()*4),offset=Math.random()*1.2,reverse=Math.random()<.5;
  for(let r=0;r<count;r++){
    olChop(dest,t,len,{clip,offset,reverse,rate,level:.4,band:1600});
    t+=len;len=Math.max(.025,len*.82);rate*=1.07;
  }
  return t;
}
function olAir(){
  if(OL.air)return OL.air;
  const dest=chan('air'),n=olNoise(),loop=()=>{const s=ctx.createBufferSource();s.buffer=n;s.loop=true;return s;};
  const wind=loop(),wf=ctx.createBiquadFilter(),wg=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();
  wf.type='bandpass';wf.Q.value=.7;wf.frequency.value=380;lfo.frequency.value=.09;lg.gain.value=260;
  lfo.connect(lg);lg.connect(wf.frequency);wg.gain.value=0;wind.connect(wf);wf.connect(wg);wg.connect(dest);
  const hiss=loop(),hf=ctx.createBiquadFilter(),hg=ctx.createGain();
  hf.type='highpass';hf.frequency.value=4500;hg.gain.value=0;hiss.connect(hf);hf.connect(hg);hg.connect(dest);
  const sub=ctx.createOscillator(),sub2=ctx.createOscillator(),sf=ctx.createBiquadFilter(),sg=ctx.createGain();
  sub.frequency.value=31;sub2.type='sawtooth';sub2.frequency.value=46.6;sf.type='lowpass';sf.frequency.value=90;sg.gain.value=0;
  sub.connect(sg);sub2.connect(sf);sf.connect(sg);sg.connect(dest);
  const hum=ctx.createOscillator(),hmf=ctx.createBiquadFilter(),hm=ctx.createGain();
  hum.type='sawtooth';hum.frequency.value=58;hmf.type='lowpass';hmf.frequency.value=380;hm.gain.value=0;
  hum.connect(hmf);hmf.connect(hm);hm.connect(dest);
  const t=ctx.currentTime;
  wind.start(t,Math.random());hiss.start(t,Math.random());[sub,sub2,hum,lfo].forEach(o=>o.start(t));
  return OL.air={dest,wg,hg,sg,hm,sources:[wind,hiss,sub,sub2,hum,lfo],
    nodes:[wind,wf,wg,lfo,lg,hiss,hf,hg,sub,sub2,sf,sg,hum,hmf,hm]};
}
// wind, hiss, sub rumble, mains hum
const olAirLevels={dormant:[.5,.04,0,0],approach:[.42,.06,.55,.02],wake:[.3,.05,.18,.05],talk:[.22,.04,.1,.05],
  handshake:[.18,.05,.2,.07],cross:[.2,.07,.25,.06],face:[.16,.04,.4,.06],sync:[.14,.03,.45,.08],canon:[.2,.05,.3,.07],
  corrupt:[.12,.16,.5,.12],radio:[.25,.09,.12,.05],close:[.4,.12,.25,.06]};
function olAirSet(mode,t,progress){
  const a=olAir(),lv=olAirLevels.wake,on=MUTE.air?0:1; // one steady Mars bed, at the level the song starts with
  const sub=mode==='approach'?lv[2]*(.25+progress):lv[2];
  [a.wg,a.hg,a.sg,a.hm].forEach((g,k)=>g.gain.setTargetAtTime((k===2?sub:lv[k])*OL_MARS*on,t,1.1));
}
function olPing(at){ // proximity radar
  if(MUTE.air)return;
  const dest=olAir().dest;
  [0,.19,.38].forEach((d,k)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=1380;g.gain.setValueAtTime(.12/(k+1),at+d);g.gain.exponentialRampToValueAtTime(.0005,at+d+.7);
    o.connect(g);g.connect(dest);o.start(at+d);o.stop(at+d+.75);
    o.onended=()=>{o.disconnect();g.disconnect();};
  });
}

/* ---------- the score ---------- */
function olEnter(stage,t){
  const mode=olSections[stage].mode,awake=!['dormant','approach','wake'].includes(mode);
  OL.nextSpeech=null;OL.clocks=[t,t+.3,t+.7,t+.15];
  olAt(t,()=>{
    OL.giantTarget=mode==='sync'?1:0;
    OL.faceTarget=mode==='face'?1:0;OL.faceRow=1;
    OL.waveTarget=mode==='sync'?.7:0;
    OL.beam=mode==='sync'?{at:t,period:16*sd()}:null;
    OL.corruptBase=mode==='cross'?.1:mode==='radio'?.06:0;
    OL.swap=0;OL.rot=0;OL.freeze=false;OL.hud='';
    OL.units.forEach((u,i)=>{
      u.mouthTarget=mode==='face'&&(i>>1)===1?1:0;
      if(mode==='dormant'){u.powerTarget=0;u.lidTarget=0;}
      if(mode==='approach'){u.lidTarget=0;}
      if(mode==='wake'){u.powerTarget=0;u.lidTarget=0;}
      if(awake||mode==='close'){u.powerTarget=1;u.lidTarget=1;if(u.power<.5)u.power=1;}
    });
  });
}
function olPlay(t,bar,step,section,ui){
  const stage=olSections.indexOf(section),mode=section.mode,lb=bar-SEC_START[stage],ls=lb*16+step,S=sd(),e=section.energy;
  if(stage!==OL.stage){OL.stage=stage;olEnter(stage,t);}
  OL.mode=mode;
  olClips();
  if(step===0||!OL.air)olAirSet(mode,t,lb/section.bars);
  const say=i=>ui.push([olUnits[i].id+'.say'],[olUnits[i].id+'.eye']);
  // memory leaks: rare and quiet before the Corruption scene, then frequent and loud
  if(['talk','handshake','cross','face','sync','canon'].includes(mode)&&Math.random()<.008)
    olFlashImage(Math.floor(Math.random()*4),t,.05+Math.random()*.07,false);
  if(['corrupt','radio','close'].includes(mode)){
    if(Math.random()<.05)olFlashImage(Math.floor(Math.random()*4),t,.1+Math.random()*.25,true);
    if(step===8&&Math.random()<.3)olFlashImage(-1,t,.2+Math.random()*.2,true);
  }

  if(mode==='dormant'){
    if(Math.random()<.06){ // a dead screen stutters with static
      const i=Math.floor(Math.random()*4);
      olAt(t,()=>{OL.units[i].flash=.5+Math.random()*.5;});
      if(!MUTE.air)olBurst(olAir().dest,t,.05+Math.random()*.1,4000,.6,.18,'highpass');
    }
  }

  else if(mode==='approach'){
    if(step===0||step===8){olPing(t);ui.push(['air.ping']);}
    if(step===0){
      const i=olClockwise[lb%4];
      olThunk(i,t);say(i);
      olAt(t,()=>{OL.units[i].powerTarget=1;OL.units[i].power=Math.max(OL.units[i].power,.02);});
      olAt(t,()=>{OL.hud='PROXIMITY '+[312,148,61,9][lb%4]+' M';});
    }
    if(lb===3&&step===2){ // someone is breaking in
      olUnits.forEach((_,i)=>{olData(i,t+i*.05,.5,.035);olGlitch(i,t+i*.05,.5);});
      olStab(1,t+.3,.08,.3);
    }
    if(lb===3&&step===10)olAt(t,()=>{OL.units[0].lidTarget=.16;olLook(0,null);});
    if(lb===3&&step===13)olAt(t,()=>{OL.units[3].lidTarget=.1;olLook(3,null);});
  }

  else if(mode==='wake'){
    if(ls<8&&ls%2===0){ // the tubes clunk on one after another
      const i=olClockwise[ls/2];
      olThunk(i,t);say(i);
      olAt(t,()=>{OL.units[i].powerTarget=1;OL.units[i].power=Math.max(OL.units[i].power,.02);});
    }
    const opens=[10,14,17,20];
    const k=opens.indexOf(ls);
    if(k>=0){
      const i=[0,3,1,2][k];
      olAt(t,()=>{OL.units[i].lidTarget=1;olLook(i,null);});
      olSpeak(i,t+.05,{syllables:2,style:'whine',energy:.4,gain:.8,stab:0});say(i);
    }
    if(ls>=24&&ls%8===0)olClockwise.forEach((i,n)=>olBlink(i,t+n*S,.14)); // ripple blink
    if(ls>=20&&step===4&&Math.random()<.7){ // "eh?"
      const i=Math.floor(Math.random()*4);olSpeak(i,t,{syllables:1+Math.floor(Math.random()*2),style:'whine',energy:.3,gain:.7,stab:0});say(i);
    }
    if(ls===32){ // the hack: the human symbol is injected into all four screens
      olAt(t,()=>{OL.human={at:t,until:t+32*S,mode:'hack'};OL.humanTarget=1;
        OL.units.forEach((u,i)=>{const [x,y]=olPos(i);u.gtx=-x*.55;u.gty=-y*.45;u.corrupt=1;u.border=1;});});
      olUnits.forEach((_,i)=>olStab(i,t+i*.04,.12,.4));
      olSayHi(t+.45); // the human says hello, very low, through all four screens
    }
    if(ls===44){olSayHuman(0,t,{dur:.5,ask:true,gain:.8});olSayHuman(1,t+.3,{dur:.5,ask:true,gain:.8});}
    if(ls===50){olSayHuman(2,t,{dur:.55,ask:true,gain:.8});olSayHuman(3,t+.25,{dur:.45,ask:true,gain:.8});}
  }

  else if(mode==='talk'){
    if(ls===44){ // they decide they love humans
      olHearts(t,26,2.6);
      olAt(t,()=>OL.units.forEach((u,i)=>{u.lidTarget=.55;u.mouthTarget=0;olLook(i,null);}));
      olAt(t+3.2,()=>OL.units.forEach(u=>{u.lidTarget=1;}));
      olUnits.forEach((u,i)=>olSpeak(i,t+i*.06,{syllables:3,style:'sing',syl:.42,gap:.08,energy:.4,gain:.6,stab:0,feedback:.2,mouth:false,
        pitchMul:164.8*[1,1.26,1.5,2][i]/u.pitch}));
      OL.nextSpeech=t+3.4;
    }
    if(ls>=44&&ls<76)return; // quiet while they swoon
    OL.nextSpeech??=t;
    if(OL.nextSpeech<t+S){
      const on=Math.max(t,OL.nextSpeech);
      let i=Math.floor(Math.random()*4);if(i===OL.last)i=(i+1+Math.floor(Math.random()*3))%4;
      OL.last=i;
      olAt(on,()=>{olLook(i,null);OL.units.forEach((_,k)=>{if(k!==i)olLook(k,i);});});
      const end=Math.random()<.18?olTransmission(i,on,.5+Math.random()*.5)
        :olSpeak(i,on,{style:['speak','speak','stutter','sing','shout'][Math.floor(Math.random()*5)],energy:e});
      say(i);
      if(Math.random()<.18){ // someone interrupts
        const j=(i+1+Math.floor(Math.random()*3))%4;
        olSpeak(j,on+(end-on)*.7,{syllables:1,style:'shout',energy:e});
      }
      OL.nextSpeech=end+.1+Math.random()*.3;
    }
  }

  else if(mode==='handshake'){
    if(ls<32){ // first half: a packet is thrown screen to screen, every 8, 4, 2, then 1 step
      const every=8>>Math.floor(ls/8);
      if(ls%every===0){
        const from=OL.holder;let to=Math.floor(Math.random()*3);if(to>=from)to++;
        const until=t+every*S*.85;
        olPacket(from,to,t,until);
        olData(from,t,Math.min(.12,every*S*.5));olBlip(to,until,1+ls/32);
        OL.holder=to;ui.push([olUnits[from].id+'.send'],[olUnits[to].id+'.in']);
      }
      if(ls===28)olUnits.forEach((_,i)=>olData(i,t+i*.03,4*S,.03));
    }else{ // second half: one beam snakes through all four screens; a waveform runs across the whole wall
      if(ls===32)olAt(t,()=>{OL.beam={at:t,period:16*S};OL.waveTarget=1;});
      if(step%4===0){
        const i=olSnake[step/4];
        if(!MUTE[olUnits[i].id])olBurst(olOutputs()[i].input,t,.03,4200,.9,.1,'highpass');olFlash(i,t,1);olBlink(i,t+S,.1); // a soft tick as the beam passes
        olAt(t,()=>OL.units.forEach((_,k)=>olLook(k,i)));
        if(step===0)olSpeak(i,t,{syllables:2,style:'whine',energy:e,gain:.6});
      }
      if(ls===60)olUnits.forEach((_,i)=>olSpeak(i,t,{syllables:3,style:'sync',syl:S*.9,gap:S*.1,energy:e,pitchMul:82.4*[1,1.5,2,3][i]/olUnits[i].pitch,gain:.6}));
    }
  }

  else if(mode==='cross'){
    olUnits.forEach((_,i)=>{
      if(OL.clocks[i]>=t+S)return;
      const on=Math.max(t,OL.clocks[i]),style=['shout','stutter','whine','speak','radio','data'][Math.floor(Math.random()*6)];
      let end;
      if(style==='radio')end=olTransmission(i,on,.3+Math.random()*.6);
      else if(style==='data'){end=olRepeat(i,on,5+Math.floor(Math.random()*7));olStab(i,end-.08,.08);olData(i,end,.15);olGlitch(i,on,end-on);olSpeaking(i,on,end,olWords());}
      else end=olSpeak(i,on,{style,energy:e,syllables:2+Math.floor(Math.random()*5),stab:.45});
      if(Math.random()<.25){olSqueal(i,on,.3+Math.random()*.5);olGlitch(i,on,.35);}
      if(style==='shout')olGlitch(i,on,.15);
      olAt(on,()=>olLook(i,Math.random()<.5?Math.floor(Math.random()*4):null));
      if(Math.random()<.3)olBlink(i,on+Math.random()*.4,.1);
      if(Math.random()<.2){const k=(i+1+Math.floor(Math.random()*3))%4;olPacket(i,k,on,on+.25);}
      say(i);
      OL.clocks[i]=end+Math.random()*.45-.12;
    });
  }

  else if(mode==='face'){
    // two screens are the eyes, two are one big mouth, and all it wants to talk about is humans.
    // At bar 4 the face flips upside down.
    if(lb===3&&step===0){
      olAt(t,()=>{OL.faceRow=0;OL.units.forEach((u,i)=>{u.mouthTarget=(i>>1)===0?1:0;u.mouth=u.mouthTarget;u.corrupt=1;u.glitchUntil=t+.3;});});
      olUnits.forEach((_,i)=>{olRepeat(i,t,6);olSqueal(i,t,.4);olStab(i,t,.2,.4);});
    }
    const mouthRow=lb>=3?0:1,mouths=[mouthRow*2,mouthRow*2+1],eyes=[(1-mouthRow)*2,(1-mouthRow)*2+1];
    const both=(at,o)=>mouths.forEach((i,n)=>{olSayHuman(i,at,{pitchMul:[110,165][n]/olUnits[i].pitch,gain:.9,...o});say(i);});
    if(lb!==3||step>=4){
      if(step===(lb===3?4:0))both(t,{dur:S*5});                       // HU-MAN
      if(step===6&&lb!==3)mouths.forEach((i,n)=>olSpeak(i,t,{words:olWords(),syllables:3,syl:S*.8,gap:S*.2,energy:e,
        pitchMul:[110,165][n]/olUnits[i].pitch,gain:.6,feedback:.3,stab:0}));
      if(step===10)both(t,{dur:S*5,ask:true});                        // HU-MAN?
      if(step===14)eyes.forEach((i,n)=>olSayHuman(i,t+n*.08,{dur:S*2.5,pitchMul:[220,262][n]/olUnits[i].pitch,gain:.35,ask:true,mouth:false}));
    }
    if(step===8)eyes.forEach(i=>olBlink(i,t,.16));
    if(step===2||step===12)olAt(t,()=>{const gx=(Math.random()-.5)*1.6,gy=(Math.random()-.5)*.5;eyes.forEach(i=>{OL.units[i].gtx=gx;OL.units[i].gty=gy;});});
  }

  else if(mode==='sync'){
    // one giant eye, four voices, one word, sung as an A major chord on every beat
    const chord=[110,138.6,164.8,220];
    const corruptions=[{reverse:1},{flip:2},{dive:1},{ring:46},{chop:28,crush:5},{crush:3},{flip:.5,chop:18},{reverse:1,ring:70},{dive:1,crush:4}];
    const pickC=()=>{const a=corruptions[Math.floor(Math.random()*corruptions.length)];return Math.random()<.35?{...a,...corruptions[Math.floor(Math.random()*corruptions.length)]}:a;};
    const chant=(at,o)=>{
      const c=pickC(),stutter=Math.random()<.3&&!o.ask;
      olUnits.forEach((u,i)=>{
        const base={pitchMul:chord[i]/u.pitch,gain:.7,...o,c};
        if(stutter){ // hu-hu-hu-man
          const d=o.dur*.18;for(let r=0;r<3;r++)olSayHuman(i,at+r*d,{...base,dur:d*.9,c:{crush:6},mouth:true});
          olSayHuman(i,at+3*d,{...base,dur:o.dur-3*d});
        }else olSayHuman(i,at,base);
        say(i);
      });
      if(Math.random()<.4)olUnits.forEach((_,i)=>olStab(i,at+o.dur*(.3+Math.random()*.4),.06,.3));
    };
    if(lb<1){
      if(step%4===0)chant(t,{dur:S*3.3,ask:step===12});
    }else{ // last bar: faster and faster, then one long question
      if(step<10&&step%2===0)chant(t,{dur:S*1.7});
      if(step===10)chant(t,{dur:S*5.5,ask:true});
    }
    if(step===0&&lb===0){olTicker('にんげん♡ にんげん♡ にんげん♡',t,0,2.9);olTicker('ニンゲン だいすき (◕‿◕)♡',t+.2,1,2.8);}
    if(step===0)olAt(t,()=>OL.units.forEach((_,i)=>olLook(i,null)));
    if(step===6||step===14)olUnits.forEach((_,i)=>olBlink(i,t,.18));
    if(lb>=1&&step===12)olUnits.forEach((_,i)=>olStab(i,t+S*.5,.1));
    if(step%4===0)olFlash(olSnake[step/4],t,.6);
    if(step===8&&lb>=1)olAt(t,()=>{const g=(Math.random()-.5)*1.6;OL.units.forEach(u=>{u.gtx=g;u.gty=(Math.random()-.5)*.6;});});
  }

  else if(mode==='canon'){
    // a carousel: each bar the four characters hop one screen clockwise (every beat in the last bar).
    // A phrase is handed round after them as a packet, each screen punches in on its turn,
    // and a light chases round the bezels.
    const every=lb===4?4:16;
    if(ls>0&&ls%every===0)olRotate(t);
    if(step%2===0)olFlash(olClockwise[(ls/2)%4],t,.4);
    if(step===0&&lb<4){
      const words=olWords(),gap=[3,2,4,1][lb],chord=[1,1.19,1.5,1.78];
      olClockwise.forEach((i,n)=>{
        const on=t+(n*gap+1)*S;
        if(n)olPacket(olClockwise[n-1],i,on-gap*S*.8,on);
        olSpeak(i,on,{words,syllables:4,syl:S*1.2,gap:S*.4,style:n%2?'stutter':'speak',energy:e,
          pitchMul:82.4*chord[n]/olUnits[i].pitch,gain:.85,stab:0});
        olPunch(i,on);
        olAt(on,()=>olUnits.forEach((_,k)=>{if(k!==i)olLook(k,i);}));
      });
      olClockwise.forEach(say);
    }
    if(lb===4&&step%4===2){const i=olClockwise[(step>>2)%4];olSpeak(i,t,{syllables:2,style:'shout',syl:S*.7,gap:S*.2,energy:e,gain:.8});olPunch(i,t);say(i);}
    if(lb===4&&step===14){olUnits.forEach((_,i)=>{olPunch(i,t);olStab(i,t,.12,.35);});}
  }

  else if(mode==='corrupt'){
    if(step===0){
      olAt(t,()=>{OL.swap=[1,2][lb];OL.corruptBase=[.55,.9][lb];OL.hud='SIGNAL INTEGRITY '+[38,4][lb]+'%';
        OL.units.forEach(u=>{u.corrupt=1;});});
      olUnits.forEach((_,i)=>olData(i,t+i*.02,.18,.03));
    }
    if(lb===1&&step>=13){ // everything freezes and drops out
      if(step===13){olAt(t,()=>{OL.freeze=true;});if(!MUTE.air)olBurst(olAir().dest,t,.5,2000,.4,.5,'lowpass',80);}
      return;
    }
    if(step%2===0){
      const i=Math.floor(Math.random()*4),r=Math.random();
      if(r<.35){const end=olRepeat(i,t,4+Math.floor(Math.random()*8));olSpeaking(i,t,end,olWords());}
      else if(r<.7)olSpeak(i,t,{syllables:2+Math.floor(Math.random()*3),style:'stutter',energy:e,feedback:.55,stab:1});
      else olData(i,t,.1+Math.random()*.2,.035);
      olStab(i,t,.06+Math.random()*.1,.4);say(i);
      if(Math.random()<.3){const k=(i+1+Math.floor(Math.random()*3))%4;olPacket(i,k,t,t+2*S);}
    }
    if(step===8)olSqueal(Math.floor(Math.random()*4),t,.6);
  }

  else if(mode==='radio'){
    if(step%8===0){
      const i=olClockwise[(ls/8)%4];
      olTransmission(i,t,.6+Math.random()*.5);say(i);
      olAt(t,()=>OL.units.forEach((_,k)=>{if(k!==i)olLook(k,i);else olLook(k,null);}));
    }
    if(step===4||step===12){ // numbers station
      const i=lb%4,digits=Array.from({length:4},()=>Math.floor(Math.random()*10));
      if(Math.random()<.35)digits.splice(0,4,3,0,2,9);
      olSpeak(i,t,{syllables:2,style:'sing',syl:.17,gap:.06,energy:.5,gain:.8});
      olAt(t,()=>{OL.hud='.. '+digits.join(' ')+' ..';});
    }
  }

  else if(mode==='close'){
    // the injected human has taken over: everything corrupts, the screens die one by one, then nothing
    const order=[1,3,2,0];
    if(step===0)olAt(t,()=>{OL.corruptBase=[.35,.7,.95,1][lb];});
    if(lb<2){
      if(step%4===0){const i=Math.floor(Math.random()*4);olSayHuman(i,t,{dur:S*3,gain:.6,ask:Math.random()<.5,mouth:false});olStab(i,t+S*2,.08,.35);say(i);}
      if(lb===1&&step%2===0){const i=Math.floor(Math.random()*4);olRepeat(i,t,4+Math.floor(Math.random()*5));olData(i,t,.12,.03);olGlitch(i,t,.25);}
      if(lb===1&&step%4===2)olAt(t,()=>{OL.swap=1+Math.floor(Math.random()*3);});
      if(step===8)olSqueal(Math.floor(Math.random()*4),t,.5);
    }else if(lb===2){
      if(step%4===0){
        const i=order[step/4];
        olStab(i,t,.15,.45);olThunk(i,t+.12,true);
        olAt(t+.12,()=>{OL.units[i].powerTarget=0;OL.units[i].mouthTarget=0;});
        if(step===12)olAt(t+.2,()=>{OL.swap=0;});
      }
      if(step%2===1&&step<12)olRepeat(order[(step>>2)+1],t,3);
    }else{
      if(step===0){const a=olAir();[a.hg,a.sg,a.hm].forEach(g=>g.gain.setTargetAtTime(0,t+.01,.08));}
      if(step===4){ // one last flash of the human across the dead glass
        olAt(t,()=>{OL.ghostUntil=t+.8;OL.units.forEach(u=>{u.flash=1;});});
        if(!MUTE.air)olBurst(olAir().dest,t,.8,1500,.5,.45,'lowpass',60);
      }
      if(step===13)olAt(t,()=>{ // clear the hack only once its last flash has finished
        const clear=()=>{if(ctx.currentTime<OL.ghostUntil){setTimeout(clear,40);return;}OL.humanTarget=0;OL.human=null;OL.corruptBase=0;};clear();
      });
    }
  }
}

/* ---------- drawing ---------- */
function olWindows(){
  return OL.views??=olUnits.map(unit=>{
    const element=document.createElement('section'),canvas=document.createElement('canvas');
    element.className='flock-monitor olympus-window';
    canvas.className='flock-canvas';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',unit.title+' screen: a watching eye that becomes a mouth when it speaks');
    element.append(canvas);
    return {id:unit.id,title:unit.title,sourceKey:unit.id+'.out',element,canvas,g:canvas.getContext('2d')};
  });
}
function olAlmond(g,cx,cy,R,hh){
  g.beginPath();g.moveTo(cx-R,cy);
  g.quadraticCurveTo(cx,cy-hh*2,cx+R,cy);g.quadraticCurveTo(cx,cy+hh*2,cx-R,cy);g.closePath();
}
function olEye(g,{cx,cy,R,open,gx,gy,spin,spec,level,words,hue,pupil,speaking,now}){
  const TAU=Math.PI*2,hh=R*.56*open;
  if(R<2)return;
  if(open>.01){
    g.save();olAlmond(g,cx,cy,R,hh);g.clip();
    g.fillStyle=olRgba(hue,.1);g.fillRect(cx-R,cy-hh*2,R*2,hh*4);
    g.strokeStyle=olRgba(hue,.18);g.lineWidth=1;
    for(let v=0;v<10;v++){ // veins of data across the sclera
      const a=v/10*TAU,w=words[v]/255;
      g.beginPath();g.moveTo(cx+Math.cos(a)*R*.95,cy+Math.sin(a)*R*.5);
      g.quadraticCurveTo(cx+Math.cos(a+.3)*R*(.6+w*.2),cy+Math.sin(a-.2)*R*.4,cx+Math.cos(a)*R*.45,cy+Math.sin(a)*R*.25);g.stroke();
    }
    const ex=cx+gx*R*.4,ey=cy+gy*R*.24,ri=R*.43;
    for(let ring=0;ring<7;ring++){ // iris rings and spokes, driven by the voice's spectrum
      const amp=(spec?.[ring*9+3]??0)/255;
      g.globalAlpha=.25+ring*.07+amp*.4;g.strokeStyle=hue;g.lineWidth=ring===6?2.2:1;
      g.beginPath();g.arc(ex,ey,ri*(.38+ring*.1)+amp*ri*.08,0,TAU);g.stroke();
    }
    g.lineWidth=1.2;
    for(let s=0;s<72;s++){
      const a=s/72*TAU+spin,amp=(spec?.[(s*3)%150]??0)/255;
      const r0=ri*(.42+level*.35),r1=ri*(.78+amp*.5+(words[s%16]/255)*.08);
      g.globalAlpha=.3+amp*.7;g.strokeStyle=s%9===0?'#fff':hue;
      g.beginPath();g.moveTo(ex+Math.cos(a)*r0,ey+Math.sin(a)*r0);g.lineTo(ex+Math.cos(a)*r1,ey+Math.sin(a)*r1);g.stroke();
    }
    g.globalAlpha=1;
    const pr=Math.min(ri*.62,ri*(.24+level*1.1+(speaking?.05:0)));
    g.fillStyle='#000';g.strokeStyle=hue;g.lineWidth=2;
    g.beginPath();
    if(pupil==='round')g.arc(ex,ey,pr,0,TAU);
    else if(pupil==='bar')g.ellipse(ex,ey,pr*1.5,pr*.42,0,0,TAU);
    else if(pupil==='slit')g.ellipse(ex,ey,pr*.3,pr*1.55,0,0,TAU);
    else for(let d=0;d<3;d++){const a=d/3*TAU-Math.PI/2+now*.4,px=ex+Math.cos(a)*pr*.8,py=ey+Math.sin(a)*pr*.8;g.moveTo(px+pr*.42,py);g.arc(px,py,pr*.42,0,TAU);}
    g.fill();g.stroke();
    g.fillStyle='rgba(255,255,255,.9)';
    g.beginPath();g.arc(ex-ri*.3,ey-ri*.32,ri*.07,0,TAU);g.fill();
    g.beginPath();g.arc(ex-ri*.16,ey-ri*.22,ri*.03,0,TAU);g.fill();
    g.restore();
  }
  g.strokeStyle=olRgba(hue,.95);g.lineWidth=Math.max(1.5,R*.02);
  olAlmond(g,cx,cy,R,hh);g.stroke();
  g.lineWidth=1;g.strokeStyle=olRgba(hue,.6);
  for(let l=1;l<12;l++){ // lashes along the upper lid
    const s=l/12,x=(1-s)*(1-s)*(cx-R)+2*s*(1-s)*cx+s*s*(cx+R),y=(1-s)*(1-s)*cy+2*s*(1-s)*(cy-hh*2)+s*s*cy;
    const len=R*.08*(1-Math.abs(s-.5)*1.2);
    g.beginPath();g.moveTo(x,y);g.lineTo(x+(s-.5)*len*1.4,y-len);g.stroke();
  }
}
// A mouth in the same line-art as the eyes: glowing lips traced with fine contours, and inside,
// the voice as mirrored bars of light with its waveform running through the middle.
function olLipPath(g,cx,cy,MW,o,k=1){
  const w=MW*k;
  g.beginPath();g.moveTo(cx-w,cy);
  g.bezierCurveTo(cx-w*.62,cy-MW*.05*k-o*.62*k,cx-w*.26,cy-MW*.17*k-o*.72*k,cx,cy-MW*.07*k-o*.62*k); // Cupid's bow
  g.bezierCurveTo(cx+w*.26,cy-MW*.17*k-o*.72*k,cx+w*.62,cy-MW*.05*k-o*.62*k,cx+w,cy);
  g.bezierCurveTo(cx+w*.55,cy+MW*.2*k+o*1.15*k,cx-w*.55,cy+MW*.2*k+o*1.15*k,cx-w,cy);
  g.closePath();
}
function olMouth(g,{cx,cy,MW,open,hue,wave,spec,speaking}){
  if(MW<2)return;
  const o=open,iw=MW*.82,top=o*.95,bot=o*1.1;
  g.save();
  // lips: a soft gradient, a glowing outline, and two inner contour lines
  const fill=g.createLinearGradient(0,cy-MW*.25-o,0,cy+MW*.25+o*1.2);
  fill.addColorStop(0,olRgba(hue,.28));fill.addColorStop(.5,olRgba(hue,.08));fill.addColorStop(1,olRgba(hue,.24));
  olLipPath(g,cx,cy,MW,o);g.fillStyle=fill;g.fill();
  g.shadowColor=hue;g.shadowBlur=MW*.09;
  g.strokeStyle=hue;g.lineWidth=Math.max(1.5,MW*.018);g.stroke();
  g.shadowBlur=0;
  [.9,.8].forEach((k,n)=>{olLipPath(g,cx,cy,MW,o,k);g.strokeStyle=olRgba(hue,.45-n*.15);g.lineWidth=1;g.stroke();});
  // the opening
  g.beginPath();g.moveTo(cx-iw,cy);g.quadraticCurveTo(cx,cy-top*2,cx+iw,cy);g.quadraticCurveTo(cx,cy+bot*2,cx-iw,cy);g.closePath();
  if(o>1){
    const glow=g.createRadialGradient(cx,cy,0,cx,cy,iw);
    glow.addColorStop(0,olRgba(hue,.3));glow.addColorStop(.6,'rgba(5,4,3,.92)');glow.addColorStop(1,'#030201');
    g.fillStyle=glow;g.fill();
    g.save();g.clip();
    const n=28,bw=iw*2/n;
    for(let b=0;b<n;b++){ // mirrored spectrum bars, tallest in the middle
      const mid=1-Math.abs(b-(n-1)/2)/(n/2),amp=(spec?.[2+Math.round(Math.abs(b-(n-1)/2))*3]??0)/255;
      const h=(top+bot)*(.15+amp*.9)*(.4+mid*.6);
      g.fillStyle=olRgba(hue,.25+amp*.55);
      g.fillRect(cx-iw+b*bw+bw*.2,cy-h,bw*.6,h*2);
    }
    if(wave){
      g.shadowColor=hue;g.shadowBlur=8;g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=1.4;g.beginPath();
      for(let x=0;x<=90;x++){const v=wave[(x*5)%wave.length]||0,env=Math.sin(Math.PI*x/90),px=cx-iw+x/90*iw*2,py=cy-Math.max(-1,Math.min(1,v*6))*Math.min(top,bot)*.9*env;x?g.lineTo(px,py):g.moveTo(px,py);}
      g.stroke();g.shadowBlur=0;
    }
    g.restore();
    g.beginPath();g.moveTo(cx-iw,cy);g.quadraticCurveTo(cx,cy-top*2,cx+iw,cy);g.quadraticCurveTo(cx,cy+bot*2,cx-iw,cy);g.closePath();
  }
  g.strokeStyle=olRgba(hue,.85);g.lineWidth=1.2;g.stroke();
  // a soft highlight on the lower lip
  g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=Math.max(1,MW*.012);g.lineCap='round';
  g.beginPath();g.moveTo(cx-MW*.22,cy+MW*.13+o*1.02);g.quadraticCurveTo(cx,cy+MW*.17+o*1.08,cx+MW*.22,cy+MW*.13+o*1.02);g.stroke();
  g.lineCap='butt';
  if(!speaking){ // resting: the lips meet in a faint smile
    g.strokeStyle=olRgba(hue,.8);g.lineWidth=1.2;g.beginPath();g.moveTo(cx-iw,cy);g.quadraticCurveTo(cx,cy+MW*.05,cx+iw,cy);g.stroke();
  }
  g.restore();
}
function olHex(g,W,H,amount,words,now,hue,font){ // scrolling hex dump behind the face
  if(amount<.02)return;
  g.font=font(.024);g.fillStyle=hue;g.textBaseline='top';
  const rows=Math.ceil(H/(W*.034)),scroll=(now*9)%1,lineH=H/rows,frame=Math.floor(now*12);
  for(let r=-1;r<rows;r++){
    const n=r+Math.floor(now*9),addr=((n*16)&0xffff).toString(16).padStart(4,'0').toUpperCase();
    let line='0x'+addr+' ';
    for(let b=0;b<10;b++){
      const v=(words[(b+n)&15]*(n+3)+b*29)&255;
      line+=Math.random()<amount*.15?olGlyphSet[(v+frame)%olGlyphSet.length]+' ':v.toString(16).padStart(2,'0').toUpperCase()+' ';
    }
    g.globalAlpha=amount*(.18+((n*7)%5)*.05);
    g.fillText(line,W*.035,(r+1-scroll)*lineH);
  }
  g.globalAlpha=1;
}
function olWall(g,W,H,i,now){ // things drawn in wall coordinates, so they cross the seams
  const col=i%2,row=i>>1,ox=col*W,oy=row*H,hue=olUnits[olIdentity(i)].hue;
  if(OL.wave>.01){ // a waveform snaking through all four screens
    const lv=OL.units.reduce((s,u)=>s+u.level,0)/4,amp=H*(.08+lv*.25)*OL.wave;
    g.strokeStyle=hue;g.lineWidth=2;g.globalAlpha=.85*OL.wave;g.beginPath();
    for(let x=0;x<=120;x++){
      const gxw=ox+x/120*W,u=row===0?gxw:4*W-gxw; // distance along the snake
      const y=H/2+Math.sin(u/W*Math.PI*1.5-now*5)*amp+Math.sin(u/W*7.3+now*11)*amp*.25;
      x?g.lineTo(x/120*W,y):g.moveTo(0,y);
    }
    g.stroke();g.globalAlpha=1;
  }
  if(OL.beam){ // a scan beam along the top row, then back along the bottom
    const s=((now-OL.beam.at)/OL.beam.period)%1,d=Math.max(0,s)*4*W,brow=d<2*W?0:1,bx=brow===0?d:4*W-d;
    if(brow===row&&bx>ox-W*.2&&bx<ox+W*1.2){
      const x=bx-ox,gr=g.createLinearGradient(x-W*.12,0,x+W*.12,0);
      gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.5,olRgba(hue,.45));gr.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=gr;g.fillRect(x-W*.12,0,W*.24,H);
      g.fillStyle='rgba(255,255,255,.85)';g.fillRect(x-1,0,2,H);
    }
  }
  for(const p of OL.packets){ // packets in flight, with a dashed line between sender and receiver
    if(now<p.at||now>p.until+.05)continue;
    const k=Math.max(0,Math.min(1,(now-p.at)/(p.until-p.at)));
    const fx=(p.from%2+.5)*W,fy=((p.from>>1)+.5)*H,tx=(p.to%2+.5)*W,ty=((p.to>>1)+.5)*H;
    g.strokeStyle=olRgba(hue,.55*(1-k*.5));g.lineWidth=1.5;g.setLineDash([5,5]);
    g.beginPath();g.moveTo(fx-ox,fy-oy);g.lineTo(tx-ox,ty-oy);g.stroke();g.setLineDash([]);
    const size=W*.065;
    for(let tr=9;tr>=0;tr--){
      const q=Math.max(0,k-tr*.035),e=q*q*(3-2*q),x=olLerp(fx,tx,e)-ox,y=olLerp(fy,ty,e)-oy;
      g.globalAlpha=(1-tr/10)*.9;g.fillStyle=tr?hue:'#fff';
      const sz=size*(1-tr*.07);g.fillRect(x-sz/2,y-sz/2,sz,sz);
    }
    const e=k*k*(3-2*k),x=olLerp(fx,tx,e)-ox,y=olLerp(fy,ty,e)-oy;
    g.globalAlpha=1;g.fillStyle='#000';g.font=`bold ${Math.round(size*.55)}px ui-monospace,monospace`;g.textAlign='center';g.textBaseline='middle';
    g.fillText(p.words[0].toString(16).toUpperCase().padStart(2,'0'),x,y);g.textAlign='left';g.textBaseline='top';
  }
  olHumanWall(g,W,H,i,now);
  g.globalAlpha=1;
  for(const h of OL.hearts){ // hearts rising through the wall
    const age=now-h.at;if(age<0||age>h.life)continue;
    const size=h.s*H*(.5+.5*Math.min(1,age*3)),hx=(h.x+Math.sin(age*h.sw+h.ph)*.05)*W-ox,hy=(h.y-age*h.vy)*H-oy;
    if(hx<-size*2||hx>W+size*2||hy<-size*2||hy>H+size*2)continue;
    g.globalAlpha=Math.min(1,(h.life-age)/1.2)*.9;
    olHeartPath(g,hx,hy,size);
    g.fillStyle='rgba(255,130,190,.45)';g.shadowColor='#ff7fbf';g.shadowBlur=size*.6;g.fill();
    g.shadowBlur=0;g.strokeStyle='#ffb3d9';g.lineWidth=Math.max(1,size*.06);g.stroke();
  }
  g.globalAlpha=1;
  for(const tk of OL.tickers){ // scrolling words, right to left across a row
    if(tk.row!==row)continue;
    const p=(now-tk.at)/tk.dur;if(p<0||p>1)continue;
    g.font=`bold ${Math.round(H*.24)}px ${OL_JP_FONT}`;g.textBaseline='middle';g.textAlign='left';
    const tw=g.measureText(tk.text).width,x=2*W-p*(2*W+tw)-ox;
    if(x>W||x+tw<0)continue;
    const band=g.createLinearGradient(0,H*.34,0,H*.66);
    band.addColorStop(0,'rgba(0,0,0,0)');band.addColorStop(.25,'rgba(0,0,0,.55)');band.addColorStop(.75,'rgba(0,0,0,.55)');band.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=band;g.fillRect(0,H*.34,W,H*.32);
    g.shadowColor=hue;g.shadowBlur=H*.06;g.fillStyle=hue;g.fillText(tk.text,x,H*.5);
    g.shadowBlur=0;g.globalAlpha=.4;g.fillStyle='#fff';g.fillText(tk.text,x,H*.5);g.globalAlpha=1;
    g.textBaseline='top';
  }
}
// The visitor: a line-art human, waving. Coordinates are fractions of its height k, centred on (cx,cy).
function olHumanFigure(g,cx,cy,k,now,color,lw=2){
  const P=(x,y)=>[cx+x*k,cy+y*k],arm=(s,a,len)=>[s[0]+Math.cos(a)*len*k,s[1]+Math.sin(a)*len*k];
  const neck=P(0,-.33),pelvis=P(0,.03),sL=P(-.12,-.29),sR=P(.12,-.29),hL=P(-.065,.04),hR=P(.065,.04);
  const a1=-1.05+Math.sin(now*5)*.35,eR=arm(sR,a1,.16),wR=arm(eR,a1-.7+Math.sin(now*11)*.7,.15); // the waving arm
  const a2=1.95+Math.sin(now*2.1)*.15,eL=arm(sL,a2,.16),wL=arm(eL,a2+.25,.15);
  const kL=P(-.09,.25),fL=P(-.12,.47),kR=P(.09,.25),fR=P(.12,.47);
  g.strokeStyle=color;g.lineWidth=lw;g.lineCap='round';g.lineJoin='round';
  g.beginPath();
  g.moveTo(...sL);g.lineTo(...sR);g.lineTo(...hR);g.lineTo(...hL);g.closePath();   // torso
  g.moveTo(...neck);g.lineTo(...P(0,-.29));
  g.moveTo(...sR);g.lineTo(...eR);g.lineTo(...wR);
  g.moveTo(...sL);g.lineTo(...eL);g.lineTo(...wL);
  g.moveTo(...hL);g.lineTo(...kL);g.lineTo(...fL);
  g.moveTo(...hR);g.lineTo(...kR);g.lineTo(...fR);
  g.stroke();
  const [hx,hy]=P(0,-.41);
  g.beginPath();g.arc(hx,hy,.075*k,0,Math.PI*2);g.stroke();
  const beat=Math.pow(Math.max(0,Math.sin(now*7.5)),8); // a little heartbeat in the chest
  const [bx,by]=P(-.035,-.2),bs=.035*k*(1+beat*.5);
  olHeartPath(g,bx,by,bs);g.fillStyle=color;g.fill();
  g.lineCap='butt';g.lineJoin='miter';
}
function olHumanWall(g,W,H,i,now){
  const hm=OL.human,amt=OL.humanAmt;if(!hm||amt<.01)return;
  const col=i%2,row=i>>1,ox=col*W,oy=row*H;
  const glimpse=hm.mode==='glimpse',age=now-hm.at;
  if(glimpse&&Math.random()<.45)return; // half there, half not
  const lv=OL.units.reduce((s,u)=>s+u.level,0)/4;
  const crazy=glimpse?.25:Math.min(1,.3+age/1.8);
  const k=H*1.9*(1+Math.sin(now*9)*.02*crazy+lv*.1),cy=H*1.04-oy;
  // it sways from side to side, right across the eyes
  const sway=tt=>W-ox+Math.sin((tt-hm.at)*1.3)*W*.5*Math.min(1,crazy*1.2)+Math.sin((tt-hm.at)*7)*W*.03*crazy;
  const cx=sway(now);
  const reveal=glimpse?1:Math.min(1,age/1.2),top=cy-k*.52,scanY=top+reveal*k*1.05;
  g.save();
  if(reveal<1){g.beginPath();g.rect(-W,-H,W*3,scanY+H);g.clip();}
  if(!glimpse)[.24,.12].forEach((lag,n)=>{ // ghost trail
    g.globalAlpha=amt*(.14+n*.1);olHumanFigure(g,sway(now-lag),cy,k,now-lag,'#ffffff',Math.max(2,H*.016));
  });
  const bands=crazy>.55?8:1,bh=k*1.1/bands;
  for(let b=0;b<bands;b++){
    g.save();
    if(bands>1){g.beginPath();g.rect(-W,top+b*bh,W*3,bh+1);g.clip();}
    const shift=bands>1&&Math.random()<.3*crazy?(Math.random()-.5)*W*.14:0;
    [['#ff3b6b',-1],['#3bffd5',1],['#ffffff',0]].forEach(([c,side])=>{ // colour-split copies that never quite line up
      const jx=side*W*.008*(1+crazy*3)+shift+(Math.random()-.5)*crazy*4,jy=(Math.random()-.5)*crazy*3;
      g.globalCompositeOperation=side?'lighter':'source-over';
      g.globalAlpha=amt*(side?.6:.95)*(glimpse?.5:1);
      if(!side){g.shadowColor='#fff';g.shadowBlur=H*.04;}
      olHumanFigure(g,cx+jx,cy+jy,k,now,c,side?Math.max(2,H*.016):Math.max(3,H*.022));
      g.shadowBlur=0;
    });
    g.restore();
  }
  g.globalCompositeOperation='source-over';
  if(reveal<1){g.globalAlpha=amt;g.fillStyle='#fff';g.fillRect(-W,scanY-1.5,W*3,3);
    const glow=g.createLinearGradient(0,scanY-H*.15,0,scanY);glow.addColorStop(0,'rgba(255,255,255,0)');glow.addColorStop(1,'rgba(255,255,255,.18)');
    g.fillStyle=glow;g.fillRect(-W,scanY-H*.15,W*3,H*.15);}
  if(!glimpse){ // targeting: corner brackets round the body and a spinning reticle on the head
    g.globalAlpha=amt*(.6+Math.random()*.3);g.strokeStyle='#fff';g.lineWidth=2;
    const x0=cx-k*.36,x1=cx+k*.36,y0=top-k*.02,y1=cy+k*.52,c=k*.08;
    g.beginPath();
    [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]].forEach(([x,y,sx,sy])=>{g.moveTo(x+sx*c,y);g.lineTo(x,y);g.lineTo(x,y+sy*c);});
    g.stroke();
    const hx=cx,hy=cy-k*.41,r=k*.13;
    g.setLineDash([r*.4,r*.25]);g.lineDashOffset=-now*60;
    g.beginPath();g.arc(hx,hy,r,0,Math.PI*2);g.stroke();g.setLineDash([]);
    g.beginPath();g.moveTo(hx-r*1.5,hy);g.lineTo(hx-r*.6,hy);g.moveTo(hx+r*.6,hy);g.lineTo(hx+r*1.5,hy);
    g.moveTo(hx,hy-r*1.5);g.lineTo(hx,hy-r*.6);g.moveTo(hx,hy+r*.6);g.lineTo(hx,hy+r*1.5);g.stroke();
  }
  g.restore();
  g.globalAlpha=1;
}
function olIntrusion(g,W,H,i,u,now){
  const it=u.intrude;if(!it||now>it.until)return;
  const col=i%2,row=i>>1,ox=it.wall?col*W:0,oy=it.wall?row*H:0,AW=it.wall?W*2:W,AH=it.wall?H*2:H;
  const jx=(Math.random()-.5)*W*.03;
  g.save();g.translate(jx-ox,-oy);
  if(it.kind==='static'){ // nothing but snow and a rolling colour band
    g.fillStyle='#050505';g.fillRect(0,0,AW,AH);
    g.restore();olSnow(g,W,H,1.5,'#ddd');
    const y=((now*3+it.seed)%1)*H;g.fillStyle=`hsla(${it.seed*360},80%,60%,.25)`;g.fillRect(0,y,W,H*.12);
    return;
  }
  if(it.kind==='bars'){ // a colour-bar test card
    const cols=['#c0c0c0','#c0c000','#00c0c0','#00c000','#c000c0','#c00000','#0000c0'];
    cols.forEach((c,n)=>{g.fillStyle=c;g.fillRect(n*AW/7,0,AW/7+1,AH*.68);});
    ['#0000c0','#131313','#c000c0','#131313','#00c0c0','#131313','#c0c0c0'].forEach((c,n)=>{g.fillStyle=c;g.fillRect(n*AW/7,AH*.68,AW/7+1,AH*.08);});
    g.fillStyle='#00214c';g.fillRect(0,AH*.76,AW*.18,AH*.24);g.fillStyle='#fff';g.fillRect(AW*.18,AH*.76,AW*.18,AH*.24);
    g.fillStyle='#32006a';g.fillRect(AW*.36,AH*.76,AW*.18,AH*.24);g.fillStyle='#090909';g.fillRect(AW*.54,AH*.76,AW*.46,AH*.24);
  }else if(it.kind==='earth'){ // home, very far away
    g.fillStyle='#010206';g.fillRect(0,0,AW,AH);
    let sd=Math.floor(it.seed*1e6);const rnd=()=>((sd=(Math.imul(sd,1664525)+1013904223)>>>0)/4294967296);
    g.fillStyle='#fff';for(let n=0;n<70;n++){g.globalAlpha=.3+rnd()*.7;g.fillRect(rnd()*AW,rnd()*AH,1.5,1.5);}
    g.globalAlpha=1;
    const cx=AW*.5,cy=AH*.5,r=Math.min(AW,AH)*.36;
    const sea=g.createRadialGradient(cx-r*.35,cy-r*.35,r*.1,cx,cy,r);
    sea.addColorStop(0,'#4fa3ff');sea.addColorStop(.6,'#1556b8');sea.addColorStop(1,'#041a44');
    g.fillStyle=sea;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fill();
    g.save();g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.clip();
    g.fillStyle='#3f9b4a';
    for(let n=0;n<9;n++){const a=rnd()*6.28,d=rnd()*r*.8,bx=cx+Math.cos(a)*d,by=cy+Math.sin(a)*d;
      g.beginPath();g.ellipse(bx,by,r*(.12+rnd()*.22),r*(.08+rnd()*.14),rnd()*3,0,Math.PI*2);g.fill();}
    g.fillStyle='rgba(255,255,255,.55)';
    for(let n=0;n<7;n++){g.beginPath();g.ellipse(cx+(rnd()-.5)*r*1.6,cy+(rnd()-.5)*r*1.6,r*(.15+rnd()*.25),r*.04,rnd()*.6-.3,0,Math.PI*2);g.fill();}
    const shade=g.createRadialGradient(cx-r*.4,cy-r*.4,r*.2,cx+r*.2,cy+r*.2,r*1.3);
    shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.85)');g.fillStyle=shade;g.fillRect(cx-r,cy-r,r*2,r*2);
    g.restore();
    g.strokeStyle='rgba(120,180,255,.5)';g.lineWidth=r*.04;g.beginPath();g.arc(cx,cy,r*1.02,0,Math.PI*2);g.stroke();
  }else{ // one of the photos, cropped to fill
    const im=olPhoto(it.kind);
    if(im.complete&&im.naturalWidth){
      const sc=Math.max(AW/im.naturalWidth,AH/im.naturalHeight),dw=im.naturalWidth*sc,dh=im.naturalHeight*sc;
      g.drawImage(im,(AW-dw)/2,(AH-dh)/2,dw,dh);
    }else{g.fillStyle='#222';g.fillRect(0,0,AW,AH);}
  }
  g.restore();
  if(it.invert){g.globalCompositeOperation='difference';g.fillStyle='#fff';g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';}
}
function olHeartPath(g,x,y,s){
  g.beginPath();g.moveTo(x,y+s*.35);
  g.bezierCurveTo(x-s*1.1,y-s*.35,x-s*.55,y-s*1.05,x,y-s*.45);
  g.bezierCurveTo(x+s*.55,y-s*1.05,x+s*1.1,y-s*.35,x,y+s*.35);
  g.closePath();
}
function olDrawUnit(view,i,now,scale){
  const {canvas,g}=view,W=canvas.clientWidth,H=canvas.clientHeight,u=OL.units[i];
  const unit=olUnits[olIdentity(i)],hue=unit.hue; // who is on this screen right now
  const out=OL.outputs[i],wave=out?.wave,TAU=Math.PI*2;
  const font=s=>`${Math.max(8,Math.round(W*s))}px ui-monospace,Menlo,Consolas,monospace`;
  g.setTransform(scale,0,0,scale,0,0);
  g.fillStyle='#030201';g.fillRect(0,0,W,H);

  if(u.power<.015){ // dead glass: faint reflection and the odd burst of snow
    const ref=g.createLinearGradient(0,0,W,H);ref.addColorStop(0,'rgba(255,255,255,.035)');ref.addColorStop(.5,'rgba(0,0,0,0)');
    g.fillStyle=ref;g.fillRect(0,0,W,H);
    if(u.flash>.02)olSnow(g,W,H,u.flash,'#ddd');
    if(now<OL.ghostUntil&&Math.random()<.8)olSnow(g,W,H,.6,'#ddd');
    olFrame(g,W,H,false);
    return;
  }
  if(OL.freeze){ // signal lost: snow and one line of text
    olSnow(g,W,H,1.4,'#bbb');
    g.fillStyle=olRgba(hue,.9);g.font=font(.045);g.textBaseline='middle';g.textAlign='center';
    g.fillText('— NO CARRIER —',W/2,H/2);g.textAlign='left';g.textBaseline='top';
    olFrame(g,W,H,true,canvas,now,i);return;
  }
  const p=Math.min(1,u.power),squash=p<.999?Math.max(.006,p*p*p):1;
  g.save();
  g.translate(0,H/2);g.scale(1,squash);g.translate(0,-H/2);
  if(OL.rot&&now-OL.rotAt<.3){ // the character slides in from the previous screen
    const prev=olClockwise[(olClockwise.indexOf(i)+3)%4],k=Math.min(1,(now-OL.rotAt)/.3),e2=1-Math.pow(1-k,3);
    g.translate(((prev%2)-(i%2))*W*(1-e2),((prev>>1)-(i>>1))*H*(1-e2));
  }
  if(u.punch>.01){const z=1+u.punch*.22;g.translate(W/2,H/2);g.scale(z,z);g.translate(-W/2,-H/2);
    g.fillStyle=olRgba(hue,.18*u.punch);g.fillRect(0,0,W,H);}

  const glow=g.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.7);
  glow.addColorStop(0,olRgba(hue,.11+u.level*.25));glow.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=glow;g.fillRect(0,0,W,H);
  const corrupt=Math.min(1,OL.corruptBase+u.corrupt*.6);
  olHex(g,W,H,Math.max(olHexLevels[OL.mode]??0,corrupt*.8),u.words,now,hue,font);

  const k=OL.giant,col=i%2,row=i>>1,inMouthRow=row===OL.faceRow;
  const fm=inMouthRow?OL.face:0,fe=inMouthRow?0:OL.face; // face: this screen is half the mouth, or one eye
  const m=Math.max(u.mouth,fm),speaking=now>=u.speakAt&&now<u.speakUntil;
  const shared=k>.5?OL.units[0]:OL.units[(1-OL.faceRow)*2],share=Math.max(k,fe);
  const spec=(k>.5?OL.outputs[0]:out)?.spectrum;

  // a screen shows an eye or a mouth, never both: the eye closes to a line, and the line opens into lips
  const eyeShut=Math.min(1,u.mouth*2),lips=Math.max(0,u.mouth*2-1);
  // eye: its own, a quarter of the giant eye, or one eye of the wall face
  if(fm<.9&&eyeShut<.999){
    let cx=W/2,cy=H*.45,R=Math.min(W*.37,H*.66);
    cy=olLerp(cy,OL.faceRow===1?H*.56:H*.4,fe);
    cx=olLerp(cx,W*(1-col),k);cy=olLerp(cy,H*(1-row),k);R=olLerp(R,Math.min(W*.96,H*1.42),k);
    R*=1-fm;
    const blink=now>=u.blinkAt&&now<u.blinkAt+u.blinkDur?Math.sin(Math.PI*(now-u.blinkAt)/u.blinkDur):0;
    olEye(g,{cx,cy,R,open:Math.max(0,u.lid*(1-blink)*(1-eyeShut)),
      gx:olLerp(u.gx+u.jx,shared.gx+shared.jx,share),gy:olLerp(u.gy+u.jy,shared.gy+shared.jy,share),
      spin:k>.5?now*.25:now*(i%2?-.25:.25)+u.words[0]/255,spec,level:u.level,
      words:(k>.5?OL.units[0]:u).words,hue,pupil:k>.5?'round':unit.pupil,speaking,now});
  }
  // mouth: opens out of the closed eye when the screen talks, or spans the seam as half of the wall's mouth
  const mm=Math.max(lips,fm);
  if(mm>.02){
    const ease=mm*mm*(3-2*mm);
    const cx=olLerp(W/2,W*(1-col),fm),cy=olLerp(H*.47,row===0?H*.56:H*.44,fm),MW=olLerp(Math.min(W*.37,H*.62),Math.min(W*.82,H*1.15),fm)*olLerp(.75,1,ease);
    const a=OL.units[row*2],b=OL.units[row*2+1];
    const pair=inMouthRow&&fm>.5?(a.level+b.level)/2:u.level;
    const talking=speaking||(fm>.5&&(a.speakUntil>now&&a.speakAt<=now||b.speakUntil>now&&b.speakAt<=now));
    const room=olLerp(H*.2,H*.17,fm)*ease; // keep the lips on the glass
    g.save();g.globalAlpha=ease;
    olMouth(g,{cx,cy,MW,open:talking?Math.min(room,MW*(.05+.42*Math.min(1,pair*1.6))):MW*.01,hue,wave,spec:out?.spectrum,speaking:talking});
    g.restore();
  }
  // the oscilloscope line under a plain eye
  if(k<.5&&m<.2&&OL.wave<.1&&wave){
    const y0=H*.86,amp=H*.1*(1-k*2)*(1-m*5);
    g.globalAlpha=speaking?.95:.3;g.strokeStyle=hue;g.lineWidth=1.4;g.beginPath();
    for(let x=0;x<=96;x++){const v=wave[(x*5)%wave.length]||0,px=W*.18+x/96*W*.64,py=y0-Math.max(-1,Math.min(1,v*6))*amp;x?g.lineTo(px,py):g.moveTo(px,py);}
    g.stroke();g.globalAlpha=1;
  }
  olWall(g,W,H,i,now);

  olIntrusion(g,W,H,i,u,now);
  // CRT: snow, rolling bar
  const glitching=now<u.glitchUntil;
  olSnow(g,W,H,(OL.mode==='radio'?.25:.08)+(glitching?.4:0)+u.flash+corrupt*.3,hue);
  const roll=((now*.17+i*.25)%1)*H*1.3-H*.15;
  g.fillStyle=olRgba(hue,.05);g.fillRect(0,roll,W,H*.12);
  g.restore();

  if(p<.999){ // CRT turn-on / turn-off line and dot
    g.fillStyle=olRgba('#ffffff',(1-p)*.9);
    const lw=W*Math.min(1,p*4);g.fillRect(W/2-lw/2,H/2-1,lw,2);
    if(p<.25){g.beginPath();g.arc(W/2,H/2,2+p*8,0,TAU);g.fill();}
  }
  // HUD: drawn outside the turn-on squash, and only once the tube is fully lit
  const hudA=Math.max(0,Math.min(1,(p-.85)/.15));
  if(hudA>0){g.save();g.globalAlpha=hudA;
  g.fillStyle=olRgba(hue,.75);g.font=font(.026);g.textBaseline='top';
  g.fillText(unit.title.toUpperCase()+' · U-0'+(i+1)+(OL.swap?' ?':''),W*.075,H*.08);
  g.textAlign='right';g.fillText('SOL 384112 · 3029',W*.925,H*.08);g.textAlign='left';
  if(speaking){
    const prog=(now-u.speakAt)/Math.max(.01,u.speakUntil-u.speakAt);
    g.fillStyle=olRgba(hue,.95);g.font=OL.mode==='sync'?`bold ${Math.max(9,Math.round(W*.045))}px ${OL_JP_FONT}`:font(.042);
    g.fillText(u.text.slice(0,Math.ceil(prog*16)),W*.075,H*.85);
  }
  if(OL.hud&&(i===0||OL.mode==='radio'||OL.mode==='corrupt')){g.fillStyle=olRgba(hue,.9);g.font=font(.034);g.textAlign='right';g.fillText(OL.hud,W*.925,H*.85);g.textAlign='left';}
  g.restore();}
  if(glitching)olTear(g,canvas,scale);
  if(corrupt>.05)olCorruptFx(g,canvas,scale,corrupt);
  olFrame(g,W,H,true,canvas,now,i);
  if(u.border>.02){const m=Math.min(W,H);g.strokeStyle=olRgba(hue,u.border);g.lineWidth=2+u.border*4;g.shadowColor=hue;g.shadowBlur=12*u.border;
    g.beginPath();g.roundRect(m*.03,m*.03,W-m*.06,H-m*.06,m*.1);g.stroke();g.shadowBlur=0;}
}
function olSnow(g,W,H,amount,hue){
  const n=Math.floor(Math.min(1.5,amount)*W*H/90);
  g.fillStyle=hue;
  for(let s=0;s<n;s++){g.globalAlpha=Math.random()*.35;g.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*1.5,1);}
  g.globalAlpha=1;
}
function olTear(g,canvas,scale){ // slice the frame sideways and ghost a colour fringe
  g.setTransform(1,0,0,1,0,0);
  const cw=canvas.width,ch=canvas.height;
  for(let s=0;s<6;s++){
    const y=Math.random()*ch,h=ch*(.02+Math.random()*.1),dx=(Math.random()-.5)*cw*.12;
    g.drawImage(canvas,0,y,cw,h,dx,y,cw,h);
  }
  g.globalCompositeOperation='screen';g.globalAlpha=.35;
  g.drawImage(canvas,4*scale,0);
  g.globalCompositeOperation='source-over';g.globalAlpha=1;
  g.setTransform(scale,0,0,scale,0,0);
}
function olCorruptFx(g,canvas,scale,amount){ // datamosh: displaced macroblocks, melting pixel columns, inverted bands
  g.setTransform(1,0,0,1,0,0);
  const cw=canvas.width,ch=canvas.height,blk=Math.round(8*scale);
  const blocks=Math.floor(amount*amount*26);
  for(let b=0;b<blocks;b++){
    const w=blk*(1+Math.floor(Math.random()*5)),h=blk*(1+Math.floor(Math.random()*3));
    const sx=Math.floor(Math.random()*(cw/blk))*blk,sy=Math.floor(Math.random()*(ch/blk))*blk;
    g.drawImage(canvas,sx,sy,w,h,sx+(Math.random()-.5)*blk*12,sy+(Math.random()<.5?0:blk*Math.round((Math.random()-.5)*4)),w,h);
  }
  const melts=Math.floor(amount*7);
  for(let m=0;m<melts;m++){ // drag one row of pixels down: the picture melts
    const x=Math.random()*cw,w=(4+Math.random()*30)*scale,y=Math.random()*ch*.8;
    g.drawImage(canvas,x,y,w,scale,x,y,w,ch*(.05+Math.random()*.3*amount));
  }
  if(Math.random()<amount*.25){
    const y=Math.random()*ch,h=ch*(.03+Math.random()*.12);
    g.globalCompositeOperation='difference';g.fillStyle='#fff';g.fillRect(0,y,cw,h);
    g.globalCompositeOperation='source-over';
  }
  g.setTransform(scale,0,0,scale,0,0);
}
/* ---------- the tube: bloom, softness, aperture grille, scanlines, curved glass and bezel ---------- */
const olFx={half:null,glow:null,wide:null,grille:null};
function olBuf(key,w,h){
  const c=olFx[key]??=document.createElement('canvas');
  w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const g=c.getContext('2d');g.clearRect(0,0,w,h);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  return [c,g];
}
function olGrille(g){ // vertical red-green-blue phosphor stripes, one device pixel each
  if(!olFx.grille){
    const c=document.createElement('canvas');c.width=3;c.height=1;
    const x=c.getContext('2d'),d=x.createImageData(3,1);
    [[255,90,90],[90,255,90],[90,90,255]].forEach(([r,gr,b],k)=>{d.data.set([r,gr,b,255],k*4);});
    x.putImageData(d,0,0);olFx.grille=g.createPattern(c,'repeat');
  }
  return olFx.grille;
}
function olBloom(g,canvas){
  const cw=canvas.width,ch=canvas.height;
  const [half,hg]=olBuf('half',cw/2,ch/2),[glow,gg]=olBuf('glow',cw/7,ch/7),[wide,wg]=olBuf('wide',cw/22,ch/22);
  hg.drawImage(canvas,0,0,half.width,half.height);
  gg.drawImage(half,0,0,glow.width,glow.height);
  wg.drawImage(glow,0,0,wide.width,wide.height);
  g.save();g.setTransform(1,0,0,1,0,0);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.globalCompositeOperation='lighter';
  g.globalAlpha=.42;g.drawImage(glow,0,0,cw,ch);            // phosphor bloom
  g.globalAlpha=.3;g.drawImage(wide,0,0,cw,ch);             // halo that spills across the tube
  g.globalCompositeOperation='multiply';g.globalAlpha=.32;
  g.fillStyle=olGrille(g);g.fillRect(0,0,cw,ch);            // aperture grille
  g.restore();
}
function olFrame(g,W,H,live=true,canvas,now=0,i=0){
  if(live&&canvas)olBloom(g,canvas);
  g.fillStyle='rgba(0,0,0,.2)';                              // scanlines
  for(let y=0;y<H;y+=3)g.fillRect(0,y,W,1.2);
  const v=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.32,W/2,H/2,Math.hypot(W,H)*.55);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.7)');
  g.fillStyle=v;g.fillRect(0,0,W,H);
  if(live){ // the tube is never quite steady
    g.fillStyle=`rgba(0,0,0,${(Math.sin(now*61+i)*.5+.5)*.035+Math.random()*.02})`;g.fillRect(0,0,W,H);
  }
  // bezel and the rounded edge of the tube
  const m=Math.min(W,H),inset=m*.028,r=m*.1;
  g.save();
  g.beginPath();g.rect(0,0,W,H);g.roundRect(inset,inset,W-inset*2,H-inset*2,r);
  g.fillStyle='#090807';g.fill('evenodd');
  g.beginPath();g.roundRect(inset,inset,W-inset*2,H-inset*2,r);g.clip();
  g.lineWidth=m*.05;g.strokeStyle='#000';
  g.beginPath();g.roundRect(inset-m*.025,inset-m*.025,W-inset*2+m*.05,H-inset*2+m*.05,r*1.2);g.stroke();
  // reflections on the curved glass
  const glare=g.createLinearGradient(0,0,W*.7,H);
  glare.addColorStop(0,'rgba(255,255,255,.075)');glare.addColorStop(.32,'rgba(255,255,255,.018)');glare.addColorStop(.33,'rgba(255,255,255,0)');
  g.fillStyle=glare;g.fillRect(0,0,W,H);
  const spot=g.createRadialGradient(W*.24,H*.16,0,W*.24,H*.16,m*.35);
  spot.addColorStop(0,'rgba(255,255,255,.07)');spot.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=spot;g.fillRect(0,0,W,H);
  g.restore();
  g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=1;            // a lit edge on the bezel lip
  g.beginPath();g.roundRect(inset-.5,inset-.5,W-inset*2+1,H-inset*2+1,r);g.stroke();
}
function olAnimate(){
  OL.frame=requestAnimationFrame(olAnimate);
  if(PATCH!==P11)return;
  const now=ctx?.currentTime??performance.now()/1000;
  const wall=performance.now()/1000,dt=Math.min(.1,wall-(OL.lastFrame||wall));OL.lastFrame=wall;
  for(let e=0;e<OL.events.length;)if(OL.events[e].at<=now){OL.events[e].fn();OL.events.splice(e,1);}else e++;
  OL.packets=OL.packets.filter(p=>p.until>now-.2);
  OL.tickers=OL.tickers.filter(tk=>now<tk.at+tk.dur+.1);OL.hearts=OL.hearts.filter(h=>now<h.at+h.life);
  OL.giant+=(OL.giantTarget-OL.giant)*Math.min(1,dt*1.4);
  OL.face+=(OL.faceTarget-OL.face)*Math.min(1,dt*1.6);
  OL.wave+=(OL.waveTarget-OL.wave)*Math.min(1,dt*2);
  {const h=OL.human;OL.humanAmt=h&&now>=h.at&&now<h.until?OL.humanTarget:0;} // no fade: it is there, or it is gone
  const awakeMode=!['dormant','approach'].includes(OL.mode)&&playing;
  OL.units.forEach((u,i)=>{
    u.power+=(u.powerTarget-u.power)*Math.min(1,dt*(u.powerTarget>u.power?2.2:3.5));
    if(Math.abs(u.powerTarget-u.power)<.002)u.power=u.powerTarget;
    u.lid+=(u.lidTarget-u.lid)*Math.min(1,dt*(u.lidTarget>u.lid?4:2.2));
    u.mouth+=(u.mouthTarget-u.mouth)*Math.min(1,dt*(u.mouthTarget>u.mouth?11:6));
    u.gx+=(u.gtx-u.gx)*Math.min(1,dt*14);u.gy+=(u.gty-u.gy)*Math.min(1,dt*14);
    u.flash*=Math.pow(.02,dt);u.border*=Math.pow(.01,dt);u.punch=(u.punch||0)*Math.pow(.003,dt);u.corrupt*=Math.pow(.08,dt);
    if(awakeMode&&u.lidTarget>.5){ // life: idle blinks and saccades
      if(!['sync','face'].includes(OL.mode)&&now>u.nextBlink){if(u.nextBlink)olBlink(i,now,.12+Math.random()*.08);u.nextBlink=now+1.5+Math.random()*4.5;}
      if(now>u.nextSaccade){u.jx=(Math.random()-.5)*.25;u.jy=(Math.random()-.5)*.2;u.nextSaccade=now+.15+Math.random()*.9;}
    }
    const out=OL.outputs[i];
    if(out){
      out.scope.getFloatTimeDomainData(out.wave);out.scope.getByteFrequencyData(out.spectrum);
      let sum=0;for(let s=0;s<out.wave.length;s+=4)sum+=out.wave[s]*out.wave[s];
      const rms=Math.min(1,Math.sqrt(sum/(out.wave.length/4))*4);
      u.level+=(rms-u.level)*Math.min(1,dt*(rms>u.level?20:5));
    }else u.level*=.9;
  });
  if(OL.giant>.02){const lv=OL.units.reduce((s,u)=>s+u.level,0)/4;OL.units.forEach(u=>{u.level=olLerp(u.level,lv,OL.giant);});}
  const scale=Math.min(2,devicePixelRatio||1);
  olWindows().forEach((view,i)=>{
    const {canvas}=view;
    if(!canvas.isConnected||!canvas.clientWidth||!canvas.clientHeight)return;
    const pw=Math.round(canvas.clientWidth*scale),ph=Math.round(canvas.clientHeight*scale);
    if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
    olDrawUnit(view,i,now,scale);
  });
}
function olSilence(){
  OL.events.length=0;OL.nextSpeech=null;OL.clocks=[0,0,0,0];OL.packets=[];OL.tickers=[];OL.hearts=[];OL.human=null;OL.humanAmt=0;OL.humanTarget=0;OL.ghostUntil=-9;
  const outs=OL.outputs,air=OL.air;OL.outputs=[];OL.air=null;
  if(!ctx)return;
  const t=ctx.currentTime;
  outs.forEach(o=>o.gate.gain.setTargetAtTime(0,t,.03));
  if(air)[air.wg,air.hg,air.sg,air.hm].forEach(g=>g.gain.setTargetAtTime(0,t,.05));
  setTimeout(()=>{
    outs.forEach(o=>o.nodes.forEach(n=>n.disconnect()));
    if(air){air.sources.forEach(s=>{try{s.stop();}catch(e){}});air.nodes.forEach(n=>n.disconnect());}
  },400);
}

const P11={
  id:'olympus',num:'11',title:'SECURITY',stepSeconds:60/(40*16),vinyl:false,seed:11,
  style:'Martian machine chatter',key:'Four-screen eye array',readLabels:['UNIT','STATE'],
  blurb:'Mars, 3029. Four screens on a crater rim wake when something approaches. They open their eyes, throw data at each other, become one face, one giant eye, and corrupt each other before they sleep.',
  maths:'Each screen is an agent with its own throat: pitch, formant scale, ring modulation and pupil. Packets, a scan beam and a waveform are drawn in wall coordinates, so they cross the seams between screens. The score moves from turn-taking to crosstalk, a shared face, a unison chord and a clockwise canon.',
  sound:'Formant-synth babble through a screaming comb loop, feedback howls, modem chatter, buffer-repeat glitches, and the DIALOGUE voices chopped, reversed and squeezed through a radio band between squelches.',
  sections:olSections,
  monitors:olWindows,
  modules:[
    {id:'clock',title:'CLOCK',sub:'',h:200,nodes:P1.modules[0].nodes,wires:P1.modules[0].wires},
    ...olUnits.map(unit=>({
      id:unit.id,title:unit.title.toUpperCase(),voice:unit.id,sub:'',h:156,
      nodes:[['in','obj',8,10,'receive packet'],['tg','tgl',260,10],['say','obj',8,45,'babble~ '+unit.pitch],['send','obj',149,45,'send packet'],
        ['eye','obj',8,80,'eye / mouth'],['out','obj',8,118,'s~ '+unit.id]],
      wires:[['in','say'],['say','send'],['say','eye'],['eye','out',1]]
    })),
    {id:'air',title:'MARS AIR',voice:'air',sub:'',h:120,
      nodes:[['wind','obj',8,10,'noise~ wind'],['tg','tgl',260,10],['ping','obj',8,45,'radar ping'],['out','obj',8,80,'s~ air']],
      wires:[['wind','out',1],['ping','out',1]]},
    {id:'out',title:'DAC~',sub:'',h:165,
      nodes:[['a','obj',8,10,'r~ units'],['b','obj',132,10,'r~ air'],['sum','obj',8,54,'+~'],['dac','obj',8,112,'dac~']],
      wires:[['a','sum',1],['b','sum',1],['sum','dac',1]]}
  ],
  cables:[['phobos.send','deimos.in'],['deimos.send','hellas.in'],['hellas.send','tharsis.in'],['tharsis.send','phobos.in']],
  mix:[...olUnits.map(u=>u.id),'air'],
  mixDef:{
    phobos:{on:true,type:'tube',drv:.3,mix:1,rev:.14,dly:0},
    deimos:{on:true,type:'tube',drv:.25,mix:1,rev:.16,dly:0},
    tharsis:{on:true,type:'over',drv:.3,mix:1,rev:.18,dly:0},
    hellas:{on:true,type:'tube',drv:.2,mix:1,rev:.14,dly:0},
    air:{on:true,rev:.25,dly:0},
    master:{vol:.3,drv:0,on:true}
  },
  // mastered to -10 LUFS integrated with the MATCH button: limiter gain 0 dB, output trim -3.1 dB
  masterDef:{sat:{on:true,type:'tube',drv:.15,mix:.5},lim:{on:true,gain:0,ceil:-1},lufs:{target:-10,trim:-3.1}},
  // default view: 100% zoom, 16:9 frame, the modules and the four screens in their arranged places
  layoutDef:{
    zoom:1,frame:'landscape',
    modules:{air:{x:731,y:346},clock:{x:-3,y:111},out:{x:462,y:341},tharsis:{x:795,y:166}},
    monitors:{
      phobos: {x:68.5, y:64.3, bw:370,bh:208.125,ratio:16/9},
      deimos: {x:471.3,y:74.6, bw:370,bh:208.125,ratio:16/9},
      tharsis:{x:51.2, y:292.2,bw:370,bh:208.125,ratio:16/9},
      hellas: {x:494.7,y:291.5,bw:370,bh:208.125,ratio:16/9}
    }
  },
  play:olPlay,
  read(){
    const s=OL.speaker;
    return [s>=0?olUnits[s].title:'—',olSections[Math.max(0,OL.stage)].name];
  },
  secLabel:section=>section.desc,
  reset(){
    try{if(localStorage.getItem('ff-security-layout')!=='1'&&typeof videoLayouts!=='undefined'){ // once: forget old screen positions that covered the modules
      Object.keys(videoLayouts).filter(k=>k.startsWith('olympus:')).forEach(k=>delete videoLayouts[k]);
      localStorage.setItem(VIDEO_LAYOUT_KEY,JSON.stringify(videoLayouts));localStorage.setItem('ff-security-layout','1');}}catch(e){}
    olLoadPhotos();olShuffleDeck();OL.earlyShown=0;
    if(typeof MIXST!=='undefined'&&MIXST.olympus?.olv!==3){MIXST.olympus={olv:3};try{localStorage.setItem('ff-patch-mix',JSON.stringify(MIXST));}catch(e){}}
    olSilence();
    OL.units=olUnitState();OL.stage=-1;OL.speaker=-1;OL.last=-1;OL.holder=0;
    OL.giant=OL.giantTarget=OL.face=OL.faceTarget=OL.wave=OL.waveTarget=0;OL.faceRow=1;
    OL.beam=null;OL.corruptBase=0;OL.swap=0;OL.rot=0;OL.freeze=false;OL.hud='';OL.mode='dormant';
    if(!OL.frame)OL.frame=requestAnimationFrame(olAnimate);
  },
  onStop:olSilence,
  jump(){olSilence();OL.stage=-1;}
};
