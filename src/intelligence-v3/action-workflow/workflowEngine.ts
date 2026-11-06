import type {AutonomousTask} from "../autonomous";
import {createInterventionMemory} from "../autonomous";
import {workflowStore} from "./workflowStore";
import type {WorkflowAction,WorkflowSummary} from "./types";

const now=()=>new Date().toISOString();

const effectiveness=(expected?:number,observed?:number)=>{
  if(observed===undefined)return undefined;
  if(!expected)return Math.max(0,Math.min(100,observed*25));
  return Math.max(0,Math.min(100,observed/expected*100));
};

export function createWorkflowFromAutonomousTask(
  task:AutonomousTask,
):WorkflowAction{
  const current=workflowStore.all().find(item=>item.sourceTaskId===task.id);
  if(current)return current;

  const action:WorkflowAction={
    id:`workflow-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    title:task.title,
    detail:task.detail,
    ownerType:task.owner,
    priority:task.priority,
    status:task.status==="active"
      ?"active"
      :task.status==="completed"
        ?"completed"
        :task.status==="cancelled"
          ?"cancelled"
          :"planned",
    plannedAt:task.createdAt,
    dueAt:task.dueAt,
    startedAt:task.status==="active"?now():undefined,
    completedAt:task.status==="completed"?now():undefined,
    expectedGain:task.expectedGain,
    sourceTaskId:task.id,
    sourceEventIds:task.sourceEventIds,
    createdAt:now(),
    updatedAt:now(),
  };

  return workflowStore.upsert(action);
}

export function updateWorkflowStatus(
  id:string,
  status:WorkflowAction["status"],
){
  const current=workflowStore.all().find(item=>item.id===id);
  if(!current)return undefined;

  const updated:WorkflowAction={
    ...current,
    status,
    startedAt:
      status==="active"&&!current.startedAt
        ?now()
        :current.startedAt,
    completedAt: status==="completed" ? (current.completedAt || now()) : undefined,
    updatedAt:now(),
  };

  return workflowStore.upsert(updated);
}

export function assignWorkflowOwner(
  id:string,
  ownerId:string|undefined,
  ownerName:string|undefined,
){
  const current=workflowStore.all().find(item=>item.id===id);
  if(!current)return undefined;
  return workflowStore.upsert({
    ...current,
    ownerId,
    ownerName,
    updatedAt:now(),
  });
}

export function completeWorkflowWithResult(
  id:string,
  observedGain:number,
  resultNote?:string,
){
  const current=workflowStore.all().find(item=>item.id===id);
  if(!current)return undefined;

  const score=effectiveness(current.expectedGain,observedGain);
  const updated:WorkflowAction={
    ...current,
    status:"completed",
    completedAt:now(),
    observedGain,
    effectivenessScore:score,
    resultNote,
    updatedAt:now(),
  };

  workflowStore.upsert(updated);

  createInterventionMemory({
    interventionType:current.subject||current.ownerType,
    title:current.title,
    startedAt:current.startedAt||current.plannedAt,
    completedAt:updated.completedAt,
    targetType:current.studentId
      ?"student"
      :current.classroom
        ?"classroom"
        :current.subject
          ?"subject"
          :"school",
    targetId:current.studentId||current.classroom||current.subject,
    targetLabel:current.studentName||current.classroom||current.subject,
    expectedGain:current.expectedGain,
    observedGain,
    notes:resultNote,
  });

  return updated;
}

export function buildWorkflowSummary():WorkflowSummary{
  const actions=workflowStore.all();
  const overdue=actions.filter(item=>
    (item.status==="planned"||item.status==="active")&&
    item.dueAt&&
    new Date(item.dueAt).getTime()<Date.now()
  ).length;

  const expected=actions
    .map(item=>item.expectedGain)
    .filter((value):value is number=>Number.isFinite(value));
  const observed=actions
    .map(item=>item.observedGain)
    .filter((value):value is number=>Number.isFinite(value));
  const effectivenessValues=actions
    .map(item=>item.effectivenessScore)
    .filter((value):value is number=>Number.isFinite(value));

  const average=(values:number[])=>values.length
    ?values.reduce((sum,value)=>sum+value,0)/values.length
    :0;

  return{
    generatedAt:now(),
    total:actions.length,
    draft:actions.filter(item=>item.status==="draft").length,
    planned:actions.filter(item=>item.status==="planned").length,
    active:actions.filter(item=>item.status==="active").length,
    completed:actions.filter(item=>item.status==="completed").length,
    overdue,
    averageExpectedGain:Number(average(expected).toFixed(2)),
    averageObservedGain:Number(average(observed).toFixed(2)),
    averageEffectiveness:Number(average(effectivenessValues).toFixed(1)),
    actions,
  };
}
