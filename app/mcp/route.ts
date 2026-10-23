import { tools } from '../../lib/mcp-tools';
import {command,responseData,requireIdentity,privateHeaders,checkOrigin} from '../../lib/workspace-server';
export const dynamic='force-dynamic';
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
function validate(value:any,schema:any,path='arguments') {
  if(schema.enum&&!schema.enum.includes(value)) throw new Error(path+' has an unsupported value.');
  if(schema.type==='object') {
    if(!object(value)) throw new Error(path+' must be an object.');
    if(schema.properties) {
      if(schema.additionalProperties===false&&Object.keys(value).some(k=>!(k in schema.properties))) throw new Error(path+' has unexpected properties.');
      for(const key of schema.required??[]) if(value[key]===undefined) throw new Error(path+'.'+key+' is required.');
      for(const key of Object.keys(value)) if(schema.properties[key]) validate(value[key],schema.properties[key],path+'.'+key);
    }
  }
  if(schema.type==='string'&&(typeof value!=='string'||value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity)||(schema.pattern&&!new RegExp(schema.pattern).test(value)))) throw new Error(path+' must be a valid bounded string.');
  if(schema.type==='integer'&&(!Number.isInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity))) throw new Error(path+' must be a bounded integer.');
  if(schema.type==='array') {
    if(!Array.isArray(value)||value.length>(schema.maxItems??Infinity)) throw new Error(path+' must be a bounded array.');
    value.forEach((x:any,i:number)=>validate(x,schema.items,path+'['+i+']'));
  }
}
function developmentView(data:any) {
  const s=data.state,ids=new Set(s.experiment.plan.development_ids);
  const {mvp_scenarios,validation_ids,...plan}=s.experiment.plan;
  return {revision:data.revision,capabilities:data.capabilities,scope:'development_only',holdout_content:'withheld',state:{
    schema_version:s.schema_version,adapter_version:s.adapter_version,
    experiment:{...s.experiment,plan:{...plan,validation_count:validation_ids.length}},
    scenarios:s.scenarios.filter((p:any)=>ids.has(p.persona_id)),evidence:s.evidence,
    diagnoses:s.diagnoses.filter((d:any)=>(d.affected_scenario_ids??[]).every((id:string)=>ids.has(id))),
    interventions:s.interventions,observations:s.observations.filter((o:any)=>ids.has(o.persona_id)),
    jobs:s.jobs.filter((j:any)=>j.scenario_ids.every((id:string)=>ids.has(id))),integration:s.integration,
  }};
}
export async function POST(req:Request) {
  let id:any=null;
  try {
    if(!req.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('Content-Type application/json is required.');
    if(req.headers.has('origin')) checkOrigin(req);
    const text=await req.text();if(text.length>8_000_000) throw new Error('Request too large.');
    const rpc=JSON.parse(text);id=rpc.id??null;
    if(rpc.jsonrpc!=='2.0') throw new Error('JSON-RPC 2.0 is required.');
    requireIdentity(req);
    if(rpc.method==='server/discover') return Response.json({jsonrpc:'2.0',id,result:{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}},{headers:privateHeaders});
    if(rpc.method==='tools/list') return Response.json({jsonrpc:'2.0',id,result:{tools}},{headers:privateHeaders});
    if(rpc.method!=='tools/call') throw new Error('Unsupported method.');
    const name=rpc.params?.name,args=rpc.params?.arguments??{};
    const tool=tools.find(t=>t.name===name);
    if(!tool||!object(args)) throw new Error('Unknown tool or invalid arguments.');
    validate(args,tool.inputSchema);
    let result:any;
    if(name==='get_experiment') result=developmentView(await responseData(req));
    else if(name==='get_run_status') {
      if(typeof args.job_id!=='string') throw new Error('job_id must be a string.');
      const data=await responseData(req);result=data.state.jobs.find((j:any)=>j.id===args.job_id||j.job_id===args.job_id)??{error:'Job not found'};
    } else {
      const actions:any={save_observations:'import_results',save_diagnosis:'save_diagnosis',save_intervention:'save_intervention',start_run:'create_job',compare_runs:'compare_runs'};
      let payload:any;
      if(name==='save_observations') payload={observations:args.observations};
      else if(name==='save_diagnosis') payload=args.diagnosis;
      else if(name==='save_intervention') payload=args.intervention;
      else {const {idempotency_key,...rest}=args;payload=rest;}
      if(name==='start_run') payload={...payload,execution:'runtime'};
      const saved=await command(req,{action:actions[name],payload,idempotency_key:args.idempotency_key});
      result={result:saved.result,revision:saved.revision,capabilities:saved.capabilities};
    }
    return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}],isError:false}},{headers:privateHeaders});
  } catch(e:any) {
    return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify({code:e.code??'TOOL_ERROR',error:e.message})}],isError:true}},{headers:privateHeaders});
  }
}
