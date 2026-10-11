const fs=require('node:fs'),path=require('node:path');
const target=process.argv[2];if(!target){console.error('Usage: node create.cjs /absolute/new-room');process.exit(1)}
const root=path.resolve(target);if(fs.existsSync(root)){console.error('Destination already exists; choose a new directory.');process.exit(1)}
fs.mkdirSync(root,{recursive:true});fs.cpSync(path.join(__dirname,'../assets/viewer'),path.join(root,'viewer'),{recursive:true});
const data=path.join(root,'data');fs.mkdirSync(path.join(data,'inbox'),{recursive:true});
fs.writeFileSync(path.join(data,'seed.json'),JSON.stringify({format:'debate-room/v1',room:{id:'room-'+require('node:crypto').randomUUID(),title:path.basename(root),purpose:''},participants:[],topics:[],messages:[],activities:[]},null,2));
fs.writeFileSync(path.join(data,'references.json'),'[]');
console.log('Created '+root+'. Set DEBATE_DATA_DIR='+data+' when running viewer/build.cjs, server.cjs or ingest.cjs.');
