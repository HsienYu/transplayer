'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const base=path.join(os.homedir(),'.cache/transplayer-builds/r10-rc15-codex-20261116');
const app=path.join(base,'validation-v2');
const run=path.join(base,'trial-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(run,{mode:0o700});
process.env.TRANSPLAYER_SNAPSHOT_ONLY='1';process.env.TRANSPLAYER_SEED='1';process.env.TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION='1';
process.env.TRANSPLAYER_PROFILE_DIR=path.join(run,'profiles');
fs.mkdirSync(process.env.TRANSPLAYER_PROFILE_DIR,{mode:0o700});
const {ChromeSession}=require(path.join(app,'chrome-session'));
const Controller=require(path.join(app,'controller'));
const {QUALITY_JS,captureQuality,snapshotArtifactQuality}=require(path.join(app,'seeder'));
const queries=require(path.join(app,'queries'));
let ws,session;let seq=0;const pending=new Map();
async function cdp(method,params={}) {
 const id=++seq;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},10000);
  pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error('page evaluation failed');return r.result.value;}
async function cleanup(){if(ws)ws.close();if(session)await session.close();}
process.on('SIGTERM',()=>cleanup().finally(()=>process.exit(124)));
(async()=>{
 session=new ChromeSession({chromePath:'/opt/transplayer/releases/r10.AppDir/browser/chrome',driverPath:'/opt/transplayer/releases/r10.AppDir/app/bin/chrome/chromedriver',profileDir:path.join(process.env.TRANSPLAYER_PROFILE_DIR,'browser'),env:process.env,extraArgs:['--headless=new','--window-size=2204,1920']});
 await session.start();
 const targets=await (await fetch('http://127.0.0.1:'+session.port+'/json/list')).json();
 const target=targets.find(t=>t.type==='page');if(!target)throw Error('page missing');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}});
 await cdp('Network.enable');
 await cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 const results=[];
 for(let i=0;i<queries.length;i++){
  const name=crypto.createHash('sha256').update(queries[i]).digest('hex').slice(0,32)+'.mhtml';
  const src=path.join(os.homedir(),'.local/share/transplayer/profiles-r10-basic/snapshots',name);
  const dest=path.join(run,name);let data=fs.readFileSync(src);fs.writeFileSync(dest,data,{mode:0o600});
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  if(hash(data)!==hash(fs.readFileSync(dest)))throw Error('copy hash mismatch');
  const entry={query:i+1,sha256:hash(data),views:[]};
  const requirement=queries.requirementFor(queries[i]);
  let artifact=snapshotArtifactQuality(data.toString('utf8'));
  entry.artifact=artifact;entry.requirement=requirement;
  for(const width of [requirement.width]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:requirement.height,deviceScaleFactor:1,mobile:false});
   const nav=await cdp('Page.navigate',{url:'file://'+dest});if(nav.errorText)throw Error('file navigation failed');
   await new Promise(r=>setTimeout(r,1500));
   if(i===1){
    if(artifact.reason!=='challenge')throw Error('expected archived challenge');
    const removed=await evaluate(`(()=>{const e=document.querySelector('#lb');if(!e||e.querySelectorAll('iframe').length!==1||e.querySelectorAll('img').length!==0)throw Error('overlay structure mismatch');const before=Array.from(document.images).filter(i=>i.complete&&i.naturalWidth>=60&&i.naturalHeight>=60).length;e.remove();return {before,after:Array.from(document.images).filter(i=>i.complete&&i.naturalWidth>=60&&i.naturalHeight>=60).length,removed:1};})()`);
    if(removed.before!==removed.after||removed.before<100)throw Error('result images changed');
    const captured=await cdp('Page.captureSnapshot',{format:'mhtml'});
    data=Buffer.from(captured.data);artifact=snapshotArtifactQuality(captured.data);
    if(!artifact.clean)throw Error('sanitized artifact still rejected');
    fs.writeFileSync(dest,data,{mode:0o600});
    entry.artifact=artifact;entry.sanitized=removed;entry.derivedSha256=hash(data);
    await cdp('Page.navigate',{url:'about:blank'});
    await cdp('Page.navigate',{url:'file://'+dest});
    await new Promise(r=>setTimeout(r,1500));
   }
   for(const y of [0,Math.floor(requirement.scroll/2),requirement.scroll]){
    await evaluate('window.scrollTo(0,'+y+')');await new Promise(r=>setTimeout(r,300));
    const metrics=await evaluate(QUALITY_JS.replace(/^return /,''));
    metrics.gated=await evaluate(Controller.GATE_CHECK_JS);
    metrics.scrollY=await evaluate('window.scrollY');
    const accepted=artifact.clean && !metrics.gated && metrics.loaded>=100 && metrics.pending===0 && metrics.height>=metrics.viewportHeight && metrics.bottom>0;
    const expectedY=Math.min(y,Math.max(0,metrics.height-metrics.viewportHeight));
    if(Math.abs(metrics.scrollY-expectedY)>2)throw Error('scroll clamp mismatch query '+(i+1));
    entry.views.push({width,y,...metrics,accepted});
    const shot=await cdp('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(run,`q${i+1}-${width}-${y}.png`),Buffer.from(shot.data,'base64'),{mode:0o600});
   }
  }
  entry.accepted=entry.views.every(v=>v.accepted);
  if(entry.accepted){const c=new Controller();if(!c.writeSnapshot(queries[i],data.toString('utf8')))throw Error('validated copy write rejected');}
  results.push(entry);
  console.log(JSON.stringify({query:entry.query,accepted:entry.accepted,artifact:entry.artifact,views:entry.views}));
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(results,null,2),{mode:0o600});
 }
 console.log('trial_accepted='+results.filter(r=>r.accepted).length+'/'+queries.length);
 await cleanup();process.exit(results.every(r=>r.accepted)?0:1);
})().catch(async e=>{console.error('offline_test_error='+e.message);await cleanup().catch(()=>{});process.exit(2)});
