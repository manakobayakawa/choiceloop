import { env } from 'cloudflare:workers';
import {requireIdentity,checkOrigin,errorResponse,privateHeaders,hash,command} from '../../../lib/workspace-server';
export const dynamic='force-dynamic';
export async function POST(req:Request) {
  try {
    checkOrigin(req);const user=requireIdentity(req);
    if(!env.BUCKET) throw new Error('Native R2 file storage is unavailable.');
    const data=await req.formData();const file=data.get('file');
    if(!(file instanceof File)||file.size>5_000_000) throw new Error('Choose a raw text/JSON response or screenshot under 5 MB.');
    if(!['application/json','text/plain','image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Only JSON, plain text, PNG, JPEG and WebP files are accepted.');
    const bytes=await file.arrayBuffer();
    const sum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const object_key=`${await hash(user.id)}/files/${sum}`;
    await env.BUCKET.put(object_key,bytes,{httpMetadata:{contentType:file.type}});
    const saved=await env.BUCKET.get(object_key);
    if(!saved||saved.size!==file.size) throw new Error('File read-back failed.');
    return Response.json(await command(req,{action:'save_attachment',payload:{id:`file-${sum}`,filename:file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,160),content_type:file.type,size_bytes:file.size,sha256:sum,object_key},idempotency_key:`attachment-${sum}`},{attachmentUpload:true}),{headers:privateHeaders});
  } catch(e) {return errorResponse(e);}
}
export async function GET(req:Request) {
  try {
    const user=requireIdentity(req);const id=new URL(req.url).searchParams.get('id');
    if(!id||!/^file-[a-f0-9]{64}$/.test(id)) throw new Error('Invalid attachment ID.');
    const object=await env.BUCKET?.get(`${await hash(user.id)}/files/${id.slice(5)}`);
    if(!object) return Response.json({error:'File not found.'},{status:404,headers:privateHeaders});
    return new Response(object.body,{headers:{...privateHeaders,'Content-Type':object.httpMetadata?.contentType??'application/octet-stream','Content-Disposition':'attachment'}});
  } catch(e) {return errorResponse(e);}
}
