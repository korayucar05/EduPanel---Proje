import React from "react";
import { BranchReportV2 } from "./BranchReportV2";
import type { BranchReportV2Data } from "./buildBranchReportV2Data";
import { downloadPdfBlob, exportHtmlReportPdf } from "../pdf/exportHtmlReportPdf";

export async function exportBranchReportV2Pdf(report:BranchReportV2Data){
  const blob=await exportHtmlReportPdf({
    render:<BranchReportV2 report={report}/>,
    pageSelector:"#hasat-branch-report-v2 > section.mx-auto",
    filename:"",
    hostWidth:1160,
    captureWidth:1123,
    captureHeight:794,
    pdfWidth:842,
    pdfHeight:595,
    pixelRatio:1.25,
    backgroundColor:"#ffffff",
  });
  const filename=`${report.examName}-${report.subjectName}-brans-raporu-v2-premium.pdf`.replace(/\s+/g,"_");
  downloadPdfBlob(blob,filename);
}
