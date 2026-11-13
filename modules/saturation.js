const SATURATION_DEVICE = {id:'sat',name:'SATURATE',sel:['type','TYPE',{over:'OVERDRIVE',tube:'TUBE',fuzz:'FUZZ',bigf:'BIG FUZZ',grit:'DIGITAL GRIT',fold:'WAVEFOLD',rect:'RECTIFY',crush:'CRUSH'},'over'],p:[['drv','DRIVE',0,1,.1,''],['mix','DRY/WET',0,1,1,'']]};

// SATURATE types (the drive shapes from Fourfold FM)
const SATF={over:u=>Math.tanh(u),tube:u=>{const b=.3;return (Math.tanh(u+b)-Math.tanh(b))/(u>=0?1-Math.tanh(b):1+Math.tanh(b));},fuzz:u=>Math.sign(u)*(1-Math.exp(-Math.abs(u)*1.6)),
  bigf:u=>{const dc=x=>x/Math.pow(1+Math.pow(Math.abs(x),2.5),.4);const a=dc(u*1.5);return Math.tanh(dc(a*6)*1.4)/Math.tanh(1.4*dc(6));},
  grit:u=>{let w=Math.tanh(u*.8);w=Math.sin(w*Math.PI*1.25)*.65+w*.35;return Math.round(w*12)/12;},fold:u=>Math.sin(u*Math.PI/2),
  rect:u=>{const v=Math.tanh(u);return v*.45+(Math.abs(v)-.5)*.9;},crush:u=>Math.round(Math.tanh(u)*7)/7};
function applySaturation(device,state,at){
    const k=1+state.drv*6,ty=SATF[state.type]?state.type:'over',key=ty+'|'+k+'|'+state.mix;if(device.curveKey!==key){device.curveKey=key;const f=SATF[ty],cv=new Float32Array(4096);let pk=1e-6;
      for(let i=0;i<4096;i++){cv[i]=f(k*(i/2047.5-1));pk=Math.max(pk,Math.abs(cv[i]));}// make-up: every type is matched to OVERDRIVE's level (sines at 0.1, 0.3 and 0.6, DC counted), so switching type changes colour, not loudness
      const lv=(fn,P)=>{let a2=0;[.1,.3,.6].forEach(a=>{let si=0,so=0;for(let j=0;j<256;j++){const x=a*Math.sin(2*Math.PI*j/256),y=fn(x)/P;si+=x*x;so+=y*y;}a2+=so/si;});return Math.sqrt(a2/3);};
      const tp=Math.tanh(k),mk=Math.pow(10,({tube:1.1,fuzz:-.6,bigf:-6.9,grit:-1.8,fold:-1.2,rect:9.5,crush:2.2}[ty]||0)/20)*Math.max(.1,Math.min(4,lv(x=>Math.tanh(k*x),tp)/lv(x=>cv[Math.round((x+1)*2047.5)],pk)));
      for(let i=0;i<4096;i++){const x=i/2047.5-1;cv[i]=(1-state.mix)*x+state.mix*Math.max(-1.5,Math.min(1.5,mk*cv[i]/pk));}device.sh.curve=cv;}
   device.sp.gain.setTargetAtTime(1/(1+state.drv*.6*state.mix),at,.03);
}
