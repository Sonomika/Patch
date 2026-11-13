function rainFrame(box){
  const w=box.clientWidth,h=box.clientHeight;
  if(!rainCanvas)rainCanvas=document.createElement('canvas');
  const backdropPath=PATCH.backdrop;
  if(!rainBackdrops.has(backdropPath)){
    const image=new Image();
    image.src=assetURL(backdropPath);
    rainBackdrops.set(backdropPath,image);
  }
  const rainBackdrop=rainBackdrops.get(backdropPath);
  if(rainCanvas.width!==w||rainCanvas.height!==h){rainCanvas.width=w;rainCanvas.height=h;}
  const g=rainCanvas.getContext('2d'),now=ctx?.currentTime??0;
  g.fillStyle='#05090d';
  g.fillRect(0,0,w,h);
  if(rainBackdrop.naturalWidth){
    const scale=Math.max(w/rainBackdrop.naturalWidth,h/rainBackdrop.naturalHeight);
    const width=rainBackdrop.naturalWidth*scale,height=rainBackdrop.naturalHeight*scale;
    g.drawImage(rainBackdrop,(w-width)/2,(h-height)/2,width,height);
  }
  const thunderAge=now-thunderTime;
  if(thunderAge>=0&&thunderAge<.28){
    g.fillStyle=`rgba(170,208,246,${.26*Math.exp(-thunderAge*16)})`;
    g.fillRect(0,0,w,h);
  }
  while(rainImpacts.length&&now-rainImpacts[0].at>.36)rainImpacts.shift();
  for(const impact of rainImpacts){
    const age=now-impact.at;
    if(age<-.12)continue;
    const x=impact.x*w,y=impact.y*h;
    g.lineWidth=Math.max(1,w/600);
    g.beginPath();
    if(age<0){
      const tip=y*(1+age/.12);
      g.strokeStyle='rgba(150,209,244,.72)';
      g.moveTo(x,Math.max(0,tip-h*.045));
      g.lineTo(x,tip);
    }else{
      const progress=age/.36,radius=(.01+progress*.075)*Math.min(w,h);
      g.strokeStyle=`rgba(150,209,244,${(1-progress)*impact.level*5})`;
      g.ellipse(x,y,radius,radius*.36,0,0,Math.PI*2);
    }
    g.stroke();
  }
  if(PATCH===P9&&rainBackdrop.naturalWidth)drawLakeFog(g,w,h);
  window.V3.draw(box,{kind:'tex',canvas:rainCanvas});
}
