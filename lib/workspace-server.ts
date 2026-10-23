import { env } from 'cloudflare:workers';
import seed from '../data/01_original_seed_data.json';
import plan from '../data/02_experiment_plan_v2.json';
import registry from '../data/05_evidence_registry.json';
import { createInitialState, applyAction } from './domain.mjs';
import frozenBundle from '../data/integration/frozen25-import.json';
import { attachIntegration, applyIntegrationAction, validateIntegrationState } from './integration-v3.mjs';

export const privateHeaders = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export class ApiError extends Error {
  constructor(public code:string, message:string, public status=400) { super(message); }
}
export function identity(req:Request) {
  const id=req.headers.get('oai-authenticated-user-id');
  const email=req.headers.get('oai-authenticated-user-email');
  return id&&email?{id,email}:null;
}
export function requireIdentity(req:Request) {
  const user=identity(req);
  if(!user) throw new ApiError('AUTH_REQUIRED','Sign in with ChatGPT to save or change this workspace.',401);
  return user;
}
export function checkOrigin(req:Request) {
  const origin=req.headers.get('origin');
  if(!origin || origin!==new URL(req.url).origin) throw new ApiError('ORIGIN_REJECTED','Same-origin request required.',403);
}
export async function hash(value:string) {
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function initial() { return attachIntegration(await createInitialState(seed,plan,registry),frozenBundle); }
function chunkText(serialized:string) {
  const chunks:string[]=[];for(let i=0;i<serialized.length;) {
    let end=Math.min(i+250_000,serialized.length),c=serialized.charCodeAt(end-1);
    if(end<serialized.length&&c>=0xD800&&c<=0xDBFF)end--;
    chunks.push(serialized.slice(i,end));i=end;
  } return chunks;
}
function database() {
  if(!env.DB) throw new ApiError('DATABASE_UNAVAILABLE','Durable database is unavailable. Export existing data; do not assume a save succeeded.',503);
  return env.DB;
}
export async function loadWorkspace(ownerId:string|null) {
  if(!ownerId) return {state:await initial(),revision:0,persisted:false};
  const db=database();
  let row=await db.prepare('SELECT document, revision FROM workspaces WHERE owner_id=?').bind(ownerId).first<{document:string,revision:number}>();
  if(!row) {
    const state=await initial();
    const chunks=chunkText(JSON.stringify(state)),snapshotId=crypto.randomUUID(),marker=JSON.stringify({storage:'chunked-v1',snapshot_id:snapshotId,chunk_count:chunks.length});
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO workspaces (owner_id,revision,document,updated_at) VALUES (?,0,?,?)').bind(ownerId,marker,new Date().toISOString()),
      ...chunks.map((chunk,i)=>db.prepare('INSERT INTO workspace_chunks (owner_id,snapshot_id,chunk_index,document) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND document=?)').bind(ownerId,snapshotId,i,chunk,ownerId,marker)),
    ]);
    row=await db.prepare('SELECT document, revision FROM workspaces WHERE owner_id=?').bind(ownerId).first<{document:string,revision:number}>();
  }
  if(!row) throw new ApiError('DATABASE_READ_FAILED','Workspace could not be read back.',503);
  let stored=JSON.parse(row.document);
  if(stored.storage==='chunked-v1') {
    const chunks=await db.prepare('SELECT document FROM workspace_chunks WHERE owner_id=? AND snapshot_id=? ORDER BY chunk_index').bind(ownerId,stored.snapshot_id).all<{document:string}>();
    if(chunks.results.length!==stored.chunk_count) throw new ApiError('INCOMPLETE_SNAPSHOT','Durable snapshot is incomplete. No empty fallback was used.',503);
    stored=JSON.parse(chunks.results.map(r=>r.document).join(''));
  }
  if(!stored.historical_experiments?.some((x:any)=>x.id==='mvp25-information-v1')) {
    const migrated=await attachIntegration(stored,frozenBundle,{id:ownerId,label:'Source-preserving bundle migration',authentication:'system_migration'});
    const chunks=chunkText(JSON.stringify(migrated)),snapshotId=crypto.randomUUID(),marker=JSON.stringify({storage:'chunked-v1',snapshot_id:snapshotId,chunk_count:chunks.length});
    const saved=await db.batch([
      ...chunks.map((chunk,i)=>db.prepare('INSERT INTO workspace_chunks (owner_id,snapshot_id,chunk_index,document) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND revision=?)').bind(ownerId,snapshotId,i,chunk,ownerId,row!.revision)),
      db.prepare('UPDATE workspaces SET document=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(marker,new Date().toISOString(),ownerId,row.revision),
    ]);
    if(!saved[chunks.length].meta.changes) throw new ApiError('REVISION_CONFLICT','A concurrent migration completed. Refresh to read its saved state.',409);
    return {state:migrated,revision:row.revision+1,persisted:true};
  }
  return {state:stored,revision:row.revision,persisted:true};
}
export async function capabilityStatus() {
  let storage='unavailable', detail='D1 binding is missing.';
  if(env.DB) {
    try { await env.DB.prepare('SELECT revision FROM workspaces LIMIT 1').first(); storage='available'; detail='Native Sites D1 responds. Hosted persistence remains unverified until private deployment.'; }
    catch {storage='unverified';detail='D1 binding exists but schema/read check failed.';}
  }
  return [
    {name:'Persistent storage',status:storage,detail},
    {name:'File storage',status:env.BUCKET?'unverified':'unavailable',detail:env.BUCKET?'Native R2 binding declared. A successful upload/read-back verifies each saved object.':'R2 binding missing; raw responses remain in database/export.'},
    {name:'Model inference',status:env.OPENAI_API_KEY&&env.CHOICELOOP_MODEL?'unverified':'unavailable',detail:env.OPENAI_API_KEY&&env.CHOICELOOP_MODEL?'Optional OpenAI API adapter configured but not smoke-tested. Automatic execution remains blocked.':'No verified callable model runtime. Optional server-side OpenAI API adapter requires a supported secret and explicit model.'},
    {name:'Web search',status:'unavailable',detail:'No verified search execution from this Site. Use isolated ChatGPT task packets and import actual answers. Public source audits are separate.'},
    {name:'Browser checks',status:'unavailable',detail:'No server browser worker. Manual booking-path packets stop before any reservation or personal data submission.'},
    {name:'MCP connectivity',status:'unverified',detail:'Same-database /mcp implementation; private Site plugin provisioning and authorized remote write/read-back are pending.'},
    {name:'Brain integration',status:'available',detail:'Contract 3.0.0 and portable role instructions imported. Frozen legacy 25-case evaluator retained under archival migration M004; model execution remains unavailable.'},
    {name:'Background worker',status:'unavailable',detail:'No verified worker or scheduler. Manual jobs checkpoint when results are imported; no background execution promised.'},
  ];
}
export async function responseData(req:Request, result?:unknown) {
  const user=identity(req);
  const data=await loadWorkspace(user?.id??null);
  return {...data,user,capabilities:await capabilityStatus(),storage:{engine:'Sites D1',scope:'authenticated user',shared_database:true,localStorage:false},...(result===undefined?{}:{result})};
}
export async function command(req:Request,input:any,internal:{attachmentUpload?:boolean}={}) {
  const user=requireIdentity(req);
  if(!input || typeof input.action!=='string' || !input.payload || typeof input.payload!=='object') throw new ApiError('BAD_COMMAND','Expected {action,payload,idempotency_key}.');
  if(input.action==='save_attachment'&&!internal.attachmentUpload) throw new ApiError('UPLOAD_REQUIRED','Use the authenticated file upload route to store and verify attachment bytes.',403);
  const key=input.idempotency_key;
  if(typeof key!=='string'||!/^[a-zA-Z0-9_.:-]{8,128}$/.test(key)) throw new ApiError('BAD_IDEMPOTENCY_KEY','Provide an 8–128 character idempotency key.');
  const db=database();
  const inputHash=await hash(JSON.stringify({action:input.action,payload:input.payload}));
  const receipt=await db.prepare('SELECT input_hash,result FROM commands WHERE owner_id=? AND command_key=?').bind(user.id,key).first<{input_hash:string,result:string}>();
  if(receipt) {
    if(receipt.input_hash!==inputHash) throw new ApiError('IDEMPOTENCY_CONFLICT','This idempotency key was already used with different inputs.',409);
    return {...await responseData(req,JSON.parse(receipt.result)),idempotent_replay:true};
  }
  const previous=await loadWorkspace(user.id);
  if(input.expected_revision!==undefined&&input.expected_revision!==previous.revision) throw new ApiError('REVISION_CONFLICT','Workspace changed. Refresh before retrying.',409);
  if(input.action==='import_backup') {
    const incoming=input.payload.backup?.state??input.payload.backup;
    await validateIntegrationState(incoming);
    for(const archive of incoming?.historical_experiments??[]) {
      const original=previous.state.historical_experiments?.find((x:any)=>x.id===archive.id);
      if(original&&JSON.stringify(original.source_hashes)!==JSON.stringify(archive.source_hashes)) throw new ApiError('IMMUTABLE_ARCHIVE','Backup source hashes differ from the preserved historical experiment.');
    }
  }
  const runner=['import_frozen25','compare_information'].includes(input.action)?applyIntegrationAction:applyAction;
  const {state,result}=await runner(previous.state,{action:input.action,payload:input.payload},{id:user.id,label:user.email,authentication:'sites_authenticated'});
  await validateIntegrationState(state);
  for(const prior of previous.state.historical_experiments??[]) {
    const next=(state.historical_experiments??[]).find((x:any)=>x.id===prior.id);
    if(!next||JSON.stringify(next.source_hashes)!==JSON.stringify(prior.source_hashes)) throw new ApiError('IMMUTABLE_ARCHIVE','A restore cannot delete or replace the frozen historical experiment.');
  }
  const now=new Date().toISOString(), revision=previous.revision+1;
  // Content-addressed raw command archive. Contains imported responses, not credentials.
  // It is private to the same authenticated owner and immutable by hash.
  if(env.BUCKET) {
    const keyPath=`${await hash(user.id)}/commands/${inputHash}.json`;
    await env.BUCKET.put(keyPath,JSON.stringify({action:input.action,payload:input.payload}),{httpMetadata:{contentType:'application/json'}});
  }
  const serialized=JSON.stringify(state), snapshotId=crypto.randomUUID();
  if(serialized.length>24_000_000) throw new ApiError('WORKSPACE_LIMIT','Workspace exceeds the 24 MB prototype limit. Export before continuing.',413);
  const chunks=chunkText(serialized);
  const inserts=chunks.map((chunk,i)=>db.prepare('INSERT INTO workspace_chunks (owner_id,snapshot_id,chunk_index,document) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND revision=?)').bind(user.id,snapshotId,i,chunk,user.id,previous.revision));
  const updates=await db.batch([...inserts,
    db.prepare('UPDATE workspaces SET document=?,revision=?,updated_at=?,last_command=? WHERE owner_id=? AND revision=?').bind(JSON.stringify({storage:'chunked-v1',snapshot_id:snapshotId,chunk_count:chunks.length}),revision,now,key,user.id,previous.revision),
    db.prepare('INSERT OR IGNORE INTO commands (owner_id,command_key,input_hash,result,revision,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND revision=? AND last_command=?)').bind(user.id,key,inputHash,JSON.stringify(result??null),revision,now,user.id,revision,key),
    db.prepare('DELETE FROM workspace_chunks WHERE owner_id=? AND snapshot_id<>? AND EXISTS (SELECT 1 FROM workspaces WHERE owner_id=? AND revision=? AND last_command=?)').bind(user.id,snapshotId,user.id,revision,key),
  ]);
  if(!updates[inserts.length].meta.changes) throw new ApiError('REVISION_CONFLICT','A concurrent save won. Refresh before retrying; no partial database change was made.',409);
  return {...await responseData(req,result),command_input_sha256:inputHash};
}
export function errorResponse(error:any) {
  const status=error.status??(error.code==='AUTH_REQUIRED'?401:400);
  return Response.json({error:error.message??'Request failed',code:error.code??'REQUEST_FAILED',details:error.details??null},{status,headers:privateHeaders});
}
