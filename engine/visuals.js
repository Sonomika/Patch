// three.js renderer for the patch visual. The page's own script computes every point; this only draws.
Promise.all([import('three'),import('three/addons/lines/LineSegments2.js'),import('three/addons/lines/LineSegmentsGeometry.js'),import('three/addons/lines/LineMaterial.js')])
.then(([THREE,{LineSegments2},{LineSegmentsGeometry},{LineMaterial}])=>{
  const canvas=document.getElementById('visc');let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){window.V3FAIL=true;return;}
  canvas.dataset.webgl='';
  function renderFrame(scene,camera){
    renderer.render(scene,camera);
    canvas.dispatchEvent(new Event('visualframe'));
  }
  renderer.setClearColor(0x000000,1);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,16/9,.1,100);camera.position.set(0,0,8);
  const N=360,lines=[];
  for(let i=0;i<4;i++){const geo=new LineSegmentsGeometry();geo.setPositions(new Float32Array(N*6));
    const glow=new LineSegments2(geo,new LineMaterial({color:0xf0f0ec,linewidth:8,transparent:true,opacity:.06,blending:THREE.AdditiveBlending,depthWrite:false}));
    const core=new LineSegments2(geo,new LineMaterial({color:0xf0f0ec,linewidth:1.8}));
    glow.frustumCulled=core.frustumCulled=false;scene.add(glow,core);lines.push({geo,glow,core});}
  // the sunflower: soft round points, size and brightness per seed, added together so lit arms glow
  const sunScene=new THREE.Scene(),sunCam=new THREE.PerspectiveCamera(40,16/9,.1,100),SN=1597,sg=new THREE.BufferGeometry();
  sg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SN*3),3));sg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(SN*3),3));sg.setAttribute('size',new THREE.BufferAttribute(new Float32Array(SN),1));
  const sm=new THREE.ShaderMaterial({uniforms:{px:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute float size;attribute vec3 color;varying vec3 vC;uniform float px;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*px*(7./-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.1,d);gl_FragColor=vec4(vC*a,a);}'});
  const sunPts=new THREE.Points(sg,sm);sunPts.frustumCulled=false;sunPts.rotation.order='XYZ';sunScene.add(sunPts);
  const texScene=new THREE.Scene(),texCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),texMat=new THREE.MeshBasicMaterial({color:0xffffff});
  texScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),texMat));let tex=null;
  let cw=0,ch=0;
  window.V3={draw(box,F){const w=box.clientWidth,h=box.clientHeight;
    if(w!==cw||h!==ch){cw=w;ch=h;renderer.setPixelRatio(1);renderer.setSize(w,h,false);camera.aspect=sunCam.aspect=w/h;camera.updateProjectionMatrix();sunCam.updateProjectionMatrix();sm.uniforms.px.value=VLS;lines.forEach(l=>{l.glow.material.resolution.set(w/VLS,h/VLS);l.core.material.resolution.set(w/VLS,h/VLS);});}
    // a resized canvas needs a fresh texture: WebGL cannot grow an uploaded texture in place, and the old one freezes
    if(F.kind==='tex'){if(!tex||tex.image!==F.canvas||tex.w!==F.canvas.width||tex.h!==F.canvas.height){if(tex)tex.dispose();tex=new THREE.CanvasTexture(F.canvas);tex.w=F.canvas.width;tex.h=F.canvas.height;tex.colorSpace=THREE.SRGBColorSpace;texMat.map=tex;texMat.needsUpdate=true;}
      tex.needsUpdate=true;renderFrame(texScene,texCam);return;}
    if(F.kind==='sun'){sg.attributes.position.array.set(F.pos);sg.attributes.color.array.set(F.col);sg.attributes.size.array.set(F.size);
      sg.attributes.position.needsUpdate=sg.attributes.color.needsUpdate=sg.attributes.size.needsUpdate=true;
      sunPts.rotation.set(F.rot[0],F.rot[1],F.rot[2]);sunCam.position.set(F.cam[0],F.cam[1],F.cam[2]);sunCam.lookAt(0,0,0);renderFrame(sunScene,sunCam);return;}
    F.circles.forEach((C,i)=>{const arr=lines[i].geo.attributes.instanceStart.data;const A=arr.array,p=C.pts;
      for(let j=0;j<N;j++){const o=j*6,q=j*3;A[o]=p[q];A[o+1]=p[q+1];A[o+2]=p[q+2];A[o+3]=p[q+3];A[o+4]=p[q+4];A[o+5]=p[q+5];}arr.needsUpdate=true;
      lines[i].glow.material.opacity=.035+.09*F.glow;});
    camera.position.set(F.cam[0],F.cam[1],F.cam[2]);camera.lookAt(0,0,0);renderFrame(scene,camera);}};
}).catch(()=>{window.V3FAIL=true;});
