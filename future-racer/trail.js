// Two intersecting ribbons follow the rear cross light's actual driving path.
export class CrossTrailHistory {
 constructor(){this.reset();}
 reset(){this.points=[];this.clock=0;this.lastSample=-1;this.envelope=0;this.lastPose=null;}
 update(car,dt,active=true){
  if(this.lastPose&&Math.hypot(car.x-this.lastPose.x,car.z-this.lastPose.z)>80)this.reset();
  this.lastPose={x:car.x,z:car.z};
  if(dt>0){
   this.clock+=dt;const target=active&&car.boost>0?1:0;
   this.envelope+=(target-this.envelope)*(1-Math.exp(-dt/(target>this.envelope?.08:.45)));
   this.points=this.points.filter(p=>this.clock-p.time<1.2);
   if(this.envelope>.002&&this.clock-this.lastSample>=1/30&&(!this.points.length||Math.hypot(car.x-this.points[0].x,car.z-this.points[0].z)>.08)){
    this.points.unshift({x:car.x,z:car.z,heading:car.heading,time:this.clock,strength:this.envelope,gauge:target?car.nitro:0});
    this.points.length=Math.min(this.points.length,40);this.lastSample=this.clock;
   }
  }
  if(!this.points.length)return [];
  const rows=[{...car,age:0,strength:this.envelope,gauge:active&&car.boost>0?car.nitro:0}];
  for(const p of this.points){const d=Math.hypot(p.x-car.x,p.z-car.z);if(d>45)break;const u=Math.max(0,Math.min(1,(d-32)/13));rows.push({...p,age:(this.clock-p.time)/1.2,strength:p.strength*(1-u*u*(3-2*u))});}
  return rows;
 }
}
export function crossAt(p){
 const s=Math.sin(p.heading),c=Math.cos(p.heading),x=p.x-s*2.016,z=p.z-c*2.016;
 return [[[x-c*.8448,.52,z+s*.8448],[x+c*.8448,.52,z-s*.8448]],[[x,.348,z],[x,.348+.7472*p.gauge,z]]];
}
