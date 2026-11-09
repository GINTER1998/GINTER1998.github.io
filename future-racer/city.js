import {random,featureAt} from './music.js';
import {sampleTrack,nearestTrack} from './track.js?v=20261108-3';
export const ROOF_ANCHORS=[[.36,.15],[-.29,.21],[0,0],[.31,0],[-.31,0],[-.265,0],[.17,.17],[0,-.19],[0,0],[0,0],[.24,0],[0,0]];
export function cityRows(track,from,to){
 const rows=[];
 for(let s=Math.floor(from/36)*36;s<to;s+=36)for(const side of [-1,1]){
  if(s<0)continue;const rng=random(s*7919+(side>0?17:71)),p=sampleTrack(track,s),energy=featureAt(track.profile,s/42),zone=['factory','power','warehouse','quiet'][(Math.floor(s/288)+1)%4];
  const make=(layer,station)=>{
   const t=sampleTrack(track,station),w=layer?23+rng()*9:19+rng()*9,d=layer?16+rng()*7:26+rng()*9;
   let h=(layer?65+rng()*30:20+rng()*12)*(.65+(layer?1.25:.65)*energy),variant=Math.floor(rng()*12)+12*layer;
   if(!layer&&Math.floor(s/36)%6===2)variant=7;if(!layer&&[3,6,9].includes(variant))h*=1.35;
   const offset=side*((layer?43:14)+w*.5+rng()*2),x=t.x+Math.cos(t.heading)*offset,z=t.z-Math.sin(t.heading)*offset;
   // Conservative whole-footprint clearance, including curved roads beside roof props.
   for(const lx of [-w*.5,0,w*.5])for(const lz of [-d*.5,0,d*.5]){const wx=x+Math.cos(t.heading)*lx+Math.sin(t.heading)*lz,wz=z-Math.sin(t.heading)*lx+Math.cos(t.heading)*lz;if(nearestTrack(track,wx,wz,station).distance<11.5)return;}
   const roll=rng(),crane={factory:.25,power:.09,warehouse:.09,quiet:.04}[zone],mast={factory:.08,power:.28,warehouse:.05,quiet:.04}[zone],plant={factory:.25,power:.1,warehouse:.1,quiet:.03}[zone];
   let roof=roll<crane?'crane':roll<crane+mast?'mast':roll<crane+mast+plant?'plant':null;if(variant===6)roof=null;
   rows.push({s:station,x,y:h*.5,z,w,h,d,variant,side,heading:t.heading,zone,layer,roof,roofYaw:rng()*Math.PI*2,roofScale:.8+rng()*.4,number:rng()<.8?String(Math.floor(rng()*100)).padStart(2,'0'):['1802','5063','5089','1094'][Math.floor(rng()*4)],label:rng()<.55&&!layer});
  };
  make(0,s);if(Math.floor(s/36)%3===1&&rng()<.5)make(1,s+18);
 }
 return rows;
}
export function roofPose(row){const [ax,az]=row.variant<12?ROOF_ANCHORS[row.variant]:row.variant%4===1?[-.22,0]:row.variant%4===2?[.17,.14]:[0,0];const c=Math.cos(row.heading),s=Math.sin(row.heading);return{x:row.x+c*ax*row.w+s*az*row.d,y:row.h,z:row.z-s*ax*row.w+c*az*row.d,heading:row.heading+row.roofYaw};}
