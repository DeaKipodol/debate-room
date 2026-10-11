const test=require('node:test'),assert=require('node:assert/strict'),M=require('./model.js');
const p={format:M.FORMAT,participants:[{id:'mc',name:'MC',role:'mc',avatar:'owl',color:'teal'}],topics:[{id:'a',title:'지도',purpose:'현재 위치로 복귀',status:'open'}],messages:[{id:'m1',topicId:'a',participantId:'mc',kind:'question',text:'현재 위치는 어떻게 찾나요?\n본문을 그대로 보존합니다.',replyTo:[],origin:{type:'mc',ref:'실제 질문'}}]};
test('reimport is idempotent and a conflicting packet changes nothing',()=>{const first=M.merge(M.empty(),p).data;assert.equal(M.merge(first,p).added,0);const bad=structuredClone(p);bad.messages[0].text='다른 본문';assert.throws(()=>M.merge(first,bad),/같은 ID/);assert.equal(first.messages[0].text,p.messages[0].text)});
test('unknown speakers and missing/cross-topic reply relations are rejected atomically',()=>{const first=M.merge(M.empty(),p).data;let q={format:M.FORMAT,participants:[],topics:[],messages:[{...p.messages[0],id:'m2',participantId:'missing'}]};assert.throws(()=>M.merge(first,q),/참여자/);q.messages[0]={...p.messages[0],id:'m2',replyTo:['missing']};assert.throws(()=>M.merge(first,q),/답변 관계/);assert.equal(first.messages.length,1)});
test('agent character and full answer can be added with a reply edge',()=>{const first=M.merge(M.empty(),p).data;const q={format:M.FORMAT,participants:[{id:'agent',name:'지도 담당',role:'discussant',avatar:'cat',color:'coral'}],topics:[],messages:[{...p.messages[0],id:'m2',participantId:'agent',kind:'answer',replyTo:['m1'],text:'본문 <script>alert(1)</script> 는 문자로 남습니다.',origin:{type:'agent',ref:'test-agent'}}]};const r=M.merge(first,q);assert.equal(r.added,1);assert.equal(r.data.messages[1].text,q.messages[0].text);assert.equal(r.data.participants[1].avatar,'cat')});
test('pasted transcript keeps body and attribution, deduplicates replay',()=>{const s='[토론: 지도]\n[MC]\n질문입니다.\n두 번째 줄입니다.\n[지도 담당]\n답입니다.';const p=M.parseText(s),r=M.merge(M.empty(),p);assert.equal(r.data.messages.length,2);assert.equal(r.data.messages[0].text,'질문입니다.\n두 번째 줄입니다.');assert.equal(r.data.messages[1].origin.type,'transcript');assert.equal(M.merge(r.data,M.parseText(s)).added,0);assert.throws(()=>M.parseText('아무 문장'),/발언자/)});
test('circular replies are rejected',()=>{const q=structuredClone(p);q.messages.push({...q.messages[0],id:'m2',replyTo:['m1']});q.messages[0].replyTo=['m2'];assert.throws(()=>M.merge(M.empty(),q),/순환/)});

test('writing expires, stops explicitly, and clears when its exact reply arrives',()=>{
  const first=M.merge(M.empty(),p).data;
  const activity={id:'writing-1',topicId:'a',participantId:'mc',status:'writing',at:1000,expiresAt:61000,messageId:'m2'};
  const packet={format:M.FORMAT,activities:[activity]};
  const writing=M.merge(first,packet).data;
  assert.equal(M.activeWriting(writing,2000).length,1);
  assert.equal(M.activeWriting(writing,61000).length,0);
  assert.equal(M.activeWriting(M.merge(writing,packet).data,2000).length,1);
  const finished=M.merge(writing,{format:M.FORMAT,messages:[{...p.messages[0],id:'m2'}]}).data;
  assert.equal(M.activeWriting(finished,2000).length,0);
  const stopped=M.merge(writing,{format:M.FORMAT,activities:[{...activity,id:'idle-1',status:'idle',at:2000,expiresAt:2000}]}).data;
  assert.equal(M.activeWriting(M.merge(stopped,packet).data,3000).length,0);
});
test('writing signals require known people/topics and a bounded lifetime',()=>{
  const first=M.merge(M.empty(),p).data;
  const activity={id:'typing',topicId:'a',participantId:'unknown',status:'writing',at:1000,expiresAt:61000,messageId:'m2'};
  assert.throws(()=>M.merge(first,{format:M.FORMAT,activities:[activity]}),/참여자/);
  assert.throws(()=>M.merge(first,{format:M.FORMAT,activities:[{...activity,participantId:'mc',expiresAt:400000}]}),/5분/);
});
