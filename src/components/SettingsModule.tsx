import React, { useMemo, useState } from "react";
import { Building2, Check, ChevronRight, Pencil, Plus, Save, ShieldCheck, UserCog, X } from "lucide-react";
import SuperAdminSystemOperations from "./admin/SuperAdminSystemOperations";
import {
  AccessControlState,
  blankPermissions,
  createPasswordCredential,
  findCurrentUser,
  loadAccessState,
  ModulePermission,
  PanelUser,
  PERMISSION_MODULES,
  saveAccessState,
  SchoolAccount,
  MAX_SUPER_ADMINS,
  MAX_SCHOOL_DELEGATED_ADMINS,
  allModuleIds,
} from "../lib/accessControl";

interface SettingsModuleProps {
  stats: { gpaAverage: number; dailyAttendanceRate: number };
  setStats: React.Dispatch<React.SetStateAction<any>>;
  accessState?: AccessControlState;
  onAccessStateChange?: (state: AccessControlState) => void;
}

const roleLabel = (role: PanelUser["role"]) =>
  role === "super_admin" ? "Süper Admin" :
  role === "principal" ? "Okul Yöneticisi" :
  role === "school_admin" ? "Yetkili Yönetici" :
  "Yetkili Öğretmen";

export default function SettingsModule({ accessState, onAccessStateChange }: SettingsModuleProps) {
  const initial = accessState || loadAccessState();
  const [state, setState] = useState(initial);
  const currentUser = findCurrentUser(state);
  const [selectedSchoolId, setSelectedSchoolId] = useState(currentUser.schoolId || initial.schools[0]?.id || "");
  const [permissionUserId, setPermissionUserId] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [modal, setModal] = useState<"school" | "user" | "superAdmin" | null>(null);
  const [notice, setNotice] = useState("");

  const selectedSchool = state.schools.find((school) => school.id === selectedSchoolId);
  const schoolUsers = state.users.filter((user) => user.schoolId === selectedSchoolId);
  const delegatedUsers = schoolUsers.filter((user) => user.role === "school_admin" || user.role === "teacher");
  const superAdmins = state.users.filter((user) => user.role === "super_admin");
  const permissionUser = state.users.find((user) => user.id === permissionUserId);
  const editingUser = state.users.find((user) => user.id === editingUserId);
  const isSuperAdmin = currentUser.role === "super_admin";
  const visibleSchools = isSuperAdmin ? state.schools : state.schools.filter((school) => school.id === currentUser.schoolId);
  const moduleIds = useMemo(() => PERMISSION_MODULES.map((module) => module.id), []);

  const commit = (next: AccessControlState, message: string) => {
    setState(next);
    saveAccessState(next);
    onAccessStateChange?.(next);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const updateStatus = (userId: string, status: PanelUser["status"]) => {
    const target = state.users.find((user) => user.id === userId);
    if (!target || target.role === "super_admin") return;
    commit({ ...state, users: state.users.map((user) => user.id === userId ? { ...user, status } : user) }, "Kullanım izni güncellendi.");
  };

  const updatePermission = (moduleId: string, action: keyof ModulePermission, checked: boolean) => {
    if (!permissionUser || !["teacher", "school_admin"].includes(permissionUser.role)) return;
    const permission = { ...(permissionUser.permissions[moduleId] || { view: false, create: false, update: false }), [action]: checked };
    if (checked && action !== "view") permission.view = true;
    if (!checked && action === "view") { permission.create = false; permission.update = false; }
    commit({ ...state, users: state.users.map((user) => user.id === permissionUser.id ? { ...user, permissions: { ...user.permissions, [moduleId]: permission } } : user) }, "Öğretmen yetkileri kaydedildi.");
  };

  const updatePermissionColumn = (action: keyof ModulePermission, checked: boolean) => {
    if (!permissionUser) return;
    const permissions = { ...permissionUser.permissions };
    moduleIds.forEach((id) => {
      const permission = { ...(permissions[id] || { view: false, create: false, update: false }), [action]: checked };
      if (checked && action !== "view") permission.view = true;
      if (!checked && action === "view") { permission.create = false; permission.update = false; }
      permissions[id] = permission;
    });
    commit({ ...state, users: state.users.map((user) => user.id === permissionUser.id ? { ...user, permissions } : user) }, "Toplu yetki seçimi kaydedildi.");
  };

  const saveNewUser = (user: PanelUser) => {
    if ((user.role === "school_admin" || user.role === "teacher") && delegatedUsers.length >= MAX_SCHOOL_DELEGATED_ADMINS) {
      return setNotice(`Bir okul yöneticisi kendisi dışında en fazla ${MAX_SCHOOL_DELEGATED_ADMINS} kişiyi yetkilendirebilir.`);
    }
    if (state.users.some((item) => item.username.toLocaleLowerCase("tr-TR") === user.username.toLocaleLowerCase("tr-TR"))) return setNotice("Bu kullanıcı adı daha önce kullanılmış.");
    commit({ ...state, users: [...state.users, user] }, "Kullanıcı oluşturuldu.");
    setModal(null);
  };

  const saveEditedUser = (updated: PanelUser) => {
    const delegatedCount = delegatedUsers.filter((account) => account.id !== updated.id).length;
    if ((updated.role === "school_admin" || updated.role === "teacher") && delegatedCount >= MAX_SCHOOL_DELEGATED_ADMINS) {
      return setNotice(`Bir okul yöneticisi kendisi dışında en fazla ${MAX_SCHOOL_DELEGATED_ADMINS} kişiyi yetkilendirebilir.`);
    }
    if (state.users.some((item) => item.id !== updated.id && item.username.toLocaleLowerCase("tr-TR") === updated.username.toLocaleLowerCase("tr-TR"))) return setNotice("Bu kullanıcı adı başka bir kullanıcıya ait.");
    commit({ ...state, users: state.users.map((user) => user.id === updated.id ? updated : user) }, "Kullanıcı bilgileri güncellendi.");
    setEditingUserId("");
  };

  const toggleSchoolModule = (moduleId: string, enabled: boolean) => {
    if (!isSuperAdmin || !selectedSchool) return;
    const current = Array.isArray(selectedSchool.enabledModules) ? selectedSchool.enabledModules : allModuleIds();
    const enabledModules = enabled
      ? Array.from(new Set([...current, moduleId]))
      : current.filter((id) => id !== moduleId);
    commit({
      ...state,
      schools: state.schools.map((school) => school.id === selectedSchool.id ? { ...school, enabledModules } : school),
    }, "Okul modül erişimi güncellendi.");
  };

  const saveSuperAdmin = (user: PanelUser) => {
    if (!isSuperAdmin) return;
    if (superAdmins.length >= MAX_SUPER_ADMINS) {
      setNotice(`Sistemde en fazla ${MAX_SUPER_ADMINS} Süper Admin olabilir.`);
      return;
    }
    if (state.users.some((item) => item.username.toLocaleLowerCase("tr-TR") === user.username.toLocaleLowerCase("tr-TR"))) {
      setNotice("Bu kullanıcı adı daha önce kullanılmış.");
      return;
    }
    commit({ ...state, users: [...state.users, user] }, "Süper Admin oluşturuldu.");
    setModal(null);
  };

  const activateSchoolContext = () => {
    if (!isSuperAdmin || !selectedSchool) return;
    const next = { ...state, activeSchoolId: selectedSchool.id };
    commit(next, `${selectedSchool.name} çalışma alanı açılıyor.`);
    window.setTimeout(() => window.location.reload(), 220);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2 md:p-5">
      {notice && <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl"><Check className="h-4 w-4" />{notice}</div>}
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-sky-300"><ShieldCheck className="h-4 w-4" />Çok Okullu Yetki Merkezi</div><h2 className="text-2xl font-black md:text-3xl">Okullar, kullanıcılar ve erişim izinleri</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Kullanıcı bilgilerini ve şifrelerini düzenleyin; öğretmenlere alan bazında yetki verin.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs"><span className="text-slate-400">Aktif oturum</span><strong className="mt-1 block text-base">{currentUser.fullName}</strong><span className="text-sky-300">{roleLabel(currentUser.role)}</span></div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black"><Building2 className="h-4 w-4 text-indigo-600" />Okullar</h3>{isSuperAdmin && <button onClick={() => setModal("school")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white" title="Okul ekle"><Plus className="h-4 w-4" /></button>}</div>
            <div className="space-y-2">{visibleSchools.map((school) => <button key={school.id} onClick={() => { setSelectedSchoolId(school.id); setPermissionUserId(""); }} className={`w-full rounded-xl border p-3 text-left ${selectedSchoolId === school.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}><div className="flex items-center justify-between"><strong className="text-xs">{school.name}</strong><ChevronRight className="h-4 w-4 text-slate-400" /></div><div className="mt-1 text-[10px] text-slate-500">{school.code} · {school.city} · {school.status === "active" ? "Aktif" : "Pasif"}</div></button>)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm"><strong className="text-slate-800">Rol sınırları</strong><ul className="mt-2 space-y-2"><li>• Süper Admin tüm okulları ve modül lisanslarını yönetir.</li><li>• Sistemde en fazla 3 Süper Admin bulunur.</li><li>• Okul yöneticisi yalnız kendi okulunu görür.</li><li>• Okul yöneticisi kendisi dışında en fazla 3 yetkili yönetici atayabilir.</li><li>• Pasif kullanıcı giriş yapamaz.</li></ul></div>
        </aside>

        <main className="space-y-6">
          {isSuperAdmin && <SuperAdminSystemOperations />}

          {isSuperAdmin && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 p-5">
                <div>
                  <h3 className="font-black text-amber-950">Süper Adminler</h3>
                  <p className="mt-1 text-xs text-amber-700">Programın tüm okullarına erişebilen en fazla {MAX_SUPER_ADMINS} kullanıcı.</p>
                </div>
                <button
                  disabled={superAdmins.length >= MAX_SUPER_ADMINS}
                  onClick={() => setModal("superAdmin")}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white disabled:bg-slate-300"
                >
                  <Plus className="h-4 w-4" /> Süper Admin Ekle
                  <span className="rounded bg-white/20 px-1.5 py-.5">{superAdmins.length}/{MAX_SUPER_ADMINS}</span>
                </button>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-3">
                {superAdmins.map((admin) => (
                  <div key={admin.id} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                    <strong className="block text-sm text-slate-900">{admin.fullName}</strong>
                    <span className="mt-1 block text-[10px] text-slate-500">@{admin.username} · {admin.email}</span>
                    <span className="mt-3 inline-flex rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">TÜM OKULLAR</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h3 className="font-black">{selectedSchool?.name || "Okul seçin"} {isSuperAdmin && selectedSchool?.id === state.activeSchoolId ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-700">AKTİF OKUL</span> : null}</h3><p className="mt-1 text-xs text-slate-500">Kullanıcı bilgileri, şifreler ve kullanım izinleri</p></div><div className="flex flex-wrap gap-2">{isSuperAdmin && selectedSchool && selectedSchool.id !== state.activeSchoolId ? <button type="button" onClick={activateSchoolContext} className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-xs font-black text-cyan-800"><Building2 className="h-4 w-4" />Bu Okulun Sayfalarına Geç</button> : null}<button disabled={!selectedSchool || delegatedUsers.length >= MAX_SCHOOL_DELEGATED_ADMINS} onClick={() => setModal("user")} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:bg-slate-300"><Plus className="h-4 w-4" />Yetkili Ekle <span className="rounded bg-white/20 px-1.5 py-.5">{delegatedUsers.length}/{MAX_SCHOOL_DELEGATED_ADMINS}</span></button></div></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">Kullanıcı</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Giriş İzni</th><th className="px-5 py-3 text-right">İşlemler</th></tr></thead><tbody className="divide-y">{schoolUsers.map((user) => <tr key={user.id} className="hover:bg-slate-50"><td className="px-5 py-4"><strong className="block">{user.fullName}</strong><span className="text-slate-400">@{user.username} · {user.email}</span></td><td className="px-5 py-4"><span className="rounded-lg bg-sky-50 px-2 py-1 font-bold text-sky-700">{roleLabel(user.role)}</span></td><td className="px-5 py-4"><label className="inline-flex cursor-pointer items-center gap-2 font-bold"><input type="checkbox" checked={user.status === "active"} onChange={(event) => updateStatus(user.id, event.target.checked ? "active" : "passive")} className="h-4 w-4 accent-emerald-600" />{user.status === "active" ? "İzinli" : "Engelli"}</label></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setEditingUserId(user.id)} className="rounded-lg border border-slate-200 px-3 py-2 font-bold text-slate-700 hover:bg-slate-100"><Pencil className="mr-1 inline h-3.5 w-3.5" />Düzenle</button>{(user.role === "teacher" || user.role === "school_admin") && <button onClick={() => setPermissionUserId(user.id)} className="rounded-lg border border-indigo-200 px-3 py-2 font-bold text-indigo-700 hover:bg-indigo-50"><UserCog className="mr-1 inline h-4 w-4" />Yetkiler</button>}</div></td></tr>)}</tbody></table></div>
          </section>

          {isSuperAdmin && selectedSchool && (
            <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="border-b border-emerald-100 bg-emerald-50 p-5">
                <h3 className="font-black text-emerald-950">{selectedSchool.name} — Açık Modüller</h3>
                <p className="mt-1 text-xs text-emerald-700">Bu okul yalnızca Süper Admin tarafından açılan modülleri kullanabilir.</p>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {PERMISSION_MODULES.map((module) => {
                  const enabled = (Array.isArray(selectedSchool.enabledModules) ? selectedSchool.enabledModules : allModuleIds()).includes(module.id);
                  return (
                    <label key={module.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${enabled ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) => toggleSchoolModule(module.id, event.target.checked)}
                        className="mt-1 h-5 w-5 accent-emerald-600"
                      />
                      <span>
                        <strong className="block text-xs text-slate-900">{module.label}</strong>
                        <span className="mt-1 block text-[10px] leading-4 text-slate-500">{module.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {(permissionUser?.role === "teacher" || permissionUser?.role === "school_admin") && <PermissionMatrix user={permissionUser} onClose={() => setPermissionUserId("")} onChange={updatePermission} onColumnChange={updatePermissionColumn} />}
        </main>
      </div>

      {modal === "school" && <SchoolModal onClose={() => setModal(null)} onSave={(school) => { commit({ ...state, schools: [...state.schools, school] }, "Yeni okul eklendi."); setSelectedSchoolId(school.id); setModal(null); }} />}
      {modal === "superAdmin" && <SuperAdminModal onClose={() => setModal(null)} onSave={saveSuperAdmin} />}
      {modal === "user" && selectedSchool && <UserModal school={selectedSchool} principalExists={schoolUsers.some((user) => user.role === "principal")} onClose={() => setModal(null)} onSave={saveNewUser} />}
      {editingUser && selectedSchool && <UserModal school={selectedSchool} principalExists={schoolUsers.some((user) => user.role === "principal" && user.id !== editingUser.id)} user={editingUser} onClose={() => setEditingUserId("")} onSave={saveEditedUser} />}
    </div>
  );
}

function PermissionMatrix({ user, onClose, onChange, onColumnChange }: { user: PanelUser; onClose: () => void; onChange: (moduleId: string, action: keyof ModulePermission, checked: boolean) => void; onColumnChange: (action: keyof ModulePermission, checked: boolean) => void }) {
  return <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm"><div className="flex items-center justify-between bg-indigo-50 p-5"><div><h3 className="font-black">{user.fullName} — Yetki Matrisi</h3><p className="mt-1 text-xs text-slate-500">Yazma ve değiştirme, görme yetkisini otomatik açar.</p></div><button onClick={onClose}><X className="h-5 w-5" /></button></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="px-5 py-3 text-left">Yetki Alanı</th>{(["view", "create", "update"] as const).map((action) => <th key={action} className="px-4 py-3 text-center"><label className="flex justify-center gap-2"><input type="checkbox" onChange={(event) => onColumnChange(action, event.target.checked)} />{action === "view" ? "Görme" : action === "create" ? "Yazma" : "Değiştirme"}</label></th>)}</tr></thead><tbody className="divide-y">{PERMISSION_MODULES.map((module) => { const permission = user.permissions[module.id] || { view: false, create: false, update: false }; return <tr key={module.id}><td className="px-5 py-4"><strong className="block">{module.label}</strong><span className="text-[10px] text-slate-400">{module.description}</span></td>{(["view", "create", "update"] as const).map((action) => <td key={action} className="text-center"><input type="checkbox" checked={permission[action]} onChange={(event) => onChange(module.id, action, event.target.checked)} className="h-5 w-5 accent-indigo-600" /></td>)}</tr>; })}</tbody></table></div></section>;
}

function SchoolModal({ onClose, onSave }: { onClose: () => void; onSave: (school: SchoolAccount) => void }) {
  const [form, setForm] = useState({ name: "", code: "", city: "" });
  return <Modal title="Yeni Okul Ekle" onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ id: `school-${Date.now()}`, ...form, status: "active", enabledModules: allModuleIds() }); }} className="space-y-4"><Field label="Okul Adı" value={form.name} onChange={(name) => setForm({ ...form, name })} /><Field label="Okul Kodu" value={form.code} onChange={(code) => setForm({ ...form, code })} /><Field label="İl / İlçe" value={form.city} onChange={(city) => setForm({ ...form, city })} /><Submit /></form></Modal>;
}

function UserModal({ school, principalExists, user, onClose, onSave }: { school: SchoolAccount; principalExists: boolean; user?: PanelUser; onClose: () => void; onSave: (user: PanelUser) => void }) {
  const schoolUsername = toUsernamePart(school.name);
  const [usernameEdited, setUsernameEdited] = useState(Boolean(user));
  const [form, setForm] = useState({ fullName: user?.fullName || "", email: user?.email || "", username: user?.username || schoolUsername, role: user?.role || (principalExists ? "school_admin" : "principal"), status: user?.status || "active", password: "" });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const credential = form.password ? await createPasswordCredential(form.password) : { passwordHash: user?.passwordHash, passwordSalt: user?.passwordSalt };
    onSave({ id: user?.id || `user-${Date.now()}`, schoolId: school.id, fullName: form.fullName, email: form.email, username: form.username, role: form.role as PanelUser["role"], status: form.status as PanelUser["status"], permissions: user?.permissions || blankPermissions(), ...credential });
  };
  const updateFullName = (fullName: string) => {
    const username = usernameEdited ? form.username : `${schoolUsername}.${toUsernamePart(fullName)}`.replace(/\.$/, "");
    setForm({ ...form, fullName, username });
  };
  return <Modal title={user ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı Ekle"} onClose={onClose}><form onSubmit={submit} className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Bağlı Okul</span><strong className="mt-1 block text-sm text-emerald-950">{school.name}</strong><span className="text-[10px] text-emerald-700">Okul Kodu: {school.code}</span></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Adı Soyadı" value={form.fullName} onChange={updateFullName} /><Field label="E-posta" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><Field label="Kullanıcı Adı (okul adıyla)" value={form.username} onChange={(username) => { setUsernameEdited(true); setForm({ ...form, username: toUsernamePart(username) }); }} /><Field label={user ? "Yeni Şifre (isteğe bağlı)" : "İlk Giriş Şifresi"} type="password" required={!user} minLength={6} value={form.password} onChange={(password) => setForm({ ...form, password })} /></div><p className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">Kullanıcı adı okul adını içerir. Örnek: <strong>{schoolUsername}.adsoyad</strong></p><label className="block text-xs font-bold">Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as PanelUser["role"] })} className="mt-1.5 w-full rounded-xl border p-3"><option value="school_admin">Yetkili Yönetici</option><option value="teacher">Yetkili Öğretmen</option>{(!principalExists || user?.role === "principal") && <option value="principal">Okul Yöneticisi</option>}</select></label><label className="block text-xs font-bold">Giriş İzni<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PanelUser["status"] })} className="mt-1.5 w-full rounded-xl border p-3"><option value="active">Aktif</option><option value="passive">Pasif</option></select></label><Submit /></form></Modal>;
}

function SuperAdminModal({ onClose, onSave }: { onClose: () => void; onSave: (user: PanelUser) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", username: "", password: "" });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const credential = await createPasswordCredential(form.password);
    onSave({
      id: `super-admin-${Date.now()}`,
      schoolId: null,
      fullName: form.fullName,
      email: form.email,
      username: toUsernamePart(form.username || form.fullName),
      role: "super_admin",
      status: "active",
      permissions: blankPermissions(),
      ...credential,
    });
  };
  return (
    <Modal title="Süper Admin Ekle" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold text-amber-800">
          Süper Admin tüm okulları, okul yöneticilerini, modül erişimlerini ve ortak sınav ağını yönetebilir.
        </div>
        <Field label="Adı Soyadı" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
        <Field label="E-posta" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Field label="Kullanıcı Adı" value={form.username} onChange={(username) => setForm({ ...form, username })} />
        <Field label="İlk Giriş Şifresi" type="password" minLength={8} value={form.password} onChange={(password) => setForm({ ...form, password })} />
        <Submit />
      </form>
    </Modal>
  );
}

function toUsernamePart(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "")
    .replace(/^\.+|\.+$/g, "");
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><h3 className="text-lg font-black">{title}</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div>{children}</div></div>; }
function Field({ label, value, onChange, type = "text", required = true, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number }) { return <label className="block text-xs font-bold">{label}<input required={required} minLength={minLength} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-400" /></label>; }
function Submit() { return <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-xs font-bold text-white"><Save className="h-4 w-4" />Kaydet</button>; }
