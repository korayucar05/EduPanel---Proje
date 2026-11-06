import {buildAcademicDna} from "../reports-v2/utils/buildAcademicDna";
import {buildParentSupportPlan} from "../reports-v2/utils/buildParentSupportPlan";
import {buildPersonalizedAiEvaluation} from "../reports-v2/utils/buildPersonalizedAiEvaluation";
import {buildStudentTargetAnalysis} from "../reports-v2/utils/buildStudentTargetAnalysis";
import {buildSuccessPrediction} from "../reports-v2/utils/buildSuccessPrediction";
import {buildAcademicRisks,buildIntelligenceSummary,buildSubjectPriorities} from "./riskEngine";
import type {HasatIntelligenceInput,HasatIntelligenceOutput} from "./types";

export function runHasatIntelligence(input:HasatIntelligenceInput):HasatIntelligenceOutput{
  const previousNets=(input.previousNets||[]).filter(Number.isFinite);
  const hasHistory=previousNets.length>=2;
  const responses=Math.max(1,input.totals.correct+input.totals.wrong+input.totals.empty);
  const emptyRate=input.totals.empty/responses*100;
  const wrongRate=input.totals.wrong/responses*100;

  const academicDna=buildAcademicDna({
    subjects:input.subjects,
    totals:input.totals,
    hasHistory,
  });

  const targetAnalysis=buildStudentTargetAnalysis({
    definition:input.targetDefinition,
    subjects:input.subjects,
    currentNet:input.totals.net,
    currentScore:Number(input.totals.score ?? 0),
    currentRank:input.currentRank,
  });

  const successPrediction=buildSuccessPrediction({
    currentNet:input.totals.net,
    currentScore:Number(input.totals.score ?? 0),
    previousNets,
    academicDna,
    targetAnalysis,
    emptyRate,
    wrongRate,
  });

  const aiEvaluation=buildPersonalizedAiEvaluation({
    studentName:input.studentName,
    subjects:input.subjects,
    totals:input.totals,
    classroomAverageNet:input.classroomAverageNet,
    academicDna,
    targetAnalysis,
    hasHistory,
  });

  const parentSupport=buildParentSupportPlan({
    studentName:input.studentName,
    subjects:input.subjects,
    totals:input.totals,
    classroomAverageNet:input.classroomAverageNet,
    academicDna,
    targetAnalysis,
    aiEvaluation,
  });

  const subjectPriorities=buildSubjectPriorities(input.subjects);
  const risks=buildAcademicRisks({
    subjects:input.subjects,
    totals:input.totals,
    academicDna,
    prediction:successPrediction,
  });
  const summary=buildIntelligenceSummary({
    totals:input.totals,
    risks,
    priorities:subjectPriorities,
    prediction:successPrediction,
  });

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    dataScope:hasHistory?"multi-exam":"single-exam",
    academicDna,
    targetAnalysis,
    successPrediction,
    aiEvaluation,
    parentSupport,
    risks,
    subjectPriorities,
    summary,
  };
}

