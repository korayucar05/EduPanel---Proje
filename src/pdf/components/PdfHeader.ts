import { PDF_COLORS } from "../core/PdfTheme";

export interface PdfHeaderOptions {
  schoolName?: string;
  slogan?: string;
  title: string;
  sectionTitle?: string;
  subtitle?: string;
  logoDataUrl?: string;
}

export function buildPdfHeader(options: PdfHeaderOptions): any {
  const headerThemes=[
    {background:"#0F172A",accent:"#38BDF8"},
    {background:"#14532D",accent:"#A3E635"},
    {background:"#7F1D1D",accent:"#FBBF24"},
    {background:"#312E81",accent:"#C4B5FD"},
    {background:"#78350F",accent:"#FDE68A"},
  ];
  const theme=headerThemes[[...options.title].reduce((sum,char)=>sum+char.charCodeAt(0),0)%headerThemes.length];
  const identity: any[] = [];
  if (options.logoDataUrl) identity.push({ image: options.logoDataUrl, width: 38, height: 38, fit: [38, 38] });
  identity.push({
    stack: [
      { text: options.schoolName || "ORDU LİSESİ", style: "schoolName" },
      ...(options.slogan ? [{ text: options.slogan, style: "smallMuted", italics: true, margin: [0, 2, 0, 0] }] : []),
    ],
  });

  return {
    margin: [0, 0, 0, 8],
    stack:[
      {
        table:{widths:[538.58],body:[[
          {stack:[
            {text:options.title.toLocaleUpperCase("tr-TR"),fontSize:15,bold:true,color:"#FFFFFF",margin:[13,9,13,2]},
            {text:[{text:"Tarih: ",bold:true},{text:options.subtitle||"-"}],fontSize:6.5,color:"#FFFFFF",margin:[13,0,13,9]},
          ],fillColor:theme.background},
        ]]},
        layout:{hLineWidth:()=>0,vLineWidth:()=>0,paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0},
      },
      {text:"",color:theme.accent,fontSize:1,margin:[0,2,0,0]},
      {
    table: {
      // pdfmake yalnızca tek "*" genişliğini destekler; "1.2*" geçerli
      // bir ölçü değildir ve tablo hesaplamasında NaN üreterek PDF'i durdurur.
      widths: ["30%", "40%", "30%"],
      body: [[
        { columns: identity, columnGap: 8, border: [false, false, false, false] },
        { text: "", style: "reportTitle", margin: [0, 8, 0, 0], border: [false, false, false, false] },
        {
          stack: [
            { text: options.sectionTitle || "", style: "sectionTitle", alignment: "right" },
            { text: options.subtitle || "", style: "smallMuted", alignment: "right", margin: [0, 3, 0, 0] },
          ],
          border: [false, false, false, false],
        },
      ]],
    },
    layout: {
      hLineWidth: (index: number) => (index === 1 ? 2 : 0),
      hLineColor: () => PDF_COLORS.primary,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 5,
    },
      },
    ],
  };
}
