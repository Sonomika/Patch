const GLUE_DEVICE = {id:'glue',name:'GLUE',p:[['thr','THRESH',-40,0,-18,'dB'],['rat','RATIO',1,10,1.8,':1'],['mk','MAKEUP',0,12,1,'dB']],gr:true};

function buildGlue(c,g,dev){
  const cmp=c.createDynamicsCompressor(),mk=g();cmp.attack.value=.01;cmp.release.value=.2;cmp.knee.value=6;cmp.connect(mk);const device=dev('glue',cmp,mk);Object.assign(device,{cmp,mk});
}
