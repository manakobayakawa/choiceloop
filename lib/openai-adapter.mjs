/**
 * Server-only, opt-in OpenAI Responses adapter. No credential is returned.
 * This module is not an execution worker and does not establish API access.
 * Official source checked 2026-10-23:
 * https://developers.openai.com/api/docs/guides/tools-web-search
 */
export const OPENAI_ADAPTER_VERSION = 'openai-responses-neutral-search/0.1';
const ENDPOINT = 'https://api.openai.com/v1/responses';
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function serverOnly() {
  if (typeof window !== 'undefined') throw new Error('OpenAI adapter is server-only.');
}

export function getOpenAIAdapterStatus(env = {}) {
  serverOnly();
  const keyPresent = typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0;
  const model = typeof env.CHOICELOOP_MODEL === 'string' ? env.CHOICELOOP_MODEL : null;
  const enabled = env.CHOICELOOP_OPENAI_ENABLED === 'true';
  return {
    adapter_version: OPENAI_ADAPTER_VERSION,
    status: keyPresent && model && enabled ? 'unverified' : 'unavailable',
    configured: Boolean(keyPresent && model && enabled),
    detail: !keyPresent ? 'No server-side API credential configured.'
      : !model ? 'An explicit supported model must be configured.'
        : !enabled ? 'Optional API adapter is disabled.'
          : 'Configured; authorized end-to-end inference/search verification is still required.',
    product: 'OpenAI Responses API',
    model,
    background_worker: 'unavailable',
    controlled_simulation: 'unavailable',
    controlled_simulation_reason: 'Frozen integration rubric and role instructions are pending.',
  };
}

export async function sha256Text(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map(n => n.toString(16).padStart(2, '0')).join('');
}

/** This helper never adds instructions, a target, previous answers or drafts. */
export async function buildNeutralSearchRequest(input, env = {}) {
  serverOnly();
  if (!input || typeof input.query_exact !== 'string' || !input.query_exact.trim()
      || input.query_exact.length > 12000) throw new Error('A bounded exact frozen query is required.');
  if (env.OPENAI_API_KEY && input.query_exact.includes(env.OPENAI_API_KEY)) {
    throw new Error('Credentials are not allowed in model input.');
  }
  const queryHash = await sha256Text(input.query_exact);
  if (input.query_sha256 !== queryHash) throw new Error('Frozen query SHA-256 does not match.');
  const model = env.CHOICELOOP_MODEL;
  if (typeof model !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(model)) {
    throw new Error('Explicit supported CHOICELOOP_MODEL is required.');
  }
  return {
    model,
    input: input.query_exact,
    tools: [{ type: 'web_search', external_web_access: true, search_context_size: 'medium', user_location: { type: 'approximate' } }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    max_tool_calls: 1,
    max_output_tokens: 1800,
    store: false,
    background: false,
  };
}

function redact(value, credential) {
  if (typeof value === 'string') {
    return (credential ? value.split(credential).join('[REDACTED]') : value)
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]');
  }
  if (Array.isArray(value)) return value.map(item => redact(item, credential));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,redact(v,credential)]));
  return value;
}

async function boundedBody(response) {
  if (!response.body) return {text:'',truncated:false};
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      const remaining = MAX_RESPONSE_BYTES - size;
      if (item.value.length > remaining) {
        chunks.push(item.value.slice(0, remaining));
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(item.value);
      size += item.value.length;
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(chunks.reduce((n,x) => n+x.length,0));
  let offset=0;
  for(const chunk of chunks) { body.set(chunk,offset); offset+=chunk.length; }
  return {text:new TextDecoder().decode(body),truncated};
}

/**
 * One foreground request, maximum 45 seconds, zero automatic retries.
 * The authenticated runner must persist a queued checkpoint and enforce the
 * scenario/call budget before calling, and persist this result afterwards.
 * API search is a different dataset from consumer ChatGPT UI observations.
 */
export async function runNeutralSearch(input, env = {}, options = {}) {
  serverOnly();
  if (!getOpenAIAdapterStatus(env).configured) throw new Error(getOpenAIAdapterStatus(env).detail);
  const request = await buildNeutralSearchRequest(input, env);
  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 45000);
  const cancel = () => controller.abort('cancelled');
  if (input.signal?.aborted) controller.abort('cancelled');
  else input.signal?.addEventListener('abort',cancel,{once:true});
  const base = {
    adapter_version: OPENAI_ADAPTER_VERSION,
    provider: 'OpenAI', product: 'OpenAI Responses API',
    mode: 'LIVE_AI_SEARCH', model_requested: request.model,
    query_exact: input.query_exact, query_sha256: input.query_sha256,
    request, request_sha256: await sha256Text(JSON.stringify(request)),
    request_id: typeof input.request_id === 'string' ? redact(input.request_id.slice(0,128), env.OPENAI_API_KEY) : null,
    started_at: startedAt, retries: 0,
  };
  try {
    const response = await (options.fetchImpl ?? fetch)(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify(request), signal: controller.signal,
    });
    const body = await boundedBody(response);
    const safeBodyText = redact(body.text, env.OPENAI_API_KEY);
    let raw;
    try { raw = JSON.parse(safeBodyText); } catch { raw = {unparsed_body: safeBodyText}; }
    const output = Array.isArray(raw.output) ? raw.output : [];
    const toolLogs = output.filter(item => item.type === 'web_search_call');
    const verified = toolLogs.some(item => item.status === 'completed' && item.action?.type === 'search');
    const messages = output.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []);
    const text = messages.filter(item => item.type === 'output_text').map(item => item.text).join('\n');
    const citations = messages.flatMap(item => Array.isArray(item.annotations) ? item.annotations : []).filter(item => item.type === 'url_citation');
    const succeeded = response.ok && raw.status === 'completed' && verified && !body.truncated;
    return {
      ...base, finished_at:new Date().toISOString(),
      status:succeeded ? 'succeeded' : 'failed',
      failure_reason:succeeded ? null : !response.ok ? `provider_http_${response.status}`
        : body.truncated ? 'response_exceeded_size_limit' : !verified ? 'completed_search_not_verified' : 'provider_response_incomplete',
      http_status:response.status, provider_request_id:response.headers.get('x-request-id'),
      response_id:raw.id ?? null, model_actual:raw.model ?? null,
      raw_response:raw, raw_response_sha256:await sha256Text(body.text),
      raw_response_redacted:safeBodyText !== body.text,
      raw_response_truncated:body.truncated, output_text:text, citations, web_search_tool_logs:toolLogs,
      web_search_used:verified ? true : null,
      search_verification:verified ? 'completed_search_tool_log' : 'unverified',
      usage:raw.usage ?? null,
      metrics_extraction:'pending_human_review',
      limitation:'Provider API observation; not a consumer ChatGPT UI observation. No recommendation, mention or rank metric is inferred by this adapter.',
    };
  } catch (error) {
    const cancelled = input.signal?.aborted === true;
    return {
      ...base, finished_at:new Date().toISOString(), status:cancelled ? 'cancelled' : 'failed',
      failure_reason:cancelled ? 'cancelled' : controller.signal.aborted ? 'request_timeout_execution_unknown' : 'network_failure_execution_unknown',
      raw_response:null, output_text:null, citations:[], web_search_tool_logs:[],
      web_search_used:null, search_verification:'unverified', usage:null,
      limitation:'Provider completion and billing may be unknown after cancellation or network interruption. Inspect the attempt before a manual retry.',
    };
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort',cancel);
  }
}
