import type {
  AutonomousRun,
  AutonomousTask,
  InterventionMemoryRecord,
} from "./types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const TASKS_KEY="hasat_autonomous_tasks_v1";
const RUNS_KEY="hasat_autonomous_runs_v1";
const MEMORY_KEY="hasat_intervention_memory_v1";

const read=<T>(key:string):T[]=>{
  try{
    const parsed=JSON.parse(sqliteStorage.getItem(key)||"[]");
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return[];
  }
};

const write=<T>(key:string,value:T[])=>{
  try{sqliteStorage.setItem(key,JSON.stringify(value));}catch{}
};

export const autonomousStore={
  tasks:()=>read<AutonomousTask>(TASKS_KEY),
  runs:()=>read<AutonomousRun>(RUNS_KEY),
  memory:()=>read<InterventionMemoryRecord>(MEMORY_KEY),

  saveTasks:(tasks:AutonomousTask[])=>write(TASKS_KEY,tasks.slice(0,500)),
  saveRuns:(runs:AutonomousRun[])=>write(RUNS_KEY,runs.slice(0,300)),
  saveMemory:(memory:InterventionMemoryRecord[])=>write(MEMORY_KEY,memory.slice(0,1000)),

  upsertTask(task:AutonomousTask){
    const tasks=read<AutonomousTask>(TASKS_KEY);
    const index=tasks.findIndex(item=>item.id===task.id);
    if(index>=0)tasks[index]=task;
    else tasks.unshift(task);
    write(TASKS_KEY,tasks);
    window.dispatchEvent(new CustomEvent("hasat-autonomous-updated"));
    return task;
  },

  addRun(run:AutonomousRun){
    const runs=read<AutonomousRun>(RUNS_KEY);
    runs.unshift(run);
    write(RUNS_KEY,runs);
    window.dispatchEvent(new CustomEvent("hasat-autonomous-updated"));
    return run;
  },

  upsertMemory(record:InterventionMemoryRecord){
    const memory=read<InterventionMemoryRecord>(MEMORY_KEY);
    const index=memory.findIndex(item=>item.id===record.id);
    if(index>=0)memory[index]=record;
    else memory.unshift(record);
    write(MEMORY_KEY,memory);
    window.dispatchEvent(new CustomEvent("hasat-autonomous-updated"));
    return record;
  },

  clear(){
    try{
      sqliteStorage.removeItem(TASKS_KEY);
      sqliteStorage.removeItem(RUNS_KEY);
      sqliteStorage.removeItem(MEMORY_KEY);
    }catch{}
    window.dispatchEvent(new CustomEvent("hasat-autonomous-updated"));
  },
};
