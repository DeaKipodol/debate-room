const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),M=require('./model.js'),{out,collect}=require('./build.cjs');
try {
  const check=process.argv.includes('--check'),file=process.argv.slice(2).find(a=>a!=='--check');
  if(!file)throw Error('사용법: node ingest.cjs [--check] 발화파일.json');
  const packet=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  const current=collect();if(current.errors.length)throw Error('기존 입력 파일을 먼저 확인하세요: '+JSON.stringify(current.errors));
  const next=M.merge(current.data,packet);
  if(check){console.log('형식과 답변 관계 확인: 새 발화 '+next.added+'개');process.exit(0)}
  const body=JSON.stringify(M.validate(packet),null,2),name='packet-'+crypto.createHash('sha256').update(body).digest('hex').slice(0,16)+'.json';
  const target=path.join(out,'inbox',name),temp=target+'.'+process.pid+'.tmp';
  if(!fs.existsSync(target)){fs.writeFileSync(temp,body,{flag:'wx'});fs.renameSync(temp,target);}
  console.log('발화 파일 접수: '+target+' · 새 발화 '+next.added+'개');
} catch(e){console.error(e.message);process.exitCode=1;}
