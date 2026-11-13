const DMODES={digital:'DIGITAL',tape:'TAPE ECHO',multi:'MULTI-HEAD',ping:'PING-PONG',dub:'DUB'};
const DELAY_DEVICE = {id:'dret',name:'DELAY',sel:['mode','MODE',DMODES,'tape'],p:[
    ['timeMs','TIME',10,7900,350,'ms',1],
    ['feedbackAmount','FEEDBACK',0,.95,.4,'',.005],
    ['drv','DRIVE',0,1,0,'']
  ]};

const DMP={digital:{lp:14000,hp:60,sat:.02,wow:0,fl:0,h:0,pp:0},tape:{lp:2900,hp:220,sat:.28,wow:.0022,fl:.00035,h:0,pp:0},multi:{lp:2600,hp:240,sat:.3,wow:.002,fl:.0003,h:1,pp:0},ping:{lp:7000,hp:150,sat:.06,wow:0,fl:0,h:0,pp:1},dub:{lp:1500,hp:380,sat:.45,wow:.0012,fl:.0002,h:0,pp:0}};
function loopCurve(amt){const n=2048,c=new Float32Array(n),a=1+amt*amt*12;for(let i=0;i<n;i++){const x=(i/(n-1)*2-1)*2;c[i]=Math.tanh(x*a)/a;}return c;}
function applyDelay(){if(!ctx||!bus.lines)return;const st=returnSettings('dret'),P=DMP[st.mode]||DMP.tape,t=ctx.currentTime,set=(a,v)=>a.setTargetAtTime(v,t,.05),dg=1+(st.drv||0)*7;
  bus.lines.forEach(L=>{set(L.l.frequency,P.lp);set(L.hp.frequency,P.hp);if(L.satv!==P.sat){L.sh.curve=loopCurve(P.sat);L.satv=P.sat;}set(L.si.gain,.5*dg);set(L.so.gain,1/dg);
    set(L.h2.gain,P.h*.6);set(L.h3.gain,P.h*.42);set(L.gst.gain,P.pp?0:1);set(L.gpp.gain,P.pp?1:0);
    set(L.feedback.gain,st.feedbackAmount==null?st.feedback:1);
    set(L.f.gain,st.feedbackAmount??bus.delayFeedbackBase??.4);
  });
  const drizzle=PATCH===P9;
  set(bus.wowG.gain,P.wow);set(bus.flG.gain,P.fl);set(bus.dlo.gain,st.on&&soloReturn('dret')?(drizzle?1:.6)*st.vol:0);
  set(bus.delayToReverb.gain,drizzle?0:.25);
  setDelayTime(drizzle?6*sd():bus.delayBase??3*sd(),t);}
const DTIMES=[3/4,1/2,1/4,3/8,2/3]; // delay time locks in beats: 3/16, 1/8, 1/16, 3/32, 1/8 triplet
function setDelayFeedback(amount,t,smoothing){
  bus.delayFeedbackBase=amount;
  const feedback=returnSettings('dret').feedbackAmount??amount;
  bus.lines[bus.active].f.gain.setTargetAtTime(feedback,t,smoothing);
}
// switch new delay sends to the idle line at the new time; the ringing line keeps its time and fades out
function setDelayTime(dt,t){bus.delayBase=dt;const state=returnSettings('dret');dt=Math.min(7.9,state.timeMs==null?dt*state.timeScale:state.timeMs/1000);if(Math.abs(dt-bus.dTime)<1e-4)return;const old=bus.lines[bus.active];bus.active^=1;const nw=bus.lines[bus.active];
  nw.d.delayTime.setValueAtTime(dt,t);nw.d2.delayTime.setValueAtTime(Math.min(7.9,dt*2),t);nw.d3.delayTime.setValueAtTime(Math.min(7.9,dt*3),t);nw.inG.gain.setValueAtTime(0,t);nw.inG.gain.linearRampToValueAtTime(1,t+.01);old.inG.gain.setValueAtTime(old.inG.gain.value,t);old.inG.gain.linearRampToValueAtTime(0,t+.01);bus.dTime=dt;}
