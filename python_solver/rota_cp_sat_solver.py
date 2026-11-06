#!/usr/bin/env python3
"""ROTA school timetable CP-SAT service.

Reads one JSON payload from stdin and writes one JSON result to stdout.
Designed to be started by the Node/Express process for each solve request.
"""
from __future__ import annotations

import json
import math
import os
import sys
import traceback
import time
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Tuple

try:
    from ortools.sat.python import cp_model
except Exception as exc:  # pragma: no cover
    print(json.dumps({
        "success": False,
        "error": "OR-Tools Python paketi kurulu değil.",
        "details": str(exc),
        "installCommand": "python -m pip install -r python_solver/requirements.txt",
    }, ensure_ascii=False))
    sys.exit(0)

DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]
HOURS = list(range(1, 9))
EMPTY_TEACHERS = {"", "Öğretmen Atanmadı", "Belirtilmedi", "undefined", "null"}


def norm(value: Any) -> str:
    return " ".join(str(value or "").strip().upper().replace("İ", "I").replace("ı", "I").split())


def as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def course_name(course: Dict[str, Any]) -> str:
    return str(course.get("courseName") or course.get("name") or course.get("subject") or "Ders")


def is_guidance_course(course: Dict[str, Any]) -> bool:
    return norm(course_name(course)) in {"REHBERLIK", "REHBERLIK VE YONLENDIRME"}


def weekly_hours(course: Dict[str, Any]) -> int:
    value = course.get("weeklyHours")
    if isinstance(value, (int, float)):
        return max(0, int(value))
    schedule = str(course.get("schedule") or "")
    digits = "".join(ch if ch.isdigit() else " " for ch in schedule).split()
    return int(digits[0]) if digits else 0


def course_identity_aliases(course: Dict[str, Any], class_id: str) -> List[str]:
    """Return canonical identity first and a legacy-compatible fallback.

    IDs win when present. The fallback keeps old schedules readable while
    teacher identity prevents equal-name lessons owned by different teachers
    from consuming each other's weekly-hour count.
    """
    group_key = "+".join(sorted(groups(course))) or "GENEL"
    split_key = norm(course.get("splitGroupId")) or "-"
    teacher_keys = []
    for id_key, name_key in (("teacherId", "teacherName"), ("teacherId2", "teacherName2")):
        teacher_id = str(course.get(id_key) or "").strip()
        teacher_keys.append(f"ID:{teacher_id}" if teacher_id else f"NAME:{norm(course.get(name_key))}")
    teacher_key = "+".join(sorted(value for value in teacher_keys if value not in {"NAME:", "ID:"})) or "TEACHERLESS"
    legacy = "::".join([
        norm(class_id),
        norm(course_name(course)),
        str(weekly_hours(course)),
        group_key,
        split_key,
        teacher_key,
    ])
    compatibility = "::".join([
        norm(class_id),
        norm(course_name(course)),
        group_key,
        split_key,
        teacher_key,
    ])
    course_id = str(course.get("courseId") or course.get("id") or course.get("code") or "").strip()
    if not course_id:
        return [legacy, compatibility]
    canonical = "::".join([norm(class_id), f"COURSE:{course_id}", group_key, split_key, teacher_key])
    return [canonical, legacy, compatibility]



def split_course_into_blocks(total_hours: int, special_english: bool) -> List[int]:
    """Split weekly hours into lesson blocks.

    Tüm normal dersler 2+2+...+(gerekirse 1) biçiminde bölünür. Tek istisna,
    haftada 12 saat olan S. İngilizce dersinin 4+4+4 bloklarıdır.
    """
    if total_hours <= 0:
        return []

    if special_english and total_hours == 12:
        return [4, 4, 4]

    result: List[int] = []
    remaining = total_hours
    while remaining > 0:
        duration = 2 if remaining >= 2 else 1
        result.append(duration)
        remaining -= duration
    return result

def teacher_names(course: Dict[str, Any]) -> List[str]:
    result: List[str] = []
    for key in ("teacherName", "teacherName2"):
        value = str(course.get(key) or "").strip()
        if value and value not in EMPTY_TEACHERS:
            result.append(value)
    return result


def teacher_ids(course: Dict[str, Any], teacher_id_by_name: Dict[str, str]) -> List[str]:
    result: List[str] = []
    for id_key, name_key in (("teacherId", "teacherName"), ("teacherId2", "teacherName2")):
        teacher_id = str(course.get(id_key) or "").strip()
        if not teacher_id:
            teacher_id = teacher_id_by_name.get(norm(course.get(name_key)), "")
        if teacher_id and teacher_id not in result:
            result.append(teacher_id)
    return result


def course_belongs_to_teacher(course: Dict[str, Any], teacher_id: str,
                              teachers_by_id: Dict[str, Dict[str, Any]]) -> bool:
    direct_ids = {str(course.get("teacherId") or ""), str(course.get("teacherId2") or "")}
    if teacher_id in direct_ids:
        return True
    selected_name = norm((teachers_by_id.get(teacher_id) or {}).get("name"))
    return bool(selected_name) and selected_name in {
        norm(course.get("teacherName")),
        norm(course.get("teacherName2")),
    }


def compulsory_like(course: Dict[str, Any]) -> bool:
    kind = norm(course.get("type") or course.get("courseType"))
    return "ZORUNLU" in kind or "COMPULSORY" in kind or not str(course.get("groupName") or "").strip()


def groups(course: Dict[str, Any]) -> set[str]:
    raw = str(course.get("groupName") or "")
    for sep in [",", "/", "+"]:
        raw = raw.replace(sep, " ")
    return {norm(part) for part in raw.split() if norm(part)}


def group_overlaps(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    ga, gb = groups(a), groups(b)
    # Explicit group membership takes precedence over the legacy course type.
    # Some catalog records mark SAY/EA lessons as "compulsory" even though they
    # are parallel tracks. Distinct explicit groups may share the same class
    # period; an ungrouped lesson conflicts with every group.
    if ga and gb:
        return bool(ga & gb)
    return True


def make_blocks(classrooms: List[Dict[str, Any]], current: Dict[str, Any], scope: str,
                selected_id: str | None, view_type: str | None,
                teachers_by_id: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    target_ids: set[str] = set()
    if scope == "local" and selected_id and view_type == "class":
        target_ids.add(selected_id)
    elif scope == "local" and selected_id and view_type == "teacher":
        for cls in classrooms:
            for course in cls.get("assignedCourses") or []:
                if course_belongs_to_teacher(course, str(selected_id), teachers_by_id):
                    target_ids.add(str(cls.get("id")))
    else:
        target_ids = {str(cls.get("id")) for cls in classrooms}

    placed_counts: Dict[str, int] = defaultdict(int)
    for key, raw in current.items():
        if not key.startswith("class_"):
            continue
        parts = key.split("_")
        if len(parts) < 4:
            continue
        class_id = parts[1]
        for item in as_list(raw):
            if not isinstance(item, dict):
                continue
            for identity in course_identity_aliases(item, class_id):
                placed_counts[identity] += 1

    blocks: List[Dict[str, Any]] = []
    compulsory_common: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for cls in classrooms:
        class_id = str(cls.get("id"))
        if class_id not in target_ids:
            continue
        class_name = str(cls.get("name") or class_id)
        seen_course_identities: set[str] = set()
        for course in cls.get("assignedCourses") or []:
            course = dict(course)
            if (
                scope == "local"
                and selected_id
                and view_type == "teacher"
                and not course_belongs_to_teacher(course, str(selected_id), teachers_by_id)
            ):
                continue
            for id_key, name_key in (("teacherId", "teacherName"), ("teacherId2", "teacherName2")):
                if not str(course.get(name_key) or "").strip() and course.get(id_key) is not None:
                    teacher = teachers_by_id.get(str(course.get(id_key)))
                    if teacher:
                        course[name_key] = teacher.get("name") or ""
            total = weekly_hours(course)
            identities = course_identity_aliases(course, class_id)
            # Legacy veride aynı ders sınıfa birden fazla kez yazılmış olabilir.
            # Aynı kanonik kayıt solver'a iki kez girerse 2 saatlik ders 4 saat
            # gibi görünür ve iki ayrı blok çifti üretilir.
            # courseId bazı eski kayıtların her kopyasında yeniden üretildiği
            # için tekilleştirme anahtarına dahil edilmez. Legacy kimlik (index
            # 1), ders adı/saat/grup/öğretmen bileşenlerini korur ve aynı dersin
            # farklı id'li kopyalarının 2+2 olarak iki kez üretilmesini önler.
            course_key = identities[1] if len(identities) > 1 else identities[0]
            if course_key in seen_course_identities:
                continue
            seen_course_identities.add(course_key)
            is_compulsory = norm(course.get("type") or course.get("courseType")) in {"ZORUNLU DERS", "COMPULSORY", "ZORUNLU"}
            common_key = (norm(class_name), norm(course_name(course)), norm(course.get("teacherId") or course.get("teacherName")))
            if is_compulsory and common_key in compulsory_common:
                for existing_block in compulsory_common[common_key]:
                    existing_block.setdefault("linkedClasses", []).append((class_id, class_name))
                continue
            already_placed = max((placed_counts.get(identity, 0) for identity in identities), default=0)
            remaining = max(0, total - already_placed)
            special_english = (
                "SECMELI INGILIZCE" in norm(course_name(course))
                or "S. INGILIZCE" in norm(course_name(course))
            )
            durations = split_course_into_blocks(remaining, special_english)
            for index, duration in enumerate(durations):
                blocks.append({
                    "id": f"{identities[0]}::BLOCK:{index}",
                    "courseIdentity": identities[0],
                    "classId": class_id,
                    "className": class_name,
                    "course": course,
                    "duration": duration,
                    "linkedClasses": [],
                })
            if is_compulsory:
                compulsory_common[common_key] = [block for block in blocks if block["courseIdentity"] == identities[0]]
    return blocks


def preserved_schedule(current: Dict[str, Any], scope: str, selected_id: str | None,
                       view_type: str | None,
                       teachers_by_id: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, raw in current.items():
        if key.startswith("blocked_") or key.startswith("locked_"):
            result[key] = raw
            continue
        if not (key.startswith("class_") or key.startswith("teacher_")):
            result[key] = raw
            continue
        kept = []
        for item in as_list(raw):
            if not isinstance(item, dict):
                continue
            if item.get("isManual") or item.get("isLocked"):
                kept.append(item)
                continue
            if scope == "local" and selected_id and view_type:
                if view_type == "class":
                    belongs = key.startswith(f"class_{selected_id}_") or str(item.get("classId") or "") == str(selected_id)
                else:
                    belongs = (
                        key.startswith(f"teacher_{selected_id}_")
                        or course_belongs_to_teacher(item, str(selected_id), teachers_by_id)
                    )
                if not belongs:
                    kept.append(item)
        if kept:
            result[key] = kept
    return result


def solve(payload: Dict[str, Any]) -> Dict[str, Any]:
    started = time.time()
    if payload.get("healthCheck"):
        return {
            "success": True,
            "status": "READY",
            "details": "Google OR-Tools CP-SAT servisi hazır.",
            "ortoolsVersion": getattr(sys.modules.get("ortools"), "__version__", "unknown"),
            "durationMs": int((time.time() - started) * 1000),
        }
    config = payload.get("config") or {}
    classrooms = payload.get("classrooms") or []
    teachers = payload.get("teachers") or []
    current = payload.get("currentSchedule") or {}
    unwanted_days = payload.get("unwantedTeacherDays") or {}
    settings = payload.get("settings") or {}

    scope = str(config.get("scope") or "global")
    selected_id = config.get("selectedId")
    view_type = config.get("viewType")
    time_limit = float(config.get("timeLimitSeconds") or settings.get("timeLimitSeconds") or 120)
    workers = int(config.get("numWorkers") or max(1, min(8, (os.cpu_count() or 4) - 1)))
    seed = int(config.get("seed") or settings.get("seed") or 20260717)

    teachers_by_id = {str(t.get("id")): t for t in teachers}
    teacher_id_by_name = {norm(t.get("name")): str(t.get("id")) for t in teachers}
    base = preserved_schedule(current, scope, selected_id, view_type, teachers_by_id)
    blocks = make_blocks(classrooms, base, scope, selected_id, view_type, teachers_by_id)

    if not blocks:
        return {
            "success": True,
            "status": "NO_BLOCKS",
            "schedule": base,
            "unplacedBlocks": [],
            "initialPenalty": 0,
            "finalPenalty": 0,
            "durationMs": int((time.time() - started) * 1000),
            "details": "Yerleştirilecek ders bloğu bulunamadı.",
            "statistics": {"blocks": 0, "placed": 0, "unplaced": 0},
        }

    model = cp_model.CpModel()
    candidates: Dict[int, List[Tuple[str, int]]] = {}
    x: Dict[Tuple[int, str, int], Any] = {}
    placed_vars: Dict[int, Any] = {}
    infeasibility_hints: List[Dict[str, Any]] = []

    class_slot_existing: Dict[Tuple[str, str, int], List[Dict[str, Any]]] = defaultdict(list)
    teacher_slot_existing: Dict[Tuple[str, str, int], List[Dict[str, Any]]] = defaultdict(list)
    for key, raw in base.items():
        parts = key.split("_")
        if len(parts) < 4:
            continue
        day, hour_s = parts[-2], parts[-1]
        if day not in DAYS or not hour_s.isdigit():
            continue
        hour = int(hour_s)
        if key.startswith("class_"):
            class_id = "_".join(parts[1:-2])
            class_slot_existing[(class_id, day, hour)].extend([i for i in as_list(raw) if isinstance(i, dict)])
        elif key.startswith("teacher_"):
            teacher_id = "_".join(parts[1:-2])
            teacher_slot_existing[(teacher_id, day, hour)].extend([i for i in as_list(raw) if isinstance(i, dict)])

    # Preserved manual/locked lessons participate in the same day policies as
    # generated lessons.  Without this index a local re-distribution could add
    # a second block of the same course (or another course of the same teacher)
    # onto a day that was already fixed by the user.
    fixed_course_days: Dict[Tuple[str, str, str], int] = defaultdict(int)
    fixed_teacher_course_days: Dict[Tuple[str, str, str], set[str]] = defaultdict(set)
    for (class_id, day, _hour), items in class_slot_existing.items():
        for item in items:
            identities = course_identity_aliases(item, class_id)
            for identity in identities:
                fixed_course_days[(class_id, identity, day)] += 1
            for teacher_id in teacher_ids(item, teacher_id_by_name):
                if not is_guidance_course(item):
                    fixed_teacher_course_days[(class_id, teacher_id, day)].update(identities)

    for bi, block in enumerate(blocks):
        legal: List[Tuple[str, int]] = []
        reasons = defaultdict(int)
        course = block["course"]
        class_id = block["classId"]
        duration = block["duration"]
        tids = teacher_ids(course, teacher_id_by_name)
        for day in DAYS:
            for start in range(1, 9 - duration + 1):
                valid = True
                for offset in range(duration):
                    hour = start + offset
                    # Kilitli gerçek ders class_slot_existing içinde zaten
                    # çakışma üretir. Boş hücreden kalmış legacy locked_* bayrağı
                    # kullanılabilir bir saati tek başına kapatmamalıdır.
                    if base.get(f"blocked_class_{class_id}_{day}_{hour}"):
                        reasons["Sınıf kapalı veya kilitli"] += 1
                        valid = False
                        break
                    existing = class_slot_existing.get((class_id, day, hour), [])
                    if any(group_overlaps(course, item) for item in existing):
                        reasons["Sınıfta çakışan sabit ders var"] += 1
                        valid = False
                        break
                    for teacher_id in tids:
                        if base.get(f"blocked_teacher_{teacher_id}_{day}_{hour}"):
                            reasons["Öğretmen kapalı veya kilitli"] += 1
                            valid = False
                            break
                        if teacher_slot_existing.get((teacher_id, day, hour)):
                            reasons["Öğretmenin sabit dersi var"] += 1
                            valid = False
                            break
                        if settings.get("unwantedTeacherDayHard") and day in (unwanted_days.get(teacher_id) or []):
                            reasons["Öğretmenin istenmeyen günü"] += 1
                            valid = False
                            break
                    if not valid:
                        break
                if valid:
                    legal.append((day, start))
        candidates[bi] = legal
        placed = model.new_bool_var(f"placed_{bi}")
        placed_vars[bi] = placed
        slot_vars = []
        for day, start in legal:
            var = model.new_bool_var(f"x_{bi}_{DAYS.index(day)}_{start}")
            x[(bi, day, start)] = var
            slot_vars.append(var)
        if slot_vars:
            model.add(sum(slot_vars) == placed)
        else:
            model.add(placed == 0)
            infeasibility_hints.append({
                "code": "no_legal_start",
                "className": block["className"],
                "courseName": course_name(course),
                "teacherNames": teacher_names(course),
                "duration": duration,
                "summary": "Bu blok için yasal başlangıç slotu yok.",
                "reasons": [f"{name}: {count}" for name, count in sorted(reasons.items(), key=lambda kv: -kv[1])[:5]],
            })

    # Conservative capacity preflight. These checks never reject a solution;
    # they explain impossible-looking inputs before and after the search.
    capacity_diagnostics: List[Dict[str, Any]] = []
    class_blocks_for_capacity: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    teacher_required_hours: Dict[str, int] = defaultdict(int)
    for block in blocks:
        class_blocks_for_capacity[block["classId"]].append(block)
        for teacher_id in teacher_ids(block["course"], teacher_id_by_name):
            teacher_required_hours[teacher_id] += int(block["duration"])

    classroom_by_id = {str(cls.get("id")): cls for cls in classrooms}
    for class_id, scoped_blocks in class_blocks_for_capacity.items():
        common_hours = 0
        grouped_hours: Dict[str, int] = defaultdict(int)
        for block in scoped_blocks:
            target_groups = groups(block["course"])
            if not target_groups:
                common_hours += int(block["duration"])
            else:
                for group_name in target_groups:
                    grouped_hours[group_name] += int(block["duration"])
        required_capacity = common_hours + max(grouped_hours.values(), default=0)
        available_capacity = sum(
            1
            for day in DAYS
            for hour in HOURS
            if not base.get(f"blocked_class_{class_id}_{day}_{hour}")
            and not class_slot_existing.get((class_id, day, hour))
        )
        if required_capacity > available_capacity:
            classroom = classroom_by_id.get(class_id) or {}
            capacity_diagnostics.append({
                "code": "class_capacity_shortage",
                "className": str(classroom.get("name") or class_id),
                "requiredHours": required_capacity,
                "availableHours": available_capacity,
                "shortageHours": required_capacity - available_capacity,
                "summary": f"Sınıfın {required_capacity} saatlik ihtiyacına karşı {available_capacity} açık saat var.",
            })

    for teacher_id, required_capacity in teacher_required_hours.items():
        available_capacity = sum(
            1
            for day in DAYS
            for hour in HOURS
            if not base.get(f"blocked_teacher_{teacher_id}_{day}_{hour}")
            and not teacher_slot_existing.get((teacher_id, day, hour))
            and not (settings.get("unwantedTeacherDayHard") and day in (unwanted_days.get(teacher_id) or []))
        )
        if required_capacity > available_capacity:
            teacher = teachers_by_id.get(teacher_id) or {}
            capacity_diagnostics.append({
                "code": "teacher_capacity_shortage",
                "teacherName": str(teacher.get("name") or teacher_id),
                "requiredHours": required_capacity,
                "availableHours": available_capacity,
                "shortageHours": required_capacity - available_capacity,
                "summary": f"Öğretmenin {required_capacity} saatlik dersine karşı {available_capacity} uygun saati var.",
            })

    preflight_report = {
        "valid": not capacity_diagnostics and not infeasibility_hints,
        "totalBlocks": len(blocks),
        "totalHours": sum(int(block["duration"]) for block in blocks),
        "zeroDomainBlocks": len(infeasibility_hints),
        "capacityIssues": capacity_diagnostics,
    }

    # Class/group conflict constraints.
    for cls in classrooms:
        class_id = str(cls.get("id"))
        class_blocks = [i for i, b in enumerate(blocks) if b["classId"] == class_id]
        for day in DAYS:
            for hour in HOURS:
                occupying: List[Tuple[int, Any]] = []
                for bi in class_blocks:
                    block = blocks[bi]
                    for cand_day, start in candidates[bi]:
                        if cand_day == day and start <= hour < start + block["duration"]:
                            occupying.append((bi, x[(bi, cand_day, start)]))
                # Pairwise to allow non-overlapping elective groups in the same class.
                for idx in range(len(occupying)):
                    bi, vi = occupying[idx]
                    for jdx in range(idx + 1, len(occupying)):
                        bj, vj = occupying[jdx]
                        if group_overlaps(blocks[bi]["course"], blocks[bj]["course"]):
                            model.add(vi + vj <= 1)

    # Teacher no-overlap.
    teacher_occupancy: Dict[Tuple[str, str, int], List[Any]] = defaultdict(list)
    for bi, block in enumerate(blocks):
        for teacher_id in teacher_ids(block["course"], teacher_id_by_name):
            for day, start in candidates[bi]:
                var = x[(bi, day, start)]
                for hour in range(start, start + block["duration"]):
                    teacher_occupancy[(teacher_id, day, hour)].append(var)
    for vars_list in teacher_occupancy.values():
        if len(vars_list) > 1:
            model.add(sum(vars_list) <= 1)

    # Büyük okul verisinde kalite değişkenlerini daha ilk yerleşim aşamasında
    # kurmak, CP-SAT'ın bütün süreyi presolve'da tüketmesine neden oluyordu.
    # Bu eşikten sonra model yalnızca zorunlu çakışmazlıkları ve tam kapsama
    # hedefini içerir. Öncelik her zaman bütün dersleri yerleştirmektir; estetik
    # iyileştirmeler eksik program üretme pahasına çalıştırılmaz.
    large_model_threshold = max(1, int(config.get("largeModelThreshold") or 240))
    coverage_only = len(blocks) >= large_model_threshold

    # Teacher workload and compactness.  Occupancy variables include preserved
    # manual/locked lessons, so optimization never improves the generated part
    # by silently ignoring the teacher's existing timetable.
    teacher_gap_vars: List[Any] = []
    teacher_day_used_vars: List[Any] = []
    limit_penalty_terms: List[Any] = []
    teacher_daily_excess_vars: List[Any] = []
    teacher_consecutive_excess_vars: List[Any] = []
    course_daily_excess_vars: List[Any] = []
    class_daily_excess_vars: List[Any] = []
    max_teacher_daily = max(1, min(8, int(settings.get("maxTeacherDailyHours") or 8)))
    max_teacher_consecutive = max(1, min(8, int(settings.get("maxTeacherConsecutiveHours") or 6)))
    # Karnıyarık (öğretmenin aynı gün içindeki ders arası boşluğu) ana kalite
    # hedefidir. CP-SAT'ın sınıf dengeleme terimleri binler mertebesinde olduğu
    # için kullanıcı cezasını aynı ölçeğe taşıyoruz.
    teacher_gap_weight = max(0, int(settings.get("teacherGapPenalty") or 30)) * 250
    teacher_hour_occupied: Dict[Tuple[str, str, int], Any] = {}

    for teacher in ([] if coverage_only else teachers):
        teacher_id = str(teacher.get("id"))
        for day in DAYS:
            occupied_for_day = []
            fixed_daily = 0
            for hour in HOURS:
                generated = teacher_occupancy.get((teacher_id, day, hour), [])
                fixed = bool(teacher_slot_existing.get((teacher_id, day, hour)))
                fixed_daily += int(fixed)
                occupied = model.new_bool_var(f"teacher_occupied_{teacher_id}_{DAYS.index(day)}_{hour}")
                if fixed:
                    model.add(occupied == 1)
                elif generated:
                    model.add_max_equality(occupied, generated)
                else:
                    model.add(occupied == 0)
                teacher_hour_occupied[(teacher_id, day, hour)] = occupied
                occupied_for_day.append(occupied)

            # Günlük yük bir kalite hedefidir. Çakışma değildir; bu sınırı hard
            # yapmak, kullanıcının elle yerleştirebildiği bir dersi otomatik
            # çözümün dışarıda bırakmasına neden oluyordu.
            effective_daily_limit = max(max_teacher_daily, fixed_daily)
            daily_excess = model.new_int_var(0, 8, f"teacher_daily_excess_{teacher_id}_{DAYS.index(day)}")
            model.add(daily_excess >= sum(occupied_for_day) - effective_daily_limit)
            teacher_daily_excess_vars.append(daily_excess)
            limit_penalty_terms.append(-50000 * daily_excess)

            if max_teacher_consecutive < 8:
                window_size = max_teacher_consecutive + 1
                for start_index in range(0, 8 - window_size + 1):
                    window = occupied_for_day[start_index:start_index + window_size]
                    fixed_in_window = sum(
                        1 for hour in range(start_index + 1, start_index + window_size + 1)
                        if teacher_slot_existing.get((teacher_id, day, hour))
                    )
                    if fixed_in_window <= max_teacher_consecutive:
                        consecutive_excess = model.new_int_var(
                            0,
                            window_size,
                            f"teacher_consecutive_excess_{teacher_id}_{DAYS.index(day)}_{start_index}",
                        )
                        model.add(consecutive_excess >= sum(window) - max_teacher_consecutive)
                        teacher_consecutive_excess_vars.append(consecutive_excess)
                        limit_penalty_terms.append(-30000 * consecutive_excess)

            day_used = model.new_bool_var(f"teacher_day_used_{teacher_id}_{DAYS.index(day)}")
            model.add_max_equality(day_used, occupied_for_day)
            teacher_day_used_vars.append(day_used)

            # An empty period is a gap iff there is at least one lesson both
            # before and after it. This also counts every hour of multi-hour gaps.
            for hour_index in range(1, 7):
                before = model.new_bool_var(f"teacher_before_{teacher_id}_{DAYS.index(day)}_{hour_index + 1}")
                after = model.new_bool_var(f"teacher_after_{teacher_id}_{DAYS.index(day)}_{hour_index + 1}")
                model.add_max_equality(before, occupied_for_day[:hour_index])
                model.add_max_equality(after, occupied_for_day[hour_index + 1:])
                gap = model.new_bool_var(f"teacher_gap_{teacher_id}_{DAYS.index(day)}_{hour_index + 1}")
                current_hour = occupied_for_day[hour_index]
                model.add(gap <= before)
                model.add(gap <= after)
                model.add(gap + current_hour <= 1)
                model.add(gap >= before + after - current_hour - 1)
                teacher_gap_vars.append(gap)

        # Boş günü çözücü seçmez. Boş gün isteniyorsa yönetici öğretmenin o
        # günkü hücrelerini kapatır; aday üretimi bu hücreleri zaten dışlar.

    # Mandatory course-day policy. These are hard constraints, deliberately
    # independent of configurable quality settings: every normal course uses
    # at most one 2-hour (or final 1-hour) block per day; only the 12-hour
    # S. İngilizce course may use one 4-hour block per day.
    course_groups: Dict[Tuple[str, str], List[int]] = defaultdict(list)
    for bi, block in enumerate(blocks):
        course_groups[(block["classId"], block["courseIdentity"])].append(bi)

    course_day_vars: Dict[Tuple[str, str, str], List[Any]] = {}
    for (class_id, course_identity), block_ids in course_groups.items():
        exemplar = blocks[block_ids[0]]["course"]
        special_english = (
            ("SECMELI INGILIZCE" in norm(course_name(exemplar)) or "S. INGILIZCE" in norm(course_name(exemplar)))
            and weekly_hours(exemplar) == 12
        )
        max_daily = 4 if special_english else 2
        for day in DAYS:
            block_terms: List[Any] = []
            hour_terms: List[Any] = []
            for bi in block_ids:
                duration = blocks[bi]["duration"]
                for cand_day, start in candidates[bi]:
                    if cand_day == day:
                        variable = x[(bi, cand_day, start)]
                        block_terms.append(variable)
                        hour_terms.append(duration * variable)
            course_day_vars[(class_id, course_identity, day)] = block_terms
            fixed_hours = fixed_course_days.get((class_id, course_identity, day), 0)
            # Existing records may carry a legacy-compatible identity, so an
            # alias match is checked below before allowing a new block.
            has_fixed_block = any(
                fixed_course_days.get((class_id, alias, day), 0) > 0
                for alias in course_identity_aliases(exemplar, class_id)
            )
            if block_terms:
                model.add(sum(block_terms) <= (0 if has_fixed_block else 1))
                model.add(sum(hour_terms) + fixed_hours <= max_daily)

    # A teacher who teaches two distinct courses in one class must teach them
    # on different days.  This is also hard, and applies to each co-teacher.
    teacher_class_course_groups: Dict[Tuple[str, str], List[str]] = defaultdict(list)
    for (class_id, course_identity), block_ids in course_groups.items():
        if is_guidance_course(blocks[block_ids[0]]["course"]):
            continue
        for teacher_id in teacher_ids(blocks[block_ids[0]]["course"], teacher_id_by_name):
            teacher_class_course_groups[(class_id, teacher_id)].append(course_identity)

    for (class_id, teacher_id), identities in teacher_class_course_groups.items():
        unique_identities = sorted(set(identities))
        for day in DAYS:
            for identity in unique_identities:
                vars_for_course = course_day_vars.get((class_id, identity, day), [])
                fixed_other_course = any(
                    existing_identity != identity
                    for existing_identity in fixed_teacher_course_days.get((class_id, teacher_id, day), set())
                )
                if fixed_other_course and vars_for_course:
                    model.add(sum(vars_for_course) == 0)
            for left_index, left_identity in enumerate(unique_identities):
                left_vars = course_day_vars.get((class_id, left_identity, day), [])
                if not left_vars:
                    continue
                for right_identity in unique_identities[left_index + 1:]:
                    right_vars = course_day_vars.get((class_id, right_identity, day), [])
                    if right_vars:
                        model.add(sum(left_vars) + sum(right_vars) <= 1)

    # Class-day load balancing.
    #
    # The previous objective rewarded placement and early hours but did not care
    # how many weekdays were used. CP-SAT could therefore produce a technically
    # valid schedule concentrated on only a few days. The variables below model
    # each class's daily lesson load and add both a sensible hard ceiling and
    # strong soft balancing terms.
    balance_objective_terms = []
    class_day_load_vars: Dict[Tuple[str, str], Any] = {}
    class_day_used_vars: Dict[Tuple[str, str], Any] = {}
    class_day_fixed_loads: Dict[Tuple[str, str], int] = defaultdict(int)

    for (class_id, day, _hour), items in class_slot_existing.items():
        if items:
            class_day_fixed_loads[(class_id, day)] += 1

    blocks_by_class: Dict[str, List[int]] = defaultdict(list)
    for bi, block in enumerate(blocks):
        blocks_by_class[block["classId"]].append(bi)
    class_hour_occupied: Dict[Tuple[str, str, int], Any] = {}

    daily_tolerance = max(1, int(settings.get("dailyLoadTolerance") or 2))
    balance_weight = max(1, int(settings.get("classDailyBalanceWeight") or 2500))
    used_day_reward = max(1, int(settings.get("usedDayReward") or 6000))
    spread_weight = max(1, int(settings.get("classDaySpreadWeight") or 3500))

    for cls in ([] if coverage_only else classrooms):
        class_id = str(cls.get("id"))
        block_ids = blocks_by_class.get(class_id, [])
        if not block_ids and not any(class_day_fixed_loads.get((class_id, day), 0) for day in DAYS):
            continue

        # Parallel group lessons (for example SAY and EA) share the same class
        # period. Count the longest group path once instead of adding every
        # group's hours as if they occurred sequentially.
        common_hours = 0
        grouped_hours: Dict[str, int] = defaultdict(int)
        for bi in block_ids:
            group_name = norm(blocks[bi]["course"].get("groupName"))
            if group_name:
                grouped_hours[group_name] += blocks[bi]["duration"]
            else:
                common_hours += blocks[bi]["duration"]
        total_class_hours = common_hours + max(grouped_hours.values(), default=0) + sum(
            class_day_fixed_loads.get((class_id, day), 0) for day in DAYS
        )
        target_daily = max(0, int(round(total_class_hours / max(1, len(DAYS)))))
        calculated_cap = int(math.ceil(total_class_hours / max(1, len(DAYS)))) + daily_tolerance
        fixed_peak = max(class_day_fixed_loads.get((class_id, day), 0) for day in DAYS)
        # Never make an already preserved manual/locked day infeasible.
        hard_daily_cap = min(8, max(1, calculated_cap, fixed_peak))

        daily_vars = []
        for day in DAYS:
            occupied_for_day = []
            for hour in HOURS:
                covering = []
                for bi in block_ids:
                    for cand_day, start in candidates[bi]:
                        if cand_day == day and start <= hour < start + blocks[bi]["duration"]:
                            covering.append(x[(bi, cand_day, start)])
                occupied = model.new_bool_var(f"class_occupied_{class_id}_{DAYS.index(day)}_{hour}")
                if class_slot_existing.get((class_id, day, hour)):
                    model.add(occupied == 1)
                elif covering:
                    model.add_max_equality(occupied, covering)
                else:
                    model.add(occupied == 0)
                class_hour_occupied[(class_id, day, hour)] = occupied
                occupied_for_day.append(occupied)

            load_var = model.new_int_var(0, 8, f"class_load_{class_id}_{DAYS.index(day)}")
            model.add(load_var == sum(occupied_for_day))
            class_daily_excess = model.new_int_var(
                0,
                8,
                f"class_daily_excess_{class_id}_{DAYS.index(day)}",
            )
            model.add(class_daily_excess >= load_var - hard_daily_cap)
            class_daily_excess_vars.append(class_daily_excess)
            limit_penalty_terms.append(-20000 * class_daily_excess)
            class_day_load_vars[(class_id, day)] = load_var
            daily_vars.append(load_var)

            used_var = model.new_bool_var(f"class_day_used_{class_id}_{DAYS.index(day)}")
            model.add(load_var >= used_var)
            model.add(load_var <= 8 * used_var)
            class_day_used_vars[(class_id, day)] = used_var
            balance_objective_terms.append(used_day_reward * used_var)

            deviation = model.new_int_var(0, 8, f"class_load_deviation_{class_id}_{DAYS.index(day)}")
            model.add_abs_equality(deviation, load_var - target_daily)
            balance_objective_terms.append(-balance_weight * deviation)

        if daily_vars:
            max_load = model.new_int_var(0, 8, f"class_max_load_{class_id}")
            min_load = model.new_int_var(0, 8, f"class_min_load_{class_id}")
            spread = model.new_int_var(0, 8, f"class_load_spread_{class_id}")
            model.add_max_equality(max_load, daily_vars)
            model.add_min_equality(min_load, daily_vars)
            model.add(spread == max_load - min_load)
            balance_objective_terms.append(-spread_weight * spread)

    # Compact class timetables and vary a course's hour across weekdays.
    class_gap_weight = max(0, int(settings.get("classGapPenalty") or 12)) * 200
    same_hour_weight = max(0, int(settings.get("sameCourseSameHourPenalty") or 20))
    class_gap_vars: List[Any] = []
    same_course_hour_repetitions: List[Any] = []

    for cls in ([] if coverage_only else classrooms):
        class_id = str(cls.get("id"))
        block_ids = blocks_by_class.get(class_id, [])
        if not any((class_id, day, hour) in class_hour_occupied for day in DAYS for hour in HOURS):
            continue
        for day in DAYS:
            occupied_for_day = [class_hour_occupied[(class_id, day, hour)] for hour in HOURS]

            for hour_index in range(1, 7):
                before = model.new_bool_var(f"class_before_{class_id}_{DAYS.index(day)}_{hour_index + 1}")
                after = model.new_bool_var(f"class_after_{class_id}_{DAYS.index(day)}_{hour_index + 1}")
                model.add_max_equality(before, occupied_for_day[:hour_index])
                model.add_max_equality(after, occupied_for_day[hour_index + 1:])
                gap = model.new_bool_var(f"class_gap_{class_id}_{DAYS.index(day)}_{hour_index + 1}")
                current_hour = occupied_for_day[hour_index]
                model.add(gap <= before)
                model.add(gap <= after)
                model.add(gap + current_hour <= 1)
                model.add(gap >= before + after - current_hour - 1)
                class_gap_vars.append(gap)
                if class_gap_weight:
                    balance_objective_terms.append(-class_gap_weight * gap)

    for (_class_id, _course_identity), block_ids in ([] if coverage_only else course_groups.items()):
        for hour in HOURS:
            day_hits = []
            for day in DAYS:
                covering = []
                for bi in block_ids:
                    for cand_day, start in candidates[bi]:
                        if cand_day == day and start <= hour < start + blocks[bi]["duration"]:
                            covering.append(x[(bi, cand_day, start)])
                day_hit = model.new_bool_var(
                    f"course_hour_hit_{block_ids[0]}_{hour}_{DAYS.index(day)}"
                )
                if covering:
                    model.add_max_equality(day_hit, covering)
                else:
                    model.add(day_hit == 0)
                day_hits.append(day_hit)
            repetition = model.new_int_var(0, len(DAYS) - 1, f"course_hour_repeat_{block_ids[0]}_{hour}")
            model.add(repetition >= sum(day_hits) - 1)
            same_course_hour_repetitions.append(repetition)
            if same_hour_weight:
                balance_objective_terms.append(-same_hour_weight * repetition)

    # Quality objective. Placement itself is solved in a separate first phase,
    # preventing any soft preference from sacrificing a lesson hour.
    quality_objective_terms = []
    for bi, block in ([] if coverage_only else enumerate(blocks)):
        for day, start in candidates[bi]:
            var = x[(bi, day, start)]
            # Prefer earlier hours and avoid last periods.
            quality = 100 - start * 3
            if start + block["duration"] - 1 >= 8:
                quality -= int(settings.get("lastHourPenalty") or 25)
            for teacher_id in teacher_ids(block["course"], teacher_id_by_name):
                if day in (unwanted_days.get(teacher_id) or []):
                    quality -= int(settings.get("unwantedTeacherDayPenalty") or 40)
            quality_objective_terms.append(quality * var)

    placement_hours = sum(blocks[bi]["duration"] * placed_vars[bi] for bi in range(len(blocks)))

    def new_phase_solver(seconds: float, phase_seed: int | None = None, randomize: bool = False) -> Any:
        phase_solver = cp_model.CpSolver()
        phase_solver.parameters.max_time_in_seconds = max(1.0, seconds)
        phase_solver.parameters.num_search_workers = max(1, workers)
        phase_solver.parameters.random_seed = int(phase_seed if phase_seed is not None else seed)
        phase_solver.parameters.randomize_search = bool(randomize)
        phase_solver.parameters.log_search_progress = bool(config.get("logSearchProgress"))
        return phase_solver

    def add_decision_hints(source_solver: Any) -> None:
        # Repeated phase solves must replace, not accumulate, model hints.
        if hasattr(model, "clear_hints"):
            model.clear_hints()
        for block_index in range(len(blocks)):
            model.add_hint(placed_vars[block_index], source_solver.value(placed_vars[block_index]))
            for candidate_day, candidate_start in candidates[block_index]:
                candidate_var = x[(block_index, candidate_day, candidate_start)]
                model.add_hint(candidate_var, source_solver.value(candidate_var))

    # Layer 1: feasibility/coverage. No aesthetic preference may sacrifice a
    # required lesson hour in this phase.
    model.maximize(placement_hours)
    configured_portfolio_size = max(
        1,
        min(8, int(config.get("portfolioSize") or (4 if scope == "global" else 3))),
    )
    # Büyük modelde kısa denemelere bölmek her denemede presolve maliyetini
    # yeniden ödüyordu. Tek ve uzun koşu çözücüye ilk geçerli programı bulması
    # ve tam kapsama ulaşması için gerçek arama süresi bırakır.
    portfolio_size = 1 if coverage_only else configured_portfolio_size
    coverage_budget = time_limit * (0.82 if coverage_only else 0.55)
    per_attempt_budget = max(2.0, coverage_budget / portfolio_size)
    portfolio_reports: List[Dict[str, Any]] = []
    phase_one_solver: Any | None = None
    phase_one_status = cp_model.UNKNOWN
    best_portfolio_hours = -1
    total_required_hours = sum(block["duration"] for block in blocks)

    for attempt in range(portfolio_size):
        attempt_seed = seed + attempt * 1009
        candidate_solver = new_phase_solver(
            per_attempt_budget,
            phase_seed=attempt_seed,
            randomize=attempt > 0,
        )
        candidate_status = candidate_solver.solve(model)
        candidate_hours = 0
        if candidate_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            candidate_hours = int(round(candidate_solver.objective_value))
        portfolio_reports.append({
            "attempt": attempt + 1,
            "seed": attempt_seed,
            "status": candidate_solver.status_name(candidate_status),
            "placedHours": candidate_hours,
            "branches": candidate_solver.num_branches,
            "conflicts": candidate_solver.num_conflicts,
        })
        if phase_one_solver is None or candidate_hours > best_portfolio_hours:
            phase_one_solver = candidate_solver
            phase_one_status = candidate_status
            best_portfolio_hours = candidate_hours
        if candidate_hours >= total_required_hours:
            break

    assert phase_one_solver is not None
    solver = phase_one_solver
    status = phase_one_status
    completed_phases = 1
    best_placed_hours = 0
    optimization_mode = "large_model_coverage" if coverage_only else "placement_portfolio"
    if phase_one_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        best_placed_hours = int(round(phase_one_solver.objective_value))
        full_placement_found = best_placed_hours >= total_required_hours
        if full_placement_found:
            # The remaining layers are lexicographic: every completed layer is
            # locked before the next one starts, so quality can never unplace a
            # lesson or worsen the teacher-gap result.
            model.add(placement_hours == total_required_hours)

            # Layer 2: minimize teacher karnıyarık hours.
            if teacher_gap_vars:
                add_decision_hints(solver)
                teacher_gap_expression = sum(teacher_gap_vars)
                model.minimize(teacher_gap_expression)
                phase_two_solver = new_phase_solver(time_limit * 0.22)
                phase_two_status = phase_two_solver.solve(model)
                if phase_two_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    solver, status = phase_two_solver, phase_two_status
                    completed_phases = 2
                    best_teacher_gaps = int(solver.value(teacher_gap_expression))
                    model.add(teacher_gap_expression == best_teacher_gaps)
                    optimization_mode = "teacher_compactness"

            # Layer 3: class compactness and balanced daily loads.
            phase_three_terms = balance_objective_terms + limit_penalty_terms
            if phase_three_terms:
                add_decision_hints(solver)
                balance_expression = sum(phase_three_terms)
                model.maximize(balance_expression)
                phase_three_solver = new_phase_solver(time_limit * 0.18)
                phase_three_status = phase_three_solver.solve(model)
                if phase_three_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    solver, status = phase_three_solver, phase_three_status
                    completed_phases = 3
                    best_balance_score = int(round(solver.value(balance_expression)))
                    model.add(balance_expression == best_balance_score)
                    optimization_mode = "class_compactness"

            # Layer 4: unwanted days, early/last-hour preferences and other
            # cosmetic choices, without worsening any earlier layer.
            if quality_objective_terms:
                add_decision_hints(solver)
                model.maximize(sum(quality_objective_terms))
                phase_four_solver = new_phase_solver(time_limit * 0.10)
                phase_four_status = phase_four_solver.solve(model)
                if phase_four_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    solver, status = phase_four_solver, phase_four_status
                    completed_phases = 4
                    optimization_mode = "layered_quality"
        else:
            # A timed FEASIBLE result is not proof that the missing lesson is
            # impossible. Spend every remaining second on coverage; quality
            # layers only run after complete placement.
            add_decision_hints(phase_one_solver)
            model.maximize(placement_hours)
            optimization_mode = "placement_retry"
            retry_solver = new_phase_solver(
                time_limit * (0.16 if coverage_only else 0.45),
                phase_seed=seed + 99991,
                randomize=True,
            )
            retry_status = retry_solver.solve(model)
            if retry_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                retry_placed_hours = sum(
                    blocks[bi]["duration"] * int(retry_solver.value(placed_vars[bi]))
                    for bi in range(len(blocks))
                )
                if retry_placed_hours >= best_placed_hours:
                    solver, status = retry_solver, retry_status
                    best_placed_hours = retry_placed_hours
                    completed_phases = 2

    status_name = solver.status_name(status)
    result_schedule = dict(base)
    unplaced: List[Dict[str, Any]] = []
    placed_count = 0

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for bi, block in enumerate(blocks):
            chosen = None
            for day, start in candidates[bi]:
                if solver.value(x[(bi, day, start)]) == 1:
                    chosen = (day, start)
                    break
            if not chosen:
                unplaced.append({
                    "id": block["id"],
                    "className": block["className"],
                    "courseName": course_name(block["course"]),
                    "course": block["course"],
                    "duration": block["duration"],
                    "reason": "CP-SAT bu bloğu kısmi çözümde yerleştirmedi.",
                })
                continue
            placed_count += 1
            day, start = chosen
            payload_item = {
                "courseName": course_name(block["course"]),
                "courseId": block["course"].get("courseId") or block["course"].get("id") or "",
                "scheduleIdentity": block["courseIdentity"],
                "weeklyHours": weekly_hours(block["course"]),
                "teacherId": block["course"].get("teacherId") or "",
                "teacherId2": block["course"].get("teacherId2") or "",
                "teacherName": block["course"].get("teacherName") or "",
                "teacherName2": block["course"].get("teacherName2") or "",
                "className": block["className"],
                "classId": block["classId"],
                "type": block["course"].get("type") or "",
                "groupName": block["course"].get("groupName") or "",
                "blockId": f"cpsat_{seed}_{bi}",
                "isManual": False,
            }
            for hour in range(start, start + block["duration"]):
                class_targets = [(block["classId"], block["className"])] + list(block.get("linkedClasses") or [])
                for target_class_id, target_class_name in class_targets:
                    target_item = dict(payload_item, className=target_class_name, classId=target_class_id)
                    class_key = f"class_{target_class_id}_{day}_{hour}"
                    result_schedule[class_key] = as_list(result_schedule.get(class_key)) + [target_item]
                for teacher_id in teacher_ids(block["course"], teacher_id_by_name):
                    teacher_key = f"teacher_{teacher_id}_{day}_{hour}"
                    result_schedule[teacher_key] = as_list(result_schedule.get(teacher_key)) + [payload_item]
    else:
        # Solver hiç uygulanabilir çözüm döndürmediyse mevcut programı koru.
        # Böylece boş sonuç uygulamaya yazılıp bütün programı silmez.
        result_schedule = dict(current)
        unplaced = [{
            "id": block["id"],
            "className": block["className"],
            "courseName": course_name(block["course"]),
            "course": block["course"],
            "duration": block["duration"],
            "reason": f"CP-SAT durumu: {status_name}. Mevcut program korunmuştur.",
        } for block in blocks]

    day_load_summary: Dict[str, Dict[str, int]] = {}
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for cls in classrooms:
            class_id = str(cls.get("id"))
            class_name = str(cls.get("name") or class_id)
            loads: Dict[str, int] = {}
            for day in DAYS:
                load_var = class_day_load_vars.get((class_id, day))
                if load_var is not None:
                    loads[day] = int(solver.value(load_var))
            if loads:
                day_load_summary[class_name] = loads

    duration_ms = int((time.time() - started) * 1000)
    success = status in (cp_model.OPTIMAL, cp_model.FEASIBLE) and not unplaced
    teacher_gap_count = (
        sum(int(solver.value(var)) for var in teacher_gap_vars)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0
    )
    teacher_working_day_count = (
        sum(int(solver.value(var)) for var in teacher_day_used_vars)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0
    )
    class_gap_count = (
        sum(int(solver.value(var)) for var in class_gap_vars)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0
    )
    same_course_hour_count = (
        sum(int(solver.value(var)) for var in same_course_hour_repetitions)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0
    )
    quality_penalty = (
        len(unplaced) * 100000
        + teacher_gap_count * teacher_gap_weight
        + class_gap_count * class_gap_weight
        + same_course_hour_count * same_hour_weight
    )
    non_empty_day_counts = {
        class_name: sum(1 for value in loads.values() if value > 0)
        for class_name, loads in day_load_summary.items()
    }
    strategy_detail = (
        "Büyük program tam-kapsama modu etkin."
        if coverage_only
        else "Haftalık gün yükü dengeleme etkin."
    )
    load_detail = (
        ""
        if coverage_only
        else f" Kullanılan gün sayıları: {json.dumps(non_empty_day_counts, ensure_ascii=False)}"
    )
    details = (
        f"Google OR-Tools CP-SAT çalıştırıldı. Durum: {status_name}. "
        f"{placed_count}/{len(blocks)} blok yerleştirildi. "
        f"{strategy_detail} "
        f"Süre: {duration_ms} ms; branch: {solver.num_branches}; conflict: {solver.num_conflicts}."
        f"{load_detail}"
    )
    return {
        "success": success,
        "status": status_name,
        "schedule": result_schedule,
        "unplacedBlocks": unplaced,
        "infeasibility": [*infeasibility_hints, *capacity_diagnostics],
        "preflight": preflight_report,
        "initialPenalty": 0,
        "finalPenalty": quality_penalty,
        "durationMs": duration_ms,
        "details": details,
        "statistics": {
            "blocks": len(blocks),
            "placed": placed_count,
            "unplaced": len(unplaced),
            "branches": solver.num_branches,
            "conflicts": solver.num_conflicts,
            "wallTimeSeconds": solver.wall_time,
            "objectiveValue": solver.objective_value if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None,
            "bestObjectiveBound": solver.best_objective_bound if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None,
            "dayLoadSummary": day_load_summary,
            "nonEmptyDayCounts": {
                class_name: sum(1 for value in loads.values() if value > 0)
                for class_name, loads in day_load_summary.items()
            },
            "placedHours": best_placed_hours,
            "teacherGapHours": teacher_gap_count,
            "teacherWorkingDays": teacher_working_day_count,
            "classGapHours": class_gap_count,
            "sameCourseHourRepetitions": same_course_hour_count,
            "teacherDailyExcess": sum(int(solver.value(var)) for var in teacher_daily_excess_vars) if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0,
            "teacherConsecutiveExcess": sum(int(solver.value(var)) for var in teacher_consecutive_excess_vars) if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0,
            "courseDailyExcess": sum(int(solver.value(var)) for var in course_daily_excess_vars) if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0,
            "classDailyExcess": sum(int(solver.value(var)) for var in class_daily_excess_vars) if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0,
            "optimizationPhases": completed_phases,
            "optimizationMode": optimization_mode,
            "coverageOnly": coverage_only,
            "largeModelThreshold": large_model_threshold,
            "coverageAttempts": len(portfolio_reports),
            "portfolio": portfolio_reports,
            "requiredHours": total_required_hours,
        },
    }


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        result = solve(payload)
    except Exception as exc:
        result = {
            "success": False,
            "error": "CP-SAT servisi çalışırken hata oluştu.",
            "details": f"{exc}\n{traceback.format_exc()}",
        }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
