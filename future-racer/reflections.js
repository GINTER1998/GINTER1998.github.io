import * as THREE from './vendor/three.module.js';
// Rough wet-road reflections and a low-resolution street probe, as in TD v5.23–5.30.
export class StreetReflections{
 constructor(race){
  this.race=race;this.age=1;this.probeAge=1;this.enabled=true;
  this.target=new THREE.WebGLRenderTarget(480,270,{type:THREE.HalfFloatType,depthBuffer:true});this.camera=new THREE.PerspectiveCamera();
  this.matrix=new THREE.Matrix4();this.uniforms={roadReflection:{value:this.target.texture},roadReflectionMatrix:{value:this.matrix},roadReflectionPixel:{value:new THREE.Vector2(1/480,1/270)}};
  this.cubeTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});this.cubeCamera=new THREE.CubeCamera(.15,420,this.cubeTarget);this.cubeCamera.position.set(0,1.2,0);
  this.attachRoad();
 }
 attachRoad(){
  const mat=this.race.roadMaterial;mat.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nuniform mat4 roadReflectionMatrix;varying vec4 vRoadReflection;varying vec2 vRoadMetric;`);
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>\nvRoadReflection=roadReflectionMatrix*modelMatrix*vec4(transformed,1.);vRoadMetric=uv*6.;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform sampler2D roadReflection;uniform vec2 roadReflectionPixel;varying vec4 vRoadReflection;varying vec2 vRoadMetric;
float wetHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wetNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wetHash(i),wetHash(i+vec2(1,0)),f.x),mix(wetHash(i+vec2(0,1)),wetHash(i+1.),f.x),f.y);}`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
vec2 reflectionUV=vRoadReflection.xy/max(vRoadReflection.w,.0001);
float valid=step(0.,reflectionUV.x)*step(reflectionUV.x,1.)*step(0.,reflectionUV.y)*step(reflectionUV.y,1.)*step(0.,vRoadReflection.w);
vec2 blur=roadReflectionPixel*2.2;
vec3 reflected=texture2D(roadReflection,reflectionUV).rgb*.36;
reflected+=(texture2D(roadReflection,reflectionUV+vec2(blur.x,0)).rgb+texture2D(roadReflection,reflectionUV-vec2(blur.x,0)).rgb+texture2D(roadReflection,reflectionUV+vec2(0,blur.y)).rgb+texture2D(roadReflection,reflectionUV-vec2(0,blur.y)).rgb)*.16;
float wet=smoothstep(.54,.78,wetNoise(vRoadMetric*vec2(.28,.045)))*.23*valid;
outgoingLight=mix(outgoingLight,reflected,wet);
#include <opaque_fragment>`);
  };mat.customProgramCacheKey=()=> 'TD-rough-wet-road-v3';
 }
 resize(){const aspect=this.race.camera.aspect,w=480,h=Math.round(w/aspect);this.target.setSize(w,h);this.uniforms.roadReflectionPixel.value.set(1/w,1/h);}
 update(dt){
  if(!this.enabled)return;this.age+=dt;this.probeAge+=dt;if(this.age<1/30)return;this.age=0;
  const r=this.race,renderer=r.renderer,scene=r.scene,camera=r.camera,hidden=[];
  scene.traverse(o=>{if(o.visible&&(o===r.car||o===r.base||o===r.crossTrail||o.material===r.roadMaterial||o.userData.excludeFromReflections)){hidden.push(o);o.visible=false;}});
  const oldFog=scene.fog,oldEnvironment=scene.environment,shadowAuto=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;scene.fog=new THREE.FogExp2(0x315f61,.006);scene.environment=r.environment.texture;
  if(this.probeAge>=.1){this.probeAge=0;this.cubeCamera.update(renderer,scene);this.cubeTarget.texture.needsPMREMUpdate=true;this.hasProbe=true;}
  this.camera.copy(camera);this.camera.position.copy(camera.position);this.camera.position.y=-camera.position.y+.02;const dir=camera.getWorldDirection(new THREE.Vector3());dir.y=-dir.y;this.camera.up.set(0,-1,0);this.camera.lookAt(this.camera.position.clone().add(dir));this.camera.updateMatrixWorld();
  this.matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse);
  renderer.setRenderTarget(this.target);renderer.render(scene,this.camera);renderer.setRenderTarget(null);scene.fog=oldFog;scene.environment=this.hasProbe?this.cubeTarget.texture:oldEnvironment;renderer.shadowMap.autoUpdate=shadowAuto;for(const object of hidden)object.visible=true;
 }
}
