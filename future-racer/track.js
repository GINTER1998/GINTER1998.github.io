import {clamp,featureAt,random} from './music.js';
export const STEP=8,REFERENCE_SPEED=42,ROAD_HALF=4.2,BARRIER_HALF=9.45;
export function buildTrack(profile){
 const length=Math.max(80,profile.duration*REFERENCE_SPEED),rng=random(profile.seed),points=[];
 let x=0,z=0,heading=0,curve=0,target=0,lastPhrase=-1,beatIndex=0;
 const phraseSeconds=profile.bpm?Math.max(4,240/profile.bpm):8;
 for(let s=0;s<=length+900;s+=STEP){
  const t=Math.min(profile.duration,s/REFERENCE_SPEED),energy=featureAt(profile,t);
  while(beatIndex<profile.beats.length&&profile.beats[beatIndex]<=t)beatIndex++;
  const phrase=profile.confidence>=.15&&profile.beats.length>=8?Math.floor(beatIndex/8):Math.floor(t/phraseSeconds);
  if(phrase!==lastPhrase){target=(rng()>.5?1:-1)*(.00035+energy*.0024)*(profile.confidence<.15?.35:1)*(profile.bpm?clamp(profile.bpm/120,.65,1.4):.65);lastPhrase=phrase;}
  const fade=clamp((s-100)/160)*clamp((length-s)/180);
  curve+=(target*fade-heading*.0014-curve)*.12;heading=clamp(heading+curve*STEP,-.85,.85);
  points.push({x,z,s,heading,energy,t});x+=Math.sin(heading)*STEP;z+=Math.cos(heading)*STEP;
 }
 return{points,length,profile};
}
export function sampleTrack(track,s){
 s=clamp(s,0,track.points.at(-1).s-.01);const f=s/STEP,i=Math.floor(f),u=f-i,a=track.points[i],b=track.points[i+1]||a;
 return{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,heading:a.heading+(b.heading-a.heading)*u,energy:a.energy+(b.energy-a.energy)*u,s};
}
export function nearestTrack(track,x,z,hint=0){
 let best={distance:Infinity};const center=Math.floor(hint/STEP),min=Math.max(0,center-35),max=Math.min(track.points.length-1,center+45);
 for(let i=min;i<max;i++){
  const a=track.points[i],b=track.points[i+1],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz));
  const px=a.x+u*dx,pz=a.z+u*dz,d=Math.hypot(x-px,z-pz);
  if(d<best.distance)best={distance:d,s:a.s+u*STEP,offset:(x-px)*Math.cos(a.heading)-(z-pz)*Math.sin(a.heading),heading:a.heading,x:px,z:pz};
 }return best;
}
export function initialCar(track){const p=sampleTrack(track,24);return{x:p.x,z:p.z,heading:p.heading,s:24,speed:0,steer:0,nitro:1,boost:0,charging:0,collisions:0,contact:false,distance:0,maxSpeed:0};}
export function startBoost(car){if(car.boost===0&&car.nitro>=.999&&car.speed>2){car.boost=5;car.nitro=0;car.charging=0;}}
export function stepCar(car,input,dt,track){
 dt=Math.min(dt,.025);const brake=!!input.brake;
 if(brake&&car.boost>0){car.boost=0;car.charging=0;}
 if(car.boost>0){car.boost=Math.max(0,car.boost-dt);car.nitro=car.boost/5;if(car.boost===0)car.nitro=0;}
 else if(car.nitro<1){car.charging+=dt;car.nitro=clamp(car.charging/3);}
 const limit=car.boost>0?91:65,throttle=Number(!!input.forward)-Number(!!input.reverse);
 let acceleration=throttle*(car.speed*throttle<0?22:car.speed<0?10:15.5);
 acceleration-=Math.sign(car.speed)*(.9+car.speed*car.speed*.0029);
 if(car.boost>0&&car.speed>=0)acceleration+=24;
 if(brake)acceleration-=Math.sign(car.speed)*29;
 const old=car.speed;car.speed=clamp(car.speed+acceleration*dt,-11,limit);
 if(!throttle&&Math.abs(car.speed)<.12||brake&&old*car.speed<0)car.speed=0;
 const steer=(Number(!!input.left)-Number(!!input.right));
 // The chase camera looks along +Z: screen-left is world +X.
 const target=steer*(.52/(1+Math.abs(car.speed)*.045));car.steer+=(target-car.steer)*Math.min(1,dt*8);
 car.heading+=Math.tan(car.steer)*car.speed/2.368*dt;
 car.x+=Math.sin(car.heading)*car.speed*dt;car.z+=Math.cos(car.heading)*car.speed*dt;
 let near=nearestTrack(track,car.x,car.z,car.s);const bound=BARRIER_HALF-1.15;
 if(Math.abs(near.offset)>bound){
  const sign=Math.sign(near.offset),excess=Math.abs(near.offset)-bound;
  car.x-=Math.cos(near.heading)*sign*excess;car.z+=Math.sin(near.heading)*sign*excess;
  const angle=car.heading-near.heading,tangent=Math.cos(angle),normal=Math.sin(angle);
  if(normal*Math.sign(car.speed)*sign>0){car.speed*=Math.abs(tangent);car.heading-=normal*sign>0?Math.min(Math.abs(normal)*dt*2,.04)*sign:-Math.min(Math.abs(normal)*dt*2,.04)*sign;}
  if(!car.contact&&Math.abs(old)>3)car.collisions++;car.contact=true;
 }else car.contact=false;
 if(near.s<2&&car.speed<0)car.speed=0;
 car.s=near.s;car.distance+=Math.abs(car.speed)*dt;car.maxSpeed=Math.max(car.maxSpeed,Math.abs(car.speed));
 return near;
}
