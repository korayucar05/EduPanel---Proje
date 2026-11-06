import React from "react";
import { InstitutionReportV2 } from "./InstitutionReportV2";
import type { InstitutionReportV2Data } from "./buildInstitutionReportV2Data";
import { downloadPdfBlob, exportHtmlReportPdf } from "../pdf/exportHtmlReportPdf";

export async function exportInstitutionReportV2Pdf(report:InstitutionReportV2Data){
  return exportHtmlReportPdf({
    render:<InstitutionReportV2 report={report}/>,
    pageSelector:"#hasat-institution-report-v2-page-1,#hasat-institution-report-v2-page-2",
    filename:"",
    hostWidth:1123,
    captureWidth:1123,
    captureHeight:1588,
    pdfWidth:595,
    pdfHeight:842,
    pixelRatio:1.35,
    backgroundColor:"#f5f7fb",
  });
}

export async function downloadInstitutionReportV2Pdf(report:InstitutionReportV2Data,filename:string){
  const blob=await exportInstitutionReportV2Pdf(report);
  downloadPdfBlob(blob,filename);
}
