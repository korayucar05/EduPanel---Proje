import React from "react";
import { Eye, Printer, Settings2, X } from "lucide-react";

export interface SeatingCriteria {
  avoidSameBranchSide: boolean;
  avoidSameExamCluster: boolean;
  alternateBranches: boolean;
  avoidSameBranchFrontBack: boolean;
  avoidSameBranchDiagonal: boolean;
  alternateBooklets: boolean;
  minSameBranchDistance: boolean;
  balanceBranchesAcrossRooms: boolean;
  avoidSequentialOrder: boolean;
  reshuffleEachExam: boolean;
  distributeEmptySeats: boolean;
  protectSpecialNeeds: boolean;
  objectiveOnly: boolean;
  showSupervisorDetails: boolean;
}

interface Props {
  isPreviewModalOpen: boolean;
  generatedSeating: any | null;
  handlePrint: () => void;
  setIsPreviewModalOpen: (value: boolean) => void;
  previewRoomName: string;
  setPreviewRoomName: (value: string) => void;
  sittingPattern: 'tekli' | 'ciftli';
  getStudentGender: (student: any) => string;
  isCriteriaModalOpen: boolean;
  setIsCriteriaModalOpen: (value: boolean) => void;
  setSittingPattern: (value: 'tekli' | 'ciftli') => void;
  genderRuleActive: boolean;
  setGenderRuleActive: (value: boolean) => void;
  crossSittingActive: boolean;
  setCrossSittingActive: (value: boolean) => void;
  manualPlacementActive: boolean;
  setManualPlacementActive: (value: boolean) => void;
  seatingCriteria: SeatingCriteria;
  setSeatingCriteria: React.Dispatch<React.SetStateAction<SeatingCriteria>>;
  onGenerateSeating: () => boolean | Promise<boolean>;
}

export default function KelebekASeatingModals(props: Props) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const {
    isPreviewModalOpen, generatedSeating, handlePrint, setIsPreviewModalOpen, previewRoomName,
    setPreviewRoomName, sittingPattern, getStudentGender, isCriteriaModalOpen, setIsCriteriaModalOpen,
    setSittingPattern, genderRuleActive, setGenderRuleActive, crossSittingActive, setCrossSittingActive,
    manualPlacementActive, setManualPlacementActive, seatingCriteria, setSeatingCriteria, onGenerateSeating
  } = props;

  return (
    <>
{/* SEATING PLAN PREVIEW MODAL */}
{isPreviewModalOpen && generatedSeating && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in print:hidden">
    <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
      
      {/* Modal Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Eye className="w-5 h-5 text-violet-600" />
            Sınav Salonu Yerleşim Planı Ön İzleme
          </h3>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
            Sıra yerleşimlerini, öğrenci konumlarını ve salon detaylarını interaktif olarak önizleyin.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[14.67px] font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Yazdır / PDF Kaydet</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPreviewModalOpen(false)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Content Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar: List of Salons */}
        <div className="w-64 border-r border-slate-100 overflow-y-auto p-4 bg-slate-50/50 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Sınav Salonları</p>
          {generatedSeating.rooms.map((room: any) => {
            const isSelected = (previewRoomName || generatedSeating.rooms[0]?.name) === room.name;
            const seatedCount = room.desks.flatMap((d: any) => [d.left, d.right]).filter(Boolean).length;
            
            return (
              <button
                key={room.name}
                type="button"
                onClick={() => setPreviewRoomName(room.name)}
                className={`w-full p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-violet-600 border-violet-600 text-white shadow-xs' 
                    : 'bg-white border-slate-200/60 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-wide">{room.name} Salonu</span>
                <div className="flex justify-between items-center w-full mt-0.5">
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-violet-100' : 'text-slate-400'}`}>
                    {room.desks.length} Sıra
                  </span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-lg ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {seatedCount} Öğrenci
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Preview Area */}
        {(() => {
          const currentRoom = generatedSeating.rooms.find((r: any) => r.name === (previewRoomName || generatedSeating.rooms[0]?.name));
          if (!currentRoom) return (
            <div className="flex-1 flex items-center justify-center text-slate-400 italic">
              Lütfen önizlemek için bir salon seçin.
            </div>
          );

          const placedStudents = currentRoom.desks.flatMap((d: any) => [d.left, d.right]).filter(Boolean);
          const vacantCount = (sittingPattern === 'tekli' ? currentRoom.desks.length : currentRoom.desks.length * 2) - placedStudents.length;

          return (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
              
              {/* Salon Stats Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between text-xs font-bold text-slate-600">
                <div className="flex items-center gap-4">
                  <span>Salon Adı: <strong className="text-slate-800">{currentRoom.name}</strong></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>Kapasite: <strong className="text-slate-800">{currentRoom.desks.length * (sittingPattern === 'tekli' ? 1 : 2)}</strong></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>Yerleşen: <strong className="text-emerald-600">{placedStudents.length}</strong></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>Boş Sıra: <strong className="text-amber-600">{vacantCount}</strong></span>
                </div>
                <div className="text-[10px] font-extrabold text-slate-500">Şube ve kitapçık bilgisi açık görünür.</div>
              </div>

              {/* Interactive Blueprint Grid */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100/40">
                
                {/* Teacher Desk Indicator */}
                <div className="w-full max-w-md mx-auto mb-8 bg-white border border-slate-200/80 rounded-2xl p-2.5 shadow-2xs text-center">
                  <div className="bg-slate-50 border border-slate-100 py-1.5 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Öğretmen Kürsüsü & Tahta Tarafı
                  </div>
                </div>

                {/* Desks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {currentRoom.desks.map((desk: any) => {
                    const hasLeft = !!desk.left;
                    const hasRight = !!desk.right;

                    return (
                      <div 
                        key={desk.id} 
                        className={`p-3 border rounded-2xl flex flex-col justify-between h-28 transition-all ${
                          hasLeft || hasRight 
                            ? 'bg-white border-slate-200 shadow-2xs hover:shadow-xs' 
                            : 'bg-slate-50 border-dashed border-slate-200 opacity-50'
                        }`}
                      >
                        {/* Desk Header */}
                        <div className="flex items-center justify-between text-[9px] font-black text-slate-400 border-b border-slate-100/60 pb-1">
                          <span>{desk.seatNumLeft}{sittingPattern === 'ciftli' ? ' - ' + desk.seatNumRight : ''}</span>
                          {(!hasLeft && !hasRight) && <span className="text-amber-500 font-bold">BOŞ</span>}
                        </div>

                        {/* Student Slot Representation */}
                        {sittingPattern === 'tekli' ? (
                          <div className="flex-1 flex items-center justify-center py-2">
                            {desk.left ? (
                              <div className="w-full p-2 rounded-xl text-center leading-tight border bg-indigo-50/60 border-indigo-100 text-indigo-900">
                                <p className="text-xs font-black truncate">{desk.left.name}</p>
                                <p className="text-[9px] font-bold opacity-80 mt-0.5">
                                  No: {desk.left.number || desk.left.id.slice(0,4)} • {desk.left.classroom} • Kitapçık: {desk.left.bookletType || "A"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-bold italic">Sıra Boş</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 grid grid-cols-2 gap-2 py-1.5">
                            {/* Left Student */}
                            <div className="flex flex-col justify-center h-full">
                              {desk.left ? (
                                <div className="p-1.5 rounded-xl text-center leading-tight border h-full flex flex-col justify-center bg-indigo-50/60 border-indigo-100 text-indigo-900">
                                  <p className="text-[10px] font-black truncate" title={desk.left.name}>
                                    {desk.left.name.split(' ')[0]}
                                  </p>
                                  <p className="text-[8px] font-extrabold opacity-75 truncate">
                                    {desk.left.classroom}
                                  </p>
                                  <p className="text-[7px] font-bold opacity-60">
                                    #{desk.left.number || desk.left.id.slice(0,4)} • {desk.left.bookletType || "A"}
                                  </p>
                                </div>
                              ) : (
                                <div className="border border-dashed border-slate-200 rounded-xl h-full flex items-center justify-center text-[8px] text-slate-300 font-bold">
                                  BOŞ
                                </div>
                              )}
                            </div>

                            {/* Right Student */}
                            <div className="flex flex-col justify-center h-full">
                              {desk.right ? (
                                <div className="p-1.5 rounded-xl text-center leading-tight border h-full flex flex-col justify-center bg-indigo-50/60 border-indigo-100 text-indigo-900">
                                  <p className="text-[10px] font-black truncate" title={desk.right.name}>
                                    {desk.right.name.split(' ')[0]}
                                  </p>
                                  <p className="text-[8px] font-extrabold opacity-75 truncate">
                                    {desk.right.classroom}
                                  </p>
                                  <p className="text-[7px] font-bold opacity-60">
                                    #{desk.right.number || desk.right.id.slice(0,4)} • {desk.right.bookletType || "A"}
                                  </p>
                                </div>
                              ) : (
                                <div className="border border-dashed border-slate-200 rounded-xl h-full flex items-center justify-center text-[8px] text-slate-300 font-bold">
                                  BOŞ
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

            </div>
          );
        })()}

      </div>

    </div>
  </div>
)}

{/* SEATING PLAN CRITERIA MODAL */}
{isCriteriaModalOpen && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in print:hidden">
    <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-violet-600" />
            Yerleşim Kriterleri
          </h3>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
            Seçili kriterler ceza puanına dönüştürülür; motor toplam ceza puanı en düşük yerleşimi seçer.
          </p>
        </div>
        <button type="button" onClick={() => setIsCriteriaModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Oturma Düzeni</label>
          <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700">
            Çiftli Oturma Düzeni (2 Öğrenci/Sıra) — Bina Bilgileri düzeni
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-xs font-black text-violet-900">Ana hedef: 8 komşuluk alanında aynı şubeden öğrenci bulunmaması</p>
          <p className="mt-1 text-[10px] font-semibold text-violet-700">Sağ, sol, ön, arka ve dört çapraz komşuluk birlikte değerlendirilir. Yan yana +100, ön/arka +80, çapraz +50 ceza alır.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ['avoidSameBranchSide', 'Aynı şube yan yana gelmesin', 'Sağ-sol komşulukta aynı sınıf/şube bulunmaması hedeflenir. (+100 ceza)'],
            ['avoidSameExamCluster', 'Aynı ders/sınav grubu kümelenmesin', 'Aynı sınav grubundaki öğrenciler salonun tek bölümünde toplanmaz.'],
            ['alternateBranches', 'Şubeler dönüşümlü yerleşsin', '9A – 9C – 9B – 9D gibi farklı şubeler mümkün olduğunca ardışık gelir.'],
            ['avoidSameBranchFrontBack', 'Ön ve arka sırada aynı şube olmasın', 'Bir öğrencinin tam önünde ve arkasında farklı şube hedeflenir. (+80 ceza)'],
            ['avoidSameBranchDiagonal', 'Çapraz görüş alanında aynı şube olmasın', 'Sağ/sol ön ve sağ/sol arkada aynı şube bulunmaması hedeflenir. (+50 ceza)'],
            ['alternateBooklets', 'Komşu kitapçık türleri farklı olsun', 'A-B varsa dama düzeni; A-B-C-D tanımlıysa dört kitapçık dönüşümlü kullanılır. (+100 ceza)'],
            ['minSameBranchDistance', 'Aynı şube arasında asgari mesafe olsun', 'Kapasite elveriyorsa aynı şubeden en yakın öğrenci birkaç koltuk/sıra uzakta tutulur.'],
            ['balanceBranchesAcrossRooms', 'Şubeler salonlara dengeli dağıtılsın', 'Tek bir şubenin bir salonda aşırı yoğunlaşması engellenir. (+30 yoğunluk cezası)'],
            ['avoidSequentialOrder', 'Numara/alfabetik sıra peş peşe kullanılmasın', 'Öğrenciler mevcut sınıf veya numara sırasını tekrar etmeyecek şekilde karıştırılır.'],
            ['reshuffleEachExam', 'Her sınavda yeniden karıştır', 'Aynı öğrencilerin sürekli aynı yerde ve aynı komşularla oturması önlenir.'],
            ['distributeEmptySeats', 'Boş sıraları stratejik dağıt', 'Kapasite uygunsa boş koltuklar tek bölgede toplanmak yerine aralara yayılır.'],
            ['protectSpecialNeeds', 'Özel gereksinimleri koru', 'Erişim veya sınav tedbiri kaydı bulunan öğrencilerin uygun konumu önceliklendirilir.'],
            ['objectiveOnly', 'Kişisel özellikleri kopya riski kriteri yapma', 'Kız/erkek, başarı ve disiplin geçmişi yerleştirme puanında kullanılmaz.'],
            ['showSupervisorDetails', 'Gözetmen kontrol bilgilerini açık göster', 'Sıra numarası, öğrenci adı, şube ve kitapçık türü salon krokisinde görünür.'],
          ] as Array<[keyof SeatingCriteria, string, string]>).map(([key, title, description]) => {
            const fixed = key === 'objectiveOnly';
            return (
              <label key={key} className={`flex items-start gap-3 rounded-2xl border p-4 select-none ${fixed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50/50 border-slate-200 hover:border-violet-200 cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={seatingCriteria[key]}
                  disabled={fixed}
                  onChange={(e) => setSeatingCriteria((current) => ({ ...current, [key]: e.target.checked }))}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <p className="text-xs font-extrabold text-slate-700">{title}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-relaxed">{description}</p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/10 hover:bg-blue-50/20 transition-all">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={manualPlacementActive} onChange={(e) => setManualPlacementActive(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5" />
            <div>
              <p className="text-xs font-extrabold text-slate-700">Bazı Öğrencileri El ile Yerleştir</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Belirli öğrencileri seçip sınav salonuna sabitleyebilirsiniz; kalan öğrenciler seçili kriterlere göre otomatik dağıtılır.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-slate-500">Yerleşim tamamlanamaz veya kriterler tam sağlanamazsa sistem kaldırılabilecek kriterleri uyarı mesajında önerecektir.</p>
        <button
          type="button"
          disabled={isGenerating}
          onClick={async () => {
            if (isGenerating) return;
            setIsGenerating(true);
            try {
              const created = await onGenerateSeating();
              if (created !== false) setIsCriteriaModalOpen(false);
            } finally {
              setIsGenerating(false);
            }
          }}
          className={`shrink-0 px-6 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm ${isGenerating ? 'bg-slate-300 text-white cursor-wait' : 'bg-violet-600 hover:bg-violet-700 text-white cursor-pointer'}`}
        >
          {isGenerating ? 'Yerleşim Oluşturuluyor...' : 'Yerleşim Planını Oluştur'}
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}
