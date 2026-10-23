export const INTEGRATION_ADAPTER:string;
export function validateFrozen25Bundle(bundle:any):Promise<any>;
export function importFrozen25(bundle:any):Promise<any>;
export function recomputeInformationComparison(baseline:any,retest:any,context?:any):Promise<any>;
export function attachIntegration(state:any,bundle:any,actor?:any):Promise<any>;
export function validateIntegrationState(state:any):Promise<boolean>;
export function applyIntegrationAction(state:any,command:{action:string,payload?:any},actor?:any):Promise<{state:any,result:any}>;
