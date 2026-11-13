/* =================== PATCH FORMAT ===================
   A song is a patch: tempo, Fibonacci sections, and modules. Each module is a subpatch with Pd-style
   boxes (obj, msg, num, tgl, bng, cmt, arr, scope) laid out on a 300×N grid and wired together.
   Modules talk through [s name] / [r name] pairs, so the layout can reflow freely. */
const PHI=(1+Math.sqrt(5))/2;
const P1={id:'fibonacci-chance',num:'01',
  title:'FIBONACCI',tag:'FOLDED SINE TECHNO · F MINOR · 55 BARS · PATCH 01',bpm:128,seed:1597,readLabels:['LOGISTIC r','CHANCE x'],visual:'sunflower',
  note:'Every sound starts as a sine oscillator, then goes through a wavefolder and a drive. The fold amount is locked per step, and the P-LOCKS grid shows the lock on each of the 16 steps. Section lengths are Fibonacci numbers (8, 5, 13, 8, 5, 13, 3, adding up to 55). Chance comes from the logistic map x → r·x·(1−x), kept in its chaotic range: r runs from 3.62 to 3.99, with a calmer period-3 window at 3.83.',
  sections:[ // bars are Fibonacci numbers; r drives the logistic-map chance
    {name:'Origin',bars:8,r:3.62,hc:[0],oh:99,v:{kick:0,bass:0,hat:0,perc:1,pad:1,lead:0,rumble:0}},
    {name:'Growth',bars:5,r:3.74,hc:[0,0,0,3],oh:99,v:{kick:1,bass:1,hat:1,perc:1,pad:1,lead:0,rumble:1}},
    {name:'Spiral',bars:13,r:3.88,hc:[5,5,5,5,5,8],oh:8,v:{kick:1,bass:1,hat:1,perc:1,pad:0,lead:1,rumble:1}},
    {name:'Golden break',bars:8,r:3.93,hc:[3],oh:99,v:{kick:0,bass:0,hat:1,perc:1,pad:1,lead:1,rumble:0}},
    {name:'Recurrence',bars:5,r:3.83,hc:[8],oh:0,v:{kick:1,bass:1,hat:1,perc:0,pad:1,lead:0,rumble:1}},
    {name:'Chaos',bars:13,r:3.99,hc:[8,8,8,8,8,13],oh:0,v:{kick:1,bass:1,hat:1,perc:1,pad:0,lead:1,rumble:1}},
    {name:'Limit',bars:3,r:3.7,hc:[5,3,0],oh:99,v:{kick:1,bass:0,hat:0,perc:1,pad:1,lead:0,rumble:0}}
  ],
  modules:[
    {id:'clock',title:'CLOCK',sub:'metro → counter → sections',h:200,nodes:[
      ['play','tgl',8,10],['c1','cmt',32,22,'play'],
      ['metro','obj',8,44,'metro 16n'],['cnt','obj',8,84,'f']//
      ,['inc','obj',48,84,'+ 1'],['mod','obj',8,120,'mod 16'],['stepn','num',8,156,'0',4],['bar','obj',120,120,'div 16'],['barn','num',120,156,'0',4],
      ['sstep','obj',200,156,'s step'],['sec','obj',200,84,'section-table'],['tick','bng',200,44],['c2','cmt',224,56,'beat']],
     wires:[['play','metro'],['metro','cnt'],['cnt','inc'],['cnt','mod'],['cnt','bar'],['mod','stepn'],['bar','barn'],['stepn','sstep'],['barn','sec'],['metro','tick']]},
    {id:'logistic',title:'LOGISTIC MAP',sub:'x → r·x·(1−x)  chance source',h:220,nodes:[
      ['rstep','obj',8,10,'r step'],['rin','obj',120,10,'r section'],['rn','num',120,44,'2.80',6],
      ['expr','obj',8,80,'expr $f2*$f1*(1-$f1)'],['xn','num',8,116,'0.500',7],['sx','obj',120,116,'s chance'],
      ['arr','arr',8,148,'',284,62]],
     wires:[['rstep','expr'],['rin','rn'],['rn','expr'],['expr','xn'],['xn','sx'],['xn','arr']]},
    {id:'locks',title:'P-LOCKS',sub:'fold + drive locked per step',h:176,nodes:[['grid','grid',8,8,'locks',284,160]],wires:[]},
    {id:'fxlocks',title:'FX LOCKS',sub:'delay, feedback, reverb, filter, crush per step',h:206,nodes:[['grid','grid',8,8,'fx',284,192]],wires:[]},
    {id:'kick',title:'KICK~',sub:'909-style sine 185→44 Hz (F)',voice:'kick',h:236,nodes:[
      ['r','obj',8,10,'r step'],['sel','obj',8,44,'sel 0 4 8 12'],['b','bng',8,80],['tg','tgl',260,10],
      ['line','obj',48,80,'vline~ 185 44 34'],['osc','obj',48,116,'osc~'],['fold','obj',100,116,'+~ click FM'],['env','obj',150,150,'*~ env 460ms'],['drv','obj',150,180,'tanh~ $lock'],['out','obj',150,210,'s~ drums']],
     wires:[['r','sel'],['sel','b'],['b','line'],['line','osc',1],['osc','fold',1],['fold','env',1],['env','drv',1],['drv','out',1]]},
    {id:'bass',title:'SUB BASS~',sub:'Fibonacci mod 5 → F minor pentatonic',voice:'bass',h:236,nodes:[
      ['r','obj',8,10,'r step'],['rc','obj',140,10,'r chance'],['spig','obj',8,44,'moses 0.38'],['tg','tgl',260,10],
      ['fib','obj',8,80,'fib n'],['fn','num',100,80,'0',5],['mod','obj',8,116,'mod 5'],['deg','num',100,116,'0',3],
      ['mtof','obj',8,150,'F min pent → mtof'],['hz','num',160,150,'55.0',6],
      ['osc','obj',8,188,'osc~'],['fold','obj',56,188,'fold~ x'],['env','obj',136,188,'*~ env'],['out','obj',200,188,'s~ low']],
     wires:[['r','spig'],['rc','spig'],['spig','fib'],['fib','fn'],['fib','mod'],['mod','deg'],['mod','mtof'],['mtof','hz'],['mtof','osc'],['osc','fold',1],['fold','env',1],['env','out',1]]},
    {id:'hat',title:'HAT~',sub:'6 inharmonic sines · 3 5 8 13 per bar',voice:'hat',h:200,nodes:[
      ['r','obj',8,10,'r step'],['rc','obj',140,10,'r chance'],['spig','obj',8,44,'euclid fib 16'],['b','bng',8,80],['tg','tgl',260,10],
      ['mod','obj',48,80,'osc~ ×6 metal'],['idx','obj',48,116,'hip~ 7200→5400'],['car','obj',150,116,'+~'],['env','obj',150,150,'*~ env 30ms | open 260ms'],['out','obj',150,180,'s~ hats']],
     wires:[['r','spig'],['rc','spig'],['spig','b'],['b','env'],['mod','idx',1],['idx','car',1],['car','env',1],['env','out',1]]},
    {id:'perc',title:'PRIME PERC~',sub:'steps 2 3 5 7 11 13, φ picks the note',voice:'perc',h:220,nodes:[
      ['r','obj',8,10,'r step'],['prime','obj',8,44,'sel 2 3 5 7 11 13'],['rc','obj',170,44,'r chance'],['gate','obj',8,80,'moses 0.4'],['tg','tgl',260,10],
      ['phi','obj',8,116,'expr frac($f1*1.618)'],['pn','num',176,116,'0.000',6],['hz','obj',8,150,'* 1200 + 300'],['osc','obj',8,184,'osc~'],['fold','obj',56,184,'fold~ φ'],['env','obj',128,184,'*~ env'],['out','obj',196,184,'s~ fx']],
     wires:[['r','prime'],['prime','gate'],['rc','gate'],['gate','phi'],['phi','pn'],['phi','hz'],['hz','osc'],['osc','fold',1],['fold','env',1],['env','out',1]]},
    {id:'pad',title:'PAD~',sub:'Fm9 · Dbmaj9 · Eb9 · Bbm9, filter sweeps with x',voice:'pad',h:200,nodes:[
      ['r','obj',8,10,'r bar'],['tg','tgl',260,10],['root','obj',8,44,'fib bar mod 4'],['rn','num',130,44,'0',3],
      ['o1','obj',8,84,'osc~ 1 3'],['o2','obj',88,84,'osc~ 5 7'],['o3','obj',178,84,'osc~ 9'],['sum','obj',8,122,'+~'],['lfo','obj',130,122,'osc~ 0.07'],['env','obj',8,158,'lop~ sweep x'],['out','obj',130,158,'s~ fx']],
     wires:[['r','root'],['root','rn'],['root','o1'],['root','o2'],['root','o3'],['o1','sum',1],['o2','sum',1],['o3','sum',1],['sum','env',1],['lfo','env',1],['env','out',1]]},
    {id:'lead',title:'COLLATZ LEAD~',sub:'n → n/2 or 3n+1, from 27',voice:'lead',h:220,nodes:[
      ['r','obj',8,10,'r step'],['rc','obj',140,10,'r chance'],['gate','obj',8,44,'moses 0.55'],['tg','tgl',260,10],
      ['col','obj',8,80,'collatz'],['cn','num',90,80,'27',5],['mod','obj',8,116,'mod 7 → F minor'],['hz','num',140,116,'440',6],
      ['osc','obj',8,152,'osc~'],['rm','obj',64,152,'*~ osc~ ×2.01'],['fold','obj',8,186,'fold~ n%10'],['env','obj',100,186,'*~ env'],['out','obj',170,186,'s~ fx']],
     wires:[['r','gate'],['rc','gate'],['gate','col'],['col','cn'],['col','mod'],['mod','hz'],['hz','osc'],['osc','rm',1],['rm','fold',1],['fold','env',1],['env','out',1]]},
    {id:'rumble',title:'RUMBLE~',sub:'sub sine after each kick',voice:'rumble',h:170,nodes:[
      ['r','obj',8,10,'r step'],['sel','obj',8,44,'sel 2 3 6 7 10 11 14 15'],['tg','tgl',260,10],['osc','obj',8,84,'osc~ 43.65'],['env','obj',90,84,'*~ env'],['lp','obj',8,120,'lop~ 120'],['out','obj',120,120,'s~ low']],
     wires:[['r','sel'],['sel','env'],['osc','env',1],['env','lp',1],['lp','out',1]]},
    {id:'out',title:'DAC~',sub:'locked delay · reverb · soft clip',h:250,nodes:[
      ['rd','obj',8,10,'r~ drums'],['rl','obj',90,10,'r~ low'],['rh','obj',160,10,'r~ hats'],['rf','obj',224,10,'r~ fx'],
      ['dl','obj',100,48,'delay~ bar-lock fb $lock'],['rv','obj',160,84,'rev~ send $lock'],['mix','obj',8,84,'+~'],['clip','obj',8,120,'tanh~ 2.6'],['dac','obj',8,156,'dac~'],
      ['scope','scope',100,120,'',192,120]],
     wires:[['rd','mix',1],['rl','mix',1],['rh','mix',1],['rf','dl',1],['dl','rv',1],['rv','mix',1],['rf','mix',1],['mix','clip',1],['clip','dac',1],['clip','scope',1]]}
  ]
};

/* =================== MATHS =================== */
const fib=(()=>{const m=[0,1];return n=>{while(m.length<=n)m.push(m[m.length-1]+m[m.length-2]);return m[n];};})();
const fibMod=(n,k)=>{let a=0,b=1;for(let i=0;i<n%(k*k*4+20);i++){[a,b]=[b,(a+b)%k];}return a;}; // Pisano-periodic, stays small
const PRIMES=[2,3,5,7,11,13];
// 808-style hat from sines only: six inharmonic partials (each FM'd by its neighbour ratio) into a high-pass
const HATR=[1,1.342,1.2312,1.6532,1.9523,2.1523];
function hatHit(t,dur,peak,pan,hp,open){const g=ctx.createGain(),f=ctx.createBiquadFilter(),f2=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=hp;f.Q.value=.7;f2.type='peaking';f2.frequency.value=10500;f2.gain.value=6;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.001);g.gain.exponentialRampToValueAtTime(.0005,t+dur);
  HATR.forEach((r,i)=>{const o=ctx.createOscillator(),m=ctx.createOscillator(),mg=ctx.createGain(),og=ctx.createGain();o.frequency.value=6400*r;m.frequency.value=6400*r*1.4142;mg.gain.value=4200;og.gain.value=1/6;
    m.connect(mg);mg.connect(o.frequency);o.connect(og);og.connect(f);o.start(t);m.start(t);o.stop(t+dur+.02);m.stop(t+dur+.02);});
  f.connect(f2);f2.connect(g);let out=g;if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;g.connect(p);out=p;}out.connect(bus.hats);
  if(open){const r=ctx.createGain();r.gain.value=.12;out.connect(r);sendToReturn(r,bus.hats,'revIn');}}
let seedRand=P1.seed;const rnd=()=>{seedRand=(seedRand*16807)%2147483647;return seedRand/2147483647;};


/* FIBONACCI CHANCE visual: a sunflower. 1597 seeds (a Fibonacci number) at the golden angle, seed n at radius √n,
   so the 8, 13, 21, 34 and 55 spiral arms of a real sunflower appear. Every voice walks its own arm: a hit lights a
   run of seeds stepping by a Fibonacci number (kick 21, bass 13, perc 5, lead 34, pad 55, hats 1), which is exactly
   the step that follows one spiral arm, then the voice moves on to the next arm. Kicks send a ripple out from the
   centre; the fold lock bends the disc into a folded surface; the logistic map's chaos tilts and shakes it. */
const SUN_N=1597,GOLD=Math.PI*(3-Math.sqrt(5));
const SUN={h:new Float32Array(SUN_N),b:new Float32Array(SUN_N),ptr:{kick:0,bass:400,hat:800,perc:1200,lead:200,pad:600,rumble:1000},rip:[],fold:0,x:.5,r:3.62,
  F:{kind:'sun',pos:new Float32Array(SUN_N*3),col:new Float32Array(SUN_N*3),size:new Float32Array(SUN_N),cam:[0,0,7],rot:[0,0,0]}};
const SUN_STEP={kick:[21,9,1],bass:[13,6,.8],hat:[1,3,.45],perc:[5,5,.7],lead:[34,7,.9],pad:[55,12,.5],rumble:[89,5,.6]};
const SUN_HUE={kick:.97,bass:.08,hat:.5,perc:.27,lead:.76,pad:.6,rumble:.04}; // magenta-red, amber, cyan, lime, violet, blue, orange
const hsl=(h,s2,l)=>{const k=n=>(n+h*12)%12,a=s2*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return [f(0),f(8),f(4)];};
function sunHits(ui){const seen=new Set();ui.forEach(u=>{const v=String(u[0]).split('.')[0];if(SUN_STEP[v]&&!seen.has(v)){seen.add(v);
  const [st,len,lv]=SUN_STEP[v];let p=SUN.ptr[v];for(let k=0;k<len;k++){const i=(p+k*st)%SUN_N;SUN.b[i]=Math.min(1.6,SUN.b[i]+lv*(1-k/len*.5));SUN.h[i]=SUN_HUE[v];}
  SUN.ptr[v]=(p+1+(v==='hat'?len:0))%SUN_N;if(v==='kick')SUN.rip.push({t:performance.now()/1000,a:.55+SUN.fold*.7});}});}
function sunFrame(box){const F=SUN.F,now=performance.now()/1000,asp=(box.clientWidth||16)/(box.clientHeight||9),R=Math.min(1,asp)*2.25,chaos=(SUN.r-3.6)/.4;
  SUN.rip=SUN.rip.filter(r=>now-r.t<3);const fold=SUN.fold;
  for(let i=0;i<SUN_N;i++){const a=i*GOLD+now*.02,rr=R*Math.sqrt(i/SUN_N),o=i*3;
    let z=0;for(const r of SUN.rip){const d=rr-(now-r.t)*1.6;z+=r.a*Math.exp(-d*d*6)*Math.exp(-(now-r.t)*1.2);}
    z+=.06*Math.sin(rr*6-now*1.3)*(1+fold*2);z=Math.sin(z*(1+fold*5)*Math.PI/2)*.5;          // folded like the sines it shows
    z+=(SUN.x-.5)*.25*Math.sin(i*1.7+now*2)*chaos;                                            // the logistic map shaking it
    F.pos[o]=rr*Math.cos(a);F.pos[o+1]=rr*Math.sin(a);F.pos[o+2]=z;
    const b=Math.min(1,SUN.b[i]),q=i/SUN_N;
    const base=hsl((.06+.55*q+now*.01)%1,.85,.2+.07*Math.sin(i*GOLD*3+now*.5)),lit=hsl(SUN.h[i],.95,.38+.3*b);
    F.col[o]=base[0]*(1-b)+lit[0]*b*1.6;F.col[o+1]=base[1]*(1-b)+lit[1]*b*1.6;F.col[o+2]=base[2]*(1-b)+lit[2]*b*1.6;F.size[i]=(3.4+11*b)*(.75+.5*Math.sqrt(i/SUN_N))*1.4;SUN.b[i]*=.955;}
  F.rot=[-.55-.25*chaos+.08*Math.sin(now*.3),.12*Math.sin(now*.21)*(1+chaos),now*(.03+.05*chaos)];F.cam=[0,0,7];
  window.V3.draw(box,F);}
