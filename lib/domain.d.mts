export class DomainError extends Error { code:string; details:unknown; }
export const SCHEMA:string;
export const ADAPTER:string;
export const MODES:string[];
export function sha256(value:unknown):Promise<string>;
export function createInitialState(seed:any,plan:any,registry:any):Promise<any>;
export function validateState(state:any):boolean;
export function validateObservation(state:any,input:any):Promise<any>;
export function metrics(rows:any[]):any;
export function applyAction(state:any,command:{action:string,payload?:any},actor:string|{id:string,label?:string,authentication?:string}):Promise<{state:any,result:any}>;
