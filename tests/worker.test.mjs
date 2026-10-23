/**
 * Built Worker integration checks in an isolated local Miniflare database.
 * These do not prove hosted authentication, a canonical MCP plugin connection,
 * model/search access or deployment. No external network is allowed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Miniflare } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler')] }));
const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://choiceloop-test.invalid';
const ownerA = { 'oai-authenticated-user-id': 'fixture-owner-a', 'oai-authenticated-user-email': 'fixture-a@example.invalid' };
const ownerB = { 'oai-authenticated-user-id': 'fixture-owner-b', 'oai-authenticated-user-email': 'fixture-b@example.invalid' };

test('built Worker + D1 + R2 + API + MCP use one isolated, durable owner-scoped store', { timeout: 120000 }, async t => {
  const sandbox = await mkdtemp(join(tmpdir(), 'choiceloop-worker-fixtures-'));
  let mf;
  let outboundAttempts = 0;
  const serverRoot=resolve(root,'dist/server');
  // Vinext emits runtime dynamic imports, so enumerate built modules instead of
  // relying on Miniflare's static dependency parser.
  const moduleFiles=(await readdir(serverRoot,{recursive:true})).filter(p=>/\.(?:m?js)$/.test(p));
  moduleFiles.sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
  const options = {
    modulesRoot: serverRoot,
    modules: moduleFiles.map(path=>({type:'ESModule',path:resolve(serverRoot,path)})),
    compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'choiceloop-isolated-fixture-db' },
    d1Persist: join(sandbox, 'd1'),
    r2Buckets: { BUCKET: 'choiceloop-isolated-fixture-files' },
    r2Persist: join(sandbox, 'r2'),
    cf: false,
    outboundService: async () => { outboundAttempts++; return new Response('External requests are disabled in isolated tests.', {status: 599}); },
  };
  const request = (path, init = {}, actor = ownerA) => mf.dispatchFetch(origin + path, {
    ...init, headers: { ...actor, ...(init.headers ?? {}) },
  });
  const read = async (actor = ownerA) => {
    const response = await request('/api/workspace', {}, actor);
    assert.equal(response.status, 200);
    return response.json();
  };
  const command = async (action, payload, key, actor = ownerA, other = {}) => {
    const response = await request('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...other.headers },
      body: JSON.stringify({action, payload, idempotency_key: key, ...other.body}),
    }, actor);
    return { response, data: await response.json() };
  };
  const rpc = async (method, params = {}, actor = ownerA) => {
    const response = await request('/mcp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:'fixture-rpc',method,params}),
    }, actor);
    assert.equal(response.status,200);
    return response.json();
  };
  const rpcResult = result => JSON.parse(result.result.content[0].text);
  const frozen25Id='mvp25-information-v1';
  const frozenArchive=state=>state.historical_experiments.find(x=>x.id===frozen25Id);
  let frozen25Baseline;
  let frozen25SourceHashes;
  const informationCounts=comparison=>({
    paired:comparison.paired_count,
    before:comparison.baseline.numerator,
    after:comparison.retest.numerator,
    delta:comparison.delta,
  });
  try {
    mf = new Miniflare(options);
    await mf.ready;
    const db = await mf.getD1Database('DB');
    const migrations=(await readdir(resolve(root,'drizzle'))).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
    assert(migrations.length>=2,'Expected initial and chunked-storage migrations.');
    for(const name of migrations) {
      const migration=await readFile(resolve(root,'drizzle',name),'utf8');
      for (const statement of migration.split('--> statement-breakpoint').map(x => x.trim()).filter(Boolean)) await db.prepare(statement).run();
    }

    await t.test('anonymous preview is read-only and reports empty measured data', async () => {
      const data = await read({});
      assert.equal(data.user,null);
      assert.equal(data.persisted,false);
      assert.equal(data.state.scenarios.length,100);
      assert.equal(data.state.observations.length,0);
      const result = await command('freeze_plan',{},'fixture-anon-freeze',{});
      assert.equal(result.response.status,401);
      assert.equal(result.data.code,'AUTH_REQUIRED');
    });

    await t.test('authenticated writes enforce same-origin checks and idempotency shape', async () => {
      const wrongOrigin = await command('freeze_plan',{},'fixture-origin-freeze',ownerA,{headers:{Origin:'https://attacker.invalid'}});
      assert.equal(wrongOrigin.response.status,403);
      assert.equal(wrongOrigin.data.code,'ORIGIN_REJECTED');
      const noKey = await command('freeze_plan',{},'tiny');
      assert.equal(noKey.response.status,400);
      assert.equal(noKey.data.code,'BAD_IDEMPOTENCY_KEY');
    });

    let frozenAt;
    let revisionAfterFreeze;
    await t.test('freeze writes to D1 and a fresh GET reads the persisted plan', async () => {
      const result = await command('freeze_plan',{},'fixture-freeze-0001');
      assert.equal(result.response.status,200);
      assert.equal(result.data.state.experiment.plan.status,'frozen');
      frozenAt=result.data.state.experiment.plan.frozen_at;
      revisionAfterFreeze=result.data.revision;
      assert(frozenAt);
      const fresh=await read();
      assert.equal(fresh.persisted,true);
      assert.equal(fresh.state.experiment.plan.frozen_at,frozenAt);
      assert.equal(fresh.revision,revisionAfterFreeze);
      assert.equal(fresh.state.scenarios.filter(p=>p.budget_preference_usd_per_person===null).length,75);
    });

    await t.test('replaying a command does not duplicate its mutation; conflicting reuse is rejected', async () => {
      const replay=await command('freeze_plan',{},'fixture-freeze-0001');
      assert.equal(replay.response.status,200);
      assert.equal(replay.data.idempotent_replay,true);
      assert.equal(replay.data.revision,revisionAfterFreeze);
      const conflict=await command('freeze_plan',{different:true},'fixture-freeze-0001');
      assert.equal(conflict.response.status,409);
      assert.equal(conflict.data.code,'IDEMPOTENCY_CONFLICT');
      const stale=await command('freeze_plan',{},'fixture-stale-0001',ownerA,{body:{expected_revision:-1}});
      assert.equal(stale.response.status,409);
      assert.equal(stale.data.code,'REVISION_CONFLICT');
    });

    await t.test('another authenticated owner has an independent unfrozen workspace', async () => {
      const other=await read(ownerB);
      assert.equal(other.state.experiment.plan.frozen_at,null);
      assert.equal(other.revision,0);
      assert.equal(other.state.observations.length,0);
    });

    await t.test('frozen25 baseline and retest are persisted as an immutable separate historical experiment',async()=>{
      const current=(await read()).state;
      const archive=frozenArchive(current);
      assert(archive,'Imported frozen25 archive must exist.');
      assert.equal(archive.contract_version,'3.0.0');
      assert.equal(archive.metric_label,'Information sufficiency');
      assert.equal(archive.baseline.journeys.length,25);
      assert.equal(archive.retest.journeys.length,25);
      assert.equal(archive.baseline.run_id,'baseline-0a5973567a2b');
      assert.equal(archive.retest.run_id,'retest-621e31f46496');
      assert.deepEqual(archive.baseline.journeys.map(j=>j.scenario_id),archive.retest.journeys.map(j=>j.scenario_id));
      assert(archive.baseline.journeys.every(j=>j.discovery.mention===null&&j.decision.selected_restaurant===null));
      assert.equal(current.scenarios.length,100);
      assert.equal(current.observations.length,0);
      frozen25Baseline=JSON.stringify(archive.baseline);
      frozen25SourceHashes=structuredClone(archive.source_hashes);
      const refreshed=frozenArchive((await read()).state);
      assert.equal(JSON.stringify(refreshed.baseline),frozen25Baseline);
      assert.deepEqual(refreshed.source_hashes,frozen25SourceHashes);
    });

    await t.test('frozen25 comparison computes 7 of 25 before and after with zero information-sufficiency delta',async()=>{
      const compared=await command('compare_information',{experiment_id:frozen25Id,baseline_run_id:'baseline-0a5973567a2b',retest_run_id:'retest-621e31f46496'},'fixture-information-compare-0001');
      assert.equal(compared.response.status,200,JSON.stringify(compared.data.error??null));
      assert.deepEqual(informationCounts(compared.data.result.comparison),{paired:25,before:7,after:7,delta:0});
      assert.equal(compared.data.result.comparison.baseline.denominator,25);
      assert.equal(compared.data.result.comparison.retest.denominator,25);
      assert.equal(compared.data.result.comparison.actual_choice,null);
      assert.equal(compared.data.result.comparison.live_visibility,null);
      const archive=frozenArchive((await read()).state);
      assert.deepEqual(informationCounts(archive.computed_comparisons.at(-1)),{paired:25,before:7,after:7,delta:0});
      assert.equal(JSON.stringify(archive.baseline),frozen25Baseline);
      assert.equal(archive.original_comparison.live_visibility.baseline.mention_rate,null);
      assert.equal(archive.original_comparison.live_visibility.retest.mention_rate,null);
    });

    await t.test('duplicate frozen25 import preserves the archive and generic forged backup cannot overwrite its baseline',async()=>{
      const bundle=JSON.parse(await readFile(resolve(root,'data/integration/frozen25-import.json'),'utf8'));
      const imported=await command('import_frozen25',{bundle},'fixture-frozen25-duplicate-0001');
      assert.equal(imported.response.status,200,JSON.stringify(imported.data.error??null));
      const current=(await read()).state;
      assert.equal(current.historical_experiments.filter(x=>x.id===frozen25Id).length,1);
      assert.equal(JSON.stringify(frozenArchive(current).baseline),frozen25Baseline);
      assert.deepEqual(frozenArchive(current).source_hashes,frozen25SourceHashes);
      const forged=structuredClone(current);
      frozenArchive(forged).baseline.journeys[0].consideration.information_sufficient=false;
      const rejected=await command('import_backup',{backup:{format:'choiceloop-backup-0.1',state:forged}},'fixture-forged-archive-backup-0001');
      assert(rejected.response.status>=400,'A modified archived baseline must be rejected.');
      assert.equal(JSON.stringify(frozenArchive((await read()).state).baseline),frozen25Baseline);
    });

    let manualJobId;
    await t.test('manual run is queued and cancellation is persisted without background progress', async () => {
      const created=await command('create_job',{mode:'LIVE_AI_SEARCH',phase:'baseline',scenario_ids:['P001'],repeats:1,execution:'manual'},'fixture-manual-run-0001');
      assert.equal(created.response.status,200);
      manualJobId=created.data.result.job.id;
      assert.equal(created.data.result.job.status,'queued');
      assert.equal(created.data.result.job.execution,'ChatGPT-assisted / manual handoff');
      const cancelled=await command('cancel_job',{job_id:manualJobId},'fixture-cancel-run-0001');
      assert.equal(cancelled.data.result.job.status,'cancelled');
      const after=await read();
      assert.equal(after.state.jobs.find(j=>j.id===manualJobId).status,'cancelled');
      assert.equal(after.state.observations.length,0);
    });

    let attachmentId;
    const fileText='Isolated fixture raw response. This is not a live observation.\n';
    await t.test('R2 raw file upload reads back identical bytes and is owner-scoped', async () => {
      const body=new FormData();
      body.set('file',new File([fileText],'fixture-answer.txt',{type:'text/plain'}));
      // Serialize with Node's Request before crossing Miniflare's fetch realm.
      const multipart=new Request(origin+'/api/files',{method:'POST',body});
      const saved=await request('/api/files',{method:'POST',headers:{Origin:origin,'Content-Type':multipart.headers.get('Content-Type')},body:new Uint8Array(await multipart.arrayBuffer())});
      const data=await saved.json();
      assert.equal(saved.status,200,JSON.stringify(data));
      const attachment=data.state.attachments.at(-1);
      attachmentId=attachment.id;
      assert.equal(attachment.size_bytes,new TextEncoder().encode(fileText).length);
      const loaded=await request('/api/files?id='+attachmentId);
      assert.equal(loaded.status,200);
      assert.equal(await loaded.text(),fileText);
      const other=await request('/api/files?id='+attachmentId,{},ownerB);
      assert.equal(other.status,404);
      const anonymous=await request('/api/files?id='+attachmentId,{},{});
      assert.equal(anonymous.status,401);
    });

    await t.test('MCP requires identity, exposes supported tools and cannot manufacture approval', async () => {
      const anonymous=await rpc('tools/list',{},{});
      assert.equal(anonymous.result.isError,true);
      const discover=await rpc('server/discover');
      assert.deepEqual(discover.result.supportedVersions,['2026-07-28']);
      const list=await rpc('tools/list');
      const names=list.result.tools.map(x=>x.name);
      assert(names.includes('save_diagnosis'));
      assert(!names.includes('approve_intervention'));
      const invented=await rpc('tools/call',{name:'approve_intervention',arguments:{}});
      assert.equal(invented.result.isError,true);
    });

    await t.test('MCP evidence-backed write is read back through MCP and the HTTP API in the same database', async () => {
      const call=await rpc('tools/call',{name:'save_diagnosis',arguments:{
        diagnosis:{id:'fixture-mcp-diagnosis',hypothesis:'ISOLATED FIXTURE: source wording needs owner confirmation.',supporting_fact_ids:['V004'],affected_scenario_ids:['P001'],uncertainty:'Synthetic integration test; not a measured diagnosis.'},
        idempotency_key:'fixture-mcp-diagnosis-0001',
      }});
      assert.equal(call.result.isError,false);
      assert.equal(rpcResult(call).result.diagnosis.id,'fixture-mcp-diagnosis');
      const remote=rpcResult(await rpc('tools/call',{name:'get_experiment',arguments:{}}));
      assert.equal(remote.scope,'development_only');
      assert.equal(remote.holdout_content,'withheld');
      assert.equal(remote.state.scenarios.length,12);
      assert.equal(Object.hasOwn(remote.state,'source_documents'),false);
      assert.equal(Object.hasOwn(remote.state,'historical_experiments'),false);
      assert.equal(Object.hasOwn(remote.state,'legacy'),false);
      assert.equal(Object.hasOwn(remote.state,'audit'),false);
      assert.equal(Object.hasOwn(remote.state.experiment.plan,'validation_ids'),false);
      assert.equal(Object.hasOwn(remote.state.experiment.plan,'mvp_scenarios'),false);
      const fullState=(await read()).state;
      const remoteText=JSON.stringify(remote);
      for(const id of fullState.experiment.plan.validation_ids) {
        assert(!remoteText.includes(fullState.scenarios.find(p=>p.persona_id===id).search_query));
      }
      assert(remote.state.diagnoses.some(d=>d.id==='fixture-mcp-diagnosis'));
      assert((await read()).state.diagnoses.some(d=>d.id==='fixture-mcp-diagnosis'));
      assert(!(await read(ownerB)).state.diagnoses.some(d=>d.id==='fixture-mcp-diagnosis'));
      const runStatus=rpcResult(await rpc('tools/call',{name:'get_run_status',arguments:{job_id:manualJobId}}));
      assert.equal(runStatus.status,'cancelled');
    });

    await t.test('MCP start_run persists blocked status when the real runtime is unavailable', async () => {
      const call=await rpc('tools/call',{name:'start_run',arguments:{mode:'LIVE_AI_SEARCH',phase:'baseline',scenario_ids:['P001'],repeats:1,idempotency_key:'fixture-mcp-runtime-0001'}});
      assert.equal(call.result.isError,false);
      const job=rpcResult(call).result.job;
      assert.equal(job.status,'blocked');
      assert.match(job.error,/No verified/);
    });

    const unicodeVersions=[];
    await t.test('multiple large Unicode asset versions round-trip through chunked D1 snapshots', async()=>{
      for(let version=1;version<=3;version++) {
        const content=`ISOLATED STORAGE FIXTURE v${version}\n`+'景🧪'.repeat(40000);
        assert(content.length<150000);
        unicodeVersions.push(content);
        const saved=await command('save_intervention',{
          id:'fixture-unicode-asset',title:'Isolated Unicode storage fixture',content,evidence_ids:['V001'],
          claim_links:[{claim:'ISOLATED STORAGE FIXTURE',evidence_ids:['V001']}],owner_confirmation_required:false,
        },`fixture-unicode-version-${version}`);
        assert.equal(saved.response.status,200,JSON.stringify(saved.data.error??null));
        assert.equal(saved.data.result.intervention.version,version);
      }
      assert(unicodeVersions.reduce((sum,s)=>sum+s.length,0)>250000);
      const refreshed=await read();
      const asset=refreshed.state.interventions.find(a=>a.id==='fixture-unicode-asset');
      assert.equal(asset.version,3);
      assert.deepEqual(asset.versions.map(v=>v.content),unicodeVersions);
      assert.equal(asset.content,unicodeVersions[2]);
      const stored=await db.prepare('SELECT document FROM workspaces WHERE owner_id=?').bind(ownerA['oai-authenticated-user-id']).first();
      const pointer=JSON.parse(stored.document);
      assert.equal(pointer.storage,'chunked-v1');
      assert(pointer.chunk_count>1);
      const chunks=await db.prepare('SELECT document FROM workspace_chunks WHERE owner_id=? AND snapshot_id=? ORDER BY chunk_index').bind(ownerA['oai-authenticated-user-id'],pointer.snapshot_id).all();
      assert.equal(chunks.results.length,pointer.chunk_count);
      for(const chunk of chunks.results) {
        const last=chunk.document.charCodeAt(chunk.document.length-1);
        assert(!(last>=0xD800&&last<=0xDBFF),'Chunk must not end with a lone high surrogate.');
      }
      assert.deepEqual(JSON.parse(chunks.results.map(c=>c.document).join('')).interventions.find(a=>a.id==='fixture-unicode-asset').versions.map(v=>v.content),unicodeVersions);
    });

    await t.test('backup export preserves nulls and empty live metrics without credentials', async () => {
      const response=await request('/api/export');
      assert.equal(response.status,200);
      const backup=await response.json();
      assert.equal(backup.state.scenarios.length,100);
      assert.equal(backup.state.scenarios.filter(p=>p.budget_preference_usd_per_person===null).length,75);
      assert.equal(backup.state.observations.length,0);
      assert.equal(backup.state.approvals.length,0);
      assert(!JSON.stringify(backup).includes('OPENAI_API_KEY'));
    });

    await t.test('D1 and R2 survive a full local worker restart using only isolated test persistence', async () => {
      const revisionBeforeRestart=(await read()).revision;
      await mf.dispose();
      mf=new Miniflare(options);
      await mf.ready;
      const restored=await read();
      assert.equal(restored.revision,revisionBeforeRestart);
      assert.equal(restored.state.experiment.plan.frozen_at,frozenAt);
      assert(restored.state.diagnoses.some(d=>d.id==='fixture-mcp-diagnosis'));
      const archive=frozenArchive(restored.state);
      assert.equal(JSON.stringify(archive.baseline),frozen25Baseline);
      assert.equal(archive.retest.journeys.length,25);
      assert.deepEqual(informationCounts(archive.computed_comparisons.at(-1)),{paired:25,before:7,after:7,delta:0});
      assert.deepEqual(restored.state.interventions.find(a=>a.id==='fixture-unicode-asset').versions.map(v=>v.content),unicodeVersions);
      const file=await request('/api/files?id='+attachmentId);
      assert.equal(await file.text(),fileText);
      assert.equal(outboundAttempts,0);
    });
  } finally {
    await mf?.dispose();
    await rm(sandbox,{recursive:true,force:true});
  }
});
