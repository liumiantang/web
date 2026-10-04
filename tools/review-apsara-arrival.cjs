// Offline art review using the same geometry as the homepage, not a browser capture.
const {createCanvas,loadImage,Path2D}=require('@napi-rs/canvas');
const fs=require('node:fs');
const path=require('node:path');
const {sample}=require('../portal-flight.js');
const root=path.join(__dirname,'..');
(async()=>{
  const [body,silk]=await Promise.all(['apsara-body-pose-01.png','apsara-ribbons-v1.png'].map(name=>loadImage(path.join(root,'assets/apsara',name))));
  const w=720,h=460, sheet=createCanvas(w*3,h*2), out=sheet.getContext('2d');
  for(const [i,t] of [.12,.28,.43,.57,.72,.87].entries()){
    const frame=createCanvas(w,h),ctx=frame.getContext('2d'),p=sample(t,w,h);
    ctx.fillStyle='#191916';ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w*.49,h*.535,0,w*.49,h*.535,190);
    glow.addColorStop(0,'rgba(218,181,107,.17)');glow.addColorStop(1,'rgba(218,181,107,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=p.silkOpacity;ctx.strokeStyle='#c8a967';ctx.lineWidth=.65;
    for(const [d,c] of [[p.blue,'#52867b'],[p.red,'#b77551']]){ctx.fillStyle=c;const shape=new Path2D(d);ctx.fill(shape);ctx.stroke(shape);}
    ctx.globalAlpha=p.opacity;ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);
    ctx.filter=`blur(${p.blur}px) saturate(${p.saturation}) sepia(${p.sepia})`;
    const fh=p.size*1278/1230;
    ctx.drawImage(silk,-p.size/2,-fh/2,p.size,fh);
    ctx.drawImage(body,-p.size/2,-fh/2,p.size,fh);
    out.drawImage(frame,(i%3)*w,Math.floor(i/3)*h);
    out.fillStyle='#e5c57d';out.font='16px sans-serif';out.fillText(`${Math.round(t*3400)} ms`,(i%3)*w+18,Math.floor(i/3)*h+28);
  }
  fs.writeFileSync(path.join(root,'artifacts/apsara-arrival-contact-sheet.png'),sheet.toBuffer('image/png'));
})();
