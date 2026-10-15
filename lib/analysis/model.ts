import { AnalysisError } from './config';

/** Fixed provider origin. Image contents and keys are never logged or returned. */
export async function modelJson<T>(input: { apiKey: string; model: string; system: string; text: string; image?: string; schema: object; name: string }, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Matchlight' },
      signal: AbortSignal.timeout(35_000), redirect: 'error',
      body: JSON.stringify({ model: input.model, max_tokens: 4000, temperature: 0.1,
        messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.image ? [{ type: 'text', text: input.text }, { type: 'image_url', image_url: { url: input.image } }] : input.text }],
        response_format: { type: 'json_schema', json_schema: { name: input.name, strict: true, schema: input.schema } },
      }),
    });
  } catch { throw new AnalysisError('MODEL_TIMEOUT', 'The image analysis service did not respond. Please try again.', 504); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new AnalysisError('MODEL_AUTH', 'The analysis service could not authenticate.');
    if (response.status === 402) throw new AnalysisError('MODEL_CREDITS', 'The analysis provider needs available credits.');
    if (response.status === 429) throw new AnalysisError('MODEL_BUSY', 'The analysis service is busy. Please try again shortly.', 429);
    throw new AnalysisError('MODEL_UNAVAILABLE', 'The analysis service is temporarily unavailable.');
  }
  try {
    if (!response.body || Number(response.headers.get('content-length'))>100_000) throw new Error();
    const reader=response.body.getReader();let bytes=0;let text='';const decoder=new TextDecoder();
    try { while(true) { const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>100_000){await reader.cancel();throw new Error();}text+=decoder.decode(value,{stream:true}); } text+=decoder.decode(); }
    finally { reader.releaseLock(); }
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length > 24_000) throw new Error();
    return JSON.parse(content) as T;
  } catch { throw new AnalysisError('MODEL_OUTPUT', 'The analysis was incomplete. Please try again.'); }
}
