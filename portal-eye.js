/* The eyelids use the original illustration's pixels. Only their geometry moves. */
(function (root) {
  'use strict';

  const landmarks = [
    // x, underside of the upper lash, inside edge of the lower lid (source pixels)
    [841,397,397], [850,381,391], [865,369,384.5], [884,364,383],
    [908,365,387], [932,369,393.5], [960,373,399], [980,373,400],
    [1005,370,397], [1030,364,390], [1055,355,378], [1080,343,361],
    [1105,331,339.5], [1130,322,322], [1145,319,319], [1162,316,316]
  ];
  const region = { x: 829, y: 210, width: 346, height: 251 };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const smooth = (v) => { const t = clamp(v); return t * t * (3 - 2 * t); };

  function sample(x, field) {
    let i = 0;
    while (i < landmarks.length - 2 && x > landmarks[i + 1][0]) i++;
    const a = landmarks[i], b = landmarks[i + 1];
    const prev = landmarks[Math.max(0, i - 1)];
    const next = landmarks[Math.min(landmarks.length - 1, i + 2)];
    const span = b[0] - a[0], t = clamp((x - a[0]) / span);
    const m0 = (b[field] - prev[field]) / (b[0] - prev[0]);
    const m1 = (next[field] - a[field]) / (next[0] - a[0]);
    return (2*t*t*t-3*t*t+1)*a[field] + (t*t*t-2*t*t+t)*span*m0
      + (-2*t*t*t+3*t*t)*b[field] + (t*t*t-t*t)*span*m1;
  }

  function poseAt(x, amount) {
    // The two lids join at x=1130; the fine outer tail continues to x=1162.
    // Keep that tail intact instead of splitting its single stroke into two halves.
    const t = clamp((x - 841) / 289);
    const weight = Math.pow(Math.sin(Math.PI * t), 1.2);
    const sourceUpper = sample(x, 1);
    const sourceLower = Math.max(sourceUpper, sample(x, 2));
    const closed = sourceLower - 4 * weight;
    return {
      sourceUpper, sourceLower,
      upper: closed - .3 * weight + (sourceUpper - 44 * weight - closed + .3 * weight) * amount,
      lower: closed + .3 * weight + (sourceLower + 3 * weight - closed - .3 * weight) * amount
    };
  }

  function create(image, canvas, makeCanvas) {
    const factory = makeCanvas || ((w,h) => {
      const node = document.createElement('canvas'); node.width=w; node.height=h; return node;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const patch = factory(region.width, region.height);
    const ink = patch.getContext('2d');
    const texture = factory(region.width, region.height);
    texture.getContext('2d').drawImage(image,region.x,region.y,region.width,region.height,
      0,0,region.width,region.height);
    ctx.drawImage(image,0,0,width,height);
    const columns = [];
    let cancelled = false;
    for (let x=841; x<1162; x++) columns.push({ x, source:poseAt(x+.5,0) });

    function strip(x, sy0, sy1, dy0, dy1) {
      if (sy1-sy0 <= .01 || dy1-dy0 <= .01) return;
      ink.drawImage(image, x, sy0, 1, sy1-sy0,
        x-region.x, dy0-region.y, 1, dy1-dy0);
    }

    function render(amount, gold=0) {
      amount=clamp(amount); gold=clamp(gold);
      ink.globalCompositeOperation='source-over';
      ink.drawImage(texture,0,0);
      const upper=[], lower=[];
      for (const {x} of columns) {
        const p=poseAt(x+.5,amount);
        const u=p.sourceUpper, l=p.sourceLower;
        // Keep the lash and its fine parallel strokes at their native thickness.
        // All stretching is confined to the dark skin between the lash and brow.
        ink.fillStyle='#010101';
        ink.fillRect(x-region.x, u-92-region.y, 1, l+45-(u-92));
        strip(x, u-92, u-27, u-92, p.upper-27);
        strip(x, u-27, u, p.upper-27, p.upper);
        strip(x, l, l+14, p.lower, p.lower+14);
        strip(x, l+14, l+45, p.lower+14, l+45);
        upper.push([x+.5-region.x,p.upper-region.y]);
        lower.push([x+.5-region.x,p.lower-region.y]);
      }

      // A stationary iris is revealed by the moving lids, never stretched with them.
      ink.save();
      ink.beginPath();
      upper.forEach(([x,y],i) => i ? ink.lineTo(x,y) : ink.moveTo(x,y));
      lower.slice().reverse().forEach(([x,y]) => ink.lineTo(x,y));
      ink.closePath(); ink.clip();
      ink.strokeStyle='rgba(221,217,207,.86)'; ink.lineWidth=1.12;
      ink.beginPath(); ink.ellipse(979-region.x,350-region.y,53,54,0,0,Math.PI*2); ink.stroke();
      ink.strokeStyle='rgba(221,217,207,.18)'; ink.lineWidth=.55;
      ink.beginPath(); ink.ellipse(979-region.x,350-region.y,54.8,55.5,0,.15,Math.PI*.97); ink.stroke();
      ink.restore();

      if (gold>0) {
        ink.globalCompositeOperation='multiply';
        ink.fillStyle=`rgba(245,208,139,${gold})`;
        ink.beginPath();
        upper.forEach(([x,y],i) => i ? ink.lineTo(x,y-27) : ink.moveTo(x,y-27));
        lower.slice().reverse().forEach(([x,y]) => ink.lineTo(x,y+14));
        ink.closePath(); ink.fill();
        ink.globalCompositeOperation='source-over';
      }
      ctx.drawImage(patch,region.x,region.y);
      return poseAt(979,amount);
    }

    function open(reducedMotion=false) {
      if (reducedMotion) { render(1,1); return Promise.resolve(); }
      const start=performance.now();
      return new Promise(resolve => {
        function frame(now) {
          if (cancelled) { resolve(); return; }
          const elapsed=now-start;
          // Opening stays white for most of the movement; gilding follows the opening.
          render(smooth(elapsed/2050), smooth((elapsed-1750)/850));
          if (elapsed < 2600) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    }

    render(0,0);
    return { render, open, stop() { cancelled=true; } };
  }

  const api={create,poseAt};
  root.DunhuangEye=api;
  if (typeof module==='object' && module.exports) module.exports=api;
})(globalThis);
