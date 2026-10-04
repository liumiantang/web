// Exercise asynchronous scene handoffs without accessing a browser or file URLs.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname,'../portal.js'),'utf8');
const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };

function harness({reduced=false,brokenFace=false}={}) {
  const timers=new Map(); let clock=0, nextId=0, finishOpening, stopped=false;
  function element() {
    const classes=new Set();
    return {
      dataset:{}, attrs:{}, disabled:true, inert:true, handlers:{}, focused:false,
      classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},
        contains(n){return classes.has(n);},toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},
      setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){if(k==='data-src')delete this.dataset.src;},
      addEventListener(k,fn){this.handlers[k]=fn;},focus(){this.focused=true;},
      click(){this.handlers.click?.({preventDefault(){}});}
    };
  }
  const portal=element(), eye=element(), image=element(), frame=element(), opening=element();
  const world=element(), link=element(), title=element(), art=element();
  art.dataset.src='fixture.png';art.decode=()=>Promise.resolve();
  image.decode=()=>brokenFace?Promise.reject(new Error('missing face')):Promise.resolve();
  world.querySelectorAll=()=>[art];world.querySelector=()=>title;
  const nodes={'#portal':portal,'#eye-hit':eye,'.opening__face-image':image,
    '#face-canvas':element(),'.opening__face-frame':frame,'#opening':opening,'#story-world':world,'#catalog-link':link};
  const window={matchMedia:()=>({matches:reduced}),setTimeout(fn,ms){const id=++nextId;timers.set(id,{at:clock+ms,fn});return id;},
    clearTimeout(id){timers.delete(id);},DunhuangEye:{create:()=>({stop(){stopped=true;},open(){return reduced?Promise.resolve():new Promise(resolve=>{finishOpening=resolve;});}})}};
  vm.runInNewContext(source,{document:{querySelector:s=>nodes[s]},window,console:{error(){}}});
  async function tick(ms) {
    const end=clock+ms;
    while(true){const pending=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!pending)break;const [id,t]=pending;timers.delete(id);clock=t.at;t.fn();await flush();}
    clock=end;await flush();
  }
  return {portal,eye,world,opening,link,title,art,tick,finish:()=>finishOpening?.(),stopped:()=>stopped,timers};
}

(async()=>{
  const normal=harness();await flush();
  assert.equal(normal.portal.dataset.phase,'draw');
  assert.equal(normal.art.src,'fixture.png','Next-scene art must preload during drawing');
  normal.eye.click();assert.equal(normal.portal.dataset.phase,'draw','Early clicks cannot start a journey');
  await normal.tick(1650);assert.equal(normal.portal.dataset.phase,'opening');
  assert.equal(normal.eye.disabled,true);
  normal.finish();await flush();assert.equal(normal.portal.dataset.phase,'ready');
  normal.eye.click();normal.eye.click();assert.equal(normal.portal.dataset.phase,'flight');
  assert.equal(normal.timers.size,3,'Repeated clicks must not queue another journey');
  await normal.tick(799);assert.equal(normal.world.classList.contains('is-entering'),false);
  await normal.tick(1);assert.equal(normal.world.classList.contains('is-entering'),true);
  await normal.tick(3400);assert.equal(normal.portal.dataset.phase,'map');
  assert.equal(normal.world.inert,false);assert.equal(normal.opening.inert,true);
  assert.equal(normal.title.focused,true);assert.equal(normal.world.classList.contains('is-entering'),false);
  assert.equal(normal.timers.size,0);

  const skipped=harness();await flush();await skipped.tick(1650);skipped.link.click();
  skipped.finish();await flush();await skipped.tick(5000);
  assert.equal(skipped.portal.dataset.phase,'map','Finishing a skipped eye animation must not resurrect the face');
  assert.equal(skipped.world.classList.contains('is-instant'),true);
  assert.equal(skipped.stopped(),true);

  const reduced=harness({reduced:true});await flush();await reduced.tick(0);
  assert.equal(reduced.portal.dataset.phase,'ready');reduced.eye.click();
  assert.equal(reduced.portal.dataset.phase,'map');assert.equal(reduced.timers.size,0);

  const failed=harness({brokenFace:true});await flush();failed.link.click();
  assert.equal(failed.portal.dataset.phase,'map','The directory must remain reachable on an image load failure');
  console.log('PASS: normal journey, premature/repeated clicks, mid-opening skip, reduced motion, failed image fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
