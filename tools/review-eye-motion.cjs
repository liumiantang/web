const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { create, poseAt } = require('../portal-eye.js');

(async () => {
  const image = await loadImage(path.join(__dirname,'../assets/portal/buddha-line-face.png'));
  const surface = createCanvas(image.width,image.height);
  const renderer = create(image,surface,createCanvas);
  for (const x of [841,1130,1162]) {
    const closed=poseAt(x,0), open=poseAt(x,1);
    assert.ok(Math.abs(closed.upper-open.upper)<.001,'Eye corners must stay fixed');
  }
  for(let x=841;x<=1162;x+=.5) {
    for(const t of [0,.25,.5,.75,1]) {
      const p=poseAt(x,t);
      assert.ok(p.lower>=p.upper-1e-6,'Lids must not cross');
    }
  }
  const closed=poseAt(979,0), open=poseAt(979,1);
  assert.ok(closed.upper-open.upper>50,'Upper lid must visibly lift');
  assert.ok(open.lower-closed.lower<10,'Lower lid should move only slightly');
  const sheet=createCanvas(1680,595), ctx=sheet.getContext('2d');
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#0d0c0a'; ctx.fillRect(0,0,sheet.width,sheet.height);
  const states=[[0,0,'01  CLOSED'],[.5,0,'02  OPENING'],[1,0,'03  OPEN'],[1,1,'04  GOLD']];
  states.forEach(([amount,gold,label],i) => {
    renderer.render(amount,gold);
    ctx.fillStyle='#e5c57d';ctx.font='16px sans-serif';ctx.fillText(label,i*420+18,27);
    ctx.drawImage(surface,i*420+10,42,400,300);
    ctx.drawImage(surface,821,280,350,153,i*420+10,375,400,175);
  });
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../artifacts/eye-motion-contact-sheet.png'),sheet.toBuffer('image/png'));
  if (process.argv.includes('--frames')) {
    const folder=path.join(__dirname,'../artifacts/eye-motion-frames');
    fs.mkdirSync(folder,{recursive:true});
    const frame=createCanvas(700,310), pen=frame.getContext('2d');
    pen.imageSmoothingQuality='high';
    const ease=v => {const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
    const start=performance.now();
    for(let i=0;i<80;i++) {
      const ms=i*50-350;
      renderer.render(ease(ms/2050),ease((ms-1750)/850));
      pen.drawImage(surface,805,265,385,170,0,0,700,310);
      fs.writeFileSync(path.join(folder,`frame-${String(i).padStart(3,'0')}.png`),frame.toBuffer('image/png'));
    }
    console.log(`Rendered and encoded 80 preview frames in ${Math.round(performance.now()-start)} ms`);
  }
  console.log(JSON.stringify({center:{closed,open},result:'geometry checks passed; four rendered frames saved'},null,2));
})();
