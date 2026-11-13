const LIMITER_DEVICE = {id:'lim',name:'LIMIT',p:[['gain','GAIN',0,12,1,'dB'],['ceil','CEILING',-12,0,-1,'dB']],gr:true};

function buildLimiter(c,g,dev){
  const lg=g(),lim=c.createDynamicsCompressor(),lpost=g();lim.ratio.value=20;lim.knee.value=0;lim.attack.value=.002;lim.release.value=.08;lg.connect(lim);lim.connect(lpost);const device=dev('lim',lg,lpost);Object.assign(device,{lg,lim,lpost});
}
