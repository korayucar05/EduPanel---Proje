import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Trash2,
  FolderPlus,
  Edit2,
  Check,
  X,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";

import { sqliteStorage } from "../core/state/SyncStateStore";
interface CustomGroupMember {
  id: string;
  name: string;
  role: string;
  class?: string;
  parentName?: string;
  studentName?: string;
}

interface CustomSubGroup {
  id: string;
  name: string;
  members: CustomGroupMember[];
}

interface CustomGroup {
  id: string;
  name: string;
  members: CustomGroupMember[];
  subGroups?: CustomSubGroup[];
}

export default function GroupsModule() {
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [allRecipients, setAllRecipients] = useState<CustomGroupMember[]>([]);
  
  // Selection
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSubGroupId, setSelectedSubGroupId] = useState<string | null>(null); // If null, editing main group

  // Input fields for creation
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);

  const [newSubGroupName, setNewSubGroupName] = useState("");
  const [showNewSubGroupInput, setShowNewSubGroupInput] = useState(false);

  // Rename states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Search and Select members
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("Tümü");

  // Manual Member Add
  const [manualName, setManualName] = useState("");
  const [manualRole, setManualRole] = useState("Öğrenci");
  const [manualClass, setManualClass] = useState("");

  const [notification, setNotification] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [subGroupToDelete, setSubGroupToDelete] = useState<string | null>(null);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  // Load groups, students, and teachers on mount
  useEffect(() => {
    import("../core/state/AppStateService").then((lf) => {
      // Load groups
      lf.default.getItem("school_whatsapp_custom_groups").then((saved: any) => {
        if (saved) {
          setCustomGroups(saved);
          if (saved.length > 0) {
            setSelectedGroupId(saved[0].id);
          }
        } else {
          try {
            const ls = sqliteStorage.getItem("school_whatsapp_custom_groups");
            if (ls) {
              const parsed = JSON.parse(ls);
              setCustomGroups(parsed);
              if (parsed.length > 0) {
                setSelectedGroupId(parsed[0].id);
              }
            }
          } catch {}
        }
      });

      // Load students
      lf.default.getItem("school_students").then((savedStudents: any) => {
        const studentsList = savedStudents || [];
        setStudents(studentsList);

        // Load teachers
        lf.default.getItem("school_teachers").then((savedTeachers: any) => {
          const teachersList = savedTeachers || [];
          setTeachers(teachersList);

          // Build unified contacts
          const unified: CustomGroupMember[] = [];
          
          // Teachers
          teachersList.forEach((t: any) => {
            unified.push({
              id: t.id,
              name: t.name,
              role: "Öğretmen",
              class: t.branch,
            });
          });

          // Students
          studentsList.forEach((s: any) => {
            unified.push({
              id: s.id,
              name: s.name,
              role: "Öğrenci",
              class: s.classroom,
              parentName: s.parentName,
            });
            
            // Parents
            unified.push({
              id: s.id + "-parent",
              name: s.parentName || (s.name + " Velisi"),
              role: "Öğrenci Velisi",
              studentName: s.name,
              class: s.classroom,
            });
          });

          setAllRecipients(unified);
        });
      });
    });
  }, []);

  const saveGroups = (updated: CustomGroup[]) => {
    setCustomGroups(updated);
    import("../core/state/AppStateService").then((lf) => {
      lf.default.setItem("school_whatsapp_custom_groups", updated).catch(e => console.error(e));
    });
    try {
      sqliteStorage.setItem("school_whatsapp_custom_groups", JSON.stringify(updated));
    } catch {}
  };

  // Add Group
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: CustomGroup = {
      id: "cg-" + Date.now(),
      name: newGroupName.trim(),
      members: [],
      subGroups: [],
    };
    const updated = [...customGroups, newGroup];
    saveGroups(updated);
    setSelectedGroupId(newGroup.id);
    setSelectedSubGroupId(null);
    setNewGroupName("");
    setShowNewGroupInput(false);
    triggerNotification(`"${newGroup.name}" grubu oluşturuldu!`);
  };

  // Delete Group
  const handleDeleteGroup = (id: string) => {
    setGroupToDelete(id);
  };

  const confirmDeleteGroup = () => {
    if (!groupToDelete) return;
    const id = groupToDelete;
    const updated = customGroups.filter(g => g.id !== id);
    saveGroups(updated);
    if (selectedGroupId === id) {
      if (updated.length > 0) {
        setSelectedGroupId(updated[0].id);
        setSelectedSubGroupId(null);
      } else {
        setSelectedGroupId(null);
        setSelectedSubGroupId(null);
      }
    }
    setGroupToDelete(null);
    triggerNotification("Grup silindi.");
  };

  // Add Subgroup
  const handleCreateSubGroup = () => {
    if (!selectedGroupId || !newSubGroupName.trim()) return;
    const updated = customGroups.map(g => {
      if (g.id === selectedGroupId) {
        const subGroups = g.subGroups || [];
        const newSub: CustomSubGroup = {
          id: "csg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
          name: newSubGroupName.trim(),
          members: [],
        };
        return {
          ...g,
          subGroups: [...subGroups, newSub],
        };
      }
      return g;
    });
    saveGroups(updated);
    
    // Auto-select newly created sub-group
    const currentGroup = updated.find(g => g.id === selectedGroupId);
    if (currentGroup && currentGroup.subGroups) {
      const addedSub = currentGroup.subGroups[currentGroup.subGroups.length - 1];
      setSelectedSubGroupId(addedSub.id);
    }
    setNewSubGroupName("");
    setShowNewSubGroupInput(false);
    triggerNotification(`"${newSubGroupName}" alt grubu başarıyla eklendi!`);
  };

  // Delete Subgroup
  const handleDeleteSubGroup = (subGroupId: string) => {
    setSubGroupToDelete(subGroupId);
  };

  const confirmDeleteSubGroup = () => {
    if (!selectedGroupId || !subGroupToDelete) return;
    const subGroupId = subGroupToDelete;
    const updated = customGroups.map(g => {
      if (g.id === selectedGroupId) {
        return {
          ...g,
          subGroups: (g.subGroups || []).filter(sg => sg.id !== subGroupId),
        };
      }
      return g;
    });
    saveGroups(updated);
    if (selectedSubGroupId === subGroupId) {
      setSelectedSubGroupId(null);
    }
    setSubGroupToDelete(null);
    triggerNotification("Alt grup silindi.");
  };

  // Rename Group or Sub-group
  const handleRename = () => {
    if (!selectedGroupId || !editNameValue.trim()) return;
    const updated = customGroups.map(g => {
      if (g.id === selectedGroupId) {
        if (selectedSubGroupId) {
          // Rename subGroup
          const updatedSubs = (g.subGroups || []).map(sg => {
            if (sg.id === selectedSubGroupId) {
              return { ...sg, name: editNameValue.trim() };
            }
            return sg;
          });
          return { ...g, subGroups: updatedSubs };
        } else {
          // Rename main group
          return { ...g, name: editNameValue.trim() };
        }
      }
      return g;
    });
    saveGroups(updated);
    setIsEditingName(false);
    triggerNotification("İsim başarıyla güncellendi.");
  };

  // Add Member to selected Group or Subgroup
  const handleAddMember = (member: CustomGroupMember) => {
    if (!selectedGroupId) return;
    const updated = customGroups.map(g => {
      if (g.id === selectedGroupId) {
        if (selectedSubGroupId) {
          // Add to subGroup
          const subGroups = (g.subGroups || []).map(sg => {
            if (sg.id === selectedSubGroupId) {
              if (sg.members.some(m => m.id === member.id)) {
                alert("Bu üye zaten bu alt grupta bulunuyor.");
                return sg;
              }
              return { ...sg, members: [...sg.members, member] };
            }
            return sg;
          });
          return { ...g, subGroups };
        } else {
          // Add to main group
          if (g.members.some(m => m.id === member.id)) {
            alert("Bu üye zaten bu grupta bulunuyor.");
            return g;
          }
          return { ...g, members: [...g.members, member] };
        }
      }
      return g;
    });
    saveGroups(updated);
    triggerNotification(`"${member.name}" başarıyla eklendi.`);
  };

  // Remove Member
  const handleRemoveMember = (memberId: string) => {
    if (!selectedGroupId) return;
    const updated = customGroups.map(g => {
      if (g.id === selectedGroupId) {
        if (selectedSubGroupId) {
          // Remove from subGroup
          const subGroups = (g.subGroups || []).map(sg => {
            if (sg.id === selectedSubGroupId) {
              return { ...sg, members: sg.members.filter(m => m.id !== memberId) };
            }
            return sg;
          });
          return { ...g, subGroups };
        } else {
          // Remove from main group
          return { ...g, members: g.members.filter(m => m.id !== memberId) };
        }
      }
      return g;
    });
    saveGroups(updated);
    triggerNotification("Üye gruptan çıkarıldı.");
  };

  // Manual Add
  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      alert("Lütfen üye adı soyadı girin.");
      return;
    }
    const newMember: CustomGroupMember = {
      id: "manual-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
      name: manualName.trim(),
      role: manualRole,
      class: manualClass.trim() || undefined,
    };
    handleAddMember(newMember);
    setManualName("");
    setManualClass("");
  };

  // Compute currently active target and list
  const activeGroup = customGroups.find(g => g.id === selectedGroupId);
  const activeSubGroup = activeGroup?.subGroups?.find(sg => sg.id === selectedSubGroupId);
  const activeTitle = selectedSubGroupId ? activeSubGroup?.name : activeGroup?.name;
  const activeMembersList = selectedSubGroupId ? (activeSubGroup?.members || []) : (activeGroup?.members || []);

  // Filter contacts
  const filteredContacts = React.useMemo(() => {
    const term = memberSearchTerm.toLowerCase().trim();
    return allRecipients.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(term) || (r.class && r.class.toLowerCase().includes(term));
      const matchesRole = selectedRoleFilter === "Tümü" || r.role === selectedRoleFilter;
      const isAlreadyInCurrent = activeMembersList.some(m => m.id === r.id);
      return matchesSearch && matchesRole && !isAlreadyInCurrent;
    }).slice(0, 50); // Cap at 50 for performance
  }, [allRecipients, memberSearchTerm, selectedRoleFilter, activeMembersList]);

  return (
    <div className="flex flex-col w-full mx-auto space-y-6 p-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
            Veri Yönetimi
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Özel Gruplar ve Alt Gruplar
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Öğrenci, veli ve öğretmenlerden oluşan özel gruplar ve hiyerarşik alt gruplar yönetin.
          </p>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          {notification}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        
        {/* COLUMN 1: Group Tree List */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-[28px] p-6 shadow-sm flex flex-col gap-5 min-h-[500px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm leading-tight">Gruplarım</h3>
                <p className="text-[11px] text-slate-400 font-semibold">Tüm grup ve alt gruplar</p>
              </div>
            </div>

            {!showNewGroupInput && (
              <button
                type="button"
                onClick={() => setShowNewGroupInput(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Grup Ekle
              </button>
            )}
          </div>

          {showNewGroupInput && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 animate-fadeIn">
              <span className="text-[9px] font-black text-slate-500 tracking-wider">YENİ GRUP ADI</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Örn: 11. Sınıf Çalışma Grubu"
                  className="flex-1 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 rounded-xl cursor-pointer"
                >
                  Oluştur
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGroupInput(false);
                    setNewGroupName("");
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-extrabold text-xs px-3 rounded-xl cursor-pointer"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Groups Tree Navigation */}
          <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[600px] pr-1">
            {customGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2 border border-dashed border-slate-100 rounded-2xl">
                <Users className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-bold">Kayıtlı grup bulunmuyor.</span>
              </div>
            ) : (
              customGroups.map((g) => {
                const isGroupSelected = selectedGroupId === g.id && selectedSubGroupId === null;
                return (
                  <div key={g.id} className="border border-slate-100 rounded-2xl p-3 flex flex-col gap-2 bg-slate-50/40">
                    <div
                      onClick={() => {
                        setSelectedGroupId(g.id);
                        setSelectedSubGroupId(null);
                        setIsEditingName(false);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                        isGroupSelected
                          ? "bg-indigo-600 text-white font-extrabold shadow-sm"
                          : "hover:bg-slate-100/80 text-slate-800 font-bold"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Users className="w-4 h-4 shrink-0" />
                        <span className="text-xs truncate">{g.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isGroupSelected ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-600"
                        }`}>
                          {g.members?.length || 0} Üye
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(g.id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isGroupSelected ? "text-indigo-200 hover:text-white" : "text-slate-400 hover:text-rose-600"
                          }`}
                          title="Grubu Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subgroups List */}
                    <div className="pl-6 border-l-2 border-slate-100/80 space-y-2 flex flex-col mt-1">
                      {(g.subGroups || []).map((sg) => {
                        const isSubSelected = selectedGroupId === g.id && selectedSubGroupId === sg.id;
                        return (
                          <div
                            key={sg.id}
                            onClick={() => {
                              setSelectedGroupId(g.id);
                              setSelectedSubGroupId(sg.id);
                              setIsEditingName(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer text-[11px] ${
                              isSubSelected
                                ? "bg-indigo-100 text-indigo-800 font-extrabold"
                                : "hover:bg-slate-100 text-slate-600 font-semibold"
                            }`}
                          >
                            <span className="truncate flex items-center gap-1.5">
                              <span className="text-indigo-400 font-bold">↳</span>
                              {sg.name}
                              <span className="text-[8px] bg-slate-200 text-slate-500 font-bold px-1 rounded-full">
                                {sg.members?.length || 0} Üye
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupId(g.id);
                                handleDeleteSubGroup(sg.id);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Alt Grubu Sil"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      {selectedGroupId === g.id && !showNewSubGroupInput && (
                        <button
                          type="button"
                          onClick={() => setShowNewSubGroupInput(true)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold text-left pl-5 py-1 flex items-center gap-1 cursor-pointer"
                        >
                          + Alt Grup Ekle
                        </button>
                      )}

                      {selectedGroupId === g.id && showNewSubGroupInput && (
                        <div className="bg-white border border-slate-100 rounded-xl p-2.5 flex flex-col gap-2 mt-1">
                          <span className="text-[8px] font-black text-slate-400">ALT GRUP ADI</span>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newSubGroupName}
                              onChange={(e) => setNewSubGroupName(e.target.value)}
                              placeholder="Örn: 11-A Velileri"
                              className="flex-1 bg-slate-50 px-2 py-1.5 rounded text-[10px] font-semibold text-slate-700 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleCreateSubGroup}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] px-2 py-1 rounded cursor-pointer"
                            >
                              Ekle
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewSubGroupInput(false);
                                setNewSubGroupName("");
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-[9px] px-2 py-1 rounded cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: Group Details and Members Administration */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {activeGroup ? (
            <div className="bg-white border border-slate-100 rounded-[28px] p-6 shadow-sm flex flex-col gap-6 animate-fadeIn">
              
              {/* Header Details */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                <div className="min-w-0 flex-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={handleRename}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-1.5 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-indigo-950 truncate">
                        {activeTitle}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setEditNameValue(activeTitle || "");
                          setIsEditingName(true);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1"
                        title="İsmi Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {selectedSubGroupId ? "Alt Grup" : "Ana Grup"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-indigo-600 font-black">
                      {activeMembersList.length} ÜYE KAYITLI
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold italic">
                    Üyeler asıl listelerden silinmez.
                  </span>
                </div>
              </div>

              {/* Members List inside group */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-black text-indigo-400 tracking-wider">GRUPTAKİ ÜYELER</span>
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 max-h-[250px] overflow-y-auto flex flex-wrap gap-2.5">
                  {activeMembersList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 bg-indigo-50 border border-indigo-100/50 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-900"
                    >
                      <div className="truncate max-w-[150px]">
                        {m.name}
                        <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1 uppercase font-bold">
                          {m.role}
                        </span>
                        {m.class && (
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 rounded ml-1">
                            {m.class}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-indigo-400 hover:text-rose-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {activeMembersList.length === 0 && (
                    <span className="text-xs text-slate-400 italic py-4 text-center w-full block">
                      Grupta henüz üye bulunmuyor. Aşağıdan yeni üyeler ekleyebilirsiniz.
                    </span>
                  )}
                </div>
              </div>

              {/* Add New Members Selection Workspace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                
                {/* SUBCOLUMN A: Select from directory */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-400 tracking-wider">REHBERDEN SEÇEREK EKLE</span>
                    <select
                      value={selectedRoleFilter}
                      onChange={(e) => setSelectedRoleFilter(e.target.value)}
                      className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border-0 outline-none"
                    >
                      <option value="Tümü">Tümü</option>
                      <option value="Öğretmen">Öğretmenler</option>
                      <option value="Öğrenci">Öğrenciler</option>
                      <option value="Öğrenci Velisi">Veliler</option>
                    </select>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      placeholder="İsim veya sınıf ile aratın..."
                      className="w-full bg-slate-50/70 pl-8.5 pr-4 py-2 text-xs font-semibold rounded-xl text-slate-700 outline-none border border-transparent focus:bg-white focus:border-indigo-400 transition-all"
                    />
                  </div>

                  <div className="border border-slate-100 rounded-2xl max-h-[220px] overflow-y-auto divide-y divide-slate-50 bg-white shadow-xs">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-indigo-50/30 transition-all text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">{contact.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 py-0.5 rounded uppercase">
                              {contact.role}
                            </span>
                            {contact.class && (
                              <span className="text-[8px] text-slate-400 font-semibold">
                                {contact.class}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMember(contact)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black p-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {filteredContacts.length === 0 && (
                      <p className="text-center text-[10px] text-slate-400 italic py-8">
                        Eşleşen üye bulunamadı.
                      </p>
                    )}
                  </div>
                </div>

                {/* SUBCOLUMN B: Add Manual Custom Member */}
                <form onSubmit={handleManualAdd} className="flex flex-col gap-3">
                  <span className="text-[10px] font-black text-indigo-400 tracking-wider">MANUEL İSİM YAZARAK EKLE</span>
                  
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-slate-500">AD SOYAD</label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Ad Soyad girin..."
                        className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black text-slate-500">ROL</label>
                        <select
                          value={manualRole}
                          onChange={(e) => setManualRole(e.target.value)}
                          className="bg-white border border-slate-200 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="Öğrenci">Öğrenci</option>
                          <option value="Öğrenci Velisi">Veli</option>
                          <option value="Öğretmen">Öğretmen</option>
                          <option value="Diğer">Diğer</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black text-slate-500">SINIF / BRANŞ</label>
                        <input
                          type="text"
                          value={manualClass}
                          onChange={(e) => setManualClass(e.target.value)}
                          placeholder="Örn: 9-A"
                          className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 rounded-xl transition-all mt-1 cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    >
                      <UserPlus className="w-4 h-4" />
                      Yazılan Üyeyi Gruba Ekle
                    </button>
                  </div>
                </form>

              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-[28px] p-8 shadow-sm flex flex-col items-center justify-center text-center py-20 gap-4 min-h-[500px]">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Grup Seçilmedi</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Soldaki hiyerarşik listeden bir grup veya alt grup seçin ya da yenisini oluşturun.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Delete Group Modal */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl w-full max-w-sm flex flex-col gap-5">
            <div className="flex flex-col gap-2 text-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-1">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg">Grubu Sil</h3>
              <p className="text-xs text-slate-500 font-medium">
                Bu grubu ve içindeki tüm alt grupları kalıcı olarak silmek istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setGroupToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmDeleteGroup}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete SubGroup Modal */}
      {subGroupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl w-full max-w-sm flex flex-col gap-5">
            <div className="flex flex-col gap-2 text-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-1">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg">Alt Grubu Sil</h3>
              <p className="text-xs text-slate-500 font-medium">
                Bu alt grubu kalıcı olarak silmek istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setSubGroupToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmDeleteSubGroup}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
