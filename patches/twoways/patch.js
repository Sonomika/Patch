/* =================== PATCH 05: TWO WAYS ROOM (replaces the old PALINDROME) ===================
   The 80-second palindrome from the Two Ways Room video, played as a tape. The left ear plays the track forwards,
   the right ear the same track reversed, so the mono sum is its own mirror. 96 BPM, 32 bars = 512 sixteenth steps
   of 0.15625 s, exactly 80 s.
   The TIMELINE screen is a deck: a lever sends the tape forwards, backwards, or bouncing between the two ends, and the
   timeline itself can be grabbed and scratched in either direction. The ROOM screen shows every hit as a small galaxy
   that gathers before the hit exactly as it spreads after it, so the picture reads the same both ways. */
// the track is already mastered, so it goes into the app's soft-clipping master quietly (where the clip is almost a
// straight line) and the clean output trim brings it back up: no added glue, saturation or limiter push
const TW_GAIN=.13;
// one sixteenth of the TAPE is always 0.15625 s of the track; the SPEED setting shortens the real time per step
// (and raises the pitch, like a tape deck)
const TW_SD=60/96/4,TW_SPEEDS=[4,2,1,.5];
const TW_T=80,TW_URL='patches/twoways/audio/two-ways-room.mp3';
try{if(localStorage.getItem('ff-twoways-v')!=='2'){
  const mp=JSON.parse(localStorage.getItem('ff-patch-mpos')||'{}');delete mp['two-ways'];localStorage.setItem('ff-patch-mpos',JSON.stringify(mp));
  const vl=JSON.parse(localStorage.getItem('ff-patch-video-layout')||'{}');delete vl['two-ways:timeline'];localStorage.setItem('ff-patch-video-layout',JSON.stringify(vl));
  localStorage.setItem('ff-twoways-v','2');}}catch(e){}
const TW={buf:null,rev:null,loading:null,err:null,src:null,scr:null,out:null,dir:1,mode:'fwd',scrub:null,anchors:[],views:null,frame:0,lastPos:0};
try{const m=localStorage.getItem('ff-twoways-mode');if(['fwd','rev','bounce'].includes(m))TW.mode=m;}catch(e){}
TW.dir=TW.mode==='rev'?-1:1;
TW.speed=1;try{const v=+localStorage.getItem('ff-twoways-speed');if(TW_SPEEDS.includes(v))TW.speed=v;}catch(e){}


/* ---------- audio ---------- */
function twLoad(){
  if(TW.loading)return TW.loading;
  const dec=ab=>new Promise((res,rej)=>{const oc=new OfflineAudioContext(2,1,44100);const p=oc.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej);});
  TW.loading=fetch(assetURL(TW_URL)).then(r=>{if(!r.ok)throw new Error(TW_URL);return r.arrayBuffer();}).then(dec).then(b=>{
    TW.buf=b;
    const oc=new OfflineAudioContext(b.numberOfChannels,b.length,b.sampleRate),rv=oc.createBuffer(b.numberOfChannels,b.length,b.sampleRate);
    for(let c=0;c<b.numberOfChannels;c++){const s=b.getChannelData(c),d=rv.getChannelData(c),n=s.length;for(let i=0;i<n;i++)d[i]=s[n-1-i];}
    TW.rev=rv;
  }).catch(e=>{TW.err=String(e);});
  return TW.loading;
}
function twOut(){
  if(!TW.out||TW.out.context!==ctx){TW.out=ctx.createGain();TW.out.gain.value=TW_GAIN;TW.out.connect(chan('tape'));}
  return TW.out;
}
// buffer position of a tape position p (seconds into the track) when the tape runs in direction dir
const twOffset=(p,dir)=>{const D=TW.buf.duration;return Math.max(0,Math.min(D-.001,dir>0?p:D-p));};
function twKill(S,t){
  if(!S)return;t=Math.max(t,ctx.currentTime);
  S.g.gain.cancelScheduledValues(t);S.g.gain.setTargetAtTime(0,t,.006);
  try{S.src.stop(t+.06);}catch(e){}
}
function twSource(t,p,dir,rate=1){
  const src=ctx.createBufferSource(),g=ctx.createGain();
  src.buffer=dir>0?TW.buf:TW.rev;src.playbackRate.value=rate;
  g.gain.setValueAtTime(0,t);g.gain.setTargetAtTime(1,t,.004);
  src.connect(g);g.connect(twOut());src.start(t,twOffset(p,dir));
  return {src,g,t0:t,p0:p,dir};
}
// keep one source running that is exactly where the transport says the tape is; restart it on a jump, a scrub or a turn
function twEnsure(t,p){
  const S=TW.src;
  if(S&&S.dir===TW.dir&&S.rate===TW.speed&&Math.abs(S.p0+S.dir*S.rate*(t-S.t0)-p)<.03)return;
  twKill(S,t);TW.src=Object.assign(twSource(t,p,TW.dir,TW.speed),{rate:TW.speed});
}
function twSilence(at){
  if(!ctx)return;
  const t=at??ctx.currentTime;
  twKill(TW.src,t);TW.src=null;twKill(TW.scr,t);TW.scr=null;
}

/* ---------- scratching: drag the timeline, the tape follows the hand at the hand's speed, either way ---------- */
function twScratch(pos,v){
  if(!ctx||!TW.buf)return;
  const now=ctx.currentTime,dir=v>=0?1:-1,rate=Math.min(4,Math.abs(v));
  let S=TW.scr;
  if(S){S.pe+=S.dir*S.rate*(now-S.tl);S.tl=now;}
  if(rate<.04){if(S&&!S.quiet){S.g.gain.setTargetAtTime(0,now,.02);S.quiet=true;}return;}
  if(!S||S.dir!==dir||S.quiet||Math.abs(S.pe-pos)>.1){
    twKill(S,now);
    S=TW.scr=Object.assign(twSource(now,pos,dir,rate),{pe:pos,tl:now,rate,quiet:false});
    return;
  }
  S.rate=rate;S.src.playbackRate.setTargetAtTime(rate,now,.015);
}

/* ---------- transport: the tape position, the lever and the ends ---------- */
const twSteps=()=>TOTAL_BARS*16;
function twMode(m){
  TW.mode=m;try{localStorage.setItem('ff-twoways-mode',m);}catch(e){}
  if(m==='fwd')TW.dir=1;else if(m==='rev')TW.dir=-1;
  // backwards from the very start means from the end
  if(!playing&&m==='rev'&&stepIdx<=0)twSeek(TW_T-TW_SD*.5,true);
}
function twSpeed(v){
  const p=twPos();TW.speed=v;P12.stepSeconds=v===1?undefined:TW_SD/v; // 96 BPM at 1×
  try{localStorage.setItem('ff-twoways-speed',String(v));}catch(e){}
  if(!playing)twSeek(p,false);
}
function twSeek(p,show){
  p=Math.max(0,Math.min(TW_T-.001,p));
  stepIdx=Math.max(0,Math.min(twSteps()-1,Math.floor(p/TW_SD)));
  TW.lastPos=p;
  if(!playing&&show){const bar=Math.floor(stepIdx/16),si=secOf(bar);uiStep(bar,stepIdx%16,si,PATCH.sections[si],[]);}
}
// where the tape is right now, for the screens: the latest scheduled step that has started, run on at its speed
function twPos(){
  if(TW.scrub)return TW.scrub.pos;
  if(!playing||!ctx)return TW.lastPos=Math.min(TW_T,stepIdx*TW_SD);
  const now=ctx.currentTime;let a=null;
  for(const x of TW.anchors)if(x.t<=now)a=x;
  if(!a)return TW.lastPos;
  return TW.lastPos=Math.max(0,Math.min(TW_T,a.p+a.dir*(a.rate||1)*Math.min(now-a.t,sd()*1.5)));
}
function twDirNow(){
  if(TW.scrub)return TW.scrub.v>=0?1:-1;
  if(!playing||!ctx)return TW.dir;
  const now=ctx.currentTime;let a=null;for(const x of TW.anchors)if(x.t<=now)a=x;
  return a?a.dir:TW.dir;
}

function twPlay(t,bar,s,S,ui){
  twLoad();
  const last=twSteps()-1;let n=bar*16+s;
  ui.push(['tape.in'],['tape.rd']);
  if(TW.dir<0)ui.push(['tape.rv']);
  // pressed play at the start with the lever on backwards: start from the end instead
  if(TW.dir<0&&n===0&&!TW.src)n=last;
  const p=n*TW_SD;
  if(TW.out&&ctx)TW.out.gain.setTargetAtTime(MUTE.tape?0:TW_GAIN,t,.01);
  if(TW.scrub){twKill(TW.src,t);TW.src=null;}
  else if(TW.buf){twEnsure(t,p);ui.push(['tape.out']);}
  TW.anchors.push({t,p,dir:TW.dir,rate:TW.speed});if(TW.anchors.length>24)TW.anchors.shift();
  // which way the next step goes
  if(TW.mode==='bounce'){if(TW.dir>0&&n>=last)TW.dir=-1;else if(TW.dir<0&&n<=0)TW.dir=1;}
  let next=n+TW.dir;
  if(TW.scrub)next=Math.max(0,Math.min(last,Math.floor(TW.scrub.pos/TW_SD)));
  if(LOOPSI!=null){const st=SEC_START[LOOPSI]*16,en=st+PATCH.sections[LOOPSI].bars*16;
    if(TW.dir<0&&next<st)next=en-1;}
  if(next<0)next=twSteps(); // backwards past the start: the tape runs out, stop
  stepIdx=next-1;           // the engine adds one after this
}

/* ---------- the timeline data ---------- */
const TW_MRMAX=Math.max(...TW_DATA.MR);
// how busy the room is over the loop: every galaxy's glow summed and smoothed, then mirrored (it is a palindrome)
const TW_ACT=(()=>{
  const n=600,a=new Float32Array(n);
  for(const [tc,,s_,g] of TW_DATA.hits){const c=tc/TW_T*(n-1),w=3;
    for(let i=Math.max(0,Math.floor(c-4*w));i<=Math.min(n-1,Math.ceil(c+4*w));i++)a[i]+=s_*(g===0?1.3:1)*Math.exp(-Math.abs(i-c)/w);}
  const b=new Float32Array(n),K=9;
  for(let i=0;i<n;i++){let su=0,ws=0;for(let j=-K;j<=K;j++){const k=i+j;if(k<0||k>=n)continue;const ww=Math.cos(Math.PI*j/(2*K+2))**2;su+=a[k]*ww;ws+=ww;}b[i]=su/ws;}
  for(let i=0;i<n;i++)b[i]=(b[i]+b[n-1-i])/2;
  const so=Array.from(b).sort((p,q)=>p-q),mn=so[Math.floor(n*.04)],mx=so[Math.floor(n*.97)];
  return b.map(v=>Math.max(0,Math.min(1,(v-mn)/(mx-mn||1))));
})();

/* ---------- the ROOM screen ---------- */
function twWindows(){
  return TW.views??=[{id:'room',title:'ROOM',sourceKey:'tape.out',label:'The mirror room: every hit is a small galaxy that gathers before the hit and spreads after it'}].map(v=>{
    const element=document.createElement('section'),canvas=document.createElement('canvas');
    element.className='flock-monitor twoways-window';canvas.className='flock-canvas';
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label',v.label);element.append(canvas);
    // the canvas is WebGL: the original three.js room (room3d.js) draws into it
    return {id:v.id,title:v.title,sourceKey:v.sourceKey,element,canvas};
  });
}
// size a canvas's bitmap to what is actually on screen (the modules are scaled), so it stays sharp at any zoom
function twFit(view){
  const c=view.canvas,dpr=Math.min(2,window.devicePixelRatio||1),r=c.getBoundingClientRect();
  const w=Math.round((r.width||c.clientWidth||320)*dpr),h=Math.round((r.height||c.clientHeight||180)*dpr);
  if(w&&h&&(c.width!==w||c.height!==h)){c.width=w;c.height=h;}
  return [c.width,c.height];
}

/* ---------- the TIMELINE module: a canvas panel inside a normal module, drawn in the modules' own style ---------- */
const TW_DECK_W=780,TW_DECK_H=170;
const TW_MODES=[['rev','◀ back'],['bounce','⇄ bounce'],['fwd','fwd ▶']];
// layout in module units (the patch's 300-wide module space); s converts to canvas pixels
function twDeckLayout(W,H){
  const s=W/TW_DECK_W,pad=8;
  const lever={x:pad,y:pad,w:92,h:TW_DECK_H-pad*2};
  const speed={x:lever.x+lever.w+6,y:pad,w:44,h:TW_DECK_H-pad*2};
  const X0=speed.x+speed.w+18,X1=TW_DECK_W-pad-4;
  return {s,pad,lever,speed,X0,X1,WW:X1-X0,top:pad+14,bot:TW_DECK_H-pad};
}
function twDeckInput(view){
  const c=view.canvas;
  const at=e=>{const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*TW_DECK_W,y:(e.clientY-r.top)/r.height*TW_DECK_H};};
  const zoneOf=e=>{
    const q=at(e),L=twDeckLayout(1,1),lv=L.lever;
    if(q.x>=lv.x&&q.x<=lv.x+lv.w&&q.y>=lv.y&&q.y<=lv.y+lv.h){
      const i=Math.max(0,Math.min(2,Math.floor((q.y-lv.y)/lv.h*3)));return {kind:'lever',mode:TW_MODES[i][0]};}
    const sp=L.speed;
    if(q.x>=sp.x&&q.x<=sp.x+sp.w&&q.y>=sp.y&&q.y<=sp.y+sp.h){
      const i=Math.max(0,Math.min(TW_SPEEDS.length-1,Math.floor((q.y-sp.y)/sp.h*TW_SPEEDS.length)));return {kind:'speed',v:TW_SPEEDS[i]};}
    if(q.x>=L.X0-8&&q.x<=L.X1+8)return {kind:'track',p:Math.max(0,Math.min(TW_T,(q.x-L.X0)/L.WW*TW_T))};
    return null;
  };
  c.addEventListener('pointermove',e=>{
    if(TW.scrub&&TW.scrub.id===e.pointerId){
      const q=at(e),L=twDeckLayout(1,1),p=Math.max(0,Math.min(TW_T-.001,(q.x-L.X0)/L.WW*TW_T));
      const now=performance.now()/1000,dt=Math.max(.008,now-TW.scrub.t);
      const v=(p-TW.scrub.pos)/dt;TW.scrub.v=TW.scrub.v*.5+v*.5;TW.scrub.pos=p;TW.scrub.t=now;
      twScratch(p,TW.scrub.v);twSeek(p,true);
      e.stopPropagation();return;
    }
    const z=zoneOf(e);c.style.cursor=!z?'':z.kind==='track'?'ew-resize':'pointer';
  });
  c.addEventListener('pointerdown',e=>{
    if(e.button>0)return;
    const z=zoneOf(e);if(!z)return;                 // the margins still drag the module
    e.preventDefault();e.stopPropagation();
    if(z.kind==='lever'){twMode(z.mode);return;}
    if(z.kind==='speed'){twSpeed(z.v);return;}
    initAudio();twLoad();
    TW.scrub={id:e.pointerId,pos:z.p,t:performance.now()/1000,v:0};
    try{c.setPointerCapture(e.pointerId);}catch(err){}
    twKill(TW.src,ctx.currentTime);TW.src=null;twSeek(z.p,true);
  });
  const up=e=>{
    if(!TW.scrub||TW.scrub.id!==e.pointerId)return;
    e.stopPropagation();
    const p=TW.scrub.pos;TW.scrub=null;
    if(ctx){twKill(TW.scr,ctx.currentTime);TW.scr=null;}
    twSeek(p,true);
  };
  c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);c.addEventListener('lostpointercapture',up);
}

function twClock(p){p=Math.max(0,p);const m=Math.floor(p/60),s=p-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1);}
function twCss(name,fb){try{return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fb;}catch(e){return fb;}}

function twDrawDeck(view,p,dir){
  const [W,H]=twFit(view),g=view.g,L=twDeckLayout(W,H),s=L.s;
  // the app's own theme colours, so the panel matches the modules in light and dark
  const INK=twCss('--box','#e9e9e7'),ON=twCss('--ink','#1a1a1a'),BG=twCss('--panel','#141414'),DIM=twCss('--dim','#8a8a86'),FAINT=twCss('--cell','#3a3a38'),EDGE=twCss('--edge2','#5a5a58');
  const font=n=>`400 ${Math.round(n*s)}px ${twCss('--mono','ui-monospace, monospace')}`;
  g.setTransform(s,0,0,s,0,0);
  g.fillStyle=BG;g.fillRect(0,0,TW_DECK_W,TW_DECK_H);
  g.textBaseline='middle';
  // the lever: three Pd-style boxes, the chosen one filled
  const lv=L.lever,rowH=lv.h/3;
  TW_MODES.forEach(([m,txt],i)=>{
    const on=m===TW.mode,y=lv.y+i*rowH+2;
    g.fillStyle=on?INK:BG;g.fillRect(lv.x+.5,y+.5,lv.w,rowH-4);
    g.strokeStyle=on?INK:EDGE;g.lineWidth=1;g.strokeRect(lv.x+.5,y+.5,lv.w,rowH-4);
    g.fillStyle=on?ON:INK;g.font=font(14);g.textAlign='center';g.fillText(txt,lv.x+lv.w/2+.5,y+(rowH-4)/2+1);
  });
  // speed: four boxes, the chosen one filled
  const sp=L.speed,sh=sp.h/TW_SPEEDS.length;
  TW_SPEEDS.forEach((v,i)=>{
    const on=v===TW.speed,y=sp.y+i*sh+2;
    g.fillStyle=on?INK:BG;g.fillRect(sp.x+.5,y+.5,sp.w,sh-4);
    g.strokeStyle=on?INK:EDGE;g.lineWidth=1;g.strokeRect(sp.x+.5,y+.5,sp.w,sh-4);
    g.fillStyle=on?ON:INK;g.font=font(13);g.textAlign='center';g.fillText(v===.5?'½×':v+'×',sp.x+sp.w/2+.5,y+(sh-4)/2+1);
  });
  const {X0,X1,WW}=L,X=u=>X0+u/TW_T*WW;
  // GALAXY curve (how busy the room is) and the AUDIO waveform (the mono sum): the forward head lights the upper
  // halves from the left, the reversed ear's head the lower halves from the right
  const span=L.bot-L.top,yA=L.top+span*.2,ampA=span*.12,yW=L.top+span*.7,ampW=span*.26,hl=X(p),hr=X(TW_T-p);
  g.fillStyle=FAINT;g.globalAlpha=.45;for(let i=1;i<SEC_START.length;i++)g.fillRect(X(SEC_START[i]*16*TW_SD)-.5,L.top,1,span);
  g.globalAlpha=1;
  g.strokeStyle=EDGE;g.lineWidth=1;g.setLineDash([2,3]);g.beginPath();g.moveTo(X(TW_T/2),L.top-2);g.lineTo(X(TW_T/2),L.bot);g.stroke();g.setLineDash([]);
  const n=TW_ACT.length,act=u=>{const f=Math.max(0,Math.min(n-1,u/TW_T*(n-1))),i=Math.min(n-2,Math.floor(f)),k=f-i;return TW_ACT[i]*(1-k)+TW_ACT[i+1]*k;};
  const curve=(ua,ub,sg,style,lw)=>{if(ub<=ua)return;g.beginPath();const st=TW_T/500,yy=u=>yA-sg*(1+ampA*act(u));g.moveTo(X(ua),yy(ua));
    for(let u=ua+st;u<ub;u+=st)g.lineTo(X(u),yy(u));g.lineTo(X(ub),yy(ub));g.strokeStyle=style;g.lineWidth=lw;g.stroke();};
  g.lineJoin='round';g.lineCap='round';
  curve(0,TW_T,1,FAINT,1);curve(0,TW_T,-1,FAINT,1);
  curve(0,p,1,INK,1.3);curve(TW_T-p,TW_T,-1,INK,1.3);
  const m=TW_DATA.MR.length,cw=WW/m;
  for(let i=0;i<m;i++){
    const u=(i+.5)/m*TW_T,h=Math.pow(TW_DATA.MR[i]/TW_MRMAX,1.6)*ampW+.4,x=X0+i*cw,w=Math.max(.35,cw-.1);
    g.fillStyle=u<=p?INK:FAINT;g.fillRect(x,yW-h,w,h);
    g.fillStyle=u>=TW_T-p?INK:FAINT;g.fillRect(x,yW,w,h+.3);
  }
  g.strokeStyle=EDGE;g.lineWidth=1;
  g.strokeRect(X0-4.5,yA-ampA-5.5,WW+9,2*ampA+11);g.strokeRect(X0-4.5,yW-ampW-5.5,WW+9,2*ampW+11);
  g.font=font(11);g.fillStyle=DIM;g.textAlign='left';
  g.fillText('galaxy',X0-4,yA-ampA-13);g.fillText('audio',X0-4,yW-ampW-13);
  // the two heads, each with an arrow for the way the tape runs under it
  for(const [hx,d] of [[hl,dir],[hr,-dir]]){
    g.fillStyle=INK;g.fillRect(hx-1,yA-ampA-6,2,yW+ampW+6-(yA-ampA-6));
    const ay=yA-ampA-11;g.beginPath();g.moveTo(hx+d*5,ay);g.lineTo(hx-d*3.5,ay-4);g.lineTo(hx-d*3.5,ay+4);g.closePath();g.fill();
  }
  if(TW.err){g.fillStyle='#ff6b4a';g.textAlign='center';g.font=font(11);g.fillText('track did not load',X0+WW/2,TW_DECK_H/2);}
  else if(!TW.buf){g.fillStyle=DIM;g.textAlign='center';g.font=font(11);g.fillText('loading the tape…',X0+WW/2,yW);}
  g.setTransform(1,0,0,1,0,0);
}

function twAnimate(){
  if(exportFrame)return;
  TW.frame=requestAnimationFrame(twAnimate);
  if(PATCH!==P12||(!TW.views&&!TW.deck))return;
  const p=twPos(),dir=twDirNow();
  if(window.TW_ROOM)for(const v of TW.views??[])if(v.canvas.isConnected)TW_ROOM.draw(v.canvas,p);
  if(TW.deck?.canvas.isConnected)twDrawDeck(TW.deck,p,dir);
}

const P12={
  id:'two-ways',num:'05',title:'PALINDROME',tag:'PALINDROME TAPE · FORWARDS / BACKWARDS DECK · 32 BARS · PATCH 05',bpm:96,vinyl:false,seed:12,
  style:'Palindrome breaks on tape',key:'A deck that runs both ways',readLabels:['TAPE','HEADS'],
  blurb:'The Two Ways Room track on a tape deck. The left ear plays it forwards, the right ear backwards. Throw the lever to run the whole tape backwards, or bounce between the ends, and grab the timeline to scratch it.',
  maths:'An 80-second palindrome, 32 bars of 96 BPM. Reversing the tape swaps the ears, so the mono sum sounds the same both ways. Each hit in the room is a galaxy whose radius grows with the distance in time from its hit, so every frame at time t has a mirror at 80 − t.',
  sound:'One stereo file and its exact reverse, cut against the transport on every sixteenth so a turn of the lever lands on the beat. Dragging the timeline plays the tape at the speed and in the direction of your hand.',
  sections:[{name:'Intro',bars:2,desc:'drone · bells'},{name:'Groove',bars:10,desc:'break · 808 · sub'},{name:'Interlude',bars:4,desc:'the drums stop'},
    {name:'Mirror',bars:4,desc:'0:40 · the ears cross'},{name:'Groove (mirror)',bars:10,desc:'the same, mirrored'},{name:'Outro',bars:2,desc:'bells · drone'}],
  monitors:twWindows,
  nodeCanvas(key,canvas){if(key!=='deck.ui')return;TW.deck={canvas,g:canvas.getContext('2d')};twDeckInput(TW.deck);if(!TW.frame)TW.frame=requestAnimationFrame(twAnimate);},
  modules:[
    {id:'clock',title:'CLOCK',sub:'',h:200,nodes:P1.modules[0].nodes,wires:P1.modules[0].wires},
    {id:'tape',title:'TAPE~',voice:'tape',sub:'',h:156,
      nodes:[['in','obj',8,10,'r position'],['tg','tgl',260,10],['rd','obj',8,45,'readsf~ two-ways-room'],['rv','obj',160,45,'reverse~'],
        ['sw','obj',8,80,'direction ± 1'],['out','obj',8,118,'s~ tape']],
      wires:[['in','rd'],['in','rv'],['rd','sw'],['rv','sw'],['sw','out',1]]},
    {id:'deck',title:'TIMELINE',sub:'',w:TW_DECK_W,h:TW_DECK_H+42,
      nodes:[['ui','canvas',0,4,'',TW_DECK_W,TW_DECK_H],['out','obj',0,TW_DECK_H+16,'s position']],
      wires:[['ui','out']]},
    {id:'out',title:'DAC~',sub:'',h:120,
      nodes:[['a','obj',8,10,'r~ tape'],['dac','obj',8,54,'dac~']],
      wires:[['a','dac',1]]}
  ],
  cables:[['deck.out','tape.in']],
  mix:['tape'],
  mixDef:{tape:{rev:0,dly:0,drv:0}},
  masterDef:{eq:{on:true,lo:0,mid:0,hi:0},glue:{on:false,thr:-18,rat:1.8,mk:1},sat:{on:false,drv:0,mix:1,type:'over'},
    width:{on:false,w:1,bm:120,ug:0},vinyl:{on:false,tone:.35,wow:.25,dust:.18},lim:{on:true,gain:0,ceil:-1},lufs:{target:-10,trim:12.3}},
  layoutDef:{
    zoom:1,frame:'landscape',
    modules:{clock:{x:10,y:16},tape:{x:10,y:236},deck:{x:376,y:352},out:{x:10,y:412}},
    monitors:{room:{x:372,y:18,bw:520,bh:292.5,ratio:16/9}}
  },
  play:twPlay,
  read(){const p=twPos();return [twClock(p),twClock(TW_T-p)];},
  secLabel:section=>section.desc,
  reset(){
    // once: drop mixer settings saved before this patch had its own clean master
    if(typeof MIXST!=='undefined'&&MIXST['two-ways']?.twv!==1){MIXST['two-ways']={twv:1};try{localStorage.setItem('ff-patch-mix',JSON.stringify(MIXST));}catch(e){}}
    P12.stepSeconds=TW.speed===1?undefined:TW_SD/TW.speed;
    twLoad();twSilence();TW.anchors=[];TW.scrub=null;TW.dir=TW.mode==='rev'?-1:1;
    if(!TW.frame)TW.frame=requestAnimationFrame(twAnimate);
  },
  onStop(at){twSilence(at);TW.anchors=[];},
  jump(){TW.anchors=[];}
};
