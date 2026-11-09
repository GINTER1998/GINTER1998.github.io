import * as THREE from './vendor/three.module.js';
export function concreteMaterial(color){
 const material=new THREE.MeshStandardMaterial({color,metalness:0,roughness:.94,envMapIntensity:.08});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
varying vec3 vConcreteLocal;
varying vec3 vConcreteFace;
varying float vConcreteSeed;`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 metricScale=vec3(1.0);
vConcreteSeed=0.0;
#ifdef USE_INSTANCING
metricScale=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
vConcreteSeed=dot(instanceMatrix[3].xz,vec2(.173,.319));
#endif
vConcreteLocal=position*metricScale;
vConcreteLocal.y+=metricScale.y*.5;
vConcreteFace=abs(normal);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vConcreteLocal;
varying vec3 vConcreteFace;
varying float vConcreteSeed;
float cementHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cementNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cementHash(i),cementHash(i+vec2(1,0)),f.x),mix(cementHash(i+vec2(0,1)),cementHash(i+1.0),f.x),f.y);}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 cementUV=vConcreteFace.y>.65?vConcreteLocal.xz:(vConcreteFace.x>vConcreteFace.z?vConcreteLocal.zy:vConcreteLocal.xy);
vec2 panel=vec2(3.6,2.8),q=mod(cementUV,panel),edge=min(q,panel-q);
float footprint=max(length(dFdx(cementUV)),length(dFdy(cementUV)));
float fineLOD=1.0-smoothstep(.025,.13,footprint);
vec2 sigma=sqrt(vec2(.008*.008)+pow(fwidth(cementUV)*.6,vec2(2.0)));
vec2 coverage=(.008/sigma)*exp(-.5*pow(edge/sigma,vec2(2.0)));
float seam=max(coverage.x,coverage.y);
float tone=.98+.045*(cementNoise(cementUV*.34+vConcreteSeed)-.5);
tone+=.022*(cementNoise(cementUV*18.0)-.5)*fineLOD;
tone+=.025*(cementHash(floor(cementUV/panel)+vConcreteSeed)-.5);
tone-=seam*.15;
if(vConcreteFace.y<.65){
 vec2 holeDelta=min(abs(q-vec2(.43)),abs(q-(panel-vec2(.43))));
 float dist=length(holeDelta),aa=max(footprint*.6,.002);
 float hole=1.0-smoothstep(.025-aa,.038+aa,dist);
 float rim=exp(-pow((dist-.047)/max(.008,aa),2.0));
 tone-=hole*.30*fineLOD;tone+=rim*.025*fineLOD;
 float runoff=smoothstep(.57,.84,cementNoise(cementUV*vec2(.65,.018)+vConcreteSeed));
 tone-=runoff*.055;
 tone-=(1.0-smoothstep(.1,2.1,vConcreteLocal.y))*.12;
}
diffuseColor.rgb*=tone;`);
 };
 material.customProgramCacheKey=()=> 'metric-neutral-concrete-v2';
 return material;
}
