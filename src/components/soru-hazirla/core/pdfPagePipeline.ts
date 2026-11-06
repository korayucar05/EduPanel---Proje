export type PageImage={page:number;url:string;name:string};

/** PDF/görsel sayfalarını OCR ve kırpma motoruna hazırlayan ara katman. */
export async function preparePages(files:File[]):Promise<PageImage[]>{
 const pages:PageImage[]=[];
 for(let i=0;i<files.length;i++){
  const file=files[i];
  if(file.type.startsWith('image/')){
   pages.push({page:i+1,url:URL.createObjectURL(file),name:file.name});
  }
  else {
   pages.push({page:i+1,url:'',name:file.name});
  }
 }
 return pages;
}
