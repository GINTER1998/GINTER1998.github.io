import * as THREE from './vendor/three.module.js';
// Ported from TD v5.30 black_mist_grade.frag and film_finish.frag.
export class Atmosphere{
 constructor(renderer){
  this.renderer=renderer;this.frame=0;
  this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1),samples:4});
  this.uniforms={image:{value:this.target.texture},depthMap:{value:this.target.depthTexture},resolution:{value:new THREE.Vector2()},forward:{value:new THREE.Vector3()},right:{value:new THREE.Vector3()},up:{value:new THREE.Vector3()},tanFov:{value:new THREE.Vector2()},cameraHeight:{value:2.15},time:{value:0},frameSeed:{value:0},grain:{value:.025},nearFar:{value:new THREE.Vector2(.1,1400)}};
  const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
varying vec2 vUv;out vec4 outputColor;
uniform sampler2D image;uniform sampler2D depthMap;uniform vec2 resolution;uniform vec3 forward,right,up;uniform vec2 tanFov;uniform float cameraHeight,time,frameSeed,grain;uniform vec2 nearFar;
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
uint scramble(uint x){x^=x>>16u;x*=0x7feb352du;x^=x>>15u;x*=0x846ca68bu;x^=x>>16u;return x;}
float randomGrain(uvec2 p,uint f,uint salt){return float(scramble(p.x*0x9e3779b9u^p.y*0x85ebca6bu^f*0xc2b2ae35u^salt)>>8u)*(1./16777216.);}
void main(){
 vec2 uv=vUv,px=1./resolution;
 vec3 ray=normalize(forward+(uv.x*2.-1.)*right*tanFov.x+(uv.y*2.-1.)*up*tanFov.y);
 float d=texture(depthMap,uv).r,z=d*2.-1.;float depth=2.*nearFar.x*nearFar.y/(nearFar.y+nearFar.x-z*(nearFar.y-nearFar.x));
 vec3 raw=texture(image,uv).rgb;vec3 src=1.-exp(-max(raw,vec3(0))*1.1);
 vec3 linear=pow(max(src,vec3(0)),vec3(2.2));float light=lum(linear);linear*=vec3(1.016,1.,.972);linear*=light/max(lum(linear),.00001);linear=mix(vec3(light),linear,.78);
 vec3 c=pow(max(linear,vec3(0)),vec3(1./2.2))*.95;
 vec3 bloom=vec3(0);for(int i=0;i<8;i++){float a=float(i)*.78539816;bloom+=max(texture(image,uv+vec2(cos(a),sin(a))*px*4.).rgb-.8,vec3(0));}c+=bloom*.125*.26;
 vec2 angles=vec2(atan(ray.x,ray.z),asin(clamp(ray.y,-1.,1.)));float t=time*.65;
 float mist=noise(angles*vec2(3.8,4.8)+vec2(-t*.06,t*.018))*.65+noise(angles*vec2(8.,9.)+vec2(t*.025,-t*.035))*.35;
 float fog=smoothstep(20.,360.,depth);float extinction=exp(-2.4*.716*fog*(.93+.07*mist));float horizon=1.-smoothstep(335.,360.,depth);
 float horizontalGlow=exp(-pow(angles.x/.68,2.)),verticalGlow=exp(-pow((angles.y-.025)/.24,2.));
 float horizonGlow=verticalGlow*(.12+.88*horizontalGlow),elevation=smoothstep(0.,.50,max(ray.y,0.));
 vec3 skyBase=mix(vec3(.19,.46,.46),vec3(.045,.20,.23),elevation);vec3 sky=mix(skyBase,vec3(.55,.73,.68),horizonGlow*.60);
 float rayDistance=depth/max(dot(ray,forward),.15),worldHeight=cameraHeight+ray.y*rayDistance;
 float groundLayer=exp(-max(worldHeight,0.)/10.)*smoothstep(30.,190.,depth);extinction*=exp(-.26*groundLayer);
 c=mix(c,vec3(lum(c))*.99,.13*smoothstep(55.,190.,depth));sky*=.96+.15*(mist-.5);
 float lowMist=(1.-smoothstep(.03,.32,abs(ray.y)))*groundLayer;sky=mix(sky,vec3(.29,.49,.48),lowMist*.22);
 c=depth>490.?sky:mix(sky,c,extinction*horizon);
 uvec2 p=uvec2(gl_FragCoord.xy);uint f=uint(frameSeed);
 float g=(randomGrain(p,f,0xa511e9b3u)+randomGrain(p,f,0x63d83595u)+randomGrain(p,f,0xb5297a4du)-1.5)*2.;
 float l=lum(c),response=mix(.35,1.,smoothstep(.015,.20,l))*mix(1.,.5,smoothstep(.55,1.,l));c+=g*grain*response;
 outputColor=vec4(max(c,vec3(0)),1.);
}`});
  this.scene=new THREE.Scene();this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));this.camera=new THREE.Camera();
 }
 resize(){const s=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.target.setSize(s.x,s.y);this.uniforms.resolution.value.copy(s);}
 render(scene,camera,time,dt){
  const u=this.uniforms;camera.updateMatrixWorld();camera.getWorldDirection(u.forward.value);u.right.value.setFromMatrixColumn(camera.matrixWorld,0);u.up.value.setFromMatrixColumn(camera.matrixWorld,1);u.tanFov.value.set(Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*camera.aspect,Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5));u.cameraHeight.value=camera.position.y;u.time.value=time;if(dt>0)this.frame++;u.frameSeed.value=this.frame;
  this.renderer.setRenderTarget(this.target);this.renderer.render(scene,camera);this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);
 }
}
