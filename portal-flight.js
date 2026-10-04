(function(root) {
  'use strict';
  const duration=3400;
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
  const range=(t,a,b)=>smooth((t-a)/(b-a));
  const point=(a,b,c,d,t)=>Math.pow(1-t,3)*a+3*Math.pow(1-t,2)*t*b+3*(1-t)*t*t*c+t*t*t*d;
  const number=v=>v.toFixed(2);

  function ribbon(anchor,size,t,phase) {
    const length=size*(.64+.55*t), points=[], widths=[];
    for(let i=0;i<=32;i++) {
      const s=i/32;
      points.push({x:anchor.x-length*s,
        y:anchor.y+length*.44*s+Math.sin(s*Math.PI*2.1-t*4+phase)*length*.085*s});
      widths.push(size*.038*(.8+.6*Math.sin(Math.PI*s))*Math.pow(1-s,.72));
    }
    const left=[],right=[];
    points.forEach((p,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(32,i+1)];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      left.push({x:p.x-dy/len*widths[i],y:p.y+dx/len*widths[i]});
      right.push({x:p.x+dy/len*widths[i],y:p.y-dx/len*widths[i]});
    });
    return [...left,...right.reverse()].map((p,i)=>`${i?'L':'M'}${number(p.x)} ${number(p.y)}`).join(' ')+' Z';
  }

  function sample(progress,width,height) {
    const t=clamp(progress), travel=smooth(t);
    const base=Math.min(height*.78,width*.86,820);
    const scale=.105+.875*range(t,.045,.88);
    const size=base*scale;
    // Begin in the same central light the enlarged eye leaves behind.
    const x=width*point(.49,.36,.91,1.37,travel);
    const y=height*point(.535,.67,.36,-.12,travel);
    const rotation=-7+11*smooth(t/.9), angle=rotation*Math.PI/180;
    const anchor=(u,v)=>({x:x+Math.cos(angle)*u*size-Math.sin(angle)*v*size,
      y:y+Math.sin(angle)*u*size+Math.cos(angle)*v*size});
    const opacity=range(t,.025,.29)*(1-range(t,.74,.96));
    const silkOpacity=range(t,.12,.36)*(1-range(t,.85,1));
    const a=anchor(.11,-.015),b=anchor(.145,.07);
    return {t,x,y,base,size,scale,rotation,opacity,silkOpacity,
      blur:2.6*(1-range(t,.08,.38)),
      saturation:.24+.65*range(t,.12,.45),sepia:.64*(1-range(t,.12,.48)),
      sway:Math.sin(t*5-1)*.75,
      blue:ribbon(a,size,t,0),red:ribbon(b,size,t,1.1),anchorBlue:a,anchorRed:b};
  }

  function create(world) {
    const figure=world.querySelector('.story-world__apsara');
    const svg=world.querySelector('.story-world__threads');
    const blue=world.querySelector('#flight-silk-teal');
    const red=world.querySelector('#flight-silk-red');
    let raf=0, running=false, startTime=0;
    function paint(now) {
      if(!running)return;
      const width=world.clientWidth,height=world.clientHeight;
      const p=sample((now-startTime)/duration,width,height);
      figure.style.width=`${p.base}px`;
      figure.style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) rotate(${p.rotation}deg) scale(${p.scale})`;
      figure.style.opacity=p.opacity;
      figure.style.filter=`blur(${p.blur}px) saturate(${p.saturation}) sepia(${p.sepia}) drop-shadow(0 8px 20px rgba(12,8,4,.18))`;
      figure.style.setProperty('--silk-sway',`${p.sway}deg`);
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      blue.setAttribute('d',p.blue);red.setAttribute('d',p.red);
      svg.style.opacity=p.silkOpacity;
      if(p.t<1)raf=requestAnimationFrame(paint);
      else running=false;
    }
    return {
      start(){cancelAnimationFrame(raf);running=true;startTime=performance.now();paint(startTime);},
      stop(){running=false;cancelAnimationFrame(raf);figure.style.opacity='0';svg.style.opacity='0';}
    };
  }
  const api={duration,sample,create};root.DunhuangFlight=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
