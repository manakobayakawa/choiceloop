import { responseData,errorResponse,privateHeaders } from '../../../lib/workspace-server';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {
    const data=await responseData(req);
    return Response.json({format:'choiceloop-backup-0.1',exported_at:new Date().toISOString(),revision:data.revision,adapter_version:data.state.adapter_version,state:data.state},{headers:{...privateHeaders,'Content-Disposition':'attachment; filename="ChoiceLoop_Backup.json"'}});
  } catch(e) {return errorResponse(e);}
}
