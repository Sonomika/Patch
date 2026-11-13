/* LUFS meter (ITU-R BS.1770 / EBU R128): the final output, K-weighted (a +4 dB shelf above ~1.7 kHz and a 38 Hz
   high-pass), squared and summed in exact 100 ms blocks by an AudioWorklet. Momentary = last 400 ms, short-term =
   last 3 s, integrated = all 400 ms blocks since reset, gated at −70 LUFS and then 10 LU below their own mean.
   Peak is the sample peak of the output in dBFS. */
const LUFS={blocks:[],gate:[],pk:0,M:-Infinity,S:-Infinity,I:-Infinity,
  async tap(src){try{const code=`class L extends AudioWorkletProcessor{constructor(){super();this.n=Math.round(sampleRate/10);this.i=0;this.a=0;this.b=0;this.p=0;}
      process(inp){const x=inp[0];if(!x||!x.length)return true;const l=x[0],r=x[1]||x[0];for(let k=0;k<l.length;k++){this.a+=l[k]*l[k];this.b+=r[k]*r[k];
        if(++this.i>=this.n){this.port.postMessage([this.a/this.n,this.b/this.n]);this.i=0;this.a=0;this.b=0;}}return true;}}registerProcessor('lufs-meter',L);`;
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code],{type:'application/javascript'})));
      // the exact BS.1770 K-weighting filters, recomputed for this sample rate (as libebur128 does)
      const fs=ctx.sampleRate;let K=Math.tan(Math.PI*1681.974450955533/fs),Q=.7071752369554196,Vh=Math.pow(10,3.999843853973347/20),Vb=Math.pow(Vh,.4996667741545416),a0=1+K/Q+K*K;
      const sh=ctx.createIIRFilter([(Vh+Vb*K/Q+K*K)/a0,2*(K*K-Vh)/a0,(Vh-Vb*K/Q+K*K)/a0],[1,2*(K*K-1)/a0,(1-K/Q+K*K)/a0]);
      K=Math.tan(Math.PI*38.13547087602444/fs);Q=.5003270373238773;const d=1+K/Q+K*K;const hp=ctx.createIIRFilter([1,-2,1],[1,2*(K*K-1)/d,(1-K/Q+K*K)/d]);
      const w=new AudioWorkletNode(ctx,'lufs-meter',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:2,channelCountMode:'explicit'}),z=ctx.createGain();z.gain.value=0;
      src.connect(sh);this.inp=sh;sh.connect(hp);hp.connect(w);w.connect(z);z.connect(ctx.destination);w.port.onmessage=e=>this.push(e.data);this.ok=true;}catch(e){this.err=String(e);}},
  lu:ms=>ms>0?-.691+10*Math.log10(ms):-Infinity,
  push([a,b]){const B=this.blocks;B.push(a+b);if(B.length>30)B.shift();const avg=n=>{const k=Math.min(n,B.length);let s=0;for(let i=B.length-k;i<B.length;i++)s+=B[i];return s/k;};
    this.M=B.length>=4?this.lu(avg(4)):-Infinity;this.S=B.length>=30?this.lu(avg(30)):this.lu(avg(B.length));
    if(B.length>=4&&playing){const m=avg(4);if(this.lu(m)>-70)this.gate.push(m);
      const G=this.gate;if(G.length){const mean=G.reduce((x,y)=>x+y,0)/G.length,rel=this.lu(mean)-10;let s=0,c=0;for(const v of G)if(this.lu(v)>rel){s+=v;c++;}this.I=c?this.lu(s/c):-Infinity;}}},
  reset(){this.gate=[];this.I=-Infinity;this.pk=0;},
  /* MATCH: steer the level to the TARGET. Louder is pushed into the limiter (LIMIT gain, so peaks stay under
     control); quieter comes off the output trim after the clip first-in, last-out. Checks the short-term
     loudness once a second while the song plays and stops when it is within 0.3 LU three times running. */
  matching:false,ok3:0,match(on){this.matching=on;this.ok3=0;clearInterval(this.mt);if(!on){paintMatch();return;}if(!playing)toggleplay();
    this.mt=setInterval(()=>{if(!playing||!Number.isFinite(this.S)||this.blocks.length<15)return;const S=mstState(),err=S.lufs.target-this.S;
      if(Math.abs(err)<.3){if(++this.ok3>=3){this.match(false);this.reset();}paintMatch();return;}this.ok3=0;
      if(err>0){if(S.lufs.trim<0)S.lufs.trim=Math.min(0,S.lufs.trim+err);else S.lim.gain=Math.min(12,S.lim.gain+err*.7);}
      else{const d=-err;if(S.lim.gain>0){const t=Math.min(S.lim.gain,d*.7);S.lim.gain-=t;}else S.lufs.trim=Math.max(-24,S.lufs.trim-d);}
      S.lim.gain=+S.lim.gain.toFixed(2);S.lufs.trim=+S.lufs.trim.toFixed(2);this.blocks.length=0;MST.apply();saveMix();if(VIEW==='mixer')syncChain();paintMatch();},1000);paintMatch();}};
function paintMatch(){const b=$('lufsMatch');if(!b)return;b.classList.toggle('on',LUFS.matching);b.textContent=LUFS.matching?'MATCHING…':'MATCH';b.setAttribute('aria-pressed',LUFS.matching);}
