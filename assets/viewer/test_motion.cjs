const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
function setup(){
  const seed={format:'debate-room/v1',participants:[{id:'mc',name:'MC',role:'mc',avatar:'owl',color:'teal'}],topics:[{id:'a',title:'지도',purpose:'움직임 확인',status:'open'}],messages:[{id:'old',topicId:'a',participantId:'mc',kind:'question',text:'기존 대화',replyTo:[],origin:{type:'mc',ref:'test'}}]};
  let html=fs.readFileSync(path.join(__dirname,'index.template.html'),'utf8');
  for(const [tag,file] of [['/*STYLE*/','style.css'],['/*MODEL*/','model.js'],['/*APP*/','app.js']])html=html.replace(tag,()=>fs.readFileSync(path.join(__dirname,file),'utf8'));
  html=html.replace('/*SEED*/',JSON.stringify(seed)).replace('/*REFS*/','[]');
  const intervals=[],feed={data:seed,errors:[]};
  const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length};w.clearInterval=()=>{};w.scrollTo=()=>{};w.fetch=async()=>({ok:true,json:async()=>feed});}});
  return {dom,w:dom.window,intervals,feed,seed};
}
test('typing becomes an arriving MC reply; old and reimported messages do not animate',async()=>{
  const {dom,w,intervals}=setup();await new Promise(r=>setImmediate(r));
  try{
    const room=w.DebateRoom,now=Date.now(),activity={id:'typing',topicId:'a',participantId:'mc',status:'writing',at:now,expiresAt:now+60000,messageId:'reply'};
    room.importPacket({format:'debate-room/v1',activities:[activity]});
    assert.equal(w.document.querySelectorAll('.typing-dot').length,3);
    assert.ok(w.document.querySelector('.typing-message.mc'));
    assert.equal(w.document.querySelectorAll('.arrival').length,0);
    const node=w.document.querySelector('.typing-message');intervals.find(x=>x.ms===1000).fn();assert.equal(w.document.querySelector('.typing-message'),node);
    const message={id:'reply',topicId:'a',participantId:'mc',kind:'answer',text:'새 대사',replyTo:['old'],origin:{type:'mc',ref:'test'}};
    room.importPacket({format:'debate-room/v1',messages:[message]});
    assert.equal(w.document.querySelectorAll('.typing-message').length,0);
    assert.ok(w.document.querySelector('#message-reply.arrival.mc'));
    assert.ok(!w.document.querySelector('#message-old.arrival'));
    room.importPacket({format:'debate-room/v1',messages:[message]});
    assert.equal(w.document.querySelectorAll('.arrival').length,0);
    room.importPacket({format:'debate-room/v1',activities:[{...activity,id:'again',at:now+1,messageId:'future',expiresAt:now+2}]});
    w.Date.now=()=>now+3;intervals.find(x=>x.ms===1000).fn();assert.equal(w.document.querySelectorAll('.typing-message').length,0);
  }finally{dom.window.close()}
});
test('feed reception animates only new IDs and renders status-only updates',async()=>{
  const {dom,w,intervals,feed,seed}=setup();await new Promise(r=>setImmediate(r));
  try{
    const now=Date.now();feed.data={...seed,activities:[{id:'typing',topicId:'a',participantId:'mc',status:'writing',at:now,expiresAt:now+60000,messageId:'reply'}]};
    await intervals.find(x=>x.ms===2500).fn();assert.equal(w.document.querySelectorAll('.typing-dot').length,3);
    feed.data.messages=[...seed.messages,{...seed.messages[0],id:'reply',text:'수신된 대사'}];
    await intervals.find(x=>x.ms===2500).fn();assert.ok(w.document.querySelector('#message-reply.arrival'));assert.equal(w.document.querySelectorAll('.typing-message').length,0);
  }finally{dom.window.close()}
});
