// Alleen lezen: geen opslag, geen uitvoering van code uit het archief.
export const ZIP_LIMITS=Object.freeze({archive:16*1024*1024,entries:250,total:48*1024*1024,entry:12*1024*1024,ratio:100});
const td=new TextDecoder("utf-8",{fatal:true});
const fail=(message)=>{throw new Error(message);};
const has=(a,o,n)=>Number.isSafeInteger(o)&&o>=0&&n>=0&&o+n<=a.byteLength;
const u16=(a,o)=>a.getUint16(o,true),u32=(a,o)=>a.getUint32(o,true);
const safePath=(path)=>!!path&&!path.includes("\\")&&!path.includes("\0")&&!/[\x00-\x1f\x7f]/.test(path)&&!path.startsWith("/")&&!/^[A-Za-z]:/.test(path)&&!path.split("/").some(p=>p==="."||p===".."||p==="") && path.length<=400;
let crcTable;
function crc32(bytes){
 if(!crcTable){crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});}
 let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;
}
function nameAt(buffer,start,length){try{return td.decode(buffer.subarray(start,start+length));}catch{fail("Het ZIP-bestand heeft een bestandsnaam met een niet-ondersteunde tekencodering.");}}
export function inspectZip(buffer){
 const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(bytes.length<22||bytes.length>ZIP_LIMITS.archive)fail("Kies een ZIP-bestand van maximaal 16 MB.");
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let eocd=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
  if(u32(view,p)===0x06054b50&&has(view,p,22)&&p+22+u16(view,p+20)===bytes.length){eocd=p;break;}
 }
 if(eocd<0)fail("Dit is geen compleet ZIP-bestand.");
 const count=u16(view,eocd+10),totalCount=u16(view,eocd+8);
 const centralSize=u32(view,eocd+12),centralStart=u32(view,eocd+16);
 if(u16(view,eocd+4)!==0||u16(view,eocd+6)!==0||count!==totalCount||count===0||count>ZIP_LIMITS.entries||count===65535||centralStart===0xffffffff||centralSize===0xffffffff||!has(view,centralStart,centralSize)||centralStart+centralSize>eocd)fail("Dit ZIP-bestand is te groot of gebruikt een niet-ondersteund formaat.");
 let p=centralStart,unpacked=0;const entries=[],seen=new Set();
 for(let n=0;n<count;n++){
  if(!has(view,p,46)||u32(view,p)!==0x02014b50)fail("De bestandslijst in het ZIP-bestand is beschadigd.");
  const flag=u16(view,p+8),method=u16(view,p+10),crc=u32(view,p+16),packed=u32(view,p+20),size=u32(view,p+24);
  const nameLen=u16(view,p+28),extra=u16(view,p+30),comment=u16(view,p+32),offset=u32(view,p+42);
  const end=p+46+nameLen+extra+comment;
  if(end>centralStart+centralSize||!has(view,p,end-p))fail("De bestandslijst is onvolledig.");
  const path=nameAt(bytes,p+46,nameLen),directory=path.endsWith("/"),normalized=directory?path.slice(0,-1):path;
  if(!safePath(normalized)||seen.has(path.toLowerCase())||flag&1||flag&0x40||![0,8].includes(method)||size===0xffffffff||packed===0xffffffff||offset===0xffffffff)fail("Het ZIP-bestand bevat een onveilig, dubbel of niet-ondersteund bestand.");
  const unixMode=u32(view,p+38)>>>16;
  if((unixMode&0xf000)===0xa000)fail("Een ZIP-bestand met snelkoppelingen wordt niet verwerkt.");
  if(directory&&(size||packed))fail("Een map in het ZIP-bestand bevat onverwachte inhoud.");
  if(size>ZIP_LIMITS.entry||(packed===0&&size>0)||(packed>0&&size/packed>ZIP_LIMITS.ratio))fail("Een bestand is te groot of te sterk gecomprimeerd.");
  unpacked+=size;
  if(unpacked>ZIP_LIMITS.total)fail("De uitgepakte bestanden zijn samen te groot.");
  if(!has(view,offset,30)||u32(view,offset)!==0x04034b50)fail("Een ZIP-bestand verwijst naar ontbrekende gegevens.");
  const localName=u16(view,offset+26),localExtra=u16(view,offset+28);
  if(u16(view,offset+8)!==method||u16(view,offset+6)!==flag)fail("ZIP-bestandsgegevens komen niet overeen.");
  const localPath=nameAt(bytes,offset+30,localName);
  const start=offset+30+localName+localExtra;
  if(localPath!==path||!has(view,offset+30,localName+localExtra)||!has(view,start,packed)||start+packed>centralStart)fail("De ZIP-structuur is beschadigd.");
  entries.push({path,size,packed,method,crc,start,directory});
  seen.add(path.toLowerCase());p=end;
 }
 if(p!==centralStart+centralSize)fail("Het ZIP-bestand bevat onverwachte gegevens in de bestandslijst.");
 return {entries,bytes,total:unpacked};
}
export async function readZipBytes(zip,entry,maxBytes=350000){
 if(!entry||entry.directory||entry.size>maxBytes)throw new Error("Dit tekstbestand is te groot om veilig te lezen.");
 const raw=zip.bytes.subarray(entry.start,entry.start+entry.packed);
 let output;
 if(entry.method===0)output=raw;
 else{
  if(typeof DecompressionStream!=="function")throw new Error("Deze browser kan gecomprimeerde ZIP-bestanden niet lezen. Gebruik een recente browser.");
  const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader=stream.getReader();let len=0;const chunks=[];
  try{
   while(true){const next=await reader.read();if(next.done)break;len+=next.value.length;if(len>maxBytes||len>entry.size){await reader.cancel();fail("Het bestand wordt groter dan het ZIP-formaat opgeeft.");}chunks.push(next.value);}
  }finally{reader.releaseLock();}
  output=new Uint8Array(len);let p=0;for(const chunk of chunks){output.set(chunk,p);p+=chunk.length;}
 }
 if(output.length!==entry.size||crc32(output)!==entry.crc)fail("De inhoud van het ZIP-bestand is beschadigd (controlegetal klopt niet).");
 return output;
}
export async function readZipText(zip,entry,maxBytes=350000){
 return new TextDecoder().decode(await readZipBytes(zip,entry,maxBytes));
}
