import React, { useMemo, useState } from "react";
import { Pencil, Save, Trash2 } from "lucide-react";
import type { Classroom, Course } from "../../types";
import { databaseGateway } from "../../core/database";

type Kind = "Zorunlu Ders" | "Seçmeli Ders";
type Draft = { name:string; code:string; weeklyHours:string; type:Kind; branch:string };

const emptyDraft: Draft = { name:"", code:"", weeklyHours:"", type:"Zorunlu Ders", branch:"" };
const norm = (v:unknown) => String(v || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g," ");
const hoursFromSchedule = (v:unknown) => Number(String(v || "").match(/(\d+)/)?.[1] || 0);
const isArtEducationCourseName = (value: unknown) => {
  const key = norm(value)
    .replace(/İ/g,"I").replace(/Ğ/g,"G").replace(/Ü/g,"U")
    .replace(/Ş/g,"S").replace(/Ö/g,"O").replace(/Ç/g,"C");
  return key === "SANAT TARIHI" || key.startsWith("SANAT EGITIMI");
};

export default function CourseDefinitionTable(props:{
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  customCreatedCourses:any[];
  setCustomCreatedCourses:React.Dispatch<React.SetStateAction<any[]>>;
  branches:string[];
  notify:(message:string)=>void;
}) {
  const {
    classrooms,setClassrooms,courses,setCourses,
    customCreatedCourses,setCustomCreatedCourses,branches,notify
  } = props;

  const [editingKey,setEditingKey] = useState<string|null>(null);
  const [draft,setDraft] = useState<Draft>(emptyDraft);
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);

  const rows = useMemo(() => {
    const map = new Map<string,any>();
    const add = (name:string, src:any, fallback?:any) => {
      const key = norm(name);
      if (!name || map.has(key)) return;
      map.set(key,{
        key,
        name,
        code:String(src?.courseCode || src?.code || fallback?.code || ""),
        weeklyHours:Number(src?.weeklyHours || fallback?.weeklyHours || hoursFromSchedule(fallback?.schedule) || 0),
        type:(src?.courseType === "Seçmeli Ders" || src?.type === "elective" || fallback?.type === "elective")
          ? "Seçmeli Ders" : "Zorunlu Ders",
        branch:isArtEducationCourseName(name) ? "" : String(src?.branch || src?.courseBranch || fallback?.branch || "")
      });
    };
    customCreatedCourses.forEach(item => {
      const name=String(item?.courseName || item?.name || "").trim();
      add(name,item,courses.find(c=>norm(c.name)===norm(name)));
    });
    courses.forEach((course:any)=>add(String(course?.name || "").trim(),course));
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr-TR"));
  },[customCreatedCourses,courses]);

  const branchOptions = useMemo(
    ()=>[...new Set(branches.map(v=>String(v||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr-TR")),
    [branches]
  );

  const validate = (d:Draft, ownKey:string|null) => {
    if (!d.name.trim()) return "Ders adı zorunludur.";
    const h=Number(d.weeklyHours);
    if (!Number.isInteger(h) || h<1 || h>40) return "Haftalık ders saati 1-40 arasında tam sayı olmalıdır.";

    // Yeni kayıtta kod ve branş zorunludur. Eski/legacy derslerde bu alanlar geçmişte
    // boş bırakılmış olabilir; böyle bir dersi yalnızca adı veya saati için düzenlemeyi
    // engelleme. Kullanıcı değer girerse yine benzersizlik kontrolü uygula.
    if (ownKey === null && !d.code.trim()) return "Ders kodu zorunludur.";
    if (ownKey === null && !d.branch && !isArtEducationCourseName(d.name)) return "Ders branşı seçilmelidir.";
    if (d.code.trim() && rows.some(r=>norm(r.code)===norm(d.code) && r.key!==ownKey)) {
      return "Bu ders kodu başka bir derste kullanılıyor.";
    }
    return "";
  };

  const commit = async (nextClasses:Classroom[], nextCourses:Course[], nextCustom:any[]) => {
    // Legacy veride bazı kayıt ID'leri boşluk, Türkçe karakter, "/" vb.
    // karakterler içeriyor. Tek belge UPSERT endpoint'i bu ID'leri "Geçersiz
    // kayıt adresi" diyerek reddediyor. Öte yandan eski toplu katalog yazımı da
    // aynı ID birden fazla kez bulunduğunda UNIQUE hatasına düşüyordu.
    //
    // Burada önce her koleksiyonu ID bazında tekilleştiriyor, ardından veritabanının
    // collection transaction yoluyla üç koleksiyonu atomik biçimde değiştiriyoruz.
    // Transaction yolu belge-adresi doğrulamasına takılmaz; tekilleştirme de UNIQUE
    // çakışmasını engeller. ID'siz legacy kayıtlar korunur ve sıra bazlı geçici anahtar
    // sayesinde birbirini ezmez.
    const dedupeById = (rows:any[], prefix:string):any[] => {
      const usedIds = new Set(
        rows.map(row=>String(row?.id ?? "").trim()).filter(Boolean),
      );
      const stabilized = rows.map((row,index)=>{
        const explicit = String(row?.id ?? "").trim();
        if (explicit) return row;
        let generated = `legacy-${prefix}-${index}`;
        let suffix = 1;
        while (usedIds.has(generated)) generated = `legacy-${prefix}-${index}-${suffix++}`;
        usedIds.add(generated);
        return { ...row, id:generated };
      });

      const byId = new Map<string,any>();
      stabilized.forEach(row=>{
        const id = String(row.id).trim();
        byId.set(id,row); // Aynı ID varsa son/güncel kayıt kazanır.
      });
      return [...byId.values()];
    };

    const safeClasses = dedupeById(nextClasses as any[], "classrooms") as Classroom[];
    const safeCourses = dedupeById(nextCourses as any[], "courses") as Course[];
    const safeCustom = dedupeById(nextCustom as any[], "customCreatedCourses");

    await databaseGateway.transact({
      classrooms:safeClasses,
      courses:safeCourses,
      customCreatedCourses:safeCustom,
    });

    setClassrooms(safeClasses);
    setCourses(safeCourses);
    setCustomCreatedCourses(safeCustom);
  };

  const beginEdit=(row:any)=>{
    setError("");
    setEditingKey(row.key);
    setDraft({
      name:row.name, code:row.code, weeklyHours:String(row.weeklyHours || ""),
      type:row.type, branch:row.branch
    });
  };

  const cancel=()=>{ setEditingKey(null); setDraft(emptyDraft); setError(""); };

  const saveNew=async()=>{
    const e=validate(draft,null); if(e){setError(e);return;}
    if(rows.some(r=>r.key===norm(draft.name))){setError("Bu ders zaten kayıtlı.");return;}
    const hours=Number(draft.weeklyHours), code=draft.code.trim().toLocaleUpperCase("tr-TR");
    const effectiveBranch=isArtEducationCourseName(draft.name) ? "" : draft.branch;
    const item={
      id:`course-def-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      gradeLevel:"GENEL", courseName:draft.name.trim(), courseCode:code, code,
      weeklyHours:hours, courseType:draft.type, type:draft.type==="Seçmeli Ders"?"elective":"compulsory",
      branch:effectiveBranch, courseBranch:effectiveBranch,
      targetGroups:["ORTAK"], selectedClassrooms:[], classGroups:{}
    };
    setSaving(true);
    try {
      await commit(classrooms,courses,[...customCreatedCourses,item]);
      setDraft(emptyDraft); setError(""); notify(`${item.courseName} dersi kaydedildi.`);
    } catch(err) { setError(`Ders kaydedilemedi: ${err instanceof Error?err.message:String(err)}`); }
    finally { setSaving(false); }
  };

  const saveEdit=async(oldKey:string)=>{
    const e=validate(draft,oldKey); if(e){setError(e);return;}
    const newName=draft.name.trim(), newKey=norm(newName), hours=Number(draft.weeklyHours);
    const code=draft.code.trim().toLocaleUpperCase("tr-TR");
    const effectiveBranch=isArtEducationCourseName(newName) ? "" : draft.branch;
    if(rows.some(r=>r.key===newKey && r.key!==oldKey)){setError("Bu adla başka bir ders zaten kayıtlı.");return;}

    const nextCustom=customCreatedCourses.map(item=>norm(item?.courseName||item?.name)===oldKey ? {
      ...item, courseName:newName, courseCode:code, code, weeklyHours:hours,
      courseType:draft.type, type:draft.type==="Seçmeli Ders"?"elective":"compulsory",
      branch:effectiveBranch, courseBranch:effectiveBranch
    }:item);

    const nextCourses=courses.map((course:any)=>norm(course.name)===oldKey ? {
      ...course, name:newName, code, weeklyHours:hours, schedule:`Haftalık ${hours} Saat`,
      type:draft.type==="Seçmeli Ders"?"elective":"compulsory", branch:effectiveBranch
    } as Course:course);

    const nextClasses=classrooms.map(cls=>({
      ...cls,
      assignedCourses:(cls.assignedCourses||[]).map((a:any)=>norm(a.courseName)===oldKey ? {
        ...a, courseName:newName, weeklyHours:hours, type:draft.type, branch:effectiveBranch
      }:a)
    }));

    setSaving(true);
    try { await commit(nextClasses,nextCourses,nextCustom); cancel(); notify(`${newName} dersi güncellendi.`); }
    catch(err){setError(`Ders güncellenemedi: ${err instanceof Error?err.message:String(err)}`);}
    finally{setSaving(false);}
  };

  const remove=async(row:any)=>{
    if(!window.confirm(`"${row.name}" dersini silmek istiyor musunuz? Sınıflardaki atamaları da kaldırılacaktır.`))return;
    const nextCustom=customCreatedCourses.filter(i=>norm(i?.courseName||i?.name)!==row.key);
    const nextCourses=courses.filter(c=>norm(c.name)!==row.key);
    const nextClasses=classrooms.map(cls=>({
      ...cls,
      assignedCourses:(cls.assignedCourses||[]).filter((a:any)=>norm(a.courseName)!==row.key)
    }));
    setSaving(true);
    try { await commit(nextClasses,nextCourses,nextCustom); if(editingKey===row.key)cancel(); notify(`${row.name} dersi silindi.`); }
    catch(err){setError(`Ders silinemedi: ${err instanceof Error?err.message:String(err)}`);}
    finally{setSaving(false);}
  };

  const input="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  const editCells=(mode:"new"|"edit")=><>
    <td className="border-b border-slate-100 px-1.5 py-1.5">
      <input value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} className={input} placeholder="Ders adı"/>
    </td>
    <td className="border-b border-slate-100 px-1.5 py-1.5">
      <input value={draft.code} onChange={e=>setDraft(p=>({...p,code:e.target.value.toLocaleUpperCase("tr-TR")}))} className={`${input} uppercase`} placeholder="KOD"/>
    </td>
    <td className="border-b border-slate-100 px-1.5 py-1.5">
      <input type="number" min={1} max={40} value={draft.weeklyHours} onChange={e=>setDraft(p=>({...p,weeklyHours:e.target.value}))} className={`${input} text-center`} placeholder="0"/>
    </td>
    <td className="border-b border-slate-100 px-1.5 py-1.5">
      <select value={draft.type} onChange={e=>setDraft(p=>({...p,type:e.target.value as Kind}))}
        className={`${input} ${draft.type==="Seçmeli Ders"?"border-orange-300 bg-orange-50 text-orange-800":"border-blue-300 bg-blue-50 text-blue-800"}`}>
        <option value="Zorunlu Ders">Zorunlu</option><option value="Seçmeli Ders">Seçmeli</option>
      </select>
    </td>
    <td className="border-b border-slate-100 px-1.5 py-1.5">
      {isArtEducationCourseName(draft.name) ? (
        <div className={`${input} flex items-center bg-emerald-50 text-emerald-700`}>Branş aranmaz • Tüm öğretmenler</div>
      ) : (
        <select value={draft.branch} onChange={e=>setDraft(p=>({...p,branch:e.target.value}))} className={input}>
          <option value="">Branş seçiniz</option>
          {branchOptions.map(branch=><option key={branch} value={branch}>{branch}</option>)}
        </select>
      )}
    </td>
    <td className="border-b border-slate-100 px-1.5 py-1.5">
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        <button type="button" disabled={saving} onClick={()=>mode==="new"?void saveNew():void saveEdit(editingKey!)}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[9px] font-black text-white hover:bg-emerald-700 disabled:opacity-50">
          <Save className="h-3.5 w-3.5"/>Kaydet
        </button>
        {mode==="edit" && <button type="button" onClick={cancel} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-black text-slate-600">Vazgeç</button>}
        {mode==="new" && <>
          <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"><Pencil className="h-3.5 w-3.5"/>Düzenle</button>
          <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"><Trash2 className="h-3.5 w-3.5"/>Sil</button>
        </>}
      </div>
    </td>
  </>;

  return <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
    {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</div>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full table-fixed border-collapse bg-white">
        <thead className="bg-slate-50"><tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
          <th className="w-[28%] border-b border-slate-200 px-2 py-2">Dersin Adı</th>
          <th className="w-[12%] border-b border-slate-200 px-2 py-2">Dersin Kodu</th>
          <th className="w-[11%] border-b border-slate-200 px-2 py-2 text-center">Haftalık Ders Saati</th>
          <th className="w-[12%] border-b border-slate-200 px-2 py-2">Türü</th>
          <th className="w-[17%] border-b border-slate-200 px-2 py-2">Dersin Branşı</th>
          <th className="w-[20%] border-b border-slate-200 px-2 py-2 text-center">İşlemler</th>
        </tr></thead>
        <tbody>
          {editingKey===null && <tr className="border-2 border-violet-500 bg-yellow-300">{editCells("new")}</tr>}
          {rows.map(row=>{
            const editing=editingKey===row.key, elective=row.type==="Seçmeli Ders";
            return <tr key={row.key} className={editing?"bg-emerald-50/40":elective?"bg-orange-50/80 hover:bg-orange-100/70":"bg-blue-50/70 hover:bg-blue-100/70"}>
              {editing?editCells("edit"):<>
                <td className="border-b border-white/70 px-2 py-2 text-[11px] font-black text-slate-900">{row.name}</td>
                <td className="border-b border-white/70 px-2 py-2 text-[11px] font-black text-slate-700">{row.code||"—"}</td>
                <td className="border-b border-white/70 px-2 py-2 text-center text-[11px] font-black text-slate-800">{row.weeklyHours||"—"}</td>
                <td className="border-b border-white/70 px-2 py-2"><span className={`inline-flex rounded-lg px-2 py-1 text-[9px] font-black ${elective?"bg-orange-500 text-white":"bg-blue-600 text-white"}`}>{elective?"Seçmeli":"Zorunlu"}</span></td>
                <td className="border-b border-white/70 px-2 py-2 text-[11px] font-bold text-slate-700">{row.branch||"—"}</td>
              </>}
              {!editing && <td className="border-b border-white/70 px-1.5 py-1.5"><div className="flex items-center justify-center gap-1 whitespace-nowrap">
                <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"><Save className="h-3.5 w-3.5"/>Kaydet</button>
                <button type="button" onClick={()=>beginEdit(row)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-[9px] font-black text-indigo-700 hover:bg-indigo-100"><Pencil className="h-3.5 w-3.5"/>Düzenle</button>
                <button type="button" disabled={saving} onClick={()=>void remove(row)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[9px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>Sil</button>
              </div></td>}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    
  </div>;
}
