const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/DisciplineDecisionModal-CJPuHbEh.js","assets/rolldown-runtime-DAXXjFlN.js","assets/icons-vendor-DH_LIb54.js","assets/react-vendor-CQrfzmh0.js","assets/DisciplineCallModal-wVtWQC8q.js","assets/DisciplineStatementModals-D00KO8sq.js","assets/DisciplineIncidentReportModal-QpzCHvgl.js","assets/DisciplinePreviewModals-BZgcORsB.js","assets/HtmlPdfAdapter-sSyHMm39.js","assets/index-E8sZGMUk.js","assets/PdfEngine-CiuNLCr_.js","assets/PdfFooter-ChpOqnAP.js"])))=>i.map(i=>d[i]);
import{o as e}from"./rolldown-runtime-DAXXjFlN.js";import{t}from"./index-E8sZGMUk.js";import{Br as n,J as r,S as i,T as a,Ur as o,cr as s,nr as c,nt as l,t as u,wn as d}from"./icons-vendor-DH_LIb54.js";import{r as f}from"./SyncStateStore-CpVDKoz5.js";import{r as p}from"./react-vendor-CQrfzmh0.js";import{t as m}from"./audit-NZk5QgwY.js";import{t as ee}from"./common-CL-0nZeD.js";import{t as h}from"./welfare-1LFmrE5N.js";import{t as g}from"./behaviorStorage-B8OEthBh.js";var _=e(o(),1);function v(e,t,n){let r=e+.3963377774*t+.2158037573*n,i=e-.1055613458*t-.0638541728*n,a=e-.0894841775*t-1.2914855414*n,o=r*r*r,s=i*i*i,c=a*a*a,l=4.0767416621*o-3.3077115913*s+.2309699292*c,u=-1.2684380046*o+2.6097574011*s-.3413193965*c,d=-.0041960863*o-.7034186147*s+1.707614701*c,f=e=>{let t=Math.abs(e),n=t>=.0031308?1.055*t**(1/2.4)-.055:12.92*t;return e<0?-n:n};return{r:Math.round(Math.max(0,Math.min(1,f(l)))*255),g:Math.round(Math.max(0,Math.min(1,f(u)))*255),b:Math.round(Math.max(0,Math.min(1,f(d)))*255)}}function te(e){let t=e.match(/oklch\(([^)]+)\)/i);if(!t)return null;let n=t[1].trim().split(/[\s,+/]+/).filter(Boolean);if(n.length<3)return null;let r=parseFloat(n[0]);n[0].endsWith(`%`)&&(r/=100);let i=parseFloat(n[1]),a=parseFloat(n[2]);n[2].endsWith(`deg`)?a=parseFloat(n[2].slice(0,-3)):n[2].endsWith(`rad`)?a=parseFloat(n[2].slice(0,-3))*(180/Math.PI):n[2].endsWith(`turn`)&&(a=parseFloat(n[2].slice(0,-4))*360);let o=1;if(n.length>=4){let e=n[3];o=parseFloat(e),e.endsWith(`%`)&&(o/=100)}return isNaN(r)||isNaN(i)||isNaN(a)?null:{l:r,c:i,h:a,a:o}}function y(e){let t=e.match(/oklab\(([^)]+)\)/i);if(!t)return null;let n=t[1].trim().split(/[\s,+/]+/).filter(Boolean);if(n.length<3)return null;let r=parseFloat(n[0]);n[0].endsWith(`%`)&&(r/=100);let i=parseFloat(n[1]),a=parseFloat(n[2]),o=1;if(n.length>=4){let e=n[3];o=parseFloat(e),e.endsWith(`%`)&&(o/=100)}return isNaN(r)||isNaN(i)||isNaN(a)?null:{l:r,a:i,b:a,alpha:o}}function ne(e){return e.replace(/oklch\([^)]+\)/gi,e=>{let t=te(e);if(!t)return e;let{l:n,c:r,h:i,a}=t,o=n,s=i*Math.PI/180,{r:c,g:l,b:u}=v(o,r*Math.cos(s),r*Math.sin(s));return a<1?`rgba(${c}, ${l}, ${u}, ${a})`:`rgb(${c}, ${l}, ${u})`})}function b(e){return e.replace(/oklab\([^)]+\)/gi,e=>{let t=y(e);if(!t)return e;let{l:n,a:r,b:i,alpha:a}=t,{r:o,g:s,b:c}=v(n,r,i);return a<1?`rgba(${o}, ${s}, ${c}, ${a})`:`rgb(${o}, ${s}, ${c})`})}function x(e){if(typeof e!=`string`)return e;let t=e;return t.includes(`oklch`)&&(t=ne(t)),t.includes(`oklab`)&&(t=b(t)),t}if(typeof window<`u`&&!window.__oklch_patched){window.__oklch_patched=!0;let e=window.getComputedStyle;window.getComputedStyle=function(t,n){let r=e(t,n);return new Proxy(r,{get(e,t){if(t===`getPropertyValue`)return function(t){return x(e.getPropertyValue(t))};if(typeof t!=`string`&&typeof t!=`number`)return e[t];let n=e[t];return typeof n==`string`?x(n):typeof n==`function`?n.bind(e):n}})}}var S=(e,t=``)=>{let n=window.open(``,`_blank`);n?(n.document.write(`
      <html>
        <head>
          <title>Yazdır</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background: white; color: black; }
            ${t}
          </style>
        </head>
        <body>
          ${e}
        </body>
      </html>
    `),n.document.close(),n.focus(),setTimeout(()=>{n.print(),n.close()},500)):alert(`Lütfen tarayıcınızda açılır pencerelere (pop-up) izin verin.`)},C=p();function re({archiveRecords:e,archiveUniqueStudentCount:t,archiveSanctionStats:n,getRecordStudents:r,onRestore:i,onDelete:o}){return(0,C.jsx)(`div`,{className:`p-6 h-full flex flex-col animate-fadeIn`,children:e.length===0?(0,C.jsx)(`div`,{className:`flex flex-col items-center justify-center text-slate-400 font-medium h-full flex-1 min-h-[300px]`,children:(0,C.jsx)(`p`,{children:`Henüz arşive gönderilmiş bir kayıt bulunmamaktadır.`})}):(0,C.jsxs)(`div`,{className:`space-y-4`,children:[(0,C.jsxs)(`div`,{className:`grid grid-cols-1 md:grid-cols-3 gap-3`,children:[(0,C.jsx)(w,{label:`Toplam öğrenci kaydı`,value:e.length}),(0,C.jsx)(w,{label:`Farklı öğrenci`,value:t}),(0,C.jsxs)(`div`,{className:`rounded-2xl border border-slate-200 bg-white p-4`,children:[(0,C.jsx)(`div`,{className:`text-[10px] font-black uppercase tracking-wider text-slate-400`,children:`Ceza dağılımı`}),(0,C.jsx)(`div`,{className:`mt-2 flex flex-wrap gap-1.5`,children:n.map(([e,t])=>(0,C.jsxs)(`span`,{className:`rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700`,children:[e,`: `,t]},e))})]})]}),e.map(e=>(0,C.jsxs)(`div`,{className:`flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100/50 transition-colors gap-4`,children:[(0,C.jsxs)(`div`,{className:`flex items-start gap-4 w-full md:w-auto`,children:[(0,C.jsx)(`div`,{className:`w-12 h-12 bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-inner mt-1`,children:e.studentName.charAt(0)}),(0,C.jsxs)(`div`,{className:`flex-1`,children:[(0,C.jsx)(`div`,{className:`flex flex-col gap-1.5`,children:r(e).map((e,t)=>(0,C.jsxs)(`h4`,{className:`font-bold text-slate-800 flex items-center gap-2 flex-wrap`,children:[(0,C.jsx)(`span`,{children:e.name}),(0,C.jsxs)(`span`,{className:`text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md`,children:[e.classroom,` - `,e.number]})]},t))}),(0,C.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2 text-xs font-medium mt-1.5 text-slate-500`,children:[(0,C.jsx)(`span`,{className:`px-2 py-0.5 rounded-md border text-slate-600 bg-slate-100 border-slate-200/50 font-semibold`,children:`Arşivlenmiş Kayıt`}),(0,C.jsx)(`span`,{className:`text-slate-300`,children:`•`}),(0,C.jsxs)(`span`,{className:`text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/30 font-medium`,children:[`Davranış: `,e.behaviorName]}),(0,C.jsx)(`span`,{className:`text-slate-300`,children:`•`}),(0,C.jsxs)(`span`,{className:`text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/30 font-medium`,children:[`Ceza: `,e.sanctionType||`Belirtilmedi`]}),(0,C.jsx)(`span`,{className:`text-slate-300`,children:`•`}),(0,C.jsxs)(`span`,{children:[`Tarih: `,new Date(e.date).toLocaleDateString(`tr-TR`)]})]})]})]}),(0,C.jsxs)(`div`,{className:`flex items-center gap-3 shrink-0 self-end md:self-center ml-auto`,children:[(0,C.jsxs)(`button`,{onClick:()=>i(e),className:`px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer h-[40px]`,title:`Arşivden Çıkar ve Uyarı Bildirimi Alanına Geri Yükle`,children:[(0,C.jsx)(c,{className:`w-4 h-4`}),(0,C.jsx)(`span`,{children:`Geri Yükle`})]}),(0,C.jsx)(`button`,{onClick:()=>o(e.id),className:`p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-100 h-[40px] w-[40px] flex items-center justify-center shrink-0 cursor-pointer`,title:`Arşivden Tamamen Sil`,children:(0,C.jsx)(a,{className:`w-5 h-5`})})]})]},e.id))]})})}function w({label:e,value:t}){return(0,C.jsxs)(`div`,{className:`rounded-2xl border border-slate-200 bg-white p-4`,children:[(0,C.jsx)(`div`,{className:`text-[10px] font-black uppercase tracking-wider text-slate-400`,children:e}),(0,C.jsx)(`div`,{className:`mt-1 text-2xl font-black text-slate-800`,children:t})]})}function T({mode:e,record:t,onToggleStep:n,onGuidance:r,onCallLetter:i,onWrittenStatements:a,onMoveToDiscipline:o,onPrintReferral:c,onNotifications:l,onDecision:u}){let d=e===`Ön İnceleme`?[`Rehberlik Servisi Raporu`,`Çağrı Yazısı`,`Yazılı İfadeler`,`Disiplin Kuruluna Sevk`]:[`Disipline Sevk Dilekçesi`,`Disiplin Kurulu Çağrı Yazısı`,`Tebliğler`,`Karar`],f=e=>{e===`Rehberlik Servisi Raporu`?r(t):e===`Çağrı Yazısı`?i(t,!1):e===`Yazılı İfadeler`?a(t):e===`Disiplin Kuruluna Sevk`?o(t):e===`Disipline Sevk Dilekçesi`?c(t):e===`Disiplin Kurulu Çağrı Yazısı`?i(t,!0):e===`Tebliğler`?l(t):e===`Karar`&&u(t)};return(0,C.jsx)(`div`,{className:`pt-2 border-t border-slate-200/60 w-full`,children:(0,C.jsx)(`div`,{className:`grid grid-cols-1 sm:grid-cols-4 gap-2.5 w-full`,children:d.map(r=>{let i=!!t.completedSteps?.[r],a=r===`Disiplin Kuruluna Sevk`;return(0,C.jsxs)(`button`,{onClick:e=>{e.preventDefault(),e.stopPropagation(),f(r)},onDoubleClick:e===`Ön İnceleme`?e=>{e.preventDefault(),e.stopPropagation(),f(r)}:void 0,className:`relative flex items-center ${a?`justify-center px-4`:`justify-between pl-3 pr-1.5`} p-1.5 rounded-lg border${e===`Ön İnceleme`?`-2`:``} text-left transition-all duration-200 select-none ${a?i?`bg-red-700 border-red-800 text-white shadow-sm`:`bg-red-600 border-red-700 text-white hover:bg-red-700 hover:border-red-800 cursor-pointer`:i?`bg-emerald-600 border-emerald-700 text-white shadow-sm`:e===`Ön İnceleme`?`bg-white border-emerald-500 text-slate-700 hover:border-emerald-600 hover:bg-emerald-50/40 cursor-pointer`:`bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer`}`,children:[(0,C.jsx)(`span`,{className:`text-[12px] font-bold leading-tight select-none ${a?``:`pr-2`}`,children:r}),!a&&(0,C.jsx)(`div`,{onClick:e=>{e.preventDefault(),e.stopPropagation(),n(t.id,r)},className:`w-7 h-7 rounded-md border flex items-center justify-center transition-all shrink-0 ${i?`bg-yellow-400 border-yellow-500 text-yellow-950 cursor-pointer`:`bg-yellow-100 border-yellow-300 text-transparent group-hover:text-yellow-500/40 cursor-pointer`}`,title:i?`İptal et`:`Tamamlandı olarak işaretle`,children:(0,C.jsx)(s,{className:`w-4 h-4 stroke-[3px] ${i?`text-yellow-950`:`text-yellow-500`}`})})]},r)})})})}function ie(e){let{activeTab:t,setActiveTab:r,tabs:i,onOpenBehaviorTab:o,boardRecords:c,selectedRecordIdsForTutanak:l,setToplantiBilgileriStudent:u,setIsToplantiBilgileriModalOpen:f,filteredWarnings:p,getRecordStudents:m,setSelectedWarningForLetter:ee,getWarningLetterHTML:h,setWarningLetterPrintPreviewContent:g,toggleLetterSent:_,handleRevert:v,handleArchiveRecord:te,filteredBoardRecords:y,handleToggleStep:ne,openGuidanceStep:b,openCallLetterStep:x,openWrittenStatementsStep:S,handleMoveToDisciplineProcess:w,handlePrintSevkYazisi:ie,openNotificationsStep:ae,openDecisionStep:oe,archiveRecords:se,archiveUniqueStudentCount:ce,archiveSanctionStats:le,handleRestoreFromArchive:ue,handleDeleteArchiveRecord:E}=e;return(0,C.jsxs)(C.Fragment,{children:[(0,C.jsx)(`div`,{className:`bg-white border-2 border-dashed border-teal-600 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs`,children:(0,C.jsxs)(`div`,{className:`flex items-center overflow-x-auto gap-1.5 bg-teal-600 bg-theme-pattern p-1.5 rounded-2xl w-full scrollbar-hide shrink-0 h-[52px]`,children:[(0,C.jsx)(`button`,{onClick:()=>o?.(`All`),className:`flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border border-white text-teal-50 hover:text-white hover:bg-teal-700/50 text-center whitespace-nowrap h-[40px]`,children:`Davranış Kaydı`}),(0,C.jsx)(`button`,{onClick:()=>o?.(`Olumlu`),className:`flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border border-white text-teal-50 hover:text-white hover:bg-teal-700/50 text-center whitespace-nowrap h-[40px]`,children:`Davranış Listesi`}),(0,C.jsx)(`div`,{className:`h-6 w-px bg-teal-800/50 self-center mx-1 shrink-0`}),i.map(e=>(0,C.jsx)(`button`,{onClick:()=>r(e),className:`flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border text-center whitespace-nowrap h-[40px] ${t===e?`bg-white text-amber-900 shadow-sm border-transparent`:`bg-amber-800 text-amber-50 hover:text-white hover:bg-amber-900 border-white`}`,children:e},e)),t===`Ön İnceleme`&&(0,C.jsxs)(`button`,{onClick:()=>{let e=c.filter(e=>l.includes(e.id));if(e.length===0){alert(`Lütfen toplantı bilgileri için listeden en az bir kayıt seçin.`);return}u(e[0].studentName),f(!0)},className:`ml-auto flex-none flex items-center justify-center gap-1.5 px-4 text-[11px] font-bold rounded-xl transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-transparent h-[40px] whitespace-nowrap font-sans shrink-0`,title:`Toplantı Bilgilerini Görüntüle`,children:[(0,C.jsx)(d,{className:`w-3.5 h-3.5`}),` Toplantı Bilgileri`]})]})}),(0,C.jsx)(`div`,{className:`bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[500px]`,children:t===`Uyarı Bildirimi`?(0,C.jsx)(`div`,{className:`p-6 h-full flex flex-col`,children:p.length===0?(0,C.jsx)(`div`,{className:`flex flex-col items-center justify-center text-slate-400 font-medium h-full flex-1 min-h-[300px]`,children:(0,C.jsx)(`p`,{children:`Henüz gönderilmiş veya arama kriterine uygun bir uyarı bildirimi kaydı bulunmamaktadır.`})}):(0,C.jsx)(`div`,{className:`space-y-3`,children:p.map(e=>(0,C.jsx)(`div`,{className:`flex flex-col gap-2`,children:(0,C.jsxs)(`div`,{className:`flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100/50 transition-colors gap-4`,children:[(0,C.jsxs)(`div`,{className:`flex items-start gap-4 w-full md:w-auto`,children:[(0,C.jsx)(`div`,{className:`w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-inner mt-1`,children:e.studentName.charAt(0)}),(0,C.jsxs)(`div`,{className:`flex-1`,children:[(0,C.jsx)(`div`,{className:`flex flex-col gap-1.5`,children:m(e).map((e,t)=>(0,C.jsxs)(`h4`,{className:`font-bold text-slate-800 flex items-center gap-2 flex-wrap`,children:[(0,C.jsx)(`span`,{children:e.name}),(0,C.jsxs)(`span`,{className:`text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md`,children:[e.classroom,` - `,e.number]})]},t))}),(0,C.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2 text-xs font-medium mt-1.5 text-slate-500`,children:[(0,C.jsx)(`span`,{className:`px-2 py-0.5 rounded-md border ${e.warningCount&&e.warningCount>1?`text-rose-600 bg-rose-100 border-rose-200/50 font-semibold`:`text-amber-600 bg-amber-100 border-amber-200/50 font-semibold`}`,children:e.warningCount&&e.warningCount>1?`Uyarı (Tekrarlayan Kınama)`:`Yazılı Uyarı (İlk Kınama)`}),(0,C.jsx)(`span`,{className:`text-slate-300`,children:`•`}),(0,C.jsxs)(`span`,{className:`text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/30 font-medium`,children:[`Davranış: `,e.behaviorName]}),(0,C.jsx)(`span`,{className:`text-slate-300`,children:`•`}),(0,C.jsxs)(`span`,{children:[`Tarih: `,new Date(e.date).toLocaleDateString(`tr-TR`)]})]})]})]}),(0,C.jsxs)(`div`,{className:`flex items-center gap-3 shrink-0 self-end md:self-center ml-auto`,children:[(0,C.jsxs)(`div`,{className:`relative shrink-0`,children:[(0,C.jsxs)(`button`,{onClick:()=>{ee(e),g(h(e))},className:`w-[90px] h-[40px] ${e.letterSent?`bg-[#8b5a2b] hover:bg-[#a06833] border-[#7a4e25]`:`bg-amber-800 hover:bg-amber-900 border-amber-950`} text-white text-[10px] font-bold rounded-xl flex flex-col justify-center items-center text-center leading-tight transition-colors border shadow-sm cursor-pointer`,title:`Uyarı Mektubu PDF'i Görüntüle / Oluştur`,children:[(0,C.jsx)(`span`,{children:`Uyarı`}),(0,C.jsx)(`span`,{children:`Mektubu`})]}),(0,C.jsx)(`button`,{onClick:()=>_(e.id),className:`absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${e.letterSent?`bg-emerald-500 border-white text-white z-10 shadow-sm`:`bg-white border-slate-300 text-transparent hover:border-slate-400 z-10`}`,title:e.letterSent?`Gönderildi İşaretini Kaldır`:`Gönderildi Olarak İşaretle`,children:(0,C.jsx)(s,{className:`w-3.5 h-3.5 stroke-[3px] ${e.letterSent?`block`:`hidden`}`})})]}),(0,C.jsx)(`button`,{onClick:()=>v(e,`warnings`),className:`p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-100 h-[40px] w-[40px] flex items-center justify-center shrink-0 cursor-pointer`,title:`Sil ve Geri Gönder`,children:(0,C.jsx)(a,{className:`w-5 h-5`})}),(0,C.jsxs)(`button`,{onClick:()=>te(e,`Uyarı Bildirimi`),className:`px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-xl flex flex-col justify-center items-center text-center leading-tight transition-all border border-slate-950 shadow-sm cursor-pointer h-[40px] min-w-[70px]`,title:`Arşive Gönder`,children:[(0,C.jsx)(n,{className:`w-4 h-4 mb-0.5`}),(0,C.jsx)(`span`,{children:`Arşive Gönder`})]})]})]})},e.id))})}):t===`Ön İnceleme`||t===`Disiplin Süreci`?(0,C.jsx)(`div`,{className:`p-6 h-full flex flex-col`,children:y.length===0?(0,C.jsx)(`div`,{className:`flex flex-col items-center justify-center text-slate-400 font-medium h-full flex-1 min-h-[300px]`,children:(0,C.jsx)(`p`,{children:t===`Ön İnceleme`?`Henüz Ön İnceleme'ye alınmış bir kayıt bulunmamaktadır.`:`Henüz Disiplin Süreci'ne aktarılmış bir kayıt bulunmamaktadır.`})}):(0,C.jsx)(`div`,{className:`space-y-3`,children:y.map(e=>(0,C.jsxs)(`div`,{className:`flex flex-col p-4 bg-slate-50 rounded-2xl hover:bg-slate-100/50 transition-colors gap-3 ${t===`Ön İnceleme`?`border-2 border-emerald-500`:`border border-slate-200`}`,children:[(0,C.jsxs)(`div`,{className:`flex items-center justify-between w-full`,children:[(0,C.jsx)(`div`,{className:`flex-1`,children:(0,C.jsx)(`div`,{className:`flex flex-col gap-2`,children:m(e).map((t,n)=>(0,C.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,C.jsx)(`span`,{className:`font-bold text-slate-800 text-base`,children:t.name}),(0,C.jsxs)(`span`,{className:`text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md`,children:[t.classroom,` - `,t.number]}),(0,C.jsxs)(`span`,{className:`text-sm text-slate-600 font-medium italic`,children:[`(`,e.behaviorName,`)`]}),(0,C.jsxs)(`span`,{className:`text-xs text-slate-400 font-normal ml-auto md:ml-2`,children:[`Tarih: `,new Date(e.date).toLocaleDateString(`tr-TR`)]})]},n))})}),(0,C.jsxs)(`div`,{className:`flex items-center gap-2 shrink-0 ml-4`,children:[t===`Disiplin Süreci`&&(0,C.jsxs)(`button`,{onClick:()=>te(e,`Disiplin Süreci`),className:`px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-xl flex flex-col justify-center items-center text-center leading-tight transition-all border border-slate-950 shadow-sm cursor-pointer h-[40px] min-w-[70px]`,title:`Öğrenci bazında Arşive Gönder`,children:[(0,C.jsx)(n,{className:`w-4 h-4 mb-0.5`}),(0,C.jsx)(`span`,{children:`Arşive Gönder`})]}),(0,C.jsx)(`button`,{onClick:()=>v(e,t===`Disiplin Süreci`?`disiplin-sureci`:`board`),className:`p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-100 h-[36px] w-[36px] flex items-center justify-center shrink-0 cursor-pointer`,title:t===`Disiplin Süreci`?`Disiplin Sürecinden Kaldır ve Ön İncelemeye Geri Gönder`:`Sil ve Geri Gönder`,children:(0,C.jsx)(a,{className:`w-4.5 h-4.5`})})]})]}),(0,C.jsx)(T,{mode:t,record:e,onToggleStep:ne,onGuidance:b,onCallLetter:x,onWrittenStatements:S,onMoveToDiscipline:w,onPrintReferral:ie,onNotifications:ae,onDecision:oe})]},e.id))})}):t===`Arşiv`?(0,C.jsx)(re,{archiveRecords:se,archiveUniqueStudentCount:ce,archiveSanctionStats:le,getRecordStudents:m,onRestore:ue,onDelete:E}):(0,C.jsx)(`div`,{className:`flex flex-col items-center justify-center p-12 text-slate-400 font-medium h-full flex-1`,children:(0,C.jsxs)(`p`,{children:[t,` sekmesi yapım aşamasındadır.`]})})})]})}function ae(e){let{classrooms:t,teachers:n,getHeaderLines:r,getRecordStudents:i,formatHeaderLine:a,getPrincipalName:o,getBehaviorDetails:s,printHtmlSafely:c,boardRecords:l,selectedRecordIdsForTutanak:u,tutanakStudents:d,tutanakDate:f,tutanakTeachers:p}=e,m=e=>{let r=e=>String(e||``).trim().toLocaleUpperCase(`tr-TR`).replace(/[\s\-_/]+/g,``),i=t.find(t=>r(t?.name||t?.classroom)===r(e)),a=n.find(e=>String(e?.id)===String(i?.advisorTeacherId))?.name||i?.advisorTeacherName||``,o=n.find(e=>String(e?.id)===String(i?.counselorTeacherId))?.name||i?.counselorTeacherName||``;return{advisorTeacher:String(a||``).trim(),counselorTeacher:String(o||``).trim()}},ee=e=>{let t=r(),n=i(e),c=``;return n.forEach((r,i)=>{let{advisorTeacher:l,counselorTeacher:u}=m(r.classroom),d=typeof s==`function`?s(e.behaviorName):{regulationName:`Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği`,article:`164`,paragraph:``,content:e.behaviorName},f=[d?.article,d?.paragraph].filter(Boolean).join(` / `),p=String(d?.content||e.behaviorName||``).trim(),ee=i<n.length-1?`<div style="page-break-after: always;"></div>`:``;c+=`
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background: white; max-width: 800px; margin: 0 auto; font-size: 12pt;">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 10px;">
          ${t.map(e=>{let t=a(e);return`<h1 style="font-size: 12pt; margin: 0 0 ${t===`T.C.`?`1px`:`4px`} 0; line-height: 1.1; color: #0f172a; font-weight: bold; font-family: Arial, sans-serif;">${t}</h1>`}).join(``)}
        </div>

        <h2 style="font-size: 14pt; margin: 0 0 28px 0; text-align: center; color: #0f172a; font-weight: bold; text-decoration: underline;">YAZILI UYARI</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 26px; font-size: 11pt;">
          <tbody>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; width: 35%; font-weight: bold;">Öğrenci Adı Soyadı</th>
              <td style="padding: 8px; text-align: left;">${r.name}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Sınıfı / Okul Numarası</th>
              <td style="padding: 8px; text-align: left;">${r.classroom} / ${r.number}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Sergilenen Davranış</th>
              <td style="padding: 8px; text-align: left;">${e.behaviorName}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Yönetmelik Maddesi</th>
              <td style="padding: 8px; text-align: left;"><b>${d?.regulationName||`Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği`}</b>${f?` · ${f}`:``}<br/><span style="display:block; margin-top:6px; line-height:1.5;">${p}</span></td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Açıklama / Detaylar</th>
              <td style="padding: 8px; text-align: left; font-style: italic;">${e.description||`Belirtilmemiş.`}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Karar / İşlem Türü</th>
              <td style="padding: 8px; text-align: left; color: #000000;">
                Yazılı Uyarı
              </td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 11.5pt; text-align: justify; color: #111827; line-height: 1.55;">
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Yapılan inceleme ve görüşmeler sonucunda, öğrencinin <b>${new Date(e.date).toLocaleDateString(`tr-TR`)}</b> tarihinde <b>${e.behaviorName}</b> şeklinde davranışta bulunduğu belirlenmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Söz konusu davranış, <b>${d?.regulationName||`Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği`}</b>${f?` (${f})`:``} kapsamında değerlendirilmiştir. Yönetmelik maddesinin tam metni yukarıda gösterilmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Ancak öğrencinin daha önce herhangi bir disiplin cezası almamış olması ve kınama cezasını gerektiren bir davranışı ilk defa gerçekleştirmesi nedeniyle; sınıf/şube rehber öğretmeni ile rehber öğretmenin değerlendirme ve önerileri dikkate alınarak öğrenciye kınama cezası yerine yazılı uyarı yapılmasına karar verilmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Öğrencinin davranışının yanlışlığını fark etmesi, benzer davranışlardan kaçınması, okul kurallarına uyması ve <b>${e.behaviorName}</b> davranışını tekrar göstermemesi beklenmektedir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Öğrenciye, olumsuz davranışlarının devam etmesi hâlinde velisinin okula davet edileceği; kınama cezasını gerektiren ikinci bir davranışta bulunması hâlinde ise doğrudan Okul Öğrenci Ödül ve Disiplin Kuruluna gönderileceği bildirilmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">İşbu yazılı uyarı öğrenciye okunmuş, gerekli açıklamalar yapılmış ve tebliğ edilmiştir.</p>
          <p style="margin: 18px 0 0 0;"><b>Tebliğ Tarihi:</b> …… / …… / …………</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 42px; page-break-inside: avoid;">
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${r.name}</div>
            <div style="font-weight: bold;">Öğrenci</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${l}</div>
            <div style="font-weight: bold;">Sınıf/Şube Rehber Öğretmeni</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${u}</div>
            <div style="font-weight: bold;">Rehber Öğretmen</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${o()}</div>
            <div style="font-weight: bold;">Okul Müdürü</div>
          </div>
        </div>
      </div>
      ${ee}
      `}),c};return{getClassroomGuidanceNames:m,getWarningLetterHTML:ee,printLetter:e=>{let t=ee(e);c(t,`@page { margin: 0; }`)},handlePrintSevkYazisi:e=>{let t=e?[e]:l.filter(e=>u.includes(e.id));if(t.length===0){alert(`Lütfen sevk yazısı oluşturmak için listeden en az bir öğrenci seçin (öğrencinin yanındaki Tutanak seçim kutucuğunu kullanın).`);return}let n=new Date().toLocaleDateString(`tr-TR`),s=r(),d=o(),f=document.getElementById(`print-section`);f||(f=document.createElement(`div`),f.id=`print-section`,document.body.appendChild(f));let p=`
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #000000; line-height: 1.6; background: white; font-size: 12pt;">
        <div style="max-width: 800px; margin: 0 auto;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 35px;">
            ${s.map((e,t)=>{let n=a(e);return`<h1 style="font-size: 12pt; margin: 0 0 `+(t===0?`1px`:`4px`)+` 0; line-height: 1.1; color: #000000; font-weight: bold; font-family: Arial, sans-serif;">`+n+`</h1>`}).join(``)}
          </div>

          <!-- Sayı / Konu / Tarih -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12pt;">
            <div>
              <div><b>Sayı:</b> E-70494665-208.01-</div>
              <div><b>Konu:</b> Ödül ve Disiplin Kurulu Sevk İşlemi</div>
            </div>
            <div style="text-align: right;">
              <b>Tarih:</b> ${n}
            </div>
          </div>

          <!-- Muhatap -->
          <div style="text-align: center; margin-top: 20px; margin-bottom: 25px; font-weight: bold; font-size: 12pt;">
            ÖDÜL VE DİSİPLİN KURULU BAŞKANLIĞINA
          </div>

          <!-- İçerik -->
          <p style="font-size: 12pt; text-align: justify; text-indent: 30px; margin-bottom: 20px;">
            Okulumuz öğrencilerinden aşağıda bilgileri bulunan öğrencilerin sergilemiş oldukları olumsuz davranışlar nedeniyle, Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği'nin ilgili ödül ve disiplin hükümleri uyarınca Ödül ve Disiplin Kurulu'na sevk edilmesi uygun görülmüştür.
          </p>

          <p style="font-size: 12pt; text-align: justify; text-indent: 30px; margin-bottom: 30px;">
            Gerekli inceleme ve değerlendirmenin yapılarak kurul kararının müdürlüğümüze bildirilmesini rica ederim.
          </p>

          <!-- Okul Müdürü İmza -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
            <div style="text-align: center; width: 250px;">
              <div style="font-size: 12pt; font-weight: bold;">${d}</div>
              <div style="font-size: 12pt; color: #475569; margin-top: 2px;">Okul Müdürü</div>
              <div style="border-bottom: 1px dotted #000000; width: 100%; height: 35px; margin-top: 5px;"></div>
              <span style="font-size: 10px; color: #64748b;">İmza</span>
            </div>
          </div>

          <!-- Öğrenci Bilgileri Başlığı -->
          <div style="font-size: 12pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px;">
            SEVK EDİLEN ÖĞRENCİ LİSTESİ:
          </div>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 12pt;">
            <thead>
              <tr>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 15%;">Sınıfı</th>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 20%;">Öğrenci No</th>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 30%;">Adı Soyadı</th>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 35%;">Sevk Nedeni / Davranış</th>
              </tr>
            </thead>
            <tbody>
              ${t.flatMap(e=>i(e).map(t=>`
                  <tr>
                    <td style="padding: 8px 12px;">${t.classroom||`Belirtilmedi`}</td>
                    <td style="padding: 8px 12px;">${t.number||`Belirtilmedi`}</td>
                    <td style="padding: 8px 12px;"><b>${t.name}</b></td>
                    <td style="padding: 8px 12px;">${e.behaviorName||e.boardReason||`Belirtilmedi`}</td>
                  </tr>
                `)).join(``)}
            </tbody>
          </table>
        </div>
      </div>
    `;c(p,`@page { size: A4 portrait; margin: 15mm; }`)},handlePrintTutanak:()=>{if(d.length===0){alert(`Lütfen tutanağa en az bir öğrenci ekleyin.`);return}let e=document.createElement(`div`);e.id=`print-section`;let t=new Date(f).toLocaleDateString(`tr-TR`),n=`
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #000000; line-height: 1.5; background: white; max-width: 800px; margin: 0 auto; font-size: 12pt;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px;">
          ${r().map(e=>{let t=a(e);return`<h1 style="font-size: 12pt; margin: 0 0 `+(t===`T.C.`?`1px`:`4px`)+` 0; line-height: 1.1; color: #000000; font-weight: bold; font-family: Arial, sans-serif;">`+t+`</h1>`}).join(``)}
        </div>

        <!-- Date & Title Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 25px;">
          <div style="width: 30%;"></div>
          <h2 style="font-size: 14pt; text-align: center; font-weight: bold; margin: 0; text-decoration: underline; flex: 1;">DAVRANIŞ TESPİT TUTANAĞI</h2>
          <div style="font-size: 12pt; font-weight: bold; width: 30%; text-align: right;">
            Tarih: ${t}
          </div>
        </div>

        <!-- Statement / Body -->
        <p style="font-size: 12pt; text-align: justify; text-indent: 30px; margin-bottom: 20px;">
          Okulumuz bünyesinde eğitim öğretim saatleri ile ara dinlenme zamanlarında gerçekleştirilen nöbet görevi esnasında, aşağıda sınıfı, okul numarası, adı soyadı belirtilen öğrencilerin yanlarında yazılı bulunan kurallara aykırı ve disiplini bozucu davranışları gösterdikleri yerinde tespit edilmiş olup; durum işbu tutanak ile imza altına alınmıştır.
        </p>

        <!-- Students Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 12pt;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: center; font-weight: bold; width: 15%;">Sınıfı</th>
              <th style="padding: 8px 12px; text-align: center; font-weight: bold; width: 25%;">Öğrenci No</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: bold; width: 60%;">Adı Soyadı</th>
            </tr>
          </thead>
          <tbody>
            ${d.map(e=>`<tr><td style="padding: 8px 12px; text-align: center;">`+e.classroom+`</td><td style="padding: 8px 12px; text-align: center;">`+e.number+`</td><td style="padding: 8px 12px; text-align: left; font-weight: bold;">`+e.name+`</td></tr>`).join(``)}
          </tbody>
        </table>

        <!-- Signatures Box -->
        <div style="margin-top: 40px;">
          <p style="font-size: 12pt; font-weight: bold; margin-bottom: 25px;">Tutanak Düzenleyen Nöbetçi Öğretmenler:</p>
          <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 40px 10%;">
            ${p.length===0?`
              <div style="width: 26%; text-align: center;">
                <div style="font-size: 12pt; font-weight: bold; margin-bottom: 5px;">Nöbetçi Öğretmen</div>
                <div style="border-bottom: 1px dotted #000000; width: 100%; height: 35px; margin-bottom: 5px;"></div>
                <span style="font-size: 11px; color: #475569;">İmza</span>
              </div>
            `:p.map(e=>`<div style="width: 26%; text-align: center; min-width: 150px;"><div style="font-size: 12pt; font-weight: bold; margin-bottom: 2px;">`+e+`</div><div style="font-size: 12pt; color: #475569; margin-bottom: 8px;">Nöbetçi Öğretmen</div><div style="border-bottom: 1px dotted #000000; width: 100%; height: 35px; margin-bottom: 5px;"></div><span style="font-size: 11px; color: #475569; display: block;">İmza</span></div>`).join(``)}
          </div>
        </div>
      </div>
    `;c(n,`@page { size: A4 portrait; margin: 15mm; }`)}}}var oe=(0,_.lazy)(()=>t(()=>import(`./DisciplineDecisionModal-CJPuHbEh.js`).then(e=>({default:e.DisciplineDecisionModal})),__vite__mapDeps([0,1,2,3]))),se=(0,_.lazy)(()=>t(()=>import(`./DisciplineCallModal-wVtWQC8q.js`).then(e=>({default:e.DisciplineCallModal})),__vite__mapDeps([4,1,2,3]))),ce=(0,_.lazy)(()=>t(()=>import(`./DisciplineStatementModals-D00KO8sq.js`).then(e=>({default:e.DisciplineStatementModals})),__vite__mapDeps([5,1,2,3]))),le=(0,_.lazy)(()=>t(()=>import(`./DisciplineIncidentReportModal-QpzCHvgl.js`).then(e=>({default:e.DisciplineIncidentReportModal})),__vite__mapDeps([6,1,2,3]))),ue=(0,_.lazy)(()=>t(()=>import(`./DisciplinePreviewModals-BZgcORsB.js`).then(e=>({default:e.DisciplinePreviewModals})),__vite__mapDeps([7,1,2,8,9,10,11,3])));function E({initialTab:e=`Uyarı Bildirimi`,classrooms:n=[],teachers:a=[],students:o=[],enforceStudentScope:s=!1,scopeReason:p,canManageDiscipline:v=!0,onOpenBehaviorTab:te}){let[y,ne]=(0,_.useState)(e),b=(e,t)=>({...t||{},...e&&typeof e==`object`?e:{}}),x=e=>{if(!s)return e;let t=new Set(o.map(e=>String(e?.id??``).trim()).filter(Boolean)),n=new Set(o.map(e=>String(e?.fullName??e?.name??``).trim().toLocaleLowerCase(`tr-TR`)).filter(Boolean)),r=new Set(o.map(e=>String(e?.classroom??e?.className??``).trim().toLocaleLowerCase(`tr-TR`)).filter(Boolean));return e.filter(e=>(Array.isArray(e?.studentsList)&&e.studentsList.length?e.studentsList:[{id:e?.studentId,name:e?.studentName,classroom:e?.studentClassroom}]).some(e=>t.has(String(e?.id??``).trim())||n.has(String(e?.name??``).trim().toLocaleLowerCase(`tr-TR`))||r.has(String(e?.classroom??``).trim().toLocaleLowerCase(`tr-TR`))))},[re,w]=(0,_.useState)([]),[T,E]=(0,_.useState)([]),[de,fe]=(0,_.useState)([]),[pe,me]=(0,_.useState)(``),[he,ge]=(0,_.useState)(!1),[D,_e]=(0,_.useState)(null),[O,ve]=(0,_.useState)(null),[ye,k]=(0,_.useState)(!1),[be,xe]=(0,_.useState)(!1),[A,Se]=(0,_.useState)(null),[Ce,j]=(0,_.useState)(``),[we,Te]=(0,_.useState)(null),[Ee,De]=(0,_.useState)(null),[Oe,ke]=(0,_.useState)([]),[Ae,je]=(0,_.useState)([]),[Me,Ne]=(0,_.useState)(!1),[Pe,Fe]=(0,_.useState)(``),[Ie,Le]=(0,_.useState)(``),[Re,ze]=(0,_.useState)(``),[Be,Ve]=(0,_.useState)(!1),[M,He]=(0,_.useState)(null),[N,Ue]=(0,_.useState)(``),[We,Ge]=(0,_.useState)(``),[Ke,qe]=(0,_.useState)(``),[P,Je]=(0,_.useState)(``),[F,Ye]=(0,_.useState)(``),[Xe,Ze]=(0,_.useState)(``),[I,Qe]=(0,_.useState)(``),[$e,et]=(0,_.useState)(!1),[tt,nt]=(0,_.useState)(!1),[L,rt]=(0,_.useState)(null),[it,at]=(0,_.useState)(``),[R,ot]=(0,_.useState)(``),[st,ct]=(0,_.useState)(``),[lt,ut]=(0,_.useState)(``),[dt,ft]=(0,_.useState)(``),[pt,mt]=(0,_.useState)(``),[ht,gt]=(0,_.useState)(!1),[_t,vt]=(0,_.useState)(null),[z,yt]=(0,_.useState)(null),[B,bt]=(0,_.useState)(`Öğrenci İfadesi`),[xt,St]=(0,_.useState)(``),[Ct,wt]=(0,_.useState)(``),[Tt,Et]=(0,_.useState)(``),[Dt,Ot]=(0,_.useState)(`Disiplin Kurulu Odası`),[V,kt]=(0,_.useState)(``),[H,At]=(0,_.useState)(``),[U,jt]=(0,_.useState)(``),[Mt,Nt]=(0,_.useState)(``),[Pt,Ft]=(0,_.useState)(``),[It,Lt]=(0,_.useState)(!1),[W,Rt]=(0,_.useState)(null),[zt,Bt]=(0,_.useState)(``),[Vt,Ht]=(0,_.useState)(``),[Ut,Wt]=(0,_.useState)(``),[Gt,Kt]=(0,_.useState)(`Okul Müdürlüğü`),[qt,Jt]=(0,_.useState)(null),[G,Yt]=(0,_.useState)(`Öğrenci Çağrı Yazısı`),[K,Xt]=(0,_.useState)(``),[q,Zt]=(0,_.useState)([]),[Qt,$t]=(0,_.useState)(`search`),[J,en]=(0,_.useState)(``),[tn,nn]=(0,_.useState)(!1),[rn,an]=(0,_.useState)(null),[on,sn]=(0,_.useState)(``),[cn,ln]=(0,_.useState)(``),[un,dn]=(0,_.useState)(``),[fn,pn]=(0,_.useState)(!1),[mn,hn]=(0,_.useState)(``),[gn,_n]=(0,_.useState)(!1),[vn,yn]=(0,_.useState)(``),[bn,xn]=(0,_.useState)(``),[Sn,Cn]=(0,_.useState)(``),[wn,Tn]=(0,_.useState)(``),[En,Dn]=(0,_.useState)(!1),[Y,On]=(0,_.useState)(null),[kn,An]=(0,_.useState)(``),[jn,Mn]=(0,_.useState)({}),[Nn,Pn]=(0,_.useState)(!1),[X,Fn]=(0,_.useState)(null),[In,Ln]=(0,_.useState)(``),[Rn,zn]=(0,_.useState)(`Öğrenci Tebliğ Belgesi`),[Bn,Vn]=(0,_.useState)(``),[Hn,Un]=(0,_.useState)(``),[Wn,Gn]=(0,_.useState)(``),[Kn,qn]=(0,_.useState)(``),[Jn,Yn]=(0,_.useState)(``),[Xn,Zn]=(0,_.useState)(``),[Qn,$n]=(0,_.useState)(!1),[er,tr]=(0,_.useState)(()=>{let e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}),[nr,rr]=(0,_.useState)([]),[ir,ar]=(0,_.useState)(``),[or,sr]=(0,_.useState)([]),[Z,cr]=(0,_.useState)(``),[lr,ur]=(0,_.useState)(null),[dr,fr]=(0,_.useState)(!1),[pr,mr]=(0,_.useState)(!1),[hr,gr]=(0,_.useState)([]),[_r,vr]=(0,_.useState)([]);(0,_.useEffect)(()=>{try{let e=f.getItem(`school_students`);e&&gr(JSON.parse(e));let t=f.getItem(`school_teachers`);t&&vr(JSON.parse(t))}catch(e){console.error(`Error loading students/teachers for tutanak`,e)}},[Qn]);let yr=e=>{let t=Oe.find(t=>t.name===e);return{regulationName:t?.regulationName||`Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği`,article:t?.article||`Madde 164`,paragraph:t?.paragraph||`1. fıkra`,content:t?.content||e}},Q=e=>e.studentsList&&e.studentsList.length>0?e.studentsList:[{id:e.studentId,name:e.studentName,classroom:e.studentClassroom||``,number:e.studentNumber||``}],br=(e,t)=>{let n=e.archiveGroupId||e.sourceRecordId||e.id;return Q(e).map((r,i)=>({...e,id:`archive-${n}-${r.id}`,sourceRecordId:e.sourceRecordId||e.id,archiveGroupId:n,archiveSource:t,archivedAt:Date.now()+i,studentId:r.id,studentName:r.name,studentClassroom:r.classroom||``,studentNumber:r.number||``,studentsList:[],originalSanctionType:e.originalSanctionType||(t===`Uyarı Bildirimi`&&e.sanctionType===`Uyarı`?`Kınama`:e.sanctionType),sanctionType:t===`Uyarı Bildirimi`?`Uyarı`:e.sanctionType}))},xr=e=>{let t=e.trim();return t.toUpperCase()===`T.C.`||t.toUpperCase()===`T.C`?`T.C.`:t.split(` `).map(e=>{if(!e)return``;if(e.toUpperCase()===`T.C.`||e.toUpperCase()===`T.C`)return`T.C.`;let t=e.toUpperCase(),n=e.toLocaleUpperCase(`tr-TR`);return t===`ORDU`||n===`ORDU`?`ORDU`:t===`VALİLİĞİ`||t===`VALILIGI`||n===`VALİLİĞİ`?`VALİLİĞİ`:t===`MÜDÜRLÜĞÜ`||t===`MUDURLUGU`||n===`MÜDÜRLÜĞÜ`?`Müdürlüğü`:t===`LİSESİ`||t===`LISESI`||n===`LİSESİ`?`Lisesi`:t===`MİLLÎ`||t===`MILLI`||n===`MİLLÎ`?`Millî`:t===`EĞİTİM`||t===`EGITIM`||n===`EĞİTİM`?`Eğitim`:t===`BAKANLIĞI`||t===`BAKANLIGI`||n===`BAKANLIĞI`?`Bakanlığı`:e.charAt(0).toLocaleUpperCase(`tr-TR`)+e.slice(1).toLocaleLowerCase(`tr-TR`)}).join(` `)},$=()=>{try{let e=f.getItem(`school_info_a_profile`);if(e){let t=JSON.parse(e);if(t&&(t.instLine1||t.instLine2||t.instLine3)){let e=[t.instLine1,t.instLine2,t.instLine3].filter(Boolean);if(e.length>0)return e}}let t=f.getItem(`school_inst_lines`),n=[];t&&(n=JSON.parse(t)),(!Array.isArray(n)||n.length===0)&&(n=[`T.C.`,`ORDU VALİLİĞİ`,`ORDU LİSESİ MÜDÜRLÜĞÜ`]);let r=[...n];if(r.length>0){let e=r.length-1,t=r[e].trim();t.toUpperCase().endsWith(`MÜDÜRLÜĞÜ`)||(r[e]=t+(t===t.toUpperCase()?` MÜDÜRLÜĞÜ`:` Müdürlüğü`))}return r}catch(e){return console.error(e),[`T.C.`,`ORDU VALİLİĞİ`,`ORDU LİSESİ MÜDÜRLÜĞÜ`]}},Sr=()=>{try{let e=f.getItem(`school_info_a_profile`);if(e){let t=JSON.parse(e);if(t&&t.principalName)return t.principalName}let t=f.getItem(`school_info`);if(t){let e=JSON.parse(t);if(e&&e.principalName)return e.principalName}}catch(e){console.error(`Error reading principalName:`,e)}return`Koray Uçar`},Cr=async e=>{try{let t=re.map(t=>t.id===e?{...t,letterSent:!t.letterSent}:t);w(t),await g.setItem(`disciplineWarnings`,t)}catch(e){console.error(`Error toggling letter sent state:`,e)}},wr=async()=>{if(!v){alert(`Bu rol rehberlik kaydı oluşturamaz.`);return}if(M)try{let e=T.map(e=>{if(e.id===M.id){let t=e.completedSteps?{...e.completedSteps}:{};return t[`Rehberlik Servisi Raporu`]=!0,{...e,completedSteps:t,rehberlikData:{...e.rehberlikData,rehberlikSevkTarihi:N,rehberlikOlayTarihi:I,rehberlikDilekceKonu:We,rehberlikGorusulenKisiler:Ke,rehberlikGorusmeOzeti:P,rehberlikPsikososyal:F,rehberlikOneriler:Xe}}}return e}),t={rehberlikSevkTarihi:N,rehberlikOlayTarihi:I,rehberlikDilekceKonu:We,rehberlikGorusulenKisiler:Ke,rehberlikGorusmeOzeti:P,rehberlikPsikososyal:F,rehberlikOneriler:Xe},n=await h.saveGuidance(M.id,t);E(e),m.record({action:`update`,module:`discipline`,targetType:`guidanceForm`,targetId:M.id,summary:`${M.studentName||`Öğrenci`} için rehberlik görüşme formu kaydedildi`,before:M,after:n}),j(`${M.studentName||`Öğrenci`} için Rehberlik Görüşme Formu başarıyla kaydedildi.`),k(!0),Ve(!1)}catch(e){console.error(`Error saving rehberlik form:`,e),alert(`Kaydetme sırasında bir hata oluştu.`)}},Tr=()=>{if(!M)return;let e=document.getElementById(`print-section`);e||(e=document.createElement(`div`),e.id=`print-section`,document.body.appendChild(e));let t=Q(M).map(e=>`${e.name} (${e.classroom} - No: ${e.number||e.id})`).join(`, `),n=$();S(`
      <div style="font-family: 'Times New Roman', Times, serif; color: #000; padding: 20px; line-height: 1.5; font-size: 14px; max-width: 900px; margin: 0 auto;">
        
        <!-- Header Image & Title -->
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px solid #0f766e; padding-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 15px;">
        <h2 style="font-size: 18px; font-weight: bold; margin: 0; color: #0f766e; text-transform: uppercase;">DİSİPLİN KURULU İÇİN ÖĞRENCİ GÖRÜŞME FORMU</h2>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px;">
          <tbody>
            <tr>
              <td style="border: none; padding: 8px; width: 25%; font-weight: bold; background-color: #f1f5f9;">Okulu:</td>
              <td style="border: none; padding: 8px; width: 75%;" colspan="3">${n.length>2?n[2]:`Okulu`}</td>
            </tr>
            <tr>
              <td style="border: none; padding: 8px; width: 25%; font-weight: bold; background-color: #f1f5f9;">Olay Tarihi:</td>
              <td style="border: none; padding: 8px; width: 25%;">${I.split(`-`).reverse().join(`.`)}</td>
              <td style="border: none; padding: 8px; width: 25%; font-weight: bold; background-color: #f1f5f9;">Rehberlik Servisine<br/>Sevk Tarihi:</td>
              <td style="border: none; padding: 8px; width: 25%;">${N.split(`-`).reverse().join(`.`)}</td>
            </tr>
            <tr>
              <td style="border: none; padding: 8px; font-weight: bold; background-color: #f1f5f9;">Dilekçe Konu/Sayı/No:</td>
              <td style="border: none; padding: 8px;" colspan="3">${We||``}</td>
            </tr>
          </tbody>
        </table>

        <!-- Olayda Adı Geçenler -->
        <div style="border: none; padding: 10px; margin-bottom: 10px; min-height: 80px;">
          <div style="font-weight: bold; color: #475569; font-size: 12px; margin-bottom: 5px;">Olayda Adı Geçen Öğrenci/Öğrenciler (Ad Soyad, Sınıf, No):</div>
          <div style="font-size: 13px;">${t}</div>
        </div>

        <!-- Görüşülen Kişiler -->
        <div style="border: none; padding: 10px; margin-bottom: 10px; min-height: 80px;">
          <div style="font-weight: bold; color: #475569; font-size: 12px; margin-bottom: 5px;">Olayla İlgili Görüşülen Kişiler:</div>
          <div style="font-size: 13px; white-space: pre-wrap;">${Ke}</div>
        </div>

        <!-- Görüşmenin Özeti -->
        <div style="border: none; padding: 10px; margin-bottom: 10px; min-height: 120px;">
          <div style="font-weight: bold; color: #475569; font-size: 12px; margin-bottom: 5px;">Olayla İlgili Görüşmenin Özeti:</div>
          <div style="font-size: 13px; text-align: justify; white-space: pre-wrap;">${P}</div>
        </div>

        <!-- Psikososyal İnceleme -->
         <div style="border: none; padding: 10px; margin-bottom: 10px; min-height: 120px;">
          <div style="font-weight: bold; color: #475569; font-size: 12px; margin-bottom: 5px;">Olayla İlgili Öğrenci/Öğrencilerin Psikososyal İncelenmesi:</div>
          <div style="font-size: 13px; text-align: justify; white-space: pre-wrap;">${F}</div>
        </div>

        <!-- Görüş ve Öneriler -->
        <div style="border: none; padding: 10px; margin-bottom: 40px; min-height: 120px;">
          <div style="font-weight: bold; color: #475569; font-size: 12px; margin-bottom: 5px;">Rehberlik Öğretmeninin Konuyla İlgili Görüş ve Önerileri:</div>
          <div style="font-size: 13px; text-align: justify; white-space: pre-wrap;">${Xe}</div>
        </div>

        <!-- Imza Alanı -->
        <div style="display: flex; justify-content: flex-end; margin-top: 50px;">
          <div style="text-align: center; width: 250px;">
            <div style="font-size: 13px; margin-bottom: 10px;">..../..../.......</div>
            <div style="border-bottom: 1px dotted #000; width: 100%; height: 30px; margin-bottom: 5px;"></div>
            <div style="font-size: 13px; font-weight: bold;">Okul Rehberlik Öğretmeni</div>
          </div>
        </div>

      </div>
    `,`@page { size: A4 portrait; margin: 10mm; }`)},Er=async()=>{let e=document.getElementById(`rehberlik-print-section`);if(e){let{exportHtmlPdf:n}=await t(async()=>{let{exportHtmlPdf:e}=await import(`./HtmlPdfAdapter-sSyHMm39.js`).then(e=>e.t);return{exportHtmlPdf:e}},__vite__mapDeps([8,1,9,10,11]));await n(e,{filename:`Rehberlik_Gorusme_Formu.pdf`,title:`Rehberlik Görüşme Formu`,pageSize:`A4`,orientation:`portrait`,margins:[28,28,28,28]})}},Dr=async()=>{if(!v){alert(`Bu rol çağrı pusulası kaydedemez.`);return}if(W)try{let e=null,t=T.map(t=>{if(t.id===W.id){let n=t.completedSteps?{...t.completedSteps}:{};n[`Çağrı Yazısı`]=!0;let r={...t,completedSteps:n,cagriData:{...t.cagriData,[G===`Tanık Çağrı Yazısı`?`witnesses`:G===`Şikayetçi (Mağdur) Çağrı Yazısı`?`complainants`:K]:{cagriDate:zt,cagriMeetingDate:Vt,cagriMeetingTime:Ut,cagriMeetingPlace:Gt,cagriType:G,...G===`Tanık Çağrı Yazısı`?{witnesses:q}:{}}}};return e=r,r}return t});e&&Rt(e),E(t),await g.setItem(`disciplineBoardRecords`,t)}catch(e){console.error(`Error saving cagri form:`,e)}},Or=async()=>{if(!v){alert(`Bu rol çağrı pusulası kaydedemez.`);return}if(!W)return;try{let e=null,t=T.map(t=>{if(t.id===W.id){let n=t.completedSteps?{...t.completedSteps}:{};n[`Çağrı Yazısı`]=!0;let r={...t,completedSteps:n,cagriData:{...t.cagriData,[G===`Tanık Çağrı Yazısı`?`witnesses`:G===`Şikayetçi (Mağdur) Çağrı Yazısı`?`complainants`:K]:{cagriDate:zt,cagriMeetingDate:Vt,cagriMeetingTime:Ut,cagriMeetingPlace:Gt,cagriType:G,...G===`Tanık Çağrı Yazısı`?{witnesses:q}:{}}}};return e=r,r}return t});e&&Rt(e),E(t),await g.setItem(`disciplineBoardRecords`,t)}catch(e){console.error(`Error saving cagri form:`,e)}let e=$().map(e=>{let t=e.replace(/(\r\n|\n|\r)/gm,``);return`<h1 style="font-size: 14px; margin: 0 0 `+(t===`T.C.`?`1px`:`4px`)+` 0; line-height: 1.1; font-weight: bold;">`+t+`</h1>`}).join(``),t=``,n=(t,n)=>`
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #000; font-size: 12pt; line-height: 1.5; ${n?``:`page-break-after: always;`}">
          <div style="text-align: center; margin-bottom: 30px;">
            ${e}
            <h2 style="font-size: 14pt; font-weight: bold; margin: 20px 0 10px 0; text-transform: uppercase;">${G.toLocaleUpperCase(`tr-TR`)}</h2>
          </div>
          
          <div style="text-align: right; margin-bottom: 40px;">
            Tarih: ${zt?zt.split(`-`).reverse().join(`.`):`..../..../202...`}
          </div>

          <div style="margin-bottom: 30px;">
            Sayın: ${t}
          </div>

          <div style="text-indent: 40px; margin-bottom: 20px; text-align: justify; line-height: 1.8;">
            Okulumuz Öğrenci Davranışlarını Değerlendirme Kurulu tarafından yürütülmekte olan bir konuyla ilgili olarak bilginize/ifadenize başvurulmak üzere aşağıda belirtilen tarih, saat ve yerde bulunmanız gerekmektedir.
          </div>
          
          <div style="margin-left: 40px; margin-bottom: 30px; line-height: 1.8;">
            <table style="border-collapse: collapse; font-size: inherit; font-family: inherit; color: inherit;">
              <tr>
                <td style="padding: 0 10px 0 0;"><strong>Toplantı Tarihi</strong></td>
                <td style="padding: 0 10px 0 0;">:</td>
                <td style="padding: 0;">${Vt?Vt.split(`-`).reverse().join(`.`):`..../..../202...`}</td>
              </tr>
              <tr>
                <td style="padding: 0 10px 0 0;"><strong>Toplantı Saati</strong></td>
                <td style="padding: 0 10px 0 0;">:</td>
                <td style="padding: 0;">${Ut||`....:....`}</td>
              </tr>
              <tr>
                <td style="padding: 0 10px 0 0;"><strong>Toplantı Yeri</strong></td>
                <td style="padding: 0 10px 0 0;">:</td>
                <td style="padding: 0;">${Gt||`....................................`}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 50px;">
            Gereğini rica ederim.
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 50px; padding-right: 40px;">
            <div style="text-align: center;">
              <div style="margin-bottom: 10px; font-weight: bold;">${Sr()}</div>
              <div>Okul Müdürü</div>
            </div>
          </div>
        </div>
      `;if(G===`Tanık Çağrı Yazısı`)t=q.length===0?n(`<strong>......................................................................</strong>`,!0):q.map((e,t)=>{let r=`<strong>${e.name}</strong> (${e.classroom} sınıfı, ${e.number?e.number+` numaralı öğrenci`:`öğrencisi`})`;return n(r,t===q.length-1)}).join(``);else if(G===`Şikayetçi (Mağdur) Çağrı Yazısı`){let e=W.complainantStudents||[];t=e.length===0?n(`<strong>......................................................................</strong>`,!0):e.map((t,r)=>{let i=`<strong>${t.name}</strong> (${t.classroom} sınıfı, ${t.number?t.number+` numaralı öğrenci`:`öğrencisi`})`;return n(i,r===e.length-1)}).join(``)}else{let e=``,r=``,i=``,a=``;if(W.studentsList){let e=W.studentsList.find(e=>e.id===K);e&&(r=e.name,i=e.classroom,a=e.number)}else r=W.studentName,i=W.studentClassroom,a=W.studentNumber;e=r?G===`Veli Çağrı Yazısı`?`<strong>${r}</strong>'nın Velisi (${i} sınıfı)`:`<strong>${r}</strong> (${i} - No: ${a||`Belirtilmedi`})`:`<strong>......................................................................</strong>`,t=n(e,!0)}Jt(t),S(t,`@page { size: A5 portrait; margin: 15mm; }`),setTimeout(()=>{Jt(null)},1e3)},kr=()=>{qt&&S(qt,`@page { size: A5 portrait; margin: 15mm; }`)},Ar=async()=>{if(!v){alert(`Bu rol disiplin kararı kaydedemez.`);return}if(!Y)return;try{let e=await h.saveDecision(Y.id,kn,{...jn});On(b(e,Y)),E(t=>t.map(t=>t.id===Y.id?b(e,Y):t)),m.record({action:`update`,module:`discipline`,targetType:`boardDecision`,targetId:Y.id,summary:`${Y.studentName||`Öğrenci`} için disiplin kurulu kararı kaydedildi`,before:Y,after:e})}catch(e){console.error(`Error saving karar form:`,e)}let e=``,t=``,n=``;if(Y.studentsList){let r=Y.studentsList.find(e=>e.id===kn);r&&(e=r.name,t=r.classroom,n=r.number)}else e=Y.studentName,t=Y.studentClassroom,n=Y.studentNumber;let r=jn,i=r.kararTarihi?r.kararTarihi.split(`-`).reverse().join(`.`):``;S(`
      <div style="font-family: Arial, sans-serif; line-height: 1.4; color: #000; font-size: 12pt;">
        <h2 style="text-align: center; margin-bottom: 20px; font-size: 14pt; padding-bottom: 10px;">OKUL ÖDÜL ve DİSİPLİN KURULU KARARI</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <tr>
            <td style="border: none; padding: 4px 8px; width: 30%;">Karar No</td>
            <td style="border: none; padding: 4px 8px; width: 70%;">: ${r.kararNo||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">Karar Tarihi</td>
            <td style="border: none; padding: 4px 8px;">: ${i}</td>
          </tr>
        </table>
        
        <div style="font-weight: bold; margin-bottom: 5px;"><u>Öğrencinin</u></div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <tr>
            <td style="border: none; padding: 4px 8px; width: 30%;">1. Adı Soyadı</td>
            <td style="border: none; padding: 4px 8px; width: 70%;">: ${e}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">2. Doğum Tarihi</td>
            <td style="border: none; padding: 4px 8px;">: ${r.dogumTarihi||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">3. T.C.</td>
            <td style="border: none; padding: 4px 8px;">: ${r.tcNo||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">4. Sınıfı, dönemi, bölümü ve okul numarası</td>
            <td style="border: none; padding: 4px 8px;">: ${t} / No: ${n}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">5. Paralı/parasız yatılı veya gündüzlü olduğu</td>
            <td style="border: none; padding: 4px 8px;">: ${r.ogrenimDurumu||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">6. Başarı Durumu</td>
            <td style="border: none; padding: 4px 8px;">: ${r.basariDurumu||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">7. Sağlık Durumu</td>
            <td style="border: none; padding: 4px 8px;">: ${r.saglikDurumu||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">8. Ailesinin ekonomik durumu</td>
            <td style="border: none; padding: 4px 8px;">: ${r.ekonomikDurum||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">9. Ailesinin birlikte oturup oturmadığı</td>
            <td style="border: none; padding: 4px 8px;">: ${r.birlikteOturma||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">10. Anne-babasının sağ olup olmadığı</td>
            <td style="border: none; padding: 4px 8px;">: ${r.anneBabaSag||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">11. Anne-babasının öz olup olmadığı</td>
            <td style="border: none; padding: 4px 8px;">: ${r.anneBabaOz||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">12. Ailesinin yanında okuyup okumadığı</td>
            <td style="border: none; padding: 4px 8px;">: ${r.ailesiYaninda||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">13. Büyüyüp yetiştiği çevre</td>
            <td style="border: none; padding: 4px 8px;">: ${r.yetistigiCevre||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">14. Ailesinin oturduğu yer ve açık adresi</td>
            <td style="border: none; padding: 4px 8px;">: ${r.adres||``}</td>
          </tr>
          <tr>
                  <td style="border: none; padding: 4px 8px;">15. Şimdiye kadar aldığı cezalar ve genel durumu</td>
            <td style="border: none; padding: 4px 8px;">: ${r.oncekiCezalar||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">16. Cezayı gerektiren davranışın yapıldığı yer ve tarih</td>
            <td style="border: none; padding: 4px 8px;">: ${r.olayYeriTarihi||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">17. Cezayı gerektiren davranışın çeşidi</td>
            <td style="border: none; padding: 4px 8px;">: ${r.davranisCesidi||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px;">18. Cezayı gerektiren davranışın nedeni</td>
            <td style="border: none; padding: 4px 8px;">: ${r.davranisNedeni||``}</td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">
              19. Olayla ilgili olarak;<br/>
              a) Cezalandırılan öğrencinin ifadesinin özeti<br/>
              b) Tanıkların ifadesinin özeti<br/>
              c) Varsa cezayı gerektiren davranışın tespitine yarayan diğer deliller
            </td>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">
              <b>A)</b> ${r.ifadeOzeti||``}<br/><br/>
              <b>B)</b> ${r.tanikOzeti||``}<br/><br/>
              <b>C)</b> ${r.digerDeliller||``}
            </td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">
              20. Cezayı hafifleten veya şiddetlendiren nedenler
            </td>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">
              <div style="margin-bottom: 5px;">M.E.B. Ortaöğretim Kurumları Ödül ve Disiplin Yön. Madde 16 "Ceza Takdirinde Dikkat Edilecek Hususlar" incelenmiştir.</div>
              <div style="display: flex; margin-bottom: 2px;"><div style="width: 250px;">Sınıf Arkadaşlarının Öğrenci Hakkında Kanaati</div><div>: ${r.arkadasKanaati||``}</div></div>
              <div style="display: flex;"><div style="width: 250px;">Sınıf Öğretmeninin ve Diğer Öğretmenlerinin Kanaati</div><div>: ${r.ogretmenKanaati||``}</div></div>
            </td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">21. Okul Öğrenci Ödül ve Disiplin Kurulunun kanaati</td>
            <td style="border: none; padding: 4px 8px; vertical-align: top; text-align: justify;">
              : Öğrencinin yapmış olduğu davranışın <u>M.E.B.</u> Ortaöğretim Kurumları Ödül ve Disiplin Yönetmeliğindeki karşılığı 12 / ${r.kurulKanaatiMaddeBendi||`...`} 'a göre "<b>${r.kurulKanaatiDavranis||`........................................................`}</b>" dır. Okul Ödül ve Disiplin Kurulu ceza takdirinde dikkat edilecek hususları ve rehberlik servisinin raporunu da inceleyerek öğrenciye gerekli konularda bilgilendirme de yaparak cezasının uygulanmasına-indirilmesine ve "<b>${r.kurulKanaatiCeza||`........................................................`}</b>" cezasının verilmesi kanaat getirmiştir.
            </td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">22. Verilen Cezanın çeşidi ve dayandığı yönetmelik maddesi</td>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">
              : <u>M.E.B.</u> Ortaöğretim Kurumları Ödül ve Disiplin Yön. Madde <u>12 / ${r.cezaMaddeBendi||`....`}</u> bendi <u>${r.cezaFikrasi||`.......`}</u> numaralı fıkrası uygulanmıştır.
            </td>
          </tr>
          <tr>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">23. Okul Öğrenci Ödül ve Disiplin Kurulunun kararı</td>
            <td style="border: none; padding: 4px 8px; vertical-align: top;">: ${r.kurulKarari||``}</td>
          </tr>
        </table>
        
        <table style="width: 100%; text-align: center; margin-top: 30px; margin-bottom: 30px; table-layout: fixed; font-weight: bold; font-size: 11px;">
          <tr>
            <td style="width: 22%; vertical-align: top;">
              Üye<br/>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 10px 0;">${r.uye1||`...................................`}</span>
              <div style="border-top: 1px dotted #000; padding-top: 4px;">
                ${r.uye1Unvan||`Öğretmeni`}
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 22%; vertical-align: top;">
              Üye<br/>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 10px 0;">${r.uye2||`...................................`}</span>
              <div style="border-top: 1px dotted #000; padding-top: 4px;">
                ${r.uye2Unvan||`Öğretmeni`}
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 22%; vertical-align: top;">
              Üye<br/>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 10px 0;">${r.uye3||`...................................`}</span>
              <div style="border-top: 1px dotted #000; padding-top: 4px;">
                Okul Aile Birliği Üyesi
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 22%; vertical-align: top;">
              Üye<br/>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 10px 0;">${r.uye4||`...................................`}</span>
              <div style="border-top: 1px dotted #000; padding-top: 4px;">
                Onur Kurulu İkinci Başkanı
              </div>
            </td>
          </tr>
        </table>
        
        <table style="width: 100%; text-align: center; font-weight: bold; font-size: 11px; table-layout: fixed;">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              Okul Disiplin Kurulu Başkanı<br/>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 15px 0;">${r.baskan||`...................................`}</span>
              <div style="border-top: 1px dotted #000; width: 70%; margin: 0 auto; padding-top: 4px;">
                Müdür Başyardımcısı
              </div>
            </td>
            <td style="width: 50%; vertical-align: top;">
              <u>U Y G U N D U R</u><br/>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 3px 0;">${i||`.... / .... / 20....`}</span>
              <span style="font-weight: normal; font-size: 10px; display: block; margin: 5px 0 10px 0;">${r.mudur||`...................................`}</span>
              <div style="border-top: 1px dotted #000; width: 70%; margin: 0 auto; padding-top: 4px;">
                Okul Müdürü
              </div>
            </td>
          </tr>
        </table>
      </div>
    `,`
        #print-section table {
          border-collapse: collapse !important;
          border: none !important;
          margin-bottom: 12px;
        }
        #print-section td {
          border: none !important;
          padding: 4px 8px !important;
        }
        #print-section * {
          font-size: 12pt !important;
        }
        #print-section h2 {
          font-size: 14pt !important;
        }
        @page { size: A4 portrait; margin: 10mm; }
    `)},jr=async()=>{if(!v){alert(`Bu rol yazılı ifade kaydedemez.`);return}if(z)try{let e=null,t=T.map(t=>{if(t.id===z.id){let n=t.completedSteps?{...t.completedSteps}:{};n[`Yazılı İfadeler`]=!0;let r={...t,completedSteps:n,yaziliIfadeData:{...t.yaziliIfadeData,[V]:{yaziliIfadeTuru:B,yaziliIfadeTarih:xt,yaziliIfadeTarihi:Ct,yaziliIfadeSaati:Tt,yaziliIfadeYeri:Dt,yaziliIfadeSelectedStudent:V,yaziliIfadeKonusu:H,yaziliIfadeMetni:U,yaziliIfadeOlayTarihi:Mt,yaziliIfadeDilekceTarihi:Pt}}};return e=r,r}return t});e&&yt(e),E(t),await g.setItem(`disciplineBoardRecords`,t)}catch(e){console.error(`Error saving yazili ifade form:`,e)}},Mr=async()=>{if(!v){alert(`Bu rol yazılı ifade kaydedemez.`);return}if(!z)return;await jr();let e=[];B===`Öğrenci İfadesi`?e=Q(z):B===`Şikayetçi (Mağdur) Öğrenci İfadesi`?e=z.complainantStudents||[]:B===`Tanık İfadesi`&&(e=z.cagriData?.witnesses?.witnesses||[]);let t=e.find(e=>(e.id||e.name)===V)||e[0],n=t?t.name:``,r=Ct?Ct.split(`-`).reverse().join(`.`):`..../..../20....`,i=Mt?Mt.split(`-`).reverse().join(`.`):`..../..../20....`,a=Pt?Pt.split(`-`).reverse().join(`.`):`..../..../20....`;$().find(e=>e.toUpperCase().endsWith(`MÜDÜRLÜĞÜ`));let o=B===`Tanık İfadesi`,s=``,c=Q(z).map(e=>{let t=[];e.classroom&&t.push(`${e.classroom} sınıfı`),(e.number||e.id)&&t.push(`${e.number||e.id} numaralı`);let n=t.length>0?` (${t.join(`, `)})`:``;return`<strong>${e.name}</strong>${n}`}).join(`, `),l=``,u=``;try{let e=f.getItem(`school_committees`);if(e){let t=JSON.parse(e).find(e=>e.name.toLowerCase().includes(`davranışlarını değerlendirme`)||e.name.toLowerCase().includes(`disiplin`));if(t&&(u=t.presidentName||``,!o)){let e=t.members.filter(e=>!e.role.toLowerCase().includes(`yedek`)).slice(0,2).map(e=>`
              <div style="flex: 1;">
                <div style="font-weight: normal; font-size: 12pt; display: block;">Üye</div>
                <div style="font-weight: bold;">${e.teacherName}</div>
                <div style="font-weight: normal; font-size: 12pt; margin-top: 30px; display: block;">İmza</div>
              </div>
            `);e.push(`
              <div style="flex: 1;">
                <div style="font-weight: normal; font-size: 12pt; display: block;">Kurul Başkanı</div>
                <div style="font-weight: bold;">${u}</div>
                <div style="font-weight: normal; font-size: 12pt; margin-top: 30px; display: block;">İmza</div>
              </div>
            `),l=`
              <div style="display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 25px; font-family: Arial, sans-serif; font-size: 12pt; text-align: center; page-break-inside: avoid;">
                ${e.join(``)}
              </div>
            `}}}catch{}if(!l&&!o&&(l=`
        <div style="display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 25px; font-family: Arial, sans-serif; font-size: 12pt; font-weight: bold; text-align: center; page-break-inside: avoid;">
          <div style="width: 33.33%;">
            Üye (Öğretmen)<br>
            <span style="font-weight: normal; font-size: 12pt; margin-top: 40px; display: block;">İmza</span>
          </div>
          <div style="width: 33.33%;">
            Üye (Öğretmen)<br>
            <span style="font-weight: normal; font-size: 12pt; margin-top: 40px; display: block;">İmza</span>
          </div>
          <div style="width: 33.33%;">
            Disiplin Kurulu Başkanı<br>
            <span style="font-weight: normal; font-size: 12pt; margin-top: 40px; display: block;">İmza</span>
          </div>
        </div>
        `),o)s=`
      <div class="print-container" style="font-family: Arial, Helvetica, sans-serif; color: #000; padding: 25px 30px; line-height: 1.4; font-size: 12pt; max-width: 800px; margin: 0 auto; background: #fff; box-sizing: border-box; text-align: justify;">
        
        <!-- School Title -->
        <div style="text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 25px; font-family: Arial, sans-serif; line-height: 1.5;">
          ${$().map(e=>e.toUpperCase()).join(`<br>`)}
        </div>

        <!-- Document Main Title -->
        <div style="text-align: center; margin-bottom: 5px; position: relative; height: 45px;">
        <h2 style="font-size: 14pt; font-weight: bold; margin: 0; font-family: Arial, sans-serif; letter-spacing: 0.5px;">DİSİPLİN KURULU TANIK ÖĞRENCİ İFADE TUTANAĞI</h2>
          
          <!-- Date in title row (right aligned) -->
          <div style="position: absolute; right: 5px; bottom: 0; font-size: 12pt; font-weight: bold; font-family: Arial, sans-serif;">
            ${r}
          </div>
        </div>

        <!-- Main Form Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Arial, sans-serif; font-size: 12pt;">
          <tbody>
            <tr>
              <td style="padding: 10px 12px; font-weight: bold; width: 18%; text-align: left; text-transform: uppercase;">ADI- SOYADI</td>
              <td style="padding: 10px 12px; width: 32%; text-align: left; font-weight: 500;">${n}</td>
              <td rowspan="3" style="padding: 10px 8px; font-weight: bold; width: 12%; text-align: center; vertical-align: middle;">Olayın<br>Özeti</td>
              <td rowspan="3" style="padding: 10px 12px; width: 38%; text-align: left; vertical-align: top; line-height: 1.5;">${H}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: bold; text-align: left; text-transform: uppercase;">SINIFI</td>
              <td style="padding: 10px 12px; text-align: left; font-weight: 500;">${t&&t.classroom||`—`}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: bold; text-align: left; text-transform: uppercase;">OKUL NO</td>
              <td style="padding: 10px 12px; text-align: left; font-weight: 500;">${t&&(t.number||t.id)||`—`}</td>
            </tr>
          </tbody>
        </table>

        <!-- Question Content (Borders and SORULAR row removed as requested) -->
        <div style="margin-top: 20px; text-align: justify; line-height: 1.6; font-size: 12pt; font-family: Arial, sans-serif;">
          Okulumuz öğrencilerinden ${c}'in, ${i} tarihinde gerçekleştirdiği iddia edilen <strong>${H}</strong> davranışı/fiili ile ilgili olarak bildiklerinizi, gördüklerinizi ve söylemek istediklerinizi aşağıdaki bölüme yazınız.
        </div>

        <!-- Disiplin Kurulu Başkanı Signature (Borderless and "2" row removed as requested) -->
        <div style="display: flex; justify-content: flex-end; margin-top: 25px; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 12pt; font-weight: bold; text-align: center; page-break-inside: avoid;">
          <div style="text-align: center; min-width: 200px;">
            <div style="font-weight: normal; font-size: 12pt; display: block;">Disiplin Kurulu Başkanı</div>
            ${u?`<div style="font-weight: bold;">${u}</div>`:``}
            <div style="font-weight: normal; font-size: 12pt; margin-top: 30px; display: block;">İmza</div>
          </div>
        </div>

        <!-- Prompt Text -->
        <div style="margin-top: 15px; margin-bottom: 10px; font-weight: bold; font-size: 12pt; font-family: Arial, sans-serif;">
          ifadenize buradan başlayınız ve sayfanın arkasına yazmayınız.
        </div>

        <!-- Response Area Dotted Lines -->
        <div style="margin-top: 10px; position: relative;">
          ${U?`<div style="line-height: 2.2; text-align: justify; font-size: 12pt; text-indent: 40px; padding: 10px 5px; white-space: pre-wrap; background-image: linear-gradient(to bottom, transparent 33px, rgba(0,0,0,0.1) 34px), none; background-size: 100% 34px; background-repeat: repeat-y; min-height: 340px;">${U}</div>`:`${Array(10).fill(`<div style="border-bottom: 1px dotted #333333; margin-bottom: 28px; width: 100%; height: 1px;"></div>`).join(``)}`}
        </div>

        <!-- Witness Name & Signature under response area -->
        <div style="display: flex; justify-content: flex-end; margin-top: 35px; padding-right: 40px; font-family: Arial, sans-serif; page-break-inside: avoid;">
          <div style="text-align: center; min-width: 220px;">
            <div style="font-size: 12pt; font-weight: normal; color: #555; margin-bottom: 2px;">İfadeyi Veren Tanık</div>
            <div style="font-weight: bold; font-size: 12pt; text-transform: uppercase;">${n}</div>
            <div style="font-size: 12pt; margin-top: 45px; border-top: 1px dotted #000; padding-top: 4px; font-weight: normal;">İmza</div>
          </div>
        </div>

      </div>
      `;else{let e=B===`Öğrenci İfadesi`?`DİSİPLİN KURULU ÖĞRENCİ İFADE TUTANAĞI`:`DİSİPLİN KURULU ŞİKAYETÇİ (MAĞDUR) ÖĞRENCİ İFADE TUTANAĞI`;s=`
      <div class="print-container" style="font-family: Arial, Helvetica, sans-serif; color: #000; padding: 25px 30px; line-height: 1.4; font-size: 12pt; max-width: 800px; margin: 0 auto; background: #fff; box-sizing: border-box; text-align: justify;">
        
        <!-- School Title -->
        <div style="text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 25px; font-family: Arial, sans-serif; line-height: 1.5;">
          ${$().map(e=>e.toUpperCase()).join(`<br>`)}
        </div>

        <!-- Document Main Title -->
        <div style="text-align: center; margin-bottom: 5px; position: relative; height: 45px;">
          <h2 style="font-size: 14pt; font-weight: bold; margin: 0; font-family: Arial, sans-serif;">${e}</h2>
          
          <!-- Date in title row (right aligned) -->
          <div style="position: absolute; right: 5px; bottom: 0; font-size: 12pt; font-weight: bold; font-family: Arial, sans-serif;">
            ${r}
          </div>
        </div>

        <!-- Main Form Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Arial, sans-serif; font-size: 12pt;">
          <tbody>
            <tr>
              <td style="padding: 10px 12px; font-weight: bold; width: 18%; text-align: left; text-transform: uppercase;">ADI- SOYADI</td>
              <td style="padding: 10px 12px; width: 32%; text-align: left; font-weight: 500;">${n}</td>
              <td rowspan="3" style="padding: 10px 8px; font-weight: bold; width: 12%; text-align: center; vertical-align: middle;">Olayın<br>Özeti</td>
              <td rowspan="3" style="padding: 10px 12px; width: 38%; text-align: left; vertical-align: top; line-height: 1.5;">${H}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: bold; text-align: left; text-transform: uppercase;">SINIFI</td>
              <td style="padding: 10px 12px; text-align: left; font-weight: 500;">${t&&t.classroom||`—`}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: bold; text-align: left; text-transform: uppercase;">OKUL NO</td>
              <td style="padding: 10px 12px; text-align: left; font-weight: 500;">${t&&(t.number||t.id)||`—`}</td>
            </tr>
          </tbody>
        </table>

        <!-- Question Content Row (Borders removed as requested) -->
        <div style="margin-top: 20px; text-align: justify; line-height: 1.6; font-size: 12pt; font-family: Arial, sans-serif;">
          ${i} tarihinde <strong>${H}</strong> fiilini işlediğiniz <strong>${a}</strong> tarihli disiplin dilekçesinden anlaşılmaktadır. Olayla ilgili bildiklerinizi ve söylemek istediklerinizi aşağıdaki bölüme yazınız.
        </div>

        <!-- Committee Signatures -->
        ${l}

        <!-- Response Area Dotted Lines -->
        <div style="margin-top: 20px; position: relative;">
          ${U?`<div style="line-height: 2.2; text-align: justify; font-size: 12pt; text-indent: 40px; padding: 10px 5px; white-space: pre-wrap; background-image: linear-gradient(to bottom, transparent 33px, rgba(0,0,0,0.1) 34px), none; background-size: 100% 34px; background-repeat: repeat-y; min-height: 340px;">${U}</div>`:`<div style="display: flex; align-items: flex-end; margin-bottom: 20px;">
              <div style="font-weight: bold; font-size: 12pt; margin-right: 10px; font-family: Arial, sans-serif;">İfadenizi Yazmaya Buradan Başlayınız:</div>
              <div style="flex-grow: 1; border-bottom: 1px dotted #000; height: 20px;"></div>
            </div>
            ${Array(11).fill(`<div style="border-bottom: 1px dotted #333333; margin-bottom: 28px; width: 100%; height: 1px;"></div>`).join(``)}`}
        </div>

        <!-- Student Name & Signature under response area -->
        <div style="display: flex; justify-content: flex-end; margin-top: 35px; padding-right: 40px; font-family: Arial, sans-serif; page-break-inside: avoid;">
          <div style="text-align: center; min-width: 220px;">
            <div style="font-size: 12pt; font-weight: normal; color: #555; margin-bottom: 2px;">İfadeyi Veren Öğrenci</div>
            <div style="font-weight: bold; font-size: 12pt; text-transform: uppercase;">${n}</div>
            <div style="font-size: 12pt; margin-top: 45px; border-top: 1px dotted #000; padding-top: 4px; font-weight: normal;">İmza</div>
          </div>
        </div>

      </div>
      `}vt(s),S(s,`
      .print-container { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 portrait; margin: 15mm; }
    `)},Nr=()=>{_t&&S(_t,`
      .print-container { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 portrait; margin: 15mm; }
    `)},Pr=async()=>{if(!v){alert(`Bu rol ifade kaydedemez.`);return}if(!L)return;try{let e=null,t=T.map(t=>{if(t.id===L.id){let n=t.completedSteps?{...t.completedSteps}:{};n[`Öğrenci İfadesi`]=!0;let r={...t,completedSteps:n,ifadeData:{...t.ifadeData,[pt]:{ifadeOlayTarihi:it,ifadeTarihi:R,ifadeKonusu:st,ifadeMetni:lt,ifadeKurulBaskani:dt}}};return e=r,r}return t});e&&rt(e),E(t),await g.setItem(`disciplineBoardRecords`,t)}catch(e){console.error(`Error saving ifade form:`,e)}let e=Q(L),t=e.find(e=>e.id===pt)||e[0],n=t?t.name:``,r=t?`${t.classroom} / ${t.number||t.id}`:``;S(`
      <div style="font-family: 'Times New Roman', Times, serif; color: #000; padding: 40px; line-height: 1.5; font-size: 15px; max-width: 900px; margin: 0 auto; text-align: justify;">
        
        <div style="text-align: center; margin-bottom: 40px;">
        <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">ÖĞRENCİ DAVRANIŞLARINI DEĞERLENDİRME KURULU</h2>
        <h2 style="font-size: 16px; font-weight: bold; margin: 0;">ÖĞRENCİ İFADE TUTANAĞI</h2>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          Sayın : <span style="font-weight: bold;">${n||`.................................................................................................`}</span> <span style="font-weight: normal;">(${r||`............./...................`})</span>
        </div>

        <div style="text-indent: 40px; margin-bottom: 30px; line-height: 1.8;">
          ${it?it.split(`-`).reverse().join(`.`):`...../...../202...`} tarihinde aşağıda belirtilen konunun gerçekleştiği iddia edilmektedir. Konuyla ilgili ifadenizi, ayrıntılı bir şekilde yazmanızı rica ederim.
        </div>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="text-align: center; width: 300px;">
            <div style="margin-bottom: 20px;">${R?R.split(`-`).reverse().join(`.`):`..../....../202...`}</div>
            <div style="margin-bottom: 10px;">.....................................................</div>
            <div>Öğrenci Davranışlarını Değerlendirme</div>
            <div>Kurulu Başkanı</div>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <div style="display: flex; margin-bottom: 15px;">
            <div style="width: 150px; font-weight: bold;">İfadenin Konusu</div>
            <div style="flex-grow: 1;">: ${st||`..........................................................................................................................................`}</div>
          </div>
        </div>

        <div style="margin-bottom: 30px; min-height: 200px;">
          ${lt?`<div style="line-height: 2; text-align: justify;"><span style="font-weight: bold; margin-right: 10px;">İfadenizi Yazmaya Buradan Başlayınız:</span><span style="white-space: pre-wrap;">${lt}</span></div>`:`<div style="display: flex; align-items: flex-end; margin-bottom: 30px;">
              <div style="font-weight: bold; margin-right: 10px;">İfadenizi Yazmaya Buradan Başlayınız:</div>
              <div style="flex-grow: 1; border-bottom: 1px dotted #000; height: 20px;"></div>
            </div>
            ${Array(11).fill(`<div style="border-bottom: 1px dotted #000; margin-bottom: 30px; width: 100%; height: 1px;"></div>`).join(``)}`}
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; page-break-inside: avoid;">
          <div style="width: 45%;">
            <div style="text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 20px;">Öğrencinin</div>
            <div style="display: flex; margin-bottom: 15px;">
              <div style="width: 80px; font-weight: bold;">Tarih</div>
              <div>: ${R?R.split(`-`).reverse().join(`.`):`..../...../202....`}</div>
            </div>
            <div style="display: flex; margin-bottom: 15px;">
              <div style="width: 80px; font-weight: bold;">İmzası</div>
              <div style="flex-grow: 1;">: ........................................</div>
            </div>
          </div>
          
          <div style="width: 45%;">
            <div style="text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 20px;">Rehber Öğretmenin</div>
            <div style="display: flex; margin-bottom: 15px;">
              <div style="width: 90px; font-weight: bold;">Adı - Soyadı</div>
              <div style="flex-grow: 1;">: ........................................</div>
            </div>
            <div style="display: flex; margin-bottom: 15px;">
              <div style="width: 90px; font-weight: bold;">İmza</div>
              <div style="flex-grow: 1;">: ........................................</div>
            </div>
          </div>
        </div>

      </div>
    `,`@page { size: A4 portrait; margin: 15mm; }`)},Fr=async(e,t)=>{if(!v){alert(`Bu rol disiplin adımlarını değiştiremez.`);return}try{let n=T.map(n=>{if(n.id===e){let e=n.completedSteps?{...n.completedSteps}:{};return e[t]=!e[t],{...n,completedSteps:e}}return n});E(n),await g.setItem(`disciplineBoardRecords`,n)}catch(e){console.error(`Error toggling step completion:`,e)}},{getClassroomGuidanceNames:Ir,getWarningLetterHTML:Lr,printLetter:Rr,handlePrintSevkYazisi:zr,handlePrintTutanak:Br}=ae({classrooms:n,teachers:a,getHeaderLines:$,getRecordStudents:Q,formatHeaderLine:xr,getPrincipalName:Sr,getBehaviorDetails:yr,printHtmlSafely:S,boardRecords:T,selectedRecordIdsForTutanak:Ae,tutanakStudents:or,tutanakDate:er,tutanakTeachers:nr}),Vr=e=>{if(!v){alert(`Bu rol kaydı disiplin sürecine taşıyamaz.`);return}Se(e),xe(!0)},Hr=async()=>{if(A)try{let e=await h.moveToDisciplineProcess(A);E(t=>t.map(t=>t.id===A.id?b(e,A):t)),xe(!1);let t=A.studentName;Se(null),j(`${t} isimli öğrencinin davranış bilgileri başarıyla Disiplin Süreci arayüzüne aktarıldı.`),k(!0)}catch(e){console.error(`Error moving record to discipline process:`,e),alert(`Disiplin sürecine taşıma sırasında bir hata oluştu.`)}},Ur=[`Uyarı Bildirimi`,`Ön İnceleme`,`Disiplin Süreci`,`Arşiv`];(0,_.useEffect)(()=>{ne(e)},[e]);let Wr=e=>{He(e);let t=e.rehberlikData||{};Ue(t.rehberlikSevkTarihi||new Date().toISOString().split(`T`)[0]),Qe(t.rehberlikOlayTarihi||new Date(e.createdAt||Date.now()).toISOString().split(`T`)[0]),Ge(t.rehberlikDilekceKonu||(e.recordReason===`Şikayet`?`Şikayet Dilekçesi`:`Tutanak`)),qe(t.rehberlikGorusulenKisiler||``),Je(t.rehberlikGorusmeOzeti||``),Ye(t.rehberlikPsikososyal||``),Ze(t.rehberlikOneriler||``),Ve(!0)},Gr=(e,t)=>{Rt(e);let n=Q(e);Xt(n.length>0?n[0].id:``),Yt(t?`Öğrenci Çağrı Yazısı`:e.recordReason===`Şikayet`?`Şikayetçi (Mağdur) Çağrı Yazısı`:`Öğrenci Çağrı Yazısı`),Lt(!0)},Kr=e=>{yt(e),bt(`Öğrenci İfadesi`);let t=Q(e);kt(t.length>0?t[0].id||t[0].name:``),gt(!0)},qr=e=>{Fn(e);let t=Q(e);Ln(t.length>0?t[0].id:``),Pn(!0)},Jr=e=>{On(e);let t=Q(e);An(t.length>0?t[0].id:``),Dn(!0)},Yr=re.filter(e=>{let t=pe.toLowerCase();return e.studentName.toLowerCase().includes(t)||e.studentNumber&&e.studentNumber.includes(t)||e.studentClassroom&&e.studentClassroom.toLowerCase().includes(t)||e.behaviorName&&e.behaviorName.toLowerCase().includes(t)}),Xr=T.filter(e=>{let t=pe.toLowerCase();return y===`Ön İnceleme`&&e.disciplineStatus===`Disiplin Süreci`||y===`Disiplin Süreci`&&e.disciplineStatus!==`Disiplin Süreci`?!1:e.studentName.toLowerCase().includes(t)||e.studentNumber&&e.studentNumber.includes(t)||e.studentClassroom&&e.studentClassroom.toLowerCase().includes(t)||e.behaviorName&&e.behaviorName.toLowerCase().includes(t)}),Zr=new Set(de.map(e=>e.studentId)).size,Qr=Object.entries(de.reduce((e,t)=>{let n=t.sanctionType||`Yaptırım belirtilmedi`;return e[n]=(e[n]||0)+1,e},{})).sort((e,t)=>Number(t[1])-Number(e[1])),$r=Z.trim()===``?[]:hr.filter(e=>e.name&&e.name.toLocaleLowerCase(`tr-TR`).includes(Z.toLocaleLowerCase(`tr-TR`))||e.id&&e.id.toString().includes(Z)||e.number&&e.number.toString().includes(Z)||e.classroom&&e.classroom.toLocaleLowerCase(`tr-TR`).includes(Z.toLocaleLowerCase(`tr-TR`))).slice(0,10),ei=J.trim()===``?[]:hr.filter(e=>e.name&&e.name.toLocaleLowerCase(`tr-TR`).includes(J.toLocaleLowerCase(`tr-TR`))||e.id&&e.id.toString().includes(J)||e.number&&e.number.toString().includes(J)||e.classroom&&e.classroom.toLocaleLowerCase(`tr-TR`).includes(J.toLocaleLowerCase(`tr-TR`))).slice(0,10),ti=ir.trim()===``?[]:_r.filter(e=>e.name&&e.name.toLocaleLowerCase(`tr-TR`).includes(ir.toLocaleLowerCase(`tr-TR`))&&!nr.includes(e.name)).slice(0,5);return(0,_.useEffect)(()=>{if(En&&Y){let e=Y.kararData?.[kn]||{};Mn({kararNo:e.kararNo||``,kararTarihi:e.kararTarihi||new Date().toISOString().split(`T`)[0],dogumTarihi:e.dogumTarihi||``,tcNo:e.tcNo||``,ogrenimDurumu:e.ogrenimDurumu||``,basariDurumu:e.basariDurumu||``,saglikDurumu:e.saglikDurumu||``,ekonomikDurum:e.ekonomikDurum||``,birlikteOturma:e.birlikteOturma||``,anneBabaSag:e.anneBabaSag||``,anneBabaOz:e.anneBabaOz||``,ailesiYaninda:e.ailesiYaninda||``,yetistigiCevre:e.yetistigiCevre||``,adres:e.adres||``,oncekiCezalar:e.oncekiCezalar||``,olayYeriTarihi:e.olayYeriTarihi||``,davranisCesidi:e.davranisCesidi||Y.behaviorName||``,davranisNedeni:e.davranisNedeni||``,ifadeOzeti:e.ifadeOzeti||``,tanikOzeti:e.tanikOzeti||``,digerDeliller:e.digerDeliller||``,arkadasKanaati:e.arkadasKanaati||``,ogretmenKanaati:e.ogretmenKanaati||``,kurulKanaatiMaddeBendi:e.kurulKanaatiMaddeBendi||``,kurulKanaatiDavranis:e.kurulKanaatiDavranis||``,kurulKanaatiCeza:e.kurulKanaatiCeza||``,cezaMaddeBendi:e.cezaMaddeBendi||``,cezaFikrasi:e.cezaFikrasi||``,kurulKarari:e.kurulKarari||``,uye1:e.uye1||``,uye1Unvan:e.uye1Unvan||``,uye2:e.uye2||``,uye2Unvan:e.uye2Unvan||``,uye3:e.uye3||``,uye4:e.uye4||``,baskan:e.baskan||``,mudur:e.mudur||``})}},[En,Y,kn]),(0,_.useEffect)(()=>{if(tt&&L){let e=L.ifadeData?.[pt];e?(at(e.ifadeOlayTarihi||new Date(L.createdAt||Date.now()).toISOString().split(`T`)[0]),ot(e.ifadeTarihi||new Date().toISOString().split(`T`)[0]),ct(e.ifadeKonusu||L.behaviorName||``),ut(e.ifadeMetni||``),ft(e.ifadeKurulBaskani||``)):(at(new Date(L.createdAt||Date.now()).toISOString().split(`T`)[0]),ot(new Date().toISOString().split(`T`)[0]),ct(L.behaviorName||``),ut(``),ft(``))}},[tt,L,pt]),(0,_.useEffect)(()=>{if(z){let e=[];if(B===`Öğrenci İfadesi`?e=Q(z):B===`Şikayetçi (Mağdur) Öğrenci İfadesi`?e=z.complainantStudents||[]:B===`Tanık İfadesi`&&(e=z.cagriData?.witnesses?.witnesses||[]),e.length>0){let t=e[0].id||e[0].name;kt(n=>e.some(e=>(e.id||e.name)===n)?n:t)}else kt(``)}},[B,z]),(0,_.useEffect)(()=>{if(ht&&z){let e=z.yaziliIfadeData?.[V];if(e){let t=e.yaziliIfadeTuru||`Öğrenci İfadesi`;z.recordReason!==`Şikayet`&&t===`Şikayetçi (Mağdur) Öğrenci İfadesi`&&(t=`Öğrenci İfadesi`),bt(t),St(e.yaziliIfadeTarih||new Date().toISOString().split(`T`)[0]),wt(e.yaziliIfadeTarihi||new Date().toISOString().split(`T`)[0]),Et(e.yaziliIfadeSaati||``),Ot(e.yaziliIfadeYeri||`Disiplin Kurulu Odası`),At(e.yaziliIfadeKonusu||z.behaviorName||``),jt(e.yaziliIfadeMetni||``),Nt(e.yaziliIfadeOlayTarihi||z.date||new Date().toISOString().split(`T`)[0]),Ft(e.yaziliIfadeDilekceTarihi||z.date||new Date().toISOString().split(`T`)[0])}else St(new Date().toISOString().split(`T`)[0]),wt(new Date().toISOString().split(`T`)[0]),Et(``),Ot(`Disiplin Kurulu Odası`),At(z.behaviorName||``),jt(``),Nt(z.date||new Date().toISOString().split(`T`)[0]),Ft(z.date||new Date().toISOString().split(`T`)[0])}},[ht,z,V]),(0,_.useEffect)(()=>{if(It&&W){let e=G===`Tanık Çağrı Yazısı`?`witnesses`:G===`Şikayetçi (Mağdur) Çağrı Yazısı`?`complainants`:K,t=W.cagriData?.[e];t?(Bt(t.cagriDate||new Date().toISOString().split(`T`)[0]),Ht(t.cagriMeetingDate||``),Wt(t.cagriMeetingTime||``),Kt(t.cagriMeetingPlace||`Disiplin Kurulu Odası`),G===`Tanık Çağrı Yazısı`&&Zt(t.witnesses||[])):(Bt(new Date().toISOString().split(`T`)[0]),Ht(``),Wt(``),Kt(`Disiplin Kurulu Odası`),G===`Tanık Çağrı Yazısı`&&Zt([]))}},[It,W,G,K]),(0,_.useEffect)(()=>{if(Nn&&X){let e=Q(X).find(e=>e.id===In)||Q(X)[0],t=e?e.name:X.studentName,n=e?e.classroom:X.studentClassroom,r=e?e.number:X.studentNumber,i=X.tebligData?.[In]||{};Vn(i.tebligDate||new Date().toISOString().split(`T`)[0]),zn(i.tebligType||`Öğrenci Tebliğ Belgesi`),Un(i.tebligSubject||`Ödül ve Disiplin Kurulu Kararının Tebliği`);let a=i.tebligType===`Veli Tebliğ Belgesi`?`Okulumuz Ödül ve Disiplin Kurulu'nun yaptığı inceleme ve değerlendirme sonucunda, velisi bulunduğunuz ${n} sınıfı ${r} numaralı ${t} isimli öğrenciye dair kurul kararı ve ilgili tebligat detayları bu belge ile tarafınıza tebliğ edilmiştir.`:`Okulumuz Ödül ve Disiplin Kurulu'nun yaptığı inceleme ve değerlendirme sonucunda, ${n} sınıfı ${r} numaralı ${t} olarak şahsınıza/öğrencinize dair kurul kararı ve ilgili tebligat detayları bu belge ile tarafınıza tebliğ edilmiştir.`;Gn(i.tebligText||a),qn(i.tebligSender||Sr()||`Okul Müdürü`),Yn(i.tebligSenderTitle||`Okul Müdürü`),Zn(i.tebligReceiver||(i.tebligType===`Veli Tebliğ Belgesi`?`${t} Velisi`:t))}},[Nn,X,In,Rn]),(0,_.useEffect)(()=>{(async()=>{try{let e=await g.getItem(`disciplineWarnings`)||[];w(x(e.sort((e,t)=>new Date(t.date).getTime()-new Date(e.date).getTime())));let t=await g.getItem(`disciplineBoardRecords`)||[];E(x(t.sort((e,t)=>new Date(t.date).getTime()-new Date(e.date).getTime())));let n=await g.getItem(`disciplineArchiveRecords`)||[],r=n.flatMap(e=>{let t=e.archiveSource||(e.disciplineStatus===`Disiplin Süreci`?`Disiplin Süreci`:`Uyarı Bildirimi`);return Q(e).length>1?br(e,t):[{...e,archiveSource:t,originalSanctionType:e.originalSanctionType||(t===`Uyarı Bildirimi`&&e.sanctionType===`Uyarı`?`Kınama`:e.sanctionType),sanctionType:t===`Uyarı Bildirimi`?`Uyarı`:e.sanctionType}]}).filter((e,t,n)=>n.findIndex(t=>t.id===e.id)===t).sort((e,t)=>(t.archivedAt||new Date(t.date).getTime())-(e.archivedAt||new Date(e.date).getTime()));fe(x(r)),(r.length!==n.length||n.some(e=>Q(e).length>1)||n.some(e=>(e.archiveSource||`Uyarı Bildirimi`)===`Uyarı Bildirimi`&&e.sanctionType!==`Uyarı`))&&await g.setItem(`disciplineArchiveRecords`,r);let i=await g.getItem(`customBehaviors`)||[];ke(i)}catch(e){console.error(`Error loading discipline records:`,e)}})()},[y]),(0,C.jsxs)(`div`,{className:`mx-auto flex h-full w-full max-w-7xl flex-col space-y-6 px-6 pb-6 pt-0 animate-fadeIn lg:px-8 lg:pb-8 lg:pt-0`,children:[!v&&(0,C.jsx)(ee,{message:`Disiplin kayıtlarını inceleyebilirsiniz; ancak bu rol ile kayıt oluşturma, süreç değiştirme, arşivleme veya silme işlemi yapılamaz.`}),(0,C.jsx)(ie,{activeTab:y,setActiveTab:ne,tabs:Ur,onOpenBehaviorTab:te,boardRecords:T,selectedRecordIdsForTutanak:Ae,setToplantiBilgileriStudent:yn,setIsToplantiBilgileriModalOpen:_n,filteredWarnings:Yr,getRecordStudents:Q,setSelectedWarningForLetter:Te,getWarningLetterHTML:Lr,setWarningLetterPrintPreviewContent:De,toggleLetterSent:Cr,handleRevert:(e,t)=>{if(!v){alert(`Bu rol kayıt geri alma işlemi yapamaz.`);return}_e(e),ve(t),ge(!0)},handleArchiveRecord:async(e,t)=>{if(!v){alert(`Bu rol kayıt arşivleyemez.`);return}try{let n=br(e,t),r=await h.archiveCase(e,t,n);t===`Uyarı Bildirimi`?w(t=>t.filter(t=>t.id!==e.id)):E(t=>t.filter(t=>t.id!==e.id)),fe(e=>[...r.map(e=>b(e)),...e].filter((e,t,n)=>n.findIndex(t=>t.id===e.id)===t)),j(n.length>1?`${n.length} öğrencinin davranış ve ceza bilgileri ayrı kayıtlar halinde Arşive gönderildi.`:`${n[0]?.studentName||e.studentName} isimli öğrencinin davranış ve ceza bilgileri Arşive gönderildi.`),k(!0)}catch(e){console.error(`Error archiving record:`,e),alert(`Arşive gönderme sırasında bir hata oluştu.`)}},filteredBoardRecords:Xr,handleToggleStep:Fr,openGuidanceStep:Wr,openCallLetterStep:Gr,openWrittenStatementsStep:Kr,handleMoveToDisciplineProcess:Vr,handlePrintSevkYazisi:zr,openNotificationsStep:qr,openDecisionStep:Jr,archiveRecords:de,archiveUniqueStudentCount:Zr,archiveSanctionStats:Qr,handleRestoreFromArchive:async e=>{if(!v){alert(`Bu rol arşiv kaydı geri yükleyemez.`);return}try{if(e.archiveSource===`Disiplin Süreci`){let t={...e,sanctionType:e.originalSanctionType||e.sanctionType,disciplineStatus:`Disiplin Süreci`,studentsList:[]},n=await h.restoreFromArchive(e,`disciplineBoardRecords`,t);fe(t=>t.filter(t=>t.id!==e.id)),E(e=>[b(n,D),...e.filter(e=>e.id!==n.id)]),j(`${e.studentName} isimli öğrencinin kaydı Disiplin Süreci alanına geri yüklendi.`)}else{let t={...e,sanctionType:e.originalSanctionType||`Kınama`,disciplineStatus:void 0,studentsList:[]},n=await h.restoreFromArchive(e,`disciplineWarnings`,t);fe(t=>t.filter(t=>t.id!==e.id)),w(e=>[b(n,D),...e.filter(e=>e.id!==n.id)]),j(`${e.studentName} isimli öğrencinin kaydı Uyarı Bildirimi alanına geri yüklendi.`)}k(!0)}catch(e){console.error(`Error restoring record:`,e),alert(`Geri yükleme sırasında bir hata oluştu.`)}},handleDeleteArchiveRecord:async e=>{if(!v){alert(`Bu rol arşiv kaydı silemez.`);return}if(window.confirm(`Bu kaydı arşivden tamamen silmek istediğinize emin misiniz?`))try{let t=de.filter(t=>t.id!==e);fe(t),await g.setItem(`disciplineArchiveRecords`,t),j(`Kayıt arşivden tamamen silindi.`),k(!0)}catch(e){console.error(`Error deleting archived record:`,e),alert(`Silme işlemi sırasında bir hata oluştu.`)}}}),he&&(0,C.jsx)(`div`,{className:`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn`,children:(0,C.jsxs)(`div`,{className:`bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-4 relative animate-scaleUp`,children:[(0,C.jsx)(`button`,{onClick:()=>{ge(!1),_e(null),ve(null)},className:`absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors`,children:(0,C.jsx)(u,{className:`w-5 h-5`})}),(0,C.jsx)(`div`,{className:`w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 shrink-0 shadow-inner`,children:(0,C.jsx)(i,{className:`w-7 h-7`})}),(0,C.jsxs)(`div`,{className:`space-y-2`,children:[(0,C.jsx)(`h3`,{className:`text-lg font-bold text-slate-800`,children:`İşlemi Onaylıyor musunuz?`}),(0,C.jsx)(`p`,{className:`text-sm text-slate-500 leading-relaxed`,children:O===`disiplin-sureci`?`Seçilen kaydı Disiplin Sürecinden çıkarıp Ön İnceleme aşamasına geri göndermeyi onaylıyor musunuz?`:`Öğrenci davranış bilgilerini davranış kaydı arayüzüne göndermeyi onaylıyor musunuz?`}),D&&(0,C.jsxs)(`div`,{className:`mt-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-left`,children:[(0,C.jsx)(`p`,{className:`text-xs font-semibold text-slate-400 uppercase tracking-wider`,children:`Öğrenci ve Davranış`}),(0,C.jsx)(`p`,{className:`text-sm font-bold text-slate-700 mt-1`,children:D.studentName}),(0,C.jsx)(`p`,{className:`text-xs text-slate-500 mt-0.5`,children:D.behaviorName})]})]}),(0,C.jsxs)(`div`,{className:`flex items-center gap-3 w-full mt-4`,children:[(0,C.jsx)(`button`,{onClick:()=>{ge(!1),_e(null),ve(null)},className:`flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm`,children:`İptal`}),(0,C.jsx)(`button`,{onClick:async()=>{if(!(!D||!O))try{if(O===`warnings`)await h.revertToBehavior(D,`disciplineWarnings`),w(e=>e.filter(e=>e.id!==D.id)),j(`Öğrenci davranış bilgisi başarıyla geri alınarak davranış kayıtlarına gönderildi.`);else if(O===`board`)await h.revertToBehavior(D,`disciplineBoardRecords`),E(e=>e.filter(e=>e.id!==D.id)),j(`Öğrenci davranış bilgisi başarıyla geri alınarak davranış kayıtlarına gönderildi.`);else if(O===`disiplin-sureci`){let e=await h.revertDisciplineProcess(D);E(t=>t.map(t=>t.id===D.id?b(e,D):t)),j(`Kayıt başarıyla Disiplin Sürecinden çıkarılarak Ön İnceleme aşamasına eski haliyle geri gönderildi.`)}ge(!1),_e(null),ve(null),k(!0)}catch(e){console.error(`Error reverting record:`,e),ge(!1),alert(`Geri gönderme işlemi sırasında bir hata oluştu.`)}},className:`flex-1 py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl transition-all shadow-md shadow-amber-800/10 text-[16.67px]`,children:O===`disiplin-sureci`?`Evet, Geri Gönder`:`Evet, Gönder`})]})]})}),ye&&(0,C.jsx)(`div`,{className:`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn`,children:(0,C.jsxs)(`div`,{className:`bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-4 relative animate-scaleUp`,children:[(0,C.jsx)(`div`,{className:`w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 shrink-0 shadow-inner`,children:(0,C.jsx)(c,{className:`w-7 h-7`})}),(0,C.jsxs)(`div`,{className:`space-y-1`,children:[(0,C.jsx)(`h3`,{className:`text-lg font-bold text-slate-800`,children:`İşlem Başarılı`}),(0,C.jsx)(`p`,{className:`text-sm text-slate-500 leading-relaxed`,children:Ce})]}),(0,C.jsx)(`button`,{onClick:()=>{k(!1),j(``)},className:`w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all text-sm shadow-md mt-2`,children:`Kapat`})]})}),be&&(0,C.jsx)(`div`,{className:`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn`,children:(0,C.jsxs)(`div`,{className:`bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-4 relative animate-scaleUp`,children:[(0,C.jsx)(`button`,{onClick:()=>{xe(!1),Se(null)},className:`absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors`,children:(0,C.jsx)(u,{className:`w-5 h-5`})}),(0,C.jsx)(`div`,{className:`w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-red-600 shrink-0 shadow-inner`,children:(0,C.jsx)(i,{className:`w-7 h-7`})}),(0,C.jsxs)(`div`,{className:`space-y-2`,children:[(0,C.jsx)(`h3`,{className:`text-lg font-bold text-slate-800`,children:`Disiplin Kuruluna Sevk Onayı`}),(0,C.jsx)(`p`,{className:`text-sm text-slate-500 leading-relaxed`,children:`Öğrenci Disiplin kuruluna sevk edilecektir. Onaylıyor musunuz?`}),A&&(0,C.jsxs)(`div`,{className:`mt-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-left`,children:[(0,C.jsx)(`p`,{className:`text-xs font-semibold text-rose-500 uppercase tracking-wider`,children:`Sevk Edilecek Öğrenci`}),(0,C.jsx)(`p`,{className:`text-sm font-bold text-slate-800 mt-1`,children:A.studentName}),(0,C.jsxs)(`p`,{className:`text-xs text-slate-600 mt-0.5`,children:[`Sınıf/No: `,A.studentClassroom,` - `,A.studentNumber]}),(0,C.jsxs)(`p`,{className:`text-xs text-slate-500 mt-1 italic`,children:[`Davranış: `,A.behaviorName]})]})]}),(0,C.jsxs)(`div`,{className:`flex items-center gap-3 w-full mt-4`,children:[(0,C.jsx)(`button`,{onClick:()=>{xe(!1),Se(null)},className:`flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm`,children:`İptal`}),(0,C.jsx)(`button`,{onClick:Hr,className:`flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-md shadow-red-600/10 text-[16.67px]`,children:`Evet, Onayla ve Sevk Et`})]})]})}),Be&&(0,C.jsx)(`div`,{className:`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn`,children:(0,C.jsxs)(`div`,{className:`bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden`,children:[(0,C.jsxs)(`div`,{className:`px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50`,children:[(0,C.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,C.jsx)(`div`,{className:`w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shadow-inner`,children:(0,C.jsx)(d,{className:`w-5 h-5`})}),(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`h3`,{className:`text-base font-black text-slate-800 tracking-tight`,children:`Rehberlik Öğrenci Görüşme Formu`}),(0,C.jsx)(`p`,{className:`text-xs text-slate-500 font-medium mt-0.5`,children:`Disiplin Kurulu İçin Form Oluştur`})]})]}),(0,C.jsx)(`button`,{onClick:()=>Ve(!1),className:`p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer`,children:(0,C.jsx)(u,{className:`w-5 h-5`})})]}),(0,C.jsxs)(`div`,{className:`flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar`,children:[(0,C.jsxs)(`div`,{className:`grid grid-cols-2 gap-4`,children:[(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Olay Tarihi`}),(0,C.jsx)(`input`,{type:`date`,value:I,onChange:e=>Qe(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Sevk Tarihi`}),(0,C.jsx)(`input`,{type:`date`,value:N,onChange:e=>Ue(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50`})]})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Dilekçe Konu/Sayı/No`}),(0,C.jsx)(`input`,{type:`text`,value:We,onChange:e=>Ge(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50`,placeholder:`Konu/Sayı/No...`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Olayla İlgili Görüşülen Kişiler`}),(0,C.jsx)(`textarea`,{value:Ke,onChange:e=>qe(e.target.value),className:`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[80px] resize-none`,placeholder:`Görüşülen kişileri yazınız...`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Olayla İlgili Görüşmenin Özeti`}),(0,C.jsx)(`textarea`,{value:P,onChange:e=>Je(e.target.value),className:`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[100px] resize-none`,placeholder:`Görüşme özetini yazınız...`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Öğrenci/Öğrencilerin Psikososyal İncelenmesi`}),(0,C.jsx)(`textarea`,{value:F,onChange:e=>Ye(e.target.value),className:`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[100px] resize-none`,placeholder:`Psikososyal incelemeyi yazınız...`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Rehberlik Öğretmeninin Görüş ve Önerileri`}),(0,C.jsx)(`textarea`,{value:Xe,onChange:e=>Ze(e.target.value),className:`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[100px] resize-none`,placeholder:`Görüş ve önerileri yazınız...`})]})]}),(0,C.jsxs)(`div`,{className:`px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0`,children:[(0,C.jsxs)(`button`,{type:`button`,onClick:wr,className:`px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-teal-600 hover:bg-teal-700 shadow-teal-600/10 font-bold`,children:[(0,C.jsx)(r,{className:`w-4 h-4`}),(0,C.jsx)(`span`,{children:`Kaydet`})]}),(0,C.jsx)(`span`,{className:`text-xs text-slate-400 italic hidden sm:inline`,children:`Boş bırakılan alanlar çıktıda el ile doldurulmak üzere boş alan olarak ayrılır.`}),(0,C.jsxs)(`button`,{type:`button`,onClick:()=>{Tr(),et(!0)},className:`px-5 py-2.5 text-slate-700 hover:text-white bg-slate-100 hover:bg-teal-600 font-extrabold rounded-xl transition-all border border-slate-200 hover:border-teal-600 text-xs flex items-center gap-2 cursor-pointer font-bold`,children:[(0,C.jsx)(l,{className:`w-4 h-4`}),(0,C.jsx)(`span`,{children:`Formu Yazdır`})]})]})]})}),$e&&M&&(0,C.jsx)(`div`,{className:`fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fadeIn`,children:(0,C.jsxs)(`div`,{className:`bg-slate-800 text-white rounded-3xl w-full max-w-4xl h-[90vh] shadow-2xl border border-slate-700 flex flex-col relative animate-scaleUp overflow-hidden`,children:[(0,C.jsxs)(`div`,{className:`px-6 py-4 border-b border-slate-700 flex items-center justify-between shrink-0 bg-slate-850`,children:[(0,C.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,C.jsx)(`div`,{className:`w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shadow-inner`,children:(0,C.jsx)(l,{className:`w-5 h-5 animate-pulse`})}),(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`h3`,{className:`text-base font-black text-slate-100 tracking-tight`,children:`Yazdır Ön İzleme`}),(0,C.jsx)(`p`,{className:`text-xs text-slate-400 font-medium mt-0.5`,children:`Rehberlik Öğrenci Görüşme Formu`})]})]}),(0,C.jsx)(`button`,{type:`button`,onClick:e=>{e.stopPropagation(),et(!1)},className:`p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors cursor-pointer relative z-50`,children:(0,C.jsx)(u,{className:`w-5 h-5`})})]}),(0,C.jsx)(`div`,{className:`flex-1 overflow-y-auto p-8 bg-slate-900 custom-scrollbar flex justify-center`,children:(0,C.jsxs)(`div`,{id:`rehberlik-print-section`,className:`bg-white text-black p-12 w-[210mm] min-h-[297mm] flex flex-col justify-between font-serif animate-fadeIn`,style:{fontFamily:`'Times New Roman', Times, serif`,fontSize:`12pt`},children:[(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`div`,{className:`text-center mb-6 border-b-2 border-teal-700 pb-3`,children:(0,C.jsx)(`h2`,{className:`text-lg font-bold uppercase tracking-wide text-slate-800`,children:`DİSİPLİN KURULU İÇİN ÖĞRENCİ GÖRÜŞME FORMU`})}),(0,C.jsx)(`table`,{className:`w-full border-collapse mb-4 text-[12pt] text-black`,children:(0,C.jsxs)(`tbody`,{children:[(0,C.jsxs)(`tr`,{children:[(0,C.jsx)(`td`,{className:`p-2 w-1/4 font-bold bg-slate-100`,children:`Okulu:`}),(0,C.jsx)(`td`,{className:`p-2 w-3/4`,colSpan:3,children:$().length>2?$()[2]:`Okulu`})]}),(0,C.jsxs)(`tr`,{children:[(0,C.jsx)(`td`,{className:`p-2 w-1/4 font-bold bg-slate-100`,children:`Olay Tarihi:`}),(0,C.jsx)(`td`,{className:`p-2 w-1/4`,children:I?I.split(`-`).reverse().join(`.`):``}),(0,C.jsxs)(`td`,{className:`p-2 w-1/4 font-bold bg-slate-100`,children:[`Rehberlik Servisine`,(0,C.jsx)(`br`,{}),`Sevk Tarihi:`]}),(0,C.jsx)(`td`,{className:`p-2 w-1/4`,children:N?N.split(`-`).reverse().join(`.`):``})]}),(0,C.jsxs)(`tr`,{children:[(0,C.jsx)(`td`,{className:`p-2 font-bold bg-slate-100`,children:`Dilekçe Konu/Sayı/No:`}),(0,C.jsx)(`td`,{className:`p-2`,colSpan:3,children:We||``})]})]})}),(0,C.jsxs)(`div`,{className:`space-y-4`,children:[(0,C.jsxs)(`div`,{className:`p-3 min-h-[60px]`,children:[(0,C.jsx)(`div`,{className:`font-bold text-slate-700 text-[12pt] mb-1`,children:`Olayda Adı Geçen Öğrenci/Öğrenciler (Ad Soyad, Sınıf, No):`}),(0,C.jsx)(`div`,{className:`text-slate-950 text-[12pt]`,children:Q(M).map(e=>`${e.name} (${e.classroom} - No: ${e.number||e.id})`).join(`, `)})]}),(0,C.jsxs)(`div`,{className:`p-3 min-h-[60px]`,children:[(0,C.jsx)(`div`,{className:`font-bold text-slate-700 text-[12pt] mb-1`,children:`Olayla İlgili Görüşülen Kişiler:`}),(0,C.jsx)(`div`,{className:`text-slate-950 text-[12pt] whitespace-pre-wrap`,children:Ke||`—`})]}),(0,C.jsxs)(`div`,{className:`p-3 min-h-[100px]`,children:[(0,C.jsx)(`div`,{className:`font-bold text-slate-700 text-[12pt] mb-1`,children:`Olayla İlgili Görüşmenin Özeti:`}),(0,C.jsx)(`div`,{className:`text-slate-950 text-[12pt] text-justify whitespace-pre-wrap`,children:P||`—`})]}),(0,C.jsxs)(`div`,{className:`p-3 min-h-[100px]`,children:[(0,C.jsx)(`div`,{className:`font-bold text-slate-700 text-[12pt] mb-1`,children:`Olayla İlgili Öğrenci/Öğrencilerin Psikososyal İncelenmesi:`}),(0,C.jsx)(`div`,{className:`text-slate-950 text-[12pt] text-justify whitespace-pre-wrap`,children:F||`—`})]}),(0,C.jsxs)(`div`,{className:`p-3 min-h-[100px]`,children:[(0,C.jsx)(`div`,{className:`font-bold text-slate-700 text-[12pt] mb-1`,children:`Rehberlik Öğretmeninin Konuyla İlgili Görüş ve Önerileri:`}),(0,C.jsx)(`div`,{className:`text-slate-950 text-[12pt] text-justify whitespace-pre-wrap`,children:Xe||`—`})]})]})]}),(0,C.jsx)(`div`,{className:`flex justify-end mt-12`,children:(0,C.jsxs)(`div`,{className:`text-center w-[200px]`,children:[(0,C.jsx)(`div`,{className:`text-[12pt] mb-2`,children:`.... / .... / .......`}),(0,C.jsx)(`div`,{className:`border-b border-dotted border-slate-600 w-full h-[25px] mb-1`}),(0,C.jsx)(`div`,{className:`text-[12pt] font-bold text-slate-800`,children:`Okul Rehberlik Öğretmeni`})]})})]})}),(0,C.jsxs)(`div`,{className:`px-6 py-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between shrink-0`,children:[(0,C.jsx)(`span`,{className:`text-xs text-slate-400 italic`,children:`Yazdır veya PDF indir butonuna tıklayarak çıktıyı alabilirsiniz.`}),(0,C.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,C.jsxs)(`button`,{type:`button`,onClick:Er,className:`px-6 py-3 text-white font-extrabold rounded-xl transition-all shadow-lg text-[16.67px] flex items-center gap-2 cursor-pointer bg-blue-500 hover:bg-blue-600 shadow-blue-500/20 font-bold`,children:[(0,C.jsx)(d,{className:`w-5 h-5`}),(0,C.jsx)(`span`,{children:`PDF İndir`})]}),(0,C.jsxs)(`button`,{type:`button`,onClick:()=>{Tr(),et(!1)},className:`px-6 py-3 text-white font-extrabold rounded-xl transition-all shadow-lg text-sm flex items-center gap-2 cursor-pointer bg-teal-500 hover:bg-teal-600 shadow-teal-500/20 font-bold`,children:[(0,C.jsx)(l,{className:`w-5 h-5`}),(0,C.jsx)(`span`,{children:`Yazdır`})]})]})]})]})}),En&&(0,C.jsx)(_.Suspense,{fallback:(0,C.jsx)(`div`,{className:`fixed inset-0 z-[9999] flex items-center justify-center bg-black/10`,children:(0,C.jsx)(`div`,{className:`rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl`,children:`İşlem ekranı yükleniyor...`})}),children:(0,C.jsx)(oe,{open:En,record:Y,selectedStudent:kn,setSelectedStudent:An,data:jn,setData:Mn,onClose:()=>Dn(!1),onSaveAndPrint:Ar})}),(tt||ht)&&(0,C.jsx)(_.Suspense,{fallback:(0,C.jsx)(`div`,{className:`fixed inset-0 z-[9999] flex items-center justify-center bg-black/10`,children:(0,C.jsx)(`div`,{className:`rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl`,children:`İşlem ekranı yükleniyor...`})}),children:(0,C.jsx)(ce,{ctx:{ifadeKonusu:st,ifadeMetni:lt,ifadeOlayTarihi:it,ifadeSelectedStudent:pt,ifadeTarihi:R,isIfadeModalOpen:tt,isYaziliIfadeModalOpen:ht,selectedRecordForIfade:L,selectedRecordForYaziliIfade:z,students:o,setIfadeKonusu:ct,setIfadeMetni:ut,setIfadeOlayTarihi:at,setIfadeSelectedStudent:mt,setIfadeTarihi:ot,setIsIfadeModalOpen:nt,setIsYaziliIfadeModalOpen:gt,setYaziliIfadeDilekceTarihi:Ft,setYaziliIfadeKonusu:At,setYaziliIfadeMetni:jt,setYaziliIfadeOlayTarihi:Nt,setYaziliIfadeSaati:Et,setYaziliIfadeSelectedStudent:kt,setYaziliIfadeTarih:St,setYaziliIfadeTarihi:wt,setYaziliIfadeTuru:bt,setYaziliIfadeYeri:Ot,yaziliIfadeDilekceTarihi:Pt,yaziliIfadeKonusu:H,yaziliIfadeMetni:U,yaziliIfadeOlayTarihi:Mt,yaziliIfadeSaati:Tt,yaziliIfadeSelectedStudent:V,yaziliIfadeTarih:xt,yaziliIfadeTarihi:Ct,yaziliIfadeTuru:B,yaziliIfadeYeri:Dt,handleSaveAndPrintIfade:Pr,handleSaveYaziliIfadeOnly:jr,handleSaveAndPreviewYaziliIfade:Mr}})}),It&&(0,C.jsx)(_.Suspense,{fallback:(0,C.jsx)(`div`,{className:`fixed inset-0 z-[9999] flex items-center justify-center bg-black/10`,children:(0,C.jsx)(`div`,{className:`rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl`,children:`İşlem ekranı yükleniyor...`})}),children:(0,C.jsx)(se,{ctx:{cagriDate:zt,cagriManualWitnessClass:cn,cagriManualWitnessName:on,cagriManualWitnessNumber:un,cagriMeetingDate:Vt,cagriMeetingPlace:Gt,cagriMeetingTime:Ut,cagriSelectedStudent:K,cagriSelectedWitnessForAdd:rn,cagriShowWitnessSuggestions:tn,cagriType:G,cagriWitnessSearchMode:Qt,cagriWitnessSearchTerm:J,cagriWitnesses:q,filteredWitnessesForSearch:ei,handleSaveAndPreviewCagriPusulasi:Or,handleSaveCagriPusulasi:Dr,isCagriPusulasiModalOpen:It,selectedRecordForCagri:W,setCagriDate:Bt,setCagriManualWitnessClass:ln,setCagriManualWitnessName:sn,setCagriManualWitnessNumber:dn,setCagriMeetingDate:Ht,setCagriMeetingPlace:Kt,setCagriMeetingTime:Wt,setCagriSelectedStudent:Xt,setCagriSelectedWitnessForAdd:an,setCagriShowWitnessSuggestions:nn,setCagriType:Yt,setCagriWitnessSearchMode:$t,setCagriWitnessSearchTerm:en,setCagriWitnesses:Zt,setIsCagriPusulasiModalOpen:Lt}})}),Nn&&X&&(0,C.jsx)(`div`,{className:`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn`,children:(0,C.jsxs)(`div`,{className:`bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col relative animate-scaleUp overflow-hidden`,children:[(0,C.jsxs)(`div`,{className:`px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50`,children:[(0,C.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,C.jsx)(`div`,{className:`w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner`,children:(0,C.jsx)(d,{className:`w-5 h-5`})}),(0,C.jsxs)(`div`,{children:[(0,C.jsx)(`h3`,{className:`text-base font-black text-slate-800 tracking-tight`,children:`Tebliğ Tebellüğ Formu`}),(0,C.jsx)(`p`,{className:`text-xs text-slate-500 font-medium mt-0.5`,children:`Tebliğ Tebellüğ Belgesi Düzenle ve Yazdır`})]})]}),(0,C.jsx)(`button`,{onClick:()=>Pn(!1),className:`p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer`,children:(0,C.jsx)(u,{className:`w-5 h-5`})})]}),(0,C.jsxs)(`div`,{className:`flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar`,children:[(0,C.jsxs)(`div`,{className:`grid grid-cols-1 md:grid-cols-2 gap-4`,children:[(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Belgesi Türü`}),(0,C.jsxs)(`select`,{value:Rn,onChange:e=>zn(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`,children:[(0,C.jsx)(`option`,{value:`Öğrenci Tebliğ Belgesi`,children:`Öğrenci Tebliğ Belgesi`}),(0,C.jsx)(`option`,{value:`Veli Tebliğ Belgesi`,children:`Veli Tebliğ Belgesi`})]})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Tarihi`}),(0,C.jsx)(`input`,{type:`date`,value:Bn,onChange:e=>Vn(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`})]})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Edilecek Kişi`}),(0,C.jsx)(`select`,{value:In,onChange:e=>Ln(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`,children:Q(X).map(e=>(0,C.jsxs)(`option`,{value:e.id,children:[e.name,` (`,e.classroom,` - No: `,e.number,`)`]},e.id))})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Konusu`}),(0,C.jsx)(`input`,{type:`text`,value:Hn,onChange:e=>Un(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Metni`}),(0,C.jsx)(`textarea`,{value:Wn,onChange:e=>Gn(e.target.value),rows:4,className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y`})]}),(0,C.jsxs)(`div`,{className:`grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100`,children:[(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Eden (Adı Soyadı)`}),(0,C.jsx)(`input`,{type:`text`,value:Kn,onChange:e=>qn(e.target.value),className:`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebliğ Eden Ünvanı`}),(0,C.jsx)(`input`,{type:`text`,value:Jn,onChange:e=>Yn(e.target.value),className:`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`})]})]}),(0,C.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,C.jsx)(`label`,{className:`text-xs font-bold text-slate-600 uppercase tracking-wider`,children:`Tebellüğ Eden (Teslim Alan Kişi)`}),(0,C.jsx)(`input`,{type:`text`,value:Xn,onChange:e=>Zn(e.target.value),className:`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50`})]})]}),(0,C.jsxs)(`div`,{className:`px-6 py-4 border-t border-slate-100 flex items-center justify-end bg-slate-50 shrink-0 gap-3`,children:[(0,C.jsx)(`button`,{type:`button`,onClick:()=>Pn(!1),className:`px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-xl transition-all text-xs cursor-pointer`,children:`İptal`}),(0,C.jsxs)(`button`,{type:`button`,onClick:async()=>{if(!v){alert(`Bu rol tebliğ kaydedemez.`);return}if(X){try{let e=null,t=T.map(t=>{if(t.id===X.id){let n=t.completedSteps?{...t.completedSteps}:{};n.Tebliğler=!0;let r={...t,completedSteps:n,tebligData:{...t.tebligData,[In]:{tebligDate:Bn,tebligType:Rn,tebligSubject:Hn,tebligText:Wn,tebligSender:Kn,tebligSenderTitle:Jn,tebligReceiver:Xn}}};return e=r,r}return t});e&&Fn(e),E(t),await g.setItem(`disciplineBoardRecords`,t)}catch(e){console.error(`Error saving teblig form:`,e)}S(`
      <div style="font-family: Arial, sans-serif; color: #000; padding: 40px; line-height: 1.6; font-size: 12pt; max-width: 800px; margin: 0 auto; text-align: justify; background: #fff;">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px;">
          ${$().map(e=>`<div style="text-transform: uppercase; font-size: 12pt; font-weight: bold; margin-bottom: 2px;">${e}</div>`).join(``)}
          <h2 style="font-size: 14pt; font-weight: bold; margin: 20px 0 5px 0; text-transform: uppercase;">TEBLİĞ TEBELLÜĞ BELGESİ</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <strong>Konu:</strong> ${Hn}
          </div>
          <div>
            <strong>Tarih:</strong> ${Bn?Bn.split(`-`).reverse().join(`.`):`..../..../202...`}
          </div>
        </div>

        <div style="margin-bottom: 40px; line-height: 1.8; text-indent: 40px;">
          ${Wn.replace(/\n/g,`<br/>`)}
        </div>

        <table style="width: 100%; margin-top: 80px; font-size: 12pt;">
          <tr>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              <p style="margin-bottom: 40px;"><strong>TEBLİĞ EDEN</strong></p>
              <p><strong>${Kn}</strong></p>
              <p style="font-size: 12pt; color: #444; margin-top: 2px;">${Jn}</p>
              <p style="font-size: 12pt; margin-top: 15px; border-top: 1px dashed #ccc; pt-2; display: inline-block; width: 120px;">İmza</p>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              <p style="margin-bottom: 40px;"><strong>TEBELLÜĞ EDEN</strong></p>
              <p><strong>${Xn}</strong></p>
              <p style="font-size: 12pt; color: #444; margin-top: 2px;">Öğrenci / Veli</p>
              <p style="font-size: 12pt; margin-top: 15px; border-top: 1px dashed #ccc; pt-2; display: inline-block; width: 120px;">İmza / Tarih</p>
            </td>
          </tr>
        </table>
      </div>
    `,`@page { size: A4 portrait; margin: 20mm; }`)}},className:`px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md text-[14.67px] flex items-center gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10`,children:[(0,C.jsx)(l,{className:`w-4 h-4`}),(0,C.jsx)(`span`,{children:`Kaydet ve Yazdır`})]})]})]})}),(fn||!!qt||!!_t||gn)&&(0,C.jsx)(_.Suspense,{fallback:(0,C.jsx)(`div`,{className:`fixed inset-0 z-[9999] flex items-center justify-center bg-black/10`,children:(0,C.jsx)(`div`,{className:`rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl`,children:`Önizleme yükleniyor...`})}),children:(0,C.jsx)(ue,{isWhatsAppPreviewOpen:fn,setIsWhatsAppPreviewOpen:pn,whatsAppMessageText:mn,setWhatsAppMessageText:hn,cagriPrintPreviewContent:qt,setCagriPrintPreviewContent:Jt,selectedRecordForCagri:W,cagriSelectedStudent:K,cagriType:G,handleActualCagriPrint:kr,yaziliIfadePrintPreviewContent:_t,setYaziliIfadePrintPreviewContent:vt,yaziliIfadeSelectedStudent:V,handleActualYaziliIfadePrint:Nr,warningLetterPrintPreviewContent:Ee,setWarningLetterPrintPreviewContent:De,selectedWarningForLetter:we,setSelectedWarningForLetter:Te,getRecordStudents:Q,toggleLetterSent:Cr,printLetter:Rr,isToplantiBilgileriModalOpen:gn,setIsToplantiBilgileriModalOpen:_n,toplantiBilgileriStudent:vn,toplantiBilgileriMeetingWith:bn,setToplantiBilgileriMeetingWith:xn,toplantiBilgileriDate:Sn,setToplantiBilgileriDate:Cn,toplantiBilgileriTime:wn,setToplantiBilgileriTime:Tn})}),Qn&&(0,C.jsx)(_.Suspense,{fallback:(0,C.jsx)(`div`,{className:`fixed inset-0 z-[9999] flex items-center justify-center bg-black/10`,children:(0,C.jsx)(`div`,{className:`rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl`,children:`İşlem ekranı yükleniyor...`})}),children:(0,C.jsx)(le,{isOpen:Qn,onClose:()=>$n(!1),tutanakDate:er,setTutanakDate:tr,newTeacherInput:ir,setNewTeacherInput:ar,showTeacherSuggestions:dr,setShowTeacherSuggestions:fr,filteredTeachersForSearch:ti,tutanakTeachers:nr,setTutanakTeachers:rr,isManualStudent:Me,setIsManualStudent:Ne,selectedStudentForTutanak:lr,setSelectedStudentForTutanak:ur,studentSearchTerm:Z,setStudentSearchTerm:cr,showStudentSuggestions:pr,setShowStudentSuggestions:mr,filteredStudentsForSearch:$r,tutanakStudents:or,setTutanakStudents:sr,manualStudentName:Pe,setManualStudentName:Fe,manualStudentClassroom:Ie,setManualStudentClassroom:Le,manualStudentNumber:Re,setManualStudentNumber:ze,onPrint:Br})})]})}export{E as default};