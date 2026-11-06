import type {AcademicDigitalProfile} from "../core/types";
import type {InterventionMemoryItem,InterventionOutcome} from "./timelineTypes";
import {clamp} from "./timelineMath";

const outcomeFrom=({
  status,
  expected,
  observed,
}:{
  status:string;
  expected?:number;
  observed?:number;
}):InterventionOutcome=>{
  if(status!=="completed"||observed===undefined)return"pending";
  if(expected===undefined)return observed>1?"effective":observed>0?"limited":"ineffective";
  const ratio=expected?observed/expected:observed>0?1:0;
  if(ratio>=.8)return"effective";
  if(ratio>=.3)return"limited";
  return"ineffective";
};

export function buildInterventionMemory(
  profile?:AcademicDigitalProfile,
):InterventionMemoryItem[]{
  if(!profile)return[];

  return [...profile.interventionHistory]
    .sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)))
    .map(item=>{
      const outcome=outcomeFrom({
        status:item.status,
        expected:item.expectedNetGain,
        observed:item.observedNetGain,
      });
      const expected=Math.abs(item.expectedNetGain||0);
      const observed=item.observedNetGain;
      const effectivenessScore=outcome==="pending"
        ?0
        :expected
          ?clamp((Number(observed||0)/expected)*100)
          :clamp(Math.max(0,Number(observed||0))*25);

      const explanation=outcome==="effective"
        ?`${item.title} beklenen akademik etkiyi büyük ölçüde sağladı.`
        :outcome==="limited"
          ?`${item.title} sınırlı fakat ölçülebilir gelişim sağladı.`
          :outcome==="ineffective"
            ?`${item.title} beklenen akademik gelişimi sağlamadı.`
            :`${item.title} için sonuç ölçümü henüz tamamlanmadı.`;

      return{
        id:item.id,
        date:item.endedAt||item.startedAt,
        title:item.title,
        type:item.type,
        status:item.status,
        expectedNetGain:item.expectedNetGain,
        observedNetGain:item.observedNetGain,
        outcome,
        effectivenessScore:Number(effectivenessScore.toFixed(1)),
        explanation,
      };
    });
}
