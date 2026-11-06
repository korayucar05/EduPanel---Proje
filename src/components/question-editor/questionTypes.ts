export type AnswerLayout = "1" | "2-2-1" | "3-2" | "5";
export type ImageFlow = "text-left" | "block" | "text-right";

export type QuestionImage = {
  id: string;
  dataUrl: string;
  xPercent: number;
  yPx: number;
  insertionOffset: number;
  widthPercent: number;
  aspectRatio: number;
  flow: ImageFlow;
};

export type QuestionRootRange = { start: number; end: number; text?: string };

export type SpecialItem = {
  marker: string;
  text: string;
};

export type SpecialBlock = {
  id: string;
  start: number;
  end: number;
  sourceText: string;
  items: SpecialItem[];
};

export type QuestionDraft = {
  id: string;
  sourceSelectionId: number;
  order: number;
  fileName: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  heightPx: number;
  answerLayout: AnswerLayout;
  rootRanges: QuestionRootRange[];
  specialStart: number;
  specialEnd: number; // legacy: yeni Özel Alan motoru bunu kullanmaz
  specialBlocks: SpecialBlock[];
  images: QuestionImage[];
  saved?: boolean;
};

export type EditorStage = "edit" | "preview";
