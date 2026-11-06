import type {ReportContext} from "../report-context";

export type DeliveryChannel="whatsapp"|"sms"|"email"|"push";
export type DeliveryAudience="admin"|"teacher"|"student"|"parent"|"family";

export type MessagingRecipient={
  id:string;
  name:string;
  phone:string;
  audience:DeliveryAudience;
  studentName?:string;
  studentNumber?:string;
  classroom?:string;
};

export type MessagingContext<TReport=any>={
  channel:DeliveryChannel;
  recipient:MessagingRecipient;
  reportContext:ReportContext;
  reportData:TReport;
  examName:string;
  createdAt:string;
};

export function buildMessagingContext<TReport>({
  channel="whatsapp",
  recipient,
  reportContext,
  reportData,
}:{
  channel?:DeliveryChannel;
  recipient:MessagingRecipient;
  reportContext:ReportContext;
  reportData:TReport;
}):MessagingContext<TReport>{
  return{
    channel,
    recipient,
    reportContext,
    reportData,
    examName:reportContext.examName,
    createdAt:new Date().toISOString(),
  };
}
