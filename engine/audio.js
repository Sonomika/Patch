function secOf(bar){let i=0;for(let k=0;k<SEC_START.length;k++)if(bar>=SEC_START[k])i=k;return i;}

/* =================== AUDIO (sines only) =================== */
let ctx=null,master,bus={},playing=false,nextT=0,stepIdx=0,timer=null,x=.5,fibN=0,collatz=27,collatzSeed=27,percN=1,analyser;
function initAudio(){
  if(ctx)return;ctx=new (window.AudioContext||window.webkitAudioContext)();
  master=ctx.createGain();master.gain.value=.8;
  const clip=ctx.createWaveShaper();const c=new Float32Array(1024);for(let i=0;i<1024;i++){const v=i/511.5-1;c[i]=Math.tanh(v*2.6)/Math.tanh(2.6);}clip.curve=c;
  analyser=ctx.createAnalyser();analyser.fftSize=1024;
  MDRV=ctx.createGain();master.connect(MDRV);MST.build(MDRV,clip);MST.trim=ctx.createGain();clip.connect(MST.trim);MST.trim.connect(analyser);analyser.connect(ctx.destination);LUFS.tap(MST.trim);
  ['drums','low','hats','fx'].forEach(n=>{bus[n]=ctx.createGain();});
  bus.drums.gain.value=.95;bus.low.gain.value=.8;bus.hats.gain.value=.35;bus.fx.gain.value=.55;
  // delay 3/16 with feedback, then a reverb built from a decaying noise impulse
  // Two delay lines. A time change never moves a line that is still ringing (that is what pitch-warps the echoes):
  // new sends switch to the idle line set to the new time, and the old line's tail fades out on its own.
  // Delay modes (from Fourfold FM): digital, tape echo, multi-head, ping-pong, dub. Each line has three heads (1×, 2×, 3× the time;
  // the extra heads only sound in multi-head), then low-pass, high-pass and a saturator inside the feedback loop, with wow and flutter
  // on the delay times. The loop swaps left and right on every pass, so a sound fed to the left only bounces side to side (ping-pong).
  const dlo=ctx.createGain(),G=v=>{const x=ctx.createGain();x.gain.value=v;return x;};bus.dlyIn=ctx.createGain();bus.dlo=dlo;
  bus.wowG=G(0);bus.flG=G(0);[[.55,bus.wowG],[6.3,bus.flG]].forEach(([hz,gn])=>{const o=ctx.createOscillator();o.frequency.value=hz;o.connect(gn);o.start();});
  bus.lines=[0,1].map(()=>{const inG=G(0),mono=G(1),gst=G(1),gpp=G(0),mg=ctx.createChannelMerger(2),d=ctx.createDelay(8),d2=ctx.createDelay(8),d3=ctx.createDelay(8),h2=G(0),h3=G(0),
      l=ctx.createBiquadFilter(),hp=ctx.createBiquadFilter(),si=G(.5),sh=ctx.createWaveShaper(),so=G(1),f=G(.4),feedback=G(1),spl=ctx.createChannelSplitter(2),sw=ctx.createChannelMerger(2);
    mono.channelCount=1;mono.channelCountMode='explicit';l.type='lowpass';l.Q.value=-3;l.frequency.value=3200;hp.type='highpass';hp.Q.value=-3;hp.frequency.value=20;sh.curve=loopCurve(0);
    bus.dlyIn.connect(inG);inG.connect(gst);gst.connect(d);gst.connect(d2);gst.connect(d3);inG.connect(mono);mono.connect(gpp);gpp.connect(mg,0,0);mg.connect(d);
    d.connect(l);d2.connect(h2);h2.connect(l);d3.connect(h3);h3.connect(l);l.connect(hp);hp.connect(si);si.connect(sh);sh.connect(so);so.connect(dlo);
    so.connect(f);f.connect(feedback);feedback.connect(spl);spl.connect(sw,0,1);spl.connect(sw,1,0);sw.connect(d);
    [d,d2,d3].forEach(x=>{bus.wowG.connect(x.delayTime);bus.flG.connect(x.delayTime);});
    return {d,d2,d3,h2,h3,l,hp,si,sh,so,gst,gpp,f,feedback,inG};});
  bus.dAn=ctx.createAnalyser();bus.dAn.fftSize=512;
  const delayEq=connectChannelEq(dlo,master);
  delayEq.hi.connect(bus.dAn);STR.dret={eq:delayEq,an:bus.dAn,buf:new Float32Array(512)};
  bus.active=0;bus.lines[0].inG.gain.value=1;bus.dTime=-1;
  bus.revIn=ctx.createGain();dlo.gain.value=.6;
  const rv=ctx.createConvolver(),len=ctx.sampleRate*2.4,ir=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);}
  bus.revReturn=ctx.createGain();
  const preDelay=ctx.createDelay(.3),damping=ctx.createBiquadFilter();
  damping.type='lowpass';damping.Q.value=.707;
  bus.reverbRoom={input:preDelay,convolver:rv,impulse:ir};
  bus.revDamping=damping;
  bus.revReturn.connect(damping);
  const revMeter=ctx.createAnalyser();revMeter.fftSize=512;
  const reverbEq=connectChannelEq(buildReverbMotion(damping),master);
  reverbEq.hi.connect(revMeter);
  STR.rret={eq:reverbEq,an:revMeter,buf:new Float32Array(512)};
  rv.buffer=ir;const rvo=ctx.createGain();rvo.gain.value=.55;bus.delayToReverb=G(.25);dlo.connect(bus.delayToReverb);bus.delayToReverb.connect(preDelay);bus.revIn.connect(preDelay);preDelay.connect(rv);rv.connect(rvo);rvo.connect(bus.revReturn);applyStrip('dret');applyStrip('rret');
  ['drums','low','hats','fx'].forEach(n=>bus[n].connect(strip(n).in));applyStrip('vinylNoise');applyMaster();

}
const sd=()=>PATCH.stepSeconds??60/PATCH.bpm/4;
/* =================== MIXER ===================
   Every sound goes through a channel strip: input → drive (soft tanh, gain-compensated) → pan → fader → mute → master,
   with delay and reverb sends after the fader and a meter tap. Patches name the strips they use in P.mix; settings are
   kept per song. A song can set a default drive (P.drive). */
let MDRV=null;
/* MASTERING: a device chain after the master fader:
   EQ → GLUE (bus compressor) → SATURATE → WIDTH (mid/side) → LIMIT, then the old soft clip and the speakers.
   Each device can be switched off (it then passes the sound untouched). Settings are kept per song. */
function mstState(){const P=PATCH.id;MIXST[P]=MIXST[P]||{};if(!MIXST[P].mst&&PATCH.masterDef)MIXST[P].mst=structuredClone(PATCH.masterDef);if(!MIXST[P].mst){const o={};MST_DEV.forEach(d=>{o[d.id]={on:true};d.p.forEach(([k,,, ,def])=>o[d.id][k]=def);});MIXST[P].mst=o;}const S=MIXST[P].mst;S.lufs=S.lufs||{target:-10,trim:0};MST_DEV.forEach(d=>{S[d.id]=S[d.id]||{on:true};d.p.forEach(([k,,, ,def])=>{if(S[d.id][k]==null)S[d.id][k]=def;});if(d.sel&&S[d.id][d.sel[0]]==null)S[d.id][d.sel[0]]=d.sel[3];});return S;}
function syncChain(){if(mixerSelection!=='master')return;const S={...mstState(),drive:mixState('master')};document.querySelectorAll('#mchain .mdev[data-d] input').forEach(inp=>{const id=inp.closest('.mdev').dataset.d,v=S[id][inp.dataset.k];if(+inp.value!==v){inp.value=v;inp.dispatchEvent(new Event('sync'));}});
  const t=$('lufsTrim');if(t){t.value=S.lufs.trim;t.nextElementSibling.textContent=(S.lufs.trim>0?'+':'')+S.lufs.trim.toFixed(1)+' dB';}}
function routeEffects(chain,order){
  if(chain.order?.every((id,i)=>id===order[i])&&chain.order.length===order.length)return;
  for(const [from,to] of chain.links??[])from.disconnect(to);
  chain.links=[];
  let from=chain.input;
  for(const id of order){
    const [input,output]=chain.devices[id];
    from.connect(input);chain.links.push([from,input]);
    from=output;
  }
  from.connect(chain.output);chain.links.push([from,chain.output]);
  chain.order=order;
}
const MST={n:{},build(src,dst){const c=ctx,n=this.n,g=()=>c.createGain();
    const dev=(id,inN,outN)=>{const i=g(),o=g(),dry=g(),wet=g();i.connect(dry);dry.connect(o);i.connect(inN);outN.connect(wet);wet.connect(o);n[id]={i,o,dry,wet};return n[id];};
    const eq=buildThreeBandEq(c);
    Object.assign(dev('eq',eq.lo,eq.hi),eq);
    buildGlue(c,g,dev);
    const sh=c.createWaveShaper(),sp=g(),dcb=c.createBiquadFilter();dcb.type='highpass';dcb.frequency.value=8;sh.oversample='4x';sh.connect(sp);sp.connect(dcb);dev('sat',sh,dcb);Object.assign(n.sat,{sh,sp});
    buildStereoUtility(c,g,dev);
    const vinyl=buildVinyl(c);
    Object.assign(dev('vinyl',vinyl.input,vinyl.output),vinyl);
    buildLimiter(c,g,dev);
    this.chain={input:src,output:dst,devices:Object.fromEntries(MST_DEV.map(({id})=>[id,[n[id].i,n[id].o]]))};
    this.ok=true;this.apply();},
  apply(){if(!this.ok)return;const S=mstState(),n=this.n,t=ctx.currentTime,set=(p,v)=>p.setTargetAtTime(v,t,.03),db=x=>Math.pow(10,x/20);
    routeEffects(this.chain,effectOrder('master',MST_DEV.map(d=>d.id)));
    MST_DEV.forEach(d=>{
      const enabled=S[d.id].on&&(d.id!=='vinyl'||PATCH.vinyl!==false);
      set(n[d.id].wet.gain,enabled?1:0);
      set(n[d.id].dry.gain,enabled?0:1);
    });
    set(n.vinyl.rolloff.frequency,15000*Math.pow(.31,S.vinyl.tone));
    set(n.vinyl.wow.gain,.0025*S.vinyl.wow);
    set(n.vinyl.flutter.gain,.00022*S.vinyl.wow);
    applyVinylNoise(S.vinyl);
    set(n.eq.lo.gain,S.eq.lo);set(n.eq.mid.gain,S.eq.mid);set(n.eq.hi.gain,S.eq.hi);
    // Web Audio compressors add their own automatic makeup gain (0.6 × the reduction at full scale): take it back out,
    // so MAKEUP and GAIN are the only level changes
    const auto=(th,ra)=>-.6*th*(1-1/ra);
    set(n.glue.cmp.threshold,S.glue.thr);set(n.glue.cmp.ratio,S.glue.rat);set(n.glue.mk.gain,db(S.glue.mk-auto(S.glue.thr,S.glue.rat)));
    applySaturation(n.sat,S.sat,t);
    const w=S.width.w;n.width.xo.forEach(f=>set(f.frequency,S.width.bm??120));set(n.width.ug.gain,db(S.width.ug??0));set(n.width.ll.gain,(1+w)/2);set(n.width.rr.gain,(1+w)/2);set(n.width.lr.gain,(1-w)/2);set(n.width.rl.gain,(1-w)/2);
    if(this.trim)set(this.trim.gain,db(S.lufs.trim));
    set(n.lim.lg.gain,db(S.lim.gain));set(n.lim.lim.threshold,S.lim.ceil);set(n.lim.lpost.gain,db(-auto(S.lim.ceil,20)));}};const STR={};const MIXNAME={rain:'RAIN',pad:'PAD',ribbon:'RIBBON',thunder:'THUNDER',perc:'PERCUSSION',drums:'DRUMS',low:'BASS',hats:'HATS',fx:'SYNTHS',ears:'EARS',acidA:'ACID 1',acidB:'ACID 2',brk:'BREAK',noise:'NOISE',vox:'VOX',vinylNoise:'VINYL',rret:'A',dret:'B',drone:'DRONE',birds:'BIRDS',bells:'BELLS',air:'AIR',master:'MASTER'};
let MIXST={};try{MIXST=JSON.parse(localStorage.getItem('ff-patch-mix')||'{}')||{};}catch(e){}
const mixIds=()=>PATCH.mix||['drums','low','hats','fx'];
function mixState(id){
  const channels=MIXST[PATCH.id]??={};
  const defaults=id==='master'?{vol:.8,drv:0}:id==='dret'?{vol:1,drv:0,mode:'tape'}:
    {vol:1,pan:0,drv:id==='vox'?.15:PATCH.drive||0,dly:0,rev:id==='vox'?.35:0,mute:false};
  const patchDefaults=PATCH.mixDef?.[id]??{};
  const state=channels[id]??={};
  for(const [key,value] of Object.entries({...defaults,...patchDefaults})){
    if(state[key]==null)state[key]=structuredClone(value);
  }
  return state;
}
function channelEqState(id){
  const eq=mixState(id).eq??={};
  eq.on??=true;
  eq.lo??=0;
  eq.mid??=0;
  eq.hi??=0;
  return eq;
}
let mixSaveT=0;const saveMix=()=>{clearTimeout(mixSaveT);mixSaveT=setTimeout(()=>{try{localStorage.setItem('ff-patch-mix',JSON.stringify(MIXST));}catch(e){}},300);};

function strip(id){if(STR[id])return STR[id];
  const S={in:ctx.createGain(),sh:ctx.createWaveShaper(),sp:ctx.createGain(),pan:ctx.createStereoPanner(),fad:ctx.createGain(),mute:ctx.createGain(),dly:ctx.createGain(),rev:ctx.createGain(),an:ctx.createAnalyser()};
  S.sh.oversample='4x';S.an.fftSize=512;S.buf=new Float32Array(512);S.pk=0;
  S.sh.connect(S.sp);S.eq=buildThreeBandEq(ctx);
  S.chain={input:S.in,output:S.pan,devices:{drive:[S.sh,S.sp],eq:[S.eq.lo,S.eq.hi]}};
  stripIdsByInput.set(S.in,id);
  S.dry=ctx.createGain();S.pan.connect(S.fad);S.fad.connect(S.mute);S.mute.connect(S.dry);S.dry.connect(master);
  S.mute.connect(S.dly);S.dly.connect(bus.dlyIn);S.mute.connect(S.rev);S.mute.connect(S.an);STR[id]=S;applyStrip(id);return S;}
function applyStrip(id){if(id==='master')return applyMaster();const S=STR[id];if(!S||!ctx)return;const st=mixState(id),t=ctx.currentTime;
  const eq=channelEqState(id);
  for(const band of ['lo','mid','hi'])S.eq[band].gain.setTargetAtTime(eq.on?eq[band]:0,t,.02);
  if(id==='dret')return applyDelay();
  if(id==='rret')return applyReverbReturn();
  if(id==='vinylNoise')return applyVinylNoise();
  routeEffects(S.chain,effectOrder(id,['drive','eq']));
  const reverb=PATCH===P9&&(id==='rain'||id==='pad'||id==='ribbon')?drizzleReverb():bus.revIn;
  if(S.reverb!==reverb){
    if(S.reverb)S.rev.disconnect(S.reverb);
    S.rev.connect(reverb);
    S.reverb=reverb;
  }
  const type=st.type??"over",mix=st.mix??1;
  if(st.on===false||mix===0||(st.drv===0&&type==="over")){
    if(S.curveKey!==null){S.sh.curve=null;S.curveKey=null;}
    S.sp.gain.setTargetAtTime(1,t,.03);
  }else applySaturation(S,{drv:st.drv,type,mix},t);
  S.dry.gain.setTargetAtTime(!mixerSolos.size||mixerSolos.has(id)?1:0,t,.02);
  for(const gate of Object.values(S.directSends??{}))gate.gain.setTargetAtTime(soloSource(id)?1:0,t,.02);
  S.pan.pan.setTargetAtTime(st.pan,t,.02);S.fad.gain.setTargetAtTime(st.vol,t,.02);S.mute.gain.setTargetAtTime(st.mute||!soloSource(id)?0:1,t,.02);S.dly.gain.setTargetAtTime(st.dly,t,.02);S.rev.gain.setTargetAtTime(st.rev,t,.02);}
function applyMaster(){if(!ctx||!MDRV)return;MST.apply();const st=mixState('master'),t=ctx.currentTime;master.gain.setTargetAtTime(st.vol,t,.02);MDRV.gain.setTargetAtTime(1+(st.on===false?0:st.drv)*3,t,.02);}
const chan=id=>strip(id).in;
// Wavefolder: a sine pushed through sin(3πx). The pre-gain (fold amount) is the parameter lock:
// 0 leaves a pure sine, 1 folds it into bright, buzzy harmonics. Then a tanh drive.
let FOLDC=null,DRVC=null;const CRUSH={};
function crushCurve(n){if(CRUSH[n])return CRUSH[n];const N=2048,c=new Float32Array(N);for(let i=0;i<N;i++){const v=i/(N-1)*2-1;c[i]=Math.round(v*n)/n;}return CRUSH[n]=c;}
function shapers(){if(FOLDC)return;const n=2048;FOLDC=new Float32Array(n);DRVC=new Float32Array(n);for(let i=0;i<n;i++){const v=i/(n-1)*2-1;FOLDC[i]=Math.sin(3*Math.PI*v);DRVC[i]=Math.tanh(v*4);}}
function sine(f,t,dur,peak,dest,opts={}){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=opts.wave||'sine';o.frequency.setValueAtTime(opts.f0||f,t);
  if(opts.periodicWave)o.setPeriodicWave(opts.periodicWave);
  if(opts.f0)o.frequency.exponentialRampToValueAtTime(f,t+(opts.drop||.05));
  if(opts.fm){const m=ctx.createOscillator(),mg=ctx.createGain();m.type='sine';m.frequency.value=f*opts.fm.ratio;mg.gain.value=opts.fm.index;
    if(opts.fm.decay)mg.gain.setTargetAtTime(0,t,opts.fm.decay);
    m.connect(mg);mg.connect(o.frequency);m.start(t);m.stop(t+dur+.05);}
  const a=opts.atk||.002;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);
  if(opts.holdUntil>a&&opts.holdUntil<dur)g.gain.setValueAtTime(peak,t+opts.holdUntil);
  g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(a+.01,dur));
  let src=o;
  if(opts.fold>0||opts.drive>0){shapers();
    const pre=ctx.createGain();pre.gain.value=(1+(opts.fold||0)*5)/6;const fw=ctx.createWaveShaper();fw.curve=FOLDC;fw.oversample='4x';o.connect(pre);pre.connect(fw);src=fw;
    if(opts.drive>0){const dg=ctx.createGain();dg.gain.value=.25+opts.drive*.75;const dw=ctx.createWaveShaper();dw.curve=DRVC;dw.oversample='2x';const comp=ctx.createGain();comp.gain.value=1/(1+opts.drive*.6);src.connect(dg);dg.connect(dw);dw.connect(comp);src=comp;}}
  // effect locks for this one hit: bit crush, a low-pass filter, delay send and reverb send
  if(opts.crush>.02){const cw=ctx.createWaveShaper();cw.curve=crushCurve([32,16,8,5,3][Math.min(4,Math.floor(opts.crush*5))]);src.connect(cw);src=cw;fxMax('crush',opts.crush);}
  src.connect(g);let out=g;
  if(opts.cut!=null&&opts.cut<.98){const lp=ctx.createBiquadFilter();lp.type='lowpass';const f0=80*Math.pow(200,opts.cut);lp.frequency.value=f0;lp.Q.value=2+opts.cut*4;
    if(opts.sweep){const [pk,q]=opts.sweep,f1=80*Math.pow(200,pk);lp.Q.value=q;lp.frequency.setValueAtTime(f0,t);lp.frequency.exponentialRampToValueAtTime(f1,t+dur*.45);lp.frequency.exponentialRampToValueAtTime(f0,t+dur);}
    g.connect(lp);out=lp;fxMax('filter',1-opts.cut);}
  out.connect(dest);
  if(opts.dly>.01){const sg=ctx.createGain();sg.gain.value=opts.dly;out.connect(sg);sendToReturn(sg,dest,'dlyIn');fxMax('delay',opts.dly);}
  if(opts.rev>.01){const rg=ctx.createGain();rg.gain.value=opts.rev;out.connect(rg);sendToReturn(rg,dest,'revIn');fxMax('reverb',opts.rev);}
  o.start(t);o.stop(t+dur+.05);
  if(opts.pan!=null&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=opts.pan;out.disconnect(dest);out.connect(p);p.connect(dest);}
  return o;
}
const LOCKV=['kick','bass','hat','perc','lead'],LOCKS=LOCKV.map(()=>new Array(16).fill(0));
let PATCH=P1,SEC_START=[],TOTAL_BARS=0;
function setLock(v,s,val){LOCKS[LOCKV.indexOf(v)][s]=val;}
const FXV=['dly','time','fdbk','rev','filt','crsh'],FXL=FXV.map(()=>new Array(16).fill(0));
function returnDevice(id){return RETURN_DEVICES[id];}
function returnSettings(id,device=returnDevice(id)){
  const state=mixState(id);
  state.on??=true;
  if(id==='rret'&&!Number.isFinite(state.decay)){
    state.decay=state.decay==='short'?.5:state.decay==='long'?1.5:1;
  }
  for(const [key,,,value] of device.selects??[device.sel])state[key]??=value;
  for(const [key,,,,value] of device.p){
    if(key!=='timeMs'&&key!=='feedbackAmount')state[key]??=value;
  }
  if(id==='dret'){
    state.timeScale??=1;
    state.feedback??=1;
  }
  return state;
}
let fxStep=null;function fxMax(k,v){if(fxStep)fxStep[k]=Math.max(fxStep[k]||0,v);}
// F minor, the classic techno key. Bass and percussion use its pentatonic (F Ab Bb C Eb), lead and pad the full scale.
const MINP=[0,3,5,7,10],MINOR=[0,2,3,5,7,8,10],ROOT=29; // F1 = 43.65 Hz
const psc=d=>MINP[((d%5)+5)%5]+12*Math.floor(d/5),msc=d=>MINOR[((d%7)+7)%7]+12*Math.floor(d/7); // degree → semitones across octaves
const euclideanHit = (hits, steps, rotation, step) =>
  hits > 0 && (((step + rotation) % steps + steps) % steps * hits) % steps < hits;
function step(t){
  if(LOOPSI!=null){const st=SEC_START[LOOPSI]*16,en=st+PATCH.sections[LOOPSI].bars*16;if(stepIdx>=en||stepIdx<st)stepIdx=st;} // loop one section
  const bar=Math.floor(stepIdx/16),s=stepIdx%16;
  if(bar>=TOTAL_BARS){stopAt(t);return;}
  const si=secOf(bar),S=PATCH.sections[si],ui=[['clock.metro']];
  fxStep={};PATCH.play(t,bar,s,S,ui);ui.push(['out.dac']);if(fxStep.delay)ui.push(['out.dl']);if(fxStep.reverb)ui.push(['out.rv']);
  const showT=t,P=PATCH;setTimeout(()=>{if(PATCH===P)uiStep(bar,s,si,S,ui);},Math.max(0,(showT-ctx.currentTime)*1000));
  stepIdx++;
}
/* ---- patch 01: the old engine, now the patch's own play function ---- */
P1.play=function(t,bar,s,S,ui){
  const V=S.v,on=k=>V[k]&&!MUTE[k];
  x=ov('logistic.rn',S.r)*x*(1-x);if(x<=0||x>=1)x=.5;
  // delay time is locked once per bar (Fibonacci of the bar mod 5); feedback is locked per step from the chance value
  const ti=fibMod(bar+3,5),fbv=.25+.4*x;
  if(s===0||bus.dTime<0)setDelayTime(DTIMES[ti]*4*sd(),t);
  setDelayFeedback(fbv,t,.02);
  ui.push(['logistic.expr']);
  // kick: four on the floor, pitch-dropping sine
  // kick: four on the floor plus chaos kicks; steps that are Fibonacci numbers get a heavy fold lock
  const fibStep=[1,2,3,5,8,13].includes(s);
  if(on('kick')&&(s%4===0||(x>.93&&s%4===3))){
    // 909-style: a sine falling fast from 210 Hz to 50 Hz, a short FM click on top, no folding (folding is what made it
    // sound high). The lock on Fibonacci steps is drive and length now: a fatter, longer kick, still low.
    const lk=fibStep?.5+.4*x:.12+.12*x,ghost=s%4!==0;setLock('kick',s,lk);
    sine(43.65,t,(ghost?.24:.5)+.12*lk,ghost?.3:.5,bus.drums,{f0:185,drop:.034,atk:.001,drive:.18+.35*lk});
    sine(1400,t,.009,(ghost?.06:.11),bus.drums,{fm:{ratio:2.71,index:2600},atk:.0005});
    ui.push(['kick.b'],['kick.osc'],['kick.fold']);}
  // rumble: sub sine after the kick, ducked by it
  if(on('rumble')&&[2,3,6,7,10,11,14,15].includes(s)){sine(43.65,t,sd()*1.4,.28,bus.low,{atk:.01,cut:.25+.25*x});ui.push(['rumble.env']);}
  // bass: chance from the logistic map, pitch from Fibonacci mod 5
  if(on('bass')&&s%4!==0&&x>.38){fibN++;const deg=fibMod(fibN,5),f=440*Math.pow(2,(ROOT+12+MINP[deg]+(deg===4&&x>.9?12:0)-69)/12);
    const fl=Math.min(1,x*x*1.1);setLock('bass',s,fl);sine(f,t,sd()*(x>.8?2.2:1.2),.5,bus.low,{atk:.004,fold:fl,drive:.35+.5*x,cut:.3+.65*x,dly:x>.9?.3:0,crush:fibStep&&x>.85?.5:0});ui.push(['bass.fold'],['bass.fib'],['bass.osc'],['num','bass.fn',String(fib(Math.min(fibN,60))).slice(-5)],['num','bass.deg',String(deg)],['num','bass.hz',f.toFixed(1)]);}
  // hat: offbeats always, other 16ths when chance is high; sine FM sine
  // hats build by Fibonacci numbers: 3, 5, 8, then 13 per bar, spread evenly (Euclid); they brighten across each section
  {const bi=bar-SEC_START[PATCH.sections.indexOf(S)],hc=S.hc[Math.min(bi,S.hc.length-1)],prog=(bi+s/16)/S.bars,openOn=bi>=S.oh&&s%4===2;
   if(on('hat')&&openOn){setLock('hat',s,1);hatHit(t,.22+.12*x,.42,.15,5600-1400*prog,true);ui.push(['hat.b'],['hat.car']);}
   else if(on('hat')&&hc&&euclideanHit(hc,16,hc===3||hc===5?2:0,s)){const acc=s%4===2,lv=(acc?.45:s%2?.2+.15*x:.3)*(.75+.25*prog);setLock('hat',s,lv/.45);
     hatHit(t,acc?.05:.03,lv,acc?-.1:(s%8<4?-.3:.3)*(.4+x),7200-1800*prog,false);ui.push(['hat.b'],['hat.car']);}
   else setLock('hat',s,0);}
  // prime percussion: prime-numbered steps, tuned by the golden ratio
  if(on('perc')&&PRIMES.includes(s)&&(x>.4||s===2)){percN++;const fr=(percN*PHI)%1,f=440*Math.pow(2,(65+psc(Math.floor(fr*10))-69)/12);setLock('perc',s,fr);sine(f,t,.07+.06*fr,.32,bus.fx,{pan:fr*1.6-.8,fold:fr,drive:.4,dly:fr*.7,rev:.25+.3*fr,crush:fr>.8?.8:0});ui.push(['perc.phi'],['perc.osc'],['perc.fold'],['num','perc.pn',fr.toFixed(3)]);}
  // pad: three sines in just intonation, one chord per bar from fib(bar) mod 4
  // pad: five sines stacked in thirds up to the 9th: Fm9, Dbmaj9, Eb9, Bbm9
  if(on('pad')&&s===0){const rootDeg=[0,5,6,3][fib(bar)%4];[0,2,4,6,8].map(k=>msc(rootDeg+k)).forEach((st,k)=>sine(440*Math.pow(2,(53+st-69)/12),t,sd()*16*.98,[.1,.075,.06,.075,.07][k],bus.fx,{atk:sd()*(5+k),pan:[0,-.5,.5,-.3,.3][k],rev:.7,dly:k>2?.3:.15,cut:.22+.02*rootDeg,sweep:[Math.min(.95,.5+.4*x+.03*k),5+6*x]}));ui.push(['pad.o1'],['pad.o2'],['pad.o3'],['num','pad.rn',String(rootDeg)]);}
  // lead: Collatz walk when chance is high
  if(on('lead')&&x>.55&&s%2===0){collatz=collatz%2?3*collatz+1:collatz/2;if(collatz===1){collatzSeed+=2;collatz=collatzSeed;}
    const n=65+msc(collatz%7)+12*(collatz%3===0),f=440*Math.pow(2,(n-69)/12);const fl=(collatz%10)/10;setLock('lead',s,fl);sine(f,t,sd()*1.6,.2,bus.fx,{fm:{ratio:2.01,index:f*.6},pan:(collatz%5)/5-.4,fold:fl,drive:.45,dly:.35+(collatz%4)*.12,rev:.35,cut:.4+.5*((collatz%7)/7)});ui.push(['lead.col'],['lead.osc'],['lead.fold'],['num','lead.cn',String(collatz)],['num','lead.hz',f.toFixed(0)]);}
  FXL[0][s]=fxStep.delay||0;FXL[1][s]=(ti+1)/5;FXL[2][s]=fbv;FXL[3][s]=fxStep.reverb||0;FXL[4][s]=fxStep.filter||0;FXL[5][s]=fxStep.crush||0;
};
P1.cables=[['locks.grid','kick.fold'],['locks.grid','bass.fold'],['locks.grid','hat.spig'],['locks.grid','perc.fold'],['locks.grid','lead.fold'],['fxlocks.grid','out.dl'],['fxlocks.grid','out.rv'],['logistic.arr','locks.grid'],['logistic.sx','fxlocks.grid']];
P1.grids={locks:{rows:LOCKV,T:LOCKS},fx:{rows:FXV,T:FXL}};
P1.edit={'logistic.rn':{min:2.5,max:4,step:.01,d:2}};
P1.read=S=>[S.r.toFixed(2),x.toFixed(3)];
P1.secLabel=S=>'r '+S.r;
P1.ui=(bar,s,S)=>{setNum('logistic.rn',S.r.toFixed(2));setNum('logistic.xn',x.toFixed(3));xHist.push(x);xHist.shift();drawArr();};
P1.reset=()=>{SUN.b.fill(0);SUN.rip=[];x=.5;fibN=0;collatz=27;collatzSeed=27;percN=1;};
P1.reseed=()=>{const sd0=fib(10+Math.floor(Math.random()*15));x=.1+(sd0%89)/100;fibN=sd0%20;collatzSeed=27+(sd0%40)*2;collatz=collatzSeed;return sd0;};
P1.jump=i=>{x=.5+.01*i;};
function schedule(){while(nextT<ctx.currentTime+.12){step(nextT);nextT+=sd();}}
function toggleplay(){if(playing){stop();}else{start();}}
function start(){initAudio();ctx.resume();if(stepIdx>=TOTAL_BARS*16)stepIdx=0;playing=true;applyVinylNoise();nextT=ctx.currentTime+.06;timer=setInterval(schedule,25);paintPlay();}
function stop(at){playing=false;applyVinylNoise();clearInterval(timer);PATCH.onStop&&PATCH.onStop(at);paintPlay();}
function stopAt(t){const patch=PATCH;stop(t);stepIdx=0;
  setTimeout(()=>{if(PATCH===patch&&!playing&&transportStep===TOTAL_BARS*16-1)paintTransportTime(TOTAL_BARS*16);},Math.max(0,(t-ctx.currentTime)*1000));}
function jumpTo(i){if(LOOPSI!=null){LOOPSI=i;paintLoop();}stepIdx=SEC_START[i]*16;PATCH.jump&&PATCH.jump(i);if(!playing)uiStep(SEC_START[i],0,i,PATCH.sections[i],[]);}
function paintPlay(){setTimeout(()=>moveUI(),0);$('play').classList.toggle('on',playing);$('play').setAttribute('aria-label',playing?'Pause':'Play');$('play').innerHTML=`<i data-ic="${playing?'Pause':'Play'}" class="fill">${playing?'❚❚':'▶'}</i>`;fillIcons($('play'));paintToggles();renderList();const dp=$('dPlay');if(dp){const on=SEL===PATCH&&playing;dp.setAttribute('aria-label',on?'Pause':'Play');dp.innerHTML=`<i data-ic="${on?'Pause':'Play'}" class="fill">${on?'PAUSE':'PLAY'}</i>`;fillIcons(dp);}}
