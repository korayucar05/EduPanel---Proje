
import { detectQuestionRegions } from "./QuestionRegionDetector";

export type DetectedQuestion = {
  questionNo:number;
  x:number;
  y:number;
  width:number;
  height:number;
};

export async function detectQuestionsFromOCRText(text:string):Promise<DetectedQuestion[]> {
  return detectQuestionRegions(text);
}
