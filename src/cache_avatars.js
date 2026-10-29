const fs=require("fs");
const path=require("path");

const OUT=path.join("assets","avatars");
fs.mkdirSync(OUT,{recursive:true});

function safe(name){
  return String(name||"").replace(/[^a-zA-Z0-9_.-]/g,"_").toLowerCase();
}

function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{return [];}
}

async function download(url,file){
  if(!url) return false;
  try{
    const r=await fetch(url);
    if(!r.ok) throw new Error(`${r.status}`);
    const buf=Buffer.from(await r.arrayBuffer());
    if(!buf.length) throw new Error("vacío");
    fs.writeFileSync(file,buf);
    return true;
  }catch(e){
    console.warn(`No se pudo guardar ${url}: ${e.message}`);
    return false;
  }
}

async function main(){
  const orgs=readJson("data/datos.json");
  const people=readJson("data/personas_datos.json");
  const all=[...orgs,...people];
  let ok=0,fail=0;

  for(const item of all){
    const u=item?.usuario;
    if(!u?.username || !u?.profile_image_url) continue;
    const file=path.join(OUT,`${safe(u.username)}.jpg`);
    const done=await download(u.profile_image_url,file);
    if(done) ok++; else fail++;
  }
  console.log(`Avatares guardados: ${ok}; fallos: ${fail}`);
}

main().catch(e=>{console.error(e);process.exitCode=1;});
