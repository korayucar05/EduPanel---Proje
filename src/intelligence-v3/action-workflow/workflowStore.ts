import type {WorkflowAction} from "./types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const STORAGE_KEY="hasat_action_workflow_v1";

const read=():WorkflowAction[]=>{
  try{
    const parsed=JSON.parse(sqliteStorage.getItem(STORAGE_KEY)||"[]");
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return[];
  }
};

const write=(items:WorkflowAction[])=>{
  try{sqliteStorage.setItem(STORAGE_KEY,JSON.stringify(items.slice(0,2000)));}catch{}
  window.dispatchEvent(new CustomEvent("hasat-workflow-updated"));
};

export const workflowStore={
  all:()=>read(),

  upsert(action:WorkflowAction){
    const items=read();
    const index=items.findIndex(item=>item.id===action.id);
    if(index>=0)items[index]=action;
    else items.unshift(action);
    write(items);
    return action;
  },

  remove(id:string){
    write(read().filter(item=>item.id!==id));
  },

  clear(){
    try{sqliteStorage.removeItem(STORAGE_KEY);}catch{}
    window.dispatchEvent(new CustomEvent("hasat-workflow-updated"));
  },
};
