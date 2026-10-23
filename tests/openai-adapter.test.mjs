import test from 'node:test';
import assert from 'node:assert/strict';
import {getOpenAIAdapterStatus,buildNeutralSearchRequest,runNeutralSearch,sha256Text} from '../lib/openai-adapter.mjs';

// Every provider response is an isolated fixture returned by an injected fetch.
// No credential or external inference/search access is used by this suite.
const env={OPENAI_API_KEY:'synthetic-fixture-key-12345678',CHOICELOOP_MODEL:'gpt-6-astra',CHOICELOOP_OPENAI_ENABLED:'true'};
async function query(){const query_exact='Where can two people eat Greek food in Pacific Beach?';return {query_exact,query_sha256:await sha256Text(query_exact)};}
const fixture={id:'fixture-response',status:'completed',model:'fixture-model',output:[
  {type:'web_search_call',status:'completed',action:{type:'search',queries:['fixture search']}},
  {type:'message',content:[{type:'output_text',text:'Isolated fixture answer.',annotations:[{type:'url_citation',url:'https://example.invalid/source',title:'Fixture source'}]}]},
],usage:{output_tokens:1}};

test('optional adapter is disabled without all supported server configuration',()=>{
  assert.equal(getOpenAIAdapterStatus({}).status,'unavailable');
  assert.equal(getOpenAIAdapterStatus({...env,CHOICELOOP_OPENAI_ENABLED:'false'}).configured,false);
  assert.equal(getOpenAIAdapterStatus(env).status,'unverified');
  assert(!JSON.stringify(getOpenAIAdapterStatus(env)).includes(env.OPENAI_API_KEY));
});

test('neutral request includes the exact query and excludes target instructions, history and secrets',async()=>{
  const input=await query();
  const request=await buildNeutralSearchRequest({...input,draft:'Never send this',goal:'Never send this',previous_response_id:'Never send this'},env);
  assert.equal(request.input,input.query_exact);
  assert.equal(Object.hasOwn(request,'instructions'),false);
  assert.equal(Object.hasOwn(request,'previous_response_id'),false);
  assert.equal(request.tool_choice,'required');
  assert.equal(request.max_tool_calls,1);
  assert.equal(request.background,false);
  assert.equal(request.store,false);
  assert(!JSON.stringify(request).includes('Never send this'));
  assert(!JSON.stringify(request).includes(env.OPENAI_API_KEY));
});

test('query integrity and credential-in-prompt checks fail before provider execution',async()=>{
  const input=await query();
  await assert.rejects(buildNeutralSearchRequest({...input,query_sha256:'bad'},env),/SHA-256/);
  await assert.rejects(buildNeutralSearchRequest({...input,query_exact:env.OPENAI_API_KEY},env),/Credentials/);
  await assert.rejects(runNeutralSearch(input,{}),/credential/);
});

test('one mocked provider call preserves source evidence and keeps metric extraction pending',async()=>{
  let calls=0;
  const result=await runNeutralSearch(await query(),env,{fetchImpl:async(url,options)=>{
    calls++;
    assert.equal(url,'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization,'Bearer '+env.OPENAI_API_KEY);
    return new Response(JSON.stringify(fixture),{headers:{'x-request-id':'fixture-request'}});
  }});
  assert.equal(calls,1);
  assert.equal(result.status,'succeeded');
  assert.equal(result.web_search_used,true);
  assert.equal(result.search_verification,'completed_search_tool_log');
  assert.equal(result.model_actual,'fixture-model');
  assert.equal(result.citations[0].url,'https://example.invalid/source');
  assert.equal(result.metrics_extraction,'pending_human_review');
  assert.equal(result.provider_request_id,'fixture-request');
  assert.equal(result.raw_response.id,'fixture-response');
  assert.match(result.raw_response_sha256,/^[a-f0-9]{64}$/);
  assert(!JSON.stringify(result).includes(env.OPENAI_API_KEY));
});

test('a text response without a completed search tool log cannot be called verified search',async()=>{
  const noLog=await runNeutralSearch(await query(),env,{fetchImpl:async()=>new Response(JSON.stringify({...fixture,output:[]}))});
  assert.equal(noLog.status,'failed');
  assert.equal(noLog.failure_reason,'completed_search_not_verified');
  assert.equal(noLog.web_search_used,null);
  assert.equal(noLog.search_verification,'unverified');
});

test('provider error output never exposes the server credential',async()=>{
  const result=await runNeutralSearch(await query(),env,{fetchImpl:async()=>new Response(JSON.stringify({error:{message:'Incorrect key '+env.OPENAI_API_KEY}}),{status:401})});
  assert.equal(result.status,'failed');
  assert.equal(result.failure_reason,'provider_http_401');
  assert(!JSON.stringify(result).includes(env.OPENAI_API_KEY));
  assert.equal(result.raw_response_redacted,true);
});

test('network interruption is preserved as uncertain execution with no automatic retry',async()=>{
  let calls=0;
  const result=await runNeutralSearch(await query(),env,{fetchImpl:async()=>{calls++;throw new Error('Fixture network interruption');}});
  assert.equal(calls,1);
  assert.equal(result.retries,0);
  assert.equal(result.status,'failed');
  assert.equal(result.failure_reason,'network_failure_execution_unknown');
  assert.equal(result.raw_response,null);
  assert.equal(result.web_search_used,null);
});

test('cancellation returns a cancelled attempt without invented provider output',async()=>{
  const controller=new AbortController();controller.abort();
  const result=await runNeutralSearch({...await query(),signal:controller.signal},env,{fetchImpl:async()=>{throw new DOMException('Fixture cancellation','AbortError');}});
  assert.equal(result.status,'cancelled');
  assert.equal(result.failure_reason,'cancelled');
  assert.equal(result.raw_response,null);
  assert.equal(result.output_text,null);
});
