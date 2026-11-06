export type CropRegion={questionNo:number;x:number;y:number;width:number;height:number};

export async function cropQuestionToPng(
 source:HTMLImageElement,
 region:CropRegion
):Promise<Blob>{
 const canvas=window.document.createElement('canvas');
 canvas.width=region.width;
 canvas.height=region.height;
 const ctx=canvas.getContext('2d');
 if(!ctx) throw new Error('Canvas desteklenmiyor');
 ctx.drawImage(source,region.x,region.y,region.width,region.height,0,0,region.width,region.height);
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG oluşturulamadı.')),'image/png'));
}

export function exportFileName(questionNo:number){
 return String(questionNo).padStart(3,'0')+'.png';
}

/** Backward-compatible alias; output is lossless PNG. */
export const cropQuestionToJpeg = cropQuestionToPng;
