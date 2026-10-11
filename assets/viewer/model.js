(function(root, factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DebateModel=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FORMAT='debate-room/v1';
  const roles=['mc','discussant','user'],avatars=['owl','cat','bear','rabbit'],colors=['teal','violet','coral','blue'];
  const kinds=['opening','claim','question','answer','revision','conclusion','note'];
  const fail=m=>{throw new Error(m)};
  const str=(v,label,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(label+' 값을 확인해 주세요.');return v};
  const id=(v,label)=>{str(v,label,160);if(!/^[\p{L}\p{N}_.:-]+$/u.test(v))fail(label+'에는 문자·숫자·밑줄·점·콜론·하이픈을 사용하세요.');return v};
  const one=(v,values,label)=>{if(!values.includes(v))fail(label+' 값을 확인해 주세요.');return v};
  const list=(v,label)=>{if(!Array.isArray(v)||v.length>10000)fail(label+'은 목록이어야 합니다.');return v};
  const empty=()=>({format:FORMAT,room:{id:'debate-room',title:'토론방',purpose:''},participants:[],topics:[],messages:[],activities:[]});
  function validate(p){
    if(!p||typeof p!=='object'||p.format!==FORMAT)fail('debate-room/v1 형식의 파일을 넣어 주세요.');
    const q={format:FORMAT,participants:[],topics:[],messages:[],activities:[]};
    if(p.room)q.room={id:id(p.room.id,'토론방 ID'),title:str(p.room.title,'토론방 이름'),purpose:typeof p.room.purpose==='string'?p.room.purpose:''};
    q.participants=list(p.participants??[],'참여자').map(x=>({id:id(x.id,'참여자 ID'),name:str(x.name,'참여자 이름'),role:one(x.role,roles,'역할'),avatar:one(x.avatar,avatars,'캐릭터'),color:one(x.color,colors,'색')}));
    q.topics=list(p.topics??[],'토론').map(x=>({id:id(x.id,'토론 ID'),title:str(x.title,'토론 제목'),purpose:str(x.purpose,'토론 목적',4000),status:one(x.status,['open','waiting','concluded'],'토론 상태')}));
    q.messages=list(p.messages??[],'발화').map(x=>({id:id(x.id,'발화 ID'),topicId:id(x.topicId,'토론 ID'),participantId:id(x.participantId,'발언자 ID'),kind:one(x.kind,kinds,'발화 종류'),text:str(x.text,'발화 본문',120000),replyTo:list(x.replyTo??[],'답할 발언').map(v=>id(v,'답할 발언 ID')),origin:{type:one(x.origin?.type,['agent','transcript','user','mc'],'출처 종류'),ref:str(x.origin?.ref,'출처',4000)}}));
    q.activities=list(p.activities??[],'작성 상태').map(x=>{
      const status=one(x.status,['writing','idle'],'작성 상태');
      if(!Number.isSafeInteger(x.at)||!Number.isSafeInteger(x.expiresAt)||x.at<0||x.expiresAt<x.at||x.expiresAt-x.at>300000)fail('작성 상태의 유효시간은 5분 이하여야 합니다.');
      return {id:id(x.id,'상태 ID'),topicId:id(x.topicId,'토론 ID'),participantId:id(x.participantId,'발언자 ID'),status,at:x.at,expiresAt:x.expiresAt,messageId:id(x.messageId,'작성할 발화 ID')};
    });
    return q;
  }
  function merge(base,packet){
    const p=validate(packet), out=JSON.parse(JSON.stringify(base||empty()));
    if(p.room){if(out.messages.length&&out.room.id!==p.room.id)fail('다른 토론방의 기록입니다. 먼저 내보내고 빈 화면에서 열어 주세요.');out.room=p.room;}
    out.activities??=[];
    let added=0;
    for(const key of ['participants','topics','messages','activities'])for(const item of p[key]){
      const prior=out[key].find(v=>v.id===item.id);
      if(prior){if(JSON.stringify(prior)!==JSON.stringify(item))fail('같은 ID의 내용이 다릅니다: '+item.id);continue;}
      out[key].push(item);if(key==='messages')added++;
    }
    const participants=new Set(out.participants.map(p=>p.id)),topics=new Set(out.topics.map(t=>t.id)),messages=new Map(out.messages.map(m=>[m.id,m]));
    out.activities.forEach(a=>{if(!participants.has(a.participantId)||!topics.has(a.topicId))fail('작성 상태의 참여자와 토론을 확인하세요.');});
    out.messages.forEach(m=>{if(!participants.has(m.participantId))fail('선언되지 않은 참여자: '+m.participantId);if(!topics.has(m.topicId))fail('선언되지 않은 토론: '+m.topicId);m.replyTo.forEach(r=>{if(r===m.id||!messages.has(r)||messages.get(r).topicId!==m.topicId)fail('답변 관계를 확인하세요: '+m.id+' → '+r)});});
    // Cyclic reply chains cannot be displayed as a meaningful question/answer history.
    const done=new Set(),visiting=new Set();function visit(id){if(done.has(id))return;if(visiting.has(id))fail('답변 관계가 순환합니다: '+id);visiting.add(id);messages.get(id).replyTo.forEach(visit);visiting.delete(id);done.add(id)}out.messages.forEach(m=>visit(m.id));
    return {data:out,added};
  }
  function activeWriting(data,now=Date.now()){
    const latest=new Map(),finished=new Set(data.messages.map(m=>m.id));
    for(const a of data.activities??[]){const key=JSON.stringify([a.topicId,a.participantId]),old=latest.get(key);if(!old||a.at>old.at||(a.at===old.at&&a.id>old.id))latest.set(key,a);}
    return [...latest.values()].filter(a=>a.status==='writing'&&a.at<=now&&a.expiresAt>now&&!finished.has(a.messageId));
  }
  function hash(s){let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619)}return(n>>>0).toString(36)}
  function parseText(text){
    str(text,'대화',2000000);const lines=text.replace(/\r\n/g,'\n').split('\n');
    const p={format:FORMAT,participants:[],topics:[],messages:[],activities:[]};let topic=null,speaker=null,body=[],counter=0;const fingerprint=hash(text);
    function flush(){if(!speaker)return;const content=body.join('\n');if(!content.trim())fail('비어 있는 발화입니다: '+speaker.name);p.messages.push({id:'paste-'+fingerprint+'-'+counter++,topicId:topic.id,participantId:speaker.id,kind:speaker.role==='mc'?'opening':'note',text:content,replyTo:[],origin:{type:'transcript',ref:'사용자가 붙여 넣은 대화'}});body=[];speaker=null;}
    for(const line of lines){
      const t=line.match(/^\[토론:\s*(.+)\]$/);if(t){flush();const title=t[1].trim();topic={id:'topic-'+hash(title),title,purpose:'가져온 대화 기록',status:'open'};if(!p.topics.some(v=>v.id===topic.id))p.topics.push(topic);continue;}
      const s=line.match(/^\[([^\[\]]{1,80})\]$/);if(s){if(!topic)fail('먼저 [토론: 제목]을 적어 주세요.');flush();const name=s[1].trim();speaker={id:'person-'+hash(name),name,role:name==='MC'?'mc':'discussant',avatar:name==='MC'?'owl':'cat',color:colors[p.participants.length%colors.length]};const prior=p.participants.find(v=>v.id===speaker.id);if(prior)speaker=prior;else p.participants.push(speaker);continue;}
      if(!speaker){if(line.trim())fail('발언자 표지 [이름] 다음에 본문을 적어 주세요.');}else body.push(line);
    }
    flush();if(!p.messages.length)fail('추가할 발화가 없습니다.');return validate(p);
  }
  return {FORMAT,empty,validate,merge,parseText,activeWriting,hash,avatars,colors,kinds};
});
