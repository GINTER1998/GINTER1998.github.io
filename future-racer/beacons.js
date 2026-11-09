import * as THREE from './vendor/three.module.js';
import {random} from './music.js';
export function beaconPulse(time,seed){
 const r=random(seed)(),period=1.6+r*.6;
 return .35+.65*(.5+.5*Math.cos(time*Math.PI*2/period+r*17))**3;
}
export class RoofBeacons{
 constructor(rows,boxGeometry){
  this.rows=rows;this.color=new THREE.Color();this.resolution=new THREE.Vector2(1,1);
  this.core=new THREE.InstancedMesh(boxGeometry,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),rows.length);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:true,depthTest:true,toneMapped:false,uniforms:{resolution:{value:this.resolution},pixelRatio:{value:1}},vertexShader:`
uniform vec2 resolution;uniform float pixelRatio;varying vec2 vHalo;varying vec3 vBeaconColor;
void main(){vec4 centre=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);gl_Position=projectionMatrix*centre;float size=clamp(1100./max(1.,-centre.z),4.,16.)*pixelRatio;gl_Position.xy+=position.xy*size*2./resolution*gl_Position.w;vHalo=uv*2.-1.;vBeaconColor=instanceColor;}`,
   fragmentShader:`varying vec2 vHalo;varying vec3 vBeaconColor;void main(){float radius=dot(vHalo,vHalo);float alpha=exp(-radius*5.)*.48+exp(-radius*55.)*.52;if(radius>1.||alpha<.01)discard;gl_FragColor=vec4(vBeaconColor,alpha);}`});
  this.glow=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,rows.length);
  this.glow.frustumCulled=false;this.glow.renderOrder=20;this.glow.userData.excludeFromReflections=true;
  this.core.userData.ownMaterial=this.glow.userData.ownMaterial=true;
  const temp=new THREE.Object3D();rows.forEach((p,i)=>{temp.position.set(p.x,p.y,p.z);temp.scale.set(Math.max(.28,p.w),Math.max(.28,p.h),Math.max(.28,p.d));temp.updateMatrix();this.core.setMatrixAt(i,temp.matrix);temp.scale.set(1,1,1);temp.updateMatrix();this.glow.setMatrixAt(i,temp.matrix);});
  this.core.computeBoundingSphere();this.update(0,1,1,1);
 }
 update(time,width,height,pixelRatio){
  this.resolution.set(width,height);this.glow.material.uniforms.pixelRatio.value=pixelRatio;
  this.rows.forEach((p,i)=>{const amount=beaconPulse(time,p.phase??Math.round(p.x*17+p.z*31));this.core.setColorAt(i,this.color.setRGB(3*amount,.018*amount,.006*amount));this.glow.setColorAt(i,this.color.setRGB(2.5*amount,.014*amount,.004*amount));});
  this.core.instanceColor.needsUpdate=this.glow.instanceColor.needsUpdate=true;
 }
}
