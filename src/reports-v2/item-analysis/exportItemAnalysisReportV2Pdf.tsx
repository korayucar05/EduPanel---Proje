import React from "react";
import { ItemAnalysisReportV2 } from "./ItemAnalysisReportV2";
import type { ItemAnalysisReportData } from "./buildItemAnalysisReportData";
import { downloadPdfBlob, exportHtmlReportPdf } from "../pdf/exportHtmlReportPdf";

export async function exportItemAnalysisReportV2Pdf(report:ItemAnalysisReportData){
  const blob=await exportHtmlReportPdf({
    render:<ItemAnalysisReportV2 report={report}/>,
    pageSelector:"#hasat-item-analysis-report-v2 > section.mx-auto",
    filename:"",
    hostWidth:1640,
    captureWidth:1588,
    captureHeight:1123,
    pdfWidth:1191,
    pdfHeight:842,
    pixelRatio:1.25,
    backgroundColor:"#ffffff",
  });
  const filename=`${report.examName}-${report.selectedSubject}-madde-analizi-v2-premium.pdf`.replace(/\s+/g,"_");
  downloadPdfBlob(blob,filename);
}
