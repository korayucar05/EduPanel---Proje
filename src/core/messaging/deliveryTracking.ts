import localforage from "../state/AppStateService";
import {
  fetchLiveReportPublicationStatus,
  type LiveReportPublication,
} from "../report-context";

export const HASAT_FAMILY_DELIVERY_KEY="hasat_family_delivery_records_v1";

export type DeliveryStageStatus="waiting"|"ready"|"sent"|"failed";
export type DeliveryViewStatus="unopened"|"opened"|"revoked"|"expired";

export type HasatFamilyDeliveryRecord={
  id:string;
  reportId:string;
  examId?:string;
  examName:string;
  reportTitle:string;
  recipientId:string;
  recipientName:string;
  phone:string;
  studentName?:string;
  studentNumber?:string;
  classroom?:string;
  pdfStatus:DeliveryStageStatus;
  linkStatus:DeliveryStageStatus;
  whatsappStatus:DeliveryStageStatus;
  viewStatus:DeliveryViewStatus;
  publication?:LiveReportPublication;
  documentMessageId?:string;
  linkMessageId?:string;
  error?:string;
  createdAt:string;
  updatedAt:string;
  firstViewedAt?:string;
  lastViewedAt?:string;
  viewCount:number;
};

const now=()=>new Date().toISOString();

export const deliveryRecordId=(reportId:string,recipientId:string)=>`${reportId}:${recipientId}`;

export async function loadHasatFamilyDeliveries(reportId?:string):Promise<HasatFamilyDeliveryRecord[]>{
  const rows=await localforage.getItem<HasatFamilyDeliveryRecord[]>(HASAT_FAMILY_DELIVERY_KEY);
  const records=Array.isArray(rows)?rows:[];
  return records
    .filter(item=>!reportId||item.reportId===reportId)
    .sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime());
}

export async function saveHasatFamilyDelivery(
  input:Partial<HasatFamilyDeliveryRecord>&Pick<HasatFamilyDeliveryRecord,"id"|"reportId"|"recipientId">,
):Promise<HasatFamilyDeliveryRecord>{
  const records=await loadHasatFamilyDeliveries();
  const existing=records.find(item=>item.id===input.id);
  const timestamp=now();
  const next:HasatFamilyDeliveryRecord={
    id:input.id,
    reportId:input.reportId,
    examId:input.examId??existing?.examId,
    examName:input.examName??existing?.examName??"Sınav",
    reportTitle:input.reportTitle??existing?.reportTitle??"Canlı rapor",
    recipientId:input.recipientId,
    recipientName:input.recipientName??existing?.recipientName??"Alıcı",
    phone:input.phone??existing?.phone??"",
    studentName:input.studentName??existing?.studentName,
    studentNumber:input.studentNumber??existing?.studentNumber,
    classroom:input.classroom??existing?.classroom,
    pdfStatus:input.pdfStatus??existing?.pdfStatus??"waiting",
    linkStatus:input.linkStatus??existing?.linkStatus??"waiting",
    whatsappStatus:input.whatsappStatus??existing?.whatsappStatus??"waiting",
    viewStatus:input.viewStatus??existing?.viewStatus??"unopened",
    publication:input.publication??existing?.publication,
    documentMessageId:input.documentMessageId??existing?.documentMessageId,
    linkMessageId:input.linkMessageId??existing?.linkMessageId,
    error:input.error===undefined?existing?.error:input.error,
    createdAt:existing?.createdAt??input.createdAt??timestamp,
    updatedAt:timestamp,
    firstViewedAt:input.firstViewedAt??existing?.firstViewedAt,
    lastViewedAt:input.lastViewedAt??existing?.lastViewedAt,
    viewCount:input.viewCount??existing?.viewCount??0,
  };
  const merged=[next,...records.filter(item=>item.id!==next.id)].slice(0,1000);
  await localforage.setItem(HASAT_FAMILY_DELIVERY_KEY,merged);
  window.dispatchEvent(new CustomEvent("hasat-family-delivery-updated",{detail:{record:next}}));
  return next;
}

export async function syncHasatFamilyDelivery(record:HasatFamilyDeliveryRecord):Promise<HasatFamilyDeliveryRecord>{
  if(!record.publication)return record;
  try{
    if(record.publication.revokeSecret==="firestore"){
      const expired=Boolean(record.publication.expiresAt)&&new Date(record.publication.expiresAt).getTime()<=Date.now();
      return await saveHasatFamilyDelivery({
        ...record,
        viewStatus:expired?"expired":record.viewStatus,
      });
    }
    const status=await fetchLiveReportPublicationStatus(record.publication);
    const viewCount=Number(status.readCount||0);
    return await saveHasatFamilyDelivery({
      ...record,
      viewCount,
      firstViewedAt:status.firstReadAt||record.firstViewedAt,
      lastViewedAt:status.lastReadAt||record.lastViewedAt,
      viewStatus:status.revokedAt
        ?"revoked"
        :status.expired
          ?"expired"
          :viewCount>0
            ?"opened"
            :"unopened",
    });
  }catch(error){
    console.warn("e-Nstitü AİLE görüntüleme durumu güncellenemedi.",error);
    return record;
  }
}

export async function syncHasatFamilyDeliveries(reportId?:string):Promise<HasatFamilyDeliveryRecord[]>{
  const records=await loadHasatFamilyDeliveries(reportId);
  return Promise.all(records.map(syncHasatFamilyDelivery));
}
