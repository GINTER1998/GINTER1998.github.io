import * as THREE from './vendor/three.module.js';
import {sampleTrack,STEP} from './track.js?v=20261108-3';
import {random,clamp} from './music.js';
import {concreteMaterial} from './concrete.js';
import {CrossTrailHistory,crossAt} from './trail.js';
import {Atmosphere} from './atmosphere.js';
import {cityRows,roofPose} from './city.js';
import {StreetReflections} from './reflections.js';
const V=THREE.Vector3;
export class RaceScene{
 constructor(canvas){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setSize(innerWidth,innerHeight);
  this.renderer.toneMapping=THREE.NoToneMapping;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.info.autoReset=false;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#315f61');
  this.camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.1,1400);
  this.world=new THREE.Group();this.scene.add(this.world);this.mode=0;
  this.setupReflectionSky();
  this.scene.add(new THREE.HemisphereLight(0xb8d0cc,0x1b2222,1.7));
  const sun=new THREE.DirectionalLight(0xc4d2c9,1.35);sun.position.set(-30,60,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:140});sun.shadow.bias=-.0005;sun.shadow.normalBias=.02;this.scene.add(sun);
  this.car=new THREE.Group();this.scene.add(this.car);this.wheels={};this.lamps={};this.tailMaterials=[];
  this.setupEnvironment();this.boxGeometry=new THREE.BoxGeometry(1,1,1);this.sharedGeometries=new Set([this.boxGeometry]);this.groundMaterials=[];
  const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=256;const gc=grainCanvas.getContext('2d'),pixels=gc.createImageData(256,256),rng=random(1730);for(let i=0;i<pixels.data.length;i+=4){const value=155+rng()*100;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}gc.putImageData(pixels,0,0);this.grain=new THREE.CanvasTexture(grainCanvas);this.grain.wrapS=this.grain.wrapT=THREE.RepeatWrapping;this.grain.repeat.set(1,1);this.grain.anisotropy=4;
  this.concrete=concreteMaterial(0xa4aaa5);
  this.darkConcrete=concreteMaterial(0x8b928c);
  const asphalt=new THREE.TextureLoader().load('./assets/asphalt-aggregate.png');asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.anisotropy=8;asphalt.repeat.set(6/1.536,6/1.536);
  this.roadMaterial=new THREE.MeshStandardMaterial({color:0x272e2d,roughness:.72,metalness:.12,map:asphalt,bumpMap:asphalt,bumpScale:.00065,envMapIntensity:.3});
  this.shoulderMaterial=new THREE.MeshStandardMaterial({color:0x737974,roughness:.95,envMapIntensity:.1});
  this.paint=new THREE.MeshStandardMaterial({color:0xaaa58b,roughness:.8});
  this.poleMaterial=new THREE.MeshStandardMaterial({color:0x253633,metalness:.65,roughness:.5});
  this.lightMaterial=new THREE.MeshBasicMaterial({color:0xffdfaa});this.redMaterial=new THREE.MeshBasicMaterial({color:0xffffff});this.warningColor=new THREE.Color();
  this.streetLights=[];for(let i=0;i<6;i++){const light=new THREE.SpotLight(0xffdfb4,0,48,.82,1,1.5);this.world.add(light,light.target);this.streetLights.push(light);}
  this.base=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshStandardMaterial({color:0x263735,roughness:.96}));this.base.rotation.x=-Math.PI/2;this.base.position.y=-.06;this.scene.add(this.base);
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;const ctx=haloCanvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,224,175,.7)');g.addColorStop(.25,'rgba(255,224,175,.25)');g.addColorStop(1,'rgba(255,224,175,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);this.haloTexture=new THREE.CanvasTexture(haloCanvas);
  this.poolMaterial=new THREE.MeshBasicMaterial({map:this.haloTexture,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending});
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const sc=shadowCanvas.getContext('2d'),sg=sc.createRadialGradient(32,32,6,32,32,32);sg.addColorStop(0,'rgba(0,0,0,.8)');sg.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=sg;sc.fillRect(0,0,64,64);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.022;this.car.add(shadow);
  this.headlights=[];for(const side of [-1,1]){const l=new THREE.SpotLight(0xf4ecd5,55,58,.4,.8,1.3);l.position.set(side*.75,.65,1.8);l.target.position.set(side*.8,0,22);this.car.add(l,l.target);this.headlights.push(l);}
  this.tailGlow=new THREE.PointLight(0xff2012,4,5,2);this.tailGlow.position.set(0,.4,-2.25);this.car.add(this.tailGlow);
  this.setupCrossTrail();
  this.camera.position.set(0,3,-10);this.look=new V(0,1,12);this.camera.lookAt(this.look);
  this.atmosphere=new Atmosphere(this.renderer);this.atmosphere.resize();
  this.reflections=new StreetReflections(this);this.reflections.resize();
  this.tailScatter=new THREE.Mesh(new THREE.PlaneGeometry(3.8,6.5),new THREE.MeshBasicMaterial({map:this.haloTexture,color:0xff1004,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending}));this.tailScatter.rotation.x=-Math.PI/2;this.tailScatter.position.set(0,.046,-3.1);this.car.add(this.tailScatter);
  window.addEventListener('resize',()=>this.resize());
 }
 setupEnvironment(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,'#6b9191');g.addColorStop(.46,'#bdd9cf');g.addColorStop(.52,'#4f6b67');g.addColorStop(1,'#101b1a');ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
  const r=random(80);for(let i=0;i<50;i++){const x=r()*1024,w=10+r()*70,h=20+r()*160;ctx.fillStyle=i%3?'#2e4945':'#8daba0';ctx.fillRect(x,256-h,w,h+90);if(i%5===0){ctx.fillStyle='#d8c9a1';ctx.fillRect(x+4,245,2,40);}}
  const texture=new THREE.CanvasTexture(c);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromEquirectangular(texture);this.scene.environment=this.environment.texture;texture.dispose();pmrem.dispose();
 }
 setupReflectionSky(){
  const geometry=new THREE.SphereGeometry(400,24,12),material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,vertexShader:`varying vec3 vDirection;void main(){vec4 w=modelMatrix*vec4(position,1.);vDirection=w.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vDirection;void main(){vec3 r=normalize(vDirection);float elevation=smoothstep(0.,.5,max(r.y,0.));float az=atan(r.x,r.z),el=asin(clamp(r.y,-1.,1.));float glow=exp(-pow((el-.025)/.24,2.))*(.12+.88*exp(-pow(az/.68,2.)));vec3 sky=mix(vec3(.19,.46,.46),vec3(.045,.20,.23),elevation);sky=mix(sky,vec3(.55,.73,.68),glow*.60);gl_FragColor=vec4(sky,1.);}`});const sky=new THREE.Mesh(geometry,material);sky.frustumCulled=false;sky.renderOrder=-1000;this.scene.add(sky);
 }
 async loadVehicle(){
  const [setup,binary]=await Promise.all([fetch('./assets/vehicle.json').then(r=>{if(!r.ok)throw Error('Could not load the vehicle');return r.json();}),fetch('./assets/vehicle.bin').then(r=>{if(!r.ok)throw Error('Could not load the vehicle');return r.arrayBuffer();})]);
  this.model=new THREE.Group();this.model.scale.setScalar(setup.scale);this.car.add(this.model);const materials={};
  for(const [tag,w] of Object.entries(setup.wheels)){const hub=new THREE.Group(),spin=new THREE.Group();hub.position.fromArray(w.center);hub.add(spin);this.model.add(hub);this.wheels[tag]={hub,spin,radius:w.radius};}
  for(const [tag,l] of Object.entries(setup.lamps)){const hinge=new THREE.Group();hinge.position.fromArray(l.hinge);this.model.add(hinge);this.lamps[tag]=hinge;}
  for(const p of setup.parts){
   const geo=new THREE.BufferGeometry(),data=new THREE.InterleavedBuffer(new Float32Array(binary,p.offset,p.count*6),6);geo.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));geo.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));
   if(!materials[p.material]){
    const metal=/Titanium|Alloy|Steel|Metal/i.test(p.material),tail=/REAR_CROSS_LED/i.test(p.material),led=/LED|LIGHT|DRL/i.test(p.material);const color=new THREE.Color().fromArray(p.color);
    const mat=new THREE.MeshStandardMaterial({color,metalness:metal?.92:.12,roughness:metal?.23:.78,envMapIntensity:metal?2.4:.65});
    if(p.material==='Satin_Titanium'){mat.color.setRGB(.62,.65,.67);mat.metalness=1;mat.envMapIntensity=1.1;mat.emissive.setRGB(.012,.014,.015);}
    if(/Glass/i.test(p.material)){mat.metalness=.7;mat.roughness=.1;}
    if(tail||led){mat.emissive.copy(color);mat.emissiveIntensity=tail?4:2;if(tail)this.tailMaterials.push(mat);}
    if(tail){mat.color.set(0x000000);mat.emissive.set(0xff0300);mat.envMapIntensity=0;mat.toneMapped=false;}
    materials[p.material]=mat;
   }
   const mesh=new THREE.Mesh(geo,materials[p.material]);mesh.castShadow=true;
   if(p.name==='FUTURE_LIGHT_REAR_VERTICAL_0'){geo.computeBoundingBox();this.verticalTailMesh=mesh;this.gaugeBottom=geo.boundingBox.min.y;}
   const wheel=/^wheel_(LF|RF|LR|RR)_(roll|steer)$/.exec(p.group);
   if(wheel)this.wheels[wheel[1]][wheel[2]==='roll'?'spin':'hub'].add(mesh);else if(p.group.startsWith('lamp_'))this.lamps[p.group.slice(5)].add(mesh);else this.model.add(mesh);
  }
  this.vehicleInfo={id:setup.id,parts:setup.parts.length};await this.loadCity();this.setupRearGlow();return this.vehicleInfo;
 }
 async loadCity(){
  const [catalog,binary]=await Promise.all([fetch('./assets/city.json').then(r=>r.json()),fetch('./assets/city.bin').then(r=>r.arrayBuffer())]);
  this.cityMeshes={};this.cityCatalog=catalog;
  for(const [name,part]of Object.entries(catalog.meshes)){
   const geometry=new THREE.BufferGeometry(),values=new Float32Array(binary,part.offset,part.count*6),data=new THREE.InterleavedBuffer(values,6);
   geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));geometry.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));
   const walls={};if(name.startsWith('building_')){
    for(let i=0;i<part.count;i+=3){const nx=values[i*6+3];if(Math.abs(nx)<.99)continue;const a=[0,1,2].map(k=>[values[(i+k)*6],values[(i+k)*6+1],values[(i+k)*6+2]]),x=a[0][0];if(Math.abs(Math.abs(x)-.5)>.01)continue;const y0=Math.min(...a.map(v=>v[1])),y1=Math.max(...a.map(v=>v[1])),z0=Math.min(...a.map(v=>v[2])),z1=Math.max(...a.map(v=>v[2])),area=(y1-y0)*(z1-z0),key=nx>0?1:-1;if(!walls[key]||area>walls[key].area)walls[key]={x,y0,y1,z0,z1,area};}
    geometry.translate(0,-.5,0);
   }
   this.cityMeshes[name]={geometry,walls};this.sharedGeometries.add(geometry);
  }
  this.rebuild(24);
 }
 setupRearGlow(){
  const make=(vertical)=>{const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d'),pixels=ctx.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const a=(vertical?x:y)/127*2-1,b=(vertical?y:x)/127*2-1,i=(y*128+x)*4;pixels.data[i]=255;pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=255*Math.exp(-a*a*10)*Math.max(0,1-Math.abs(b)**8);}ctx.putImageData(pixels,0,0);const m=new THREE.Mesh(new THREE.PlaneGeometry(vertical?.20:2.3,vertical?1.15:.20),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),color:0xff0800,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));m.position.set(0,vertical?.902:.65,-2.523);this.model.add(m);return m;};
  this.verticalTailGlow=make(true);this.horizontalTailGlow=make(false);
 }
 setupCrossTrail(){
  this.trailHistory=new CrossTrailHistory();const capacity=40*24;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('trailUV',new THREE.BufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('strength',new THREE.BufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,vertexShader:`attribute vec2 trailUV;attribute float strength;varying vec2 vTrailUV;varying float vStrength;void main(){vTrailUV=trailUV;vStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vTrailUV;varying float vStrength;void main(){float edge=exp(-min(vTrailUV.x,1.-vTrailUV.x)*38.);float fade=pow(max(0.,1.-vTrailUV.y),1.8);float alpha=(.085+.65*edge)*vStrength*fade;gl_FragColor=vec4(1.,.006,.002,alpha);}`});
  this.crossTrail=new THREE.Mesh(geometry,material);this.crossTrail.frustumCulled=false;this.crossTrail.visible=false;this.world.add(this.crossTrail);
 }
 updateCrossTrail(car,dt,active){
  const rows=this.trailHistory.update(car,dt,active),geometry=this.crossTrail.geometry,positions=geometry.attributes.position,uv=geometry.attributes.trailUV,strength=geometry.attributes.strength;let count=0;
  for(let i=0;i<rows.length-1;i++){
   const a=rows[i],b=rows[i+1];if(Math.hypot(a.x-b.x,a.z-b.z)<.01)continue;const ca=crossAt(a),cb=crossAt(b);
   // Thin luminous rims keep the vertical ribbon readable directly behind the car.
   for(const [cross,row]of [[ca,a],[cb,b]])for(const endpoint of cross[1]){const nx=Math.cos(row.heading)*.02,nz=-Math.sin(row.heading)*.02;cross.push([[endpoint[0]-nx,endpoint[1],endpoint[2]-nz],[endpoint[0]+nx,endpoint[1],endpoint[2]+nz]]);}
   for(let axis=0;axis<4;axis++){if(axis&&Math.max(a.gauge,b.gauge)<.001)continue;
    const vertices=[ca[axis][0],ca[axis][1],cb[axis][1],ca[axis][0],cb[axis][1],cb[axis][0]],coords=[[0,a.age],[1,a.age],[1,b.age],[0,a.age],[1,b.age],[0,b.age]],alpha=[a.strength,a.strength,b.strength,a.strength,b.strength,b.strength];
    for(let k=0;k<6;k++){positions.setXYZ(count,...vertices[k]);uv.setXY(count,...coords[k]);strength.setX(count,alpha[k]);count++;}
   }
  }
  geometry.setDrawRange(0,count);positions.needsUpdate=uv.needsUpdate=strength.needsUpdate=true;this.crossTrail.visible=count>0;
 }
 setTrack(track){this.track=track;this.chunk=-Infinity;this.trailHistory.reset();this.cameraHeading=undefined;this.previousSpeed=undefined;this.accelerationView=0;this.lastMode=undefined;this.rebuild(24);}
 meshStrip(from,to,left,right,material,y=.01){
  const positions=[],uv=[],indices=[];
  for(let s=from,i=0;s<=to+STEP;s+=STEP,i++){
   const p=sampleTrack(this.track,s),nx=Math.cos(p.heading),nz=-Math.sin(p.heading);
   for(const side of [left,right]){positions.push(p.x+nx*side,y,p.z+nz*side);uv.push(side/6,s/6);}
   if(i)indices.push(i*2-2,i*2,i*2-1,i*2-1,i*2,i*2+1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;this.chunkGroup.add(mesh);
 }
 rebuild(s){
  if(this.chunkGroup){this.world.remove(this.chunkGroup);this.chunkGroup.traverse(o=>{if(o.geometry&&!this.sharedGeometries.has(o.geometry))o.geometry.dispose();if(o.userData.ownMaterial){o.material.map?.dispose();o.material.dispose();}});}
  this.chunk=Math.floor(s/96);this.chunkGroup=new THREE.Group();this.world.add(this.chunkGroup);const from=Math.max(0,this.chunk*96-160),to=Math.min(this.track.points.at(-1).s-16,from+1000);
  this.meshStrip(from,to,-4.2,4.2,this.roadMaterial);this.meshStrip(from,to,-9.4,-4.2,this.shoulderMaterial);this.meshStrip(from,to,4.2,9.4,this.shoulderMaterial);
  this.meshStrip(from,to,-4.2,-4.15,this.paint,.025);this.meshStrip(from,to,4.15,4.2,this.paint,.025);
  const boxes={concrete:[],dark:[],pole:[],light:[],red:[]},pools=[],wires=[];this.lampRows=[];
  const add=(kind,x,y,z,w,h,d,rot=0)=>boxes[kind].push({x,y,z,w,h,d,rot});
  const at=(s,offset)=>{const p=sampleTrack(this.track,s);return{...p,x:p.x+Math.cos(p.heading)*offset,z:p.z-Math.sin(p.heading)*offset};};
  const dash=[];for(let d=Math.ceil(from/12)*12;d<to;d+=12){const p=at(d,0);dash.push({x:p.x,y:.035,z:p.z,w:.1,h:.012,d:4,rot:p.heading});}boxes.light.push(...[]);
  const temp=new THREE.Object3D();const instances=(data,material,geometry=this.boxGeometry)=>{if(!data.length)return;const inst=new THREE.InstancedMesh(geometry,material,data.length);data.forEach((b,i)=>{temp.position.set(b.x,b.y,b.z);temp.rotation.set(0,b.rot,0);temp.scale.set(b.w,b.h,b.d);temp.updateMatrix();inst.setMatrixAt(i,temp.matrix);});inst.receiveShadow=true;inst.computeBoundingSphere();this.chunkGroup.add(inst);return inst;};instances(dash,this.paint);
  // Barriers, lamps and utilities share a handful of instance batches.
  const barrierRows=[];for(let d=Math.ceil(from/4)*4;d<to;d+=4)for(const side of [-1,1]){const p=at(d,side*9.95);barrierRows.push({x:p.x,y:0,z:p.z,w:1,h:1,d:1,rot:p.heading});}if(this.cityMeshes)instances(barrierRows,this.concrete,this.cityMeshes.barrier.geometry);
  for(let d=Math.ceil(from/64)*64;d<to;d+=64)for(const side of [-1,1]){
   const p=at(d,side*8);add('pole',p.x,4.1,p.z,.11,8.2,.11,p.heading);const q=at(d,side*6.5);add('pole',q.x,8.15,q.z,3.1,.12,.12,p.heading);const lamp=at(d,side*5.1);add('light',lamp.x,8.08,lamp.z,.85,.08,.25,p.heading);const pool=at(d,side*3.8);pools.push(pool);this.lampRows.push({x:lamp.x,z:lamp.z,target:pool});
  }
  if(this.cityMeshes){
   const rows=cityRows(this.track,from,to),byVariant=Array.from({length:24},()=>[]),roofs={crane:[],mast:[],plant:[]};
   for(const row of rows){
    byVariant[row.variant].push({x:row.x,y:row.y,z:row.z,w:row.w,h:row.h,d:row.d,rot:row.heading});
    const c=Math.cos(row.heading),sn=Math.sin(row.heading);
    if(row.label){const wall=this.cityMeshes['building_'+row.variant].walls[-row.side];if(wall){const lx=wall.x*row.w-row.side*.025,lz=(wall.z0+wall.z1)*.5*row.d,width=Math.min(row.number.length>2?6:4,(wall.z1-wall.z0)*row.d*.65),height=Math.min(6.5,(wall.y1-wall.y0)*row.h*.65);if(width>2&&height>2)this.addWallSign({x:row.x+c*lx+sn*lz,y:(wall.y0+wall.y1)*.5*row.h,z:row.z-sn*lx+c*lz,heading:row.heading,width,height},row.side,row.number,{factory:'WORKS',power:'POWER',warehouse:'STORAGE',quiet:'DEPOT'}[row.zone]);}}
    if(row.roof){const p=roofPose(row),scale=row.roofScale;roofs[row.roof].push({x:p.x,y:p.y,z:p.z,w:scale,h:scale,d:scale,rot:p.heading});
     const mark=(x,y,z)=>{const co=Math.cos(p.heading),si=Math.sin(p.heading);add('red',p.x+(co*x+si*z)*scale,p.y+y*scale,p.z+(-si*x+co*z)*scale,.16,.16,.16);};
     if(row.roof==='crane'){mark(0,12.1,0);mark(15,10.5,0);}else mark(0,row.roof==='mast'?5.2:4.7,0);
    }else if(row.s%72===0){add('red',row.x-c*row.w*.3,row.h+.15,row.z+sn*row.w*.3,.14,.14,.14);add('red',row.x+c*row.w*.3,row.h+.15,row.z-sn*row.w*.3,.14,.14,.14);}
   }
   byVariant.forEach((list,i)=>instances(list,i%3===0?this.darkConcrete:this.concrete,this.cityMeshes['building_'+i].geometry));
   for(const [kind,list]of Object.entries(roofs))instances(list,this.poleMaterial,this.cityMeshes[kind].geometry);
   this.cityStats={buildings:rows.length,cranes:roofs.crane.length,originalMeshes:28};
  }
  for(let d=Math.ceil(from/64)*64;d<to;d+=64)for(const side of [-1,1]){
   if(random(d*4513+side*19)()>.3)continue;
   const p=at(d,side*11),q=at(d+64,side*11);add('pole',p.x,6,p.z,.13,12,.13,p.heading);add('pole',p.x,11.6,p.z,2,.12,.12,p.heading);
   for(const shift of [-.7,.7])for(let k=0;k<10;k++){const u=k/10,v=(k+1)/10;wires.push(p.x+(q.x-p.x)*u+shift,11.8-Math.sin(u*Math.PI)*1.6,p.z+(q.z-p.z)*u,p.x+(q.x-p.x)*v+shift,11.8-Math.sin(v*Math.PI)*1.6,p.z+(q.z-p.z)*v);}
  }
  instances(boxes.concrete,this.concrete);instances(boxes.dark,this.darkConcrete);instances(boxes.pole,this.poleMaterial);instances(boxes.light,this.lightMaterial);this.beacons=instances(boxes.red,this.redMaterial);this.beaconRows=boxes.red;
  const poolGeo=new THREE.PlaneGeometry(16,30);for(const p of pools){const mesh=new THREE.Mesh(poolGeo,this.poolMaterial);mesh.rotation.set(-Math.PI/2,0,p.heading);mesh.position.set(p.x,.044,p.z);this.chunkGroup.add(mesh);}
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(wires,3));this.chunkGroup.add(new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:0x263d38})));
  // A physical finish gantry, with a visible chequered header.
  if(this.track.length>from&&this.track.length<to){const p=sampleTrack(this.track,this.track.length);const group=new THREE.Group();group.position.set(p.x,0,p.z);group.rotation.y=p.heading;for(const side of [-1,1]){const m=new THREE.Mesh(this.boxGeometry,this.poleMaterial);m.position.set(side*6,3.8,0);m.scale.set(.3,7.6,.3);group.add(m);}const c=document.createElement('canvas');c.width=512;c.height=64;const cx=c.getContext('2d');for(let x=0;x<32;x++)for(let y=0;y<4;y++){cx.fillStyle=(x+y)%2?'#1a2927':'#dadcc8';cx.fillRect(x*16,y*16,16,16);}const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(12,1.5),mat);mesh.position.y=7;mesh.userData.ownMaterial=true;group.add(mesh);this.chunkGroup.add(group);}
 }
 addWallSign(p,side,number,label){
  const c=document.createElement('canvas');c.width=256;c.height=384;const cx=c.getContext('2d');cx.fillStyle='#c4c3b9';cx.textAlign='center';cx.font='bold 170px sans-serif';cx.fillText(number,128,185);cx.font='bold 29px sans-serif';cx.fillText(label,128,255);const rng=random(Number(number));cx.globalCompositeOperation='destination-out';for(let i=0;i<1100;i++)cx.fillRect(rng()*256,rng()*384,rng()*6+1,rng()*3+1);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(p.width||4,p.height||6),mat);mesh.position.set(p.x,p.y||5.5,p.z);mesh.rotation.y=p.heading+(side===1?-Math.PI/2:Math.PI/2);mesh.userData.ownMaterial=true;this.chunkGroup.add(mesh);
 }
 resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.atmosphere?.resize();this.reflections?.resize();}
 setQuality(low){this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.6));this.renderer.shadowMap.enabled=!low;this.reflections.enabled=!low;this.resize();}
 render(car,dt,time,energy=0,brake=false,idle=false,active=true){
  this.renderer.info.reset();
  if(Math.floor(car.s/96)!==this.chunk)this.rebuild(car.s);
  this.world.position.set(-car.x,0,-car.z);this.car.rotation.y=car.heading;this.car.position.y=.008;
  for(const [tag,w]of Object.entries(this.wheels)){w.spin.rotation.x+=car.speed*dt/(w.radius*.8);w.hub.rotation.y=tag.endsWith('F')?car.steer:0;}
  for(const hinge of Object.values(this.lamps))hinge.rotation.x=THREE.MathUtils.damp(hinge.rotation.x,this.lightsOpen?-.506:0,9,dt);
  for(const l of this.headlights)l.intensity=this.lightsOpen?55:16;
  for(const m of this.tailMaterials)m.emissiveIntensity=brake?7:3;
  this.tailGlow.intensity=0;this.tailScatter.material.opacity=car.boost>0?.27:brake?.3:.15;this.updateCrossTrail(car,dt,active&&!idle);
  this.poolMaterial.opacity=.34+energy*.12;
  const lamps=this.lampRows?.map(p=>({...p,d:Math.hypot(p.x-car.x,p.z-car.z)})).sort((a,b)=>a.d-b.d)||[];
  this.streetLights.forEach((light,i)=>{const p=lamps[i];light.intensity=p?85*clamp((140-p.d)/45):0;if(p){light.position.set(p.x,8,p.z);light.target.position.set(p.target.x,0,p.target.z);}});
  if(this.beacons){this.beaconRows.forEach((p,i)=>{const seed=random(Math.round(p.x*17+p.z*31))(),period=1.6+seed*.6,amount=.08+.92*Math.max(0,Math.sin(time*Math.PI*2/period+seed*17))**6;this.beacons.setColorAt(i,this.warningColor.setRGB(2.5*amount,.012*amount,.004*amount));});this.beacons.instanceColor.needsUpdate=true;}
  if(this.verticalTailMesh){const gauge=clamp(car.nitro);this.verticalTailMesh.scale.y=gauge;this.verticalTailMesh.position.y=this.gaugeBottom*(1-gauge);this.verticalTailMesh.visible=gauge>.001;if(this.verticalTailGlow){this.verticalTailGlow.scale.y=gauge;this.verticalTailGlow.position.y=.435+.467*gauge;this.verticalTailGlow.visible=gauge>.001;this.verticalTailGlow.material.opacity=car.boost>0?.9:.65;}}
  const changed=this.lastMode!==this.mode;
  if(this.cameraHeading===undefined||changed)this.cameraHeading=car.heading;
  else this.cameraHeading+=Math.atan2(Math.sin(car.heading-this.cameraHeading),Math.cos(car.heading-this.cameraHeading))*(1-Math.exp(-dt*9));this.lastMode=this.mode;
  const h=this.cameraHeading;let local,target,baseFov;
  if(idle){local=new V(-5.8,3.1,-9.5).applyAxisAngle(new V(0,1,0),car.heading);target=new V(0,.9,1).applyAxisAngle(new V(0,1,0),car.heading);baseFov=58;this.camera.position.lerp(local,1-Math.exp(-dt*3));}
  else{const [back,height,lead,side,fov]=[[9.8,2.15,1.7,.8,58],[8,12.5,.3,.5,56],[-8.5,1.55,.2,.55,56],[-6.8,2.5,.2,6.5,55]][this.mode];local=new V(side,height,-back).applyAxisAngle(new V(0,1,0),h);target=new V(0,.55,lead).applyAxisAngle(new V(0,1,0),h);baseFov=fov;this.camera.position.copy(local);}
  this.look.copy(target);this.camera.lookAt(this.look);
  const accel=dt>0&&this.previousSpeed!==undefined?Math.max(0,(car.speed-this.previousSpeed)/dt):0;this.previousSpeed=car.speed;this.accelerationView=THREE.MathUtils.damp(this.accelerationView||0,Math.min(1,accel/6.4),accel?5.5:1.8,dt);
  const horizontalFov=baseFov+(this.accelerationView||0)*6+(car.boost>0?4:0),fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(horizontalFov)*.5)/this.camera.aspect));this.camera.fov=THREE.MathUtils.damp(this.camera.fov,fov,3,dt);this.camera.updateProjectionMatrix();this.reflections.update(dt);this.atmosphere.render(this.scene,this.camera,time,dt);
 }
}
