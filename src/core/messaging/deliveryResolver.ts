import type {LiveReportPublication} from "../report-context";
import {publishLiveReportFromContext} from "../report-context";
import type {MessagingContext} from "./messagingContext";

export type DeliveryResult={
  ok:boolean;
  status?:string;
  error?:string;
  id?:string;
  [key:string]:any;
};

export type PdfAndLiveLinkDeliveryResult={
  documentResult:DeliveryResult;
  linkResult?:DeliveryResult;
  livePublication?:LiveReportPublication;
};

const skippedDocumentResult=(reason?:string):DeliveryResult=>({
  ok:false,
  status:"PDF atlandı",
  error:reason||"PDF hazırlanamadığı için yalnızca canlı e-Nstitü AİLE bağlantısı gönderildi.",
  skipped:true,
});

export async function deliverPdfAndLiveLink<TReport>({
  context,
  filename,
  pdfBase64,
  documentMessage,
  pdfError,
  sendDocument,
  sendText,
  validDays=30,
}:{
  context:MessagingContext<TReport>;
  filename?:string;
  pdfBase64?:string;
  documentMessage?:string;
  pdfError?:string;
  validDays?:number;
  sendDocument:(phone:string,message:string,filename:string,base64:string)=>Promise<DeliveryResult>;
  sendText:(phone:string,message:string)=>Promise<DeliveryResult>;
}):Promise<PdfAndLiveLinkDeliveryResult>{
  const recipient=context.recipient;
  const shouldPublish=recipient.audience!=="teacher"&&recipient.audience!=="admin";
  // e-Nstitü AİLE yayınları artık doğrudan istemciden Firestore'a yazılmaz.
  // Ana Node.js/SQLite canlı rapor API'si raporu yayımlar ve güvenli bağlantıyı döndürür.
  // Böylece Firestore security-rules kaynaklı "Missing or insufficient permissions"
  // hatası WhatsApp teslim zincirini kesmez.
  const livePublication:LiveReportPublication|undefined=shouldPublish
    ?await publishLiveReportFromContext(context.reportContext,context.reportData as any,validDays)
    :undefined;

  const liveUrl=livePublication?.url;

  if(liveUrl){
    const parsed=new URL(liveUrl);
    const host=parsed.hostname.toLowerCase();
    const privateHost=
      host==="localhost"||
      host==="127.0.0.1"||
      host==="::1"||
      /^10\./.test(host)||
      /^192\.168\./.test(host)||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)||
      host.endsWith(".local");
    if(privateHost||parsed.protocol!=="https:"){
      throw new Error("Öğrenci canlı rapor bağlantısı genel HTTPS adresi değil. WhatsApp gönderimi güvenlik nedeniyle durduruldu.");
    }
  }
  // FINAL-19: WhatsApp'a yalnızca public HTTPS URL gönderilir.
  // URL'nin Open Graph önizlemesi C tasarımlı tıklanabilir e-Nstitü AİLE kartını oluşturur.
  const linkMessage=liveUrl||"";

  let documentResult:DeliveryResult=skippedDocumentResult(pdfError);
  if(!shouldPublish&&filename&&pdfBase64&&documentMessage){
    try{
      // Bağlantıyı PDF'den sonra gönderilecek ikinci bir mesaja bağımlı bırakmıyoruz.
      // WhatsApp belge açıklamasına eklenen URL doğrudan tıklanabilir olur.
      // PDF yalnızca yardımcı belgedir; canlı link/kart ayrı mesajda gönderilir.
      documentResult=await sendDocument(
        recipient.phone,
        documentMessage,
        filename,
        pdfBase64,
      );
    }catch(error:any){
      documentResult={
        ok:false,
        status:"PDF gönderilemedi",
        error:error?.message||"PDF gönderimi başarısız oldu.",
      };
    }
  }

  if(!liveUrl){
    return{documentResult,livePublication};
  }

  // Canlı bağlantı asıl teslim öğesidir. PDF başarılı olsa bile öğrenci/veliye
  // ayrıca e-Nstitü AİLE sonuç kartı + tıklanabilir HTTPS bağlantısı gönderilir.
  // Böylece kart gönderimi PDF başarısına bağlı kalmaz.
  let linkResult:DeliveryResult;
  try{
    linkResult=await sendText(recipient.phone,linkMessage);
  }catch(error:any){
    linkResult={
      ok:false,
      status:"Canlı bağlantı/kart gönderilemedi",
      error:error?.message||"e-Nstitü AİLE sonuç kartı WhatsApp ile gönderilemedi.",
    };
  }

  return{documentResult,linkResult,livePublication};
}
