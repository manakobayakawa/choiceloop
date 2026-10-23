import { responseData,command,checkOrigin,errorResponse,privateHeaders } from '../../../lib/workspace-server';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try { return Response.json(await responseData(req),{headers:privateHeaders}); } catch(e) {return errorResponse(e);}
}
export async function POST(req:Request) {
  try {
    checkOrigin(req);
    if(Number(req.headers.get('content-length')??0)>8_000_000) return Response.json({error:'Import exceeds 8 MB. Split results into smaller batches.'},{status:413,headers:privateHeaders});
    const body=await req.text();
    if(body.length>8_000_000) return Response.json({error:'Import exceeds 8 MB.'},{status:413,headers:privateHeaders});
    return Response.json(await command(req,JSON.parse(body)),{headers:privateHeaders});
  } catch(e) {return errorResponse(e);}
}
