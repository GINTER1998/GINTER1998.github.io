import {clamp,featureAt,random} from './music.js';
import {BODY_OUTLINE} from './body.js';
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
export function initialCar(track){const p=sampleTrack(track,24);return{x:p.x,z:p.z,heading:p.heading,s:24,speed:0,vx:0,vz:0,steer:0,steerInput:0,rack:0,nitro:1,boost:0,charging:0,collisions:0,contact:false,distance:0,maxSpeed:0};}
export function startBoost(car){if(car.boost===0&&car.nitro>=.999&&car.speed>2){car.boost=5;car.nitro=1;car.charging=0;}}
export function steeringProfile(speed){
 const kmh=Math.abs(speed)*3.6,knots=[[0,34],[20,32],[60,21],[100,12],[160,6.4],[220,4],[300,2.6]];let degrees=2.6;
 for(let i=0;i<knots.length-1;i++){const [a,lo]=knots[i],[b,hi]=knots[i+1];if(kmh<=b){const u=clamp((kmh-a)/(b-a)),s=u*u*(3-2*u);degrees=lo+(hi-lo)*s;break;}}
 const high=clamp((kmh-60)/80),blend=clamp(kmh/220);degrees*=1-.3*high*high*(3-2*high);
 return{lock:degrees*Math.PI/180,exponent:1.05+.5*blend,rackRate:10.5-4*blend};
}
export function engineAcceleration(speed){const v=Math.max(0,speed),u=clamp(v/18),spool=.78+.22*u*u*(3-2*u);return Math.min(6.4,315000/(1250*Math.max(25,v)))*spool;}
export function stepCar(car,input,dt,track){
 dt=Math.min(dt,.025);const brake=!!input.brake;
 if(brake&&car.boost>0){car.boost=0;car.charging=0;car.nitro=0;}
 if(car.boost>0){car.boost=Math.max(0,car.boost-dt);car.nitro=car.boost/5;if(car.boost===0)car.nitro=0;}
 else if(car.nitro<1){car.charging+=dt;car.nitro=clamp(car.charging/3);}
 const boosting=car.boost>0,limit=(300+(boosting?95:0))/3.6,throttle=!!input.forward||boosting;
 let acceleration=throttle?engineAcceleration(car.speed):0;if(boosting)acceleration+=11.5;
 if(input.reverse&&!boosting)acceleration=car.speed>.5?-18:-5.5;
 acceleration-=car.speed*.006+car.speed*Math.abs(car.speed)*.000295+Math.sign(car.speed)*Math.min(.13,Math.abs(car.speed)/Math.max(dt,.001));
 if(brake)acceleration-=Math.sign(car.speed)*18;
 const old=car.speed;car.speed=clamp(car.speed+acceleration*dt,-8,Math.max(old,limit));
 if(!throttle&&!input.reverse&&Math.abs(car.speed)<.02||brake&&old*car.speed<=0)car.speed=0;
 const key=Number(!!input.left)-Number(!!input.right),keyWeight=1-.18*clamp((Math.abs(car.speed)*3.6-10)/50),command=key*keyWeight,profile=steeringProfile(car.speed);
 // Digital keys progressively move the rack; a tap never applies full wheel lock.
 const reversing=command*(car.steerInput||0)<0;
 const attack=reversing?.065:Math.abs(car.speed)>5?.09:.07,release=.05;
 car.steerInput=(car.steerInput||0)+(command-(car.steerInput||0))*(1-Math.exp(-dt/(command?attack:release)));
 const target=Math.sign(car.steerInput)*Math.abs(car.steerInput)**profile.exponent;
 car.rack=(car.rack||0)+(target-(car.rack||0))*(1-Math.exp(-dt*profile.rackRate*(command?1.8:2.2)));
 const angle=car.rack*profile.lock,gripLock=Math.atan(2.368*18/Math.max(16,car.speed*car.speed));
 car.steer=clamp(angle,-gripLock,gripLock);
 car.heading+=Math.tan(car.steer)*car.speed/2.368*dt;
 // A blocked car can pivot only while the player steers and applies drive.
 // Contact never chooses a road heading or overrides the player's steering.
 if(car.contact&&Math.abs(car.speed)<3&&key&&(input.forward||input.reverse)){
  const driveDirection=input.reverse&&!input.forward?-1:1;
  car.heading+=clamp(car.steerInput/Math.max(.1,keyWeight),-1,1)*driveDirection*1.15*dt;
 }
 const sin=Math.sin(car.heading),cos=Math.cos(car.heading),side=((car.vx||0)*cos-(car.vz||0)*sin)*Math.exp(-9*dt);
 car.vx=sin*car.speed+cos*side;car.vz=cos*car.speed-sin*side;
 car.x+=car.vx*dt;car.z+=car.vz*dt;
 let near=nearestTrack(track,car.x,car.z,car.s);const wasContact=car.contact;car.contact=false;
 if(near.distance>BARRIER_HALF-2.4)resolveBodyContact(car,track,dt);
 if(car.contact&&!wasContact&&Math.abs(old)>3)car.collisions++;
 near=nearestTrack(track,car.x,car.z,near.s);
 if(near.s<2&&car.speed<0)car.speed=0;
 car.s=near.s;car.distance+=Math.abs(car.speed)*dt;car.maxSpeed=Math.max(car.maxSpeed,Math.abs(car.speed));
 return near;
}
export function resolveBodyContact(car,track,dt){
 const bound=BARRIER_HALF-.015;
 for(let iteration=0;iteration<8;iteration++){
  const sn=Math.sin(car.heading),co=Math.cos(car.heading),contacts=BODY_OUTLINE.map(([lat,long])=>{
   const x=car.x+sn*long+co*lat,z=car.z+co*long-sn*lat,p=nearestTrack(track,x,z,car.s),sign=p.offset>0?1:-1;
   return{depth:Math.abs(p.offset)-bound,nx:Math.cos(p.heading)*sign,nz:-Math.sin(p.heading)*sign,x,z};
  }).sort((a,b)=>b.depth-a.depth),worst=contacts[0];if(worst.depth<-.001)break;
  const {depth,nx,nz}=worst,inward=car.vx*nx+car.vz*nz;car.contact=true;
  if(inward>0){car.vx-=nx*inward;car.vz-=nz*inward;}
  if(depth<=0)break;
  car.x-=nx*(depth+.0005);car.z-=nz*(depth+.0005);
 }
 if(car.contact)car.speed=car.vx*Math.sin(car.heading)+car.vz*Math.cos(car.heading);
}
