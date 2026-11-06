import {autonomousStore} from "./autonomousStore";
import type {InterventionMemoryRecord} from "./types";

const scoreOutcome=(
  expected?:number,
  observed?:number,
):Pick<InterventionMemoryRecord,"outcome"|"effectivenessScore">=>{
  if(observed===undefined)return{outcome:"pending",effectivenessScore:undefined};
  if(expected===undefined||expected===0){
    return{
      outcome:observed>1?"effective":observed>0?"limited":"ineffective",
      effectivenessScore:Math.max(0,Math.min(100,observed*25)),
    };
  }
  const ratio=observed/expected;
  return{
    outcome:ratio>=.8?"effective":ratio>=.3?"limited":"ineffective",
    effectivenessScore:Math.max(0,Math.min(100,ratio*100)),
  };
};

export function createInterventionMemory(
  input:Omit<InterventionMemoryRecord,"id"|"outcome"|"effectivenessScore">,
){
  const scored=scoreOutcome(input.expectedGain,input.observedGain);
  return autonomousStore.upsertMemory({
    ...input,
    id:`memory-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    ...scored,
  });
}

export function completeInterventionMemory(
  id:string,
  observedGain:number,
  notes?:string,
){
  const current=autonomousStore.memory().find(item=>item.id===id);
  if(!current)return undefined;
  const scored=scoreOutcome(current.expectedGain,observedGain);
  return autonomousStore.upsertMemory({
    ...current,
    completedAt:new Date().toISOString(),
    observedGain,
    notes:notes||current.notes,
    ...scored,
  });
}
