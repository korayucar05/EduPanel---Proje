from copy import deepcopy

from rota_cp_sat_solver import group_overlaps, is_guidance_course, solve


assert not group_overlaps(
    {"type": "compulsory", "groupName": "SAY"},
    {"type": "compulsory", "groupName": "EA"},
)
assert group_overlaps(
    {"type": "compulsory", "groupName": "SAY"},
    {"type": "compulsory", "groupName": "SAY"},
)
assert is_guidance_course({"courseName": "Rehberlik ve Yönlendirme"})
assert group_overlaps(
    {"type": "compulsory", "groupName": ""},
    {"type": "compulsory", "groupName": "EA"},
)


payload = {
    "config": {"scope": "global", "timeLimitSeconds": 15, "seed": 20260717},
    "currentSchedule": {},
    "teachers": [
        {"id": "t1", "name": "Math Teacher", "status": "Aktif"},
        {"id": "t2", "name": "Science Teacher", "status": "Aktif"},
        {"id": "t3", "name": "English Teacher", "status": "Aktif"},
    ],
    "classrooms": [
        {"id": "9A", "name": "9-A", "assignedCourses": [
            {"courseName": "Matematik", "weeklyHours": 4, "teacherName": "Math Teacher", "type": "Zorunlu Ders"},
            {"courseName": "Fizik", "weeklyHours": 2, "teacherName": "Science Teacher", "type": "Zorunlu Ders"},
            {"courseName": "Geometri", "weeklyHours": 2, "teacherName": "Math Teacher", "type": "Zorunlu Ders"},
            {"courseName": "S. INGILIZCE", "weeklyHours": 12, "teacherName": "English Teacher", "type": "Zorunlu Ders"},
        ]},
        {"id": "9B", "name": "9-B", "assignedCourses": [
            {"courseName": "Matematik", "weeklyHours": 4, "teacherName": "Math Teacher", "type": "Zorunlu Ders"},
            {"courseName": "Fizik", "weeklyHours": 2, "teacherName": "Science Teacher", "type": "Zorunlu Ders"},
        ]},
    ],
    "courses": [],
    "unwantedTeacherDays": {},
    "settings": {
        "maxDailyCourseHours": 2,
        "electiveEnglishMaxDailyHours": 4,
        "maxTeacherDailyHours": 6,
        "maxTeacherConsecutiveHours": 6,
        "teacherGapPenalty": 15,
    },
}

result = solve(payload)
assert result.get("schedule"), result
assert result.get("statistics", {}).get("placed", 0) > 0, result
# Yerleşim hedefinden sonra kalite hedefleri katmanlı olarak çalışır. Aşama
# sayısı geliştikçe artabilir; test, eski uygulamaya ait sabit sayı yerine
# en az yerleşim + kalite katmanlarının varlığını doğrular.
assert result.get("statistics", {}).get("optimizationPhases", 0) >= 2, result
assert result.get("statistics", {}).get("coverageAttempts", 0) >= 1, result
assert result.get("statistics", {}).get("portfolio"), result
assert result.get("preflight", {}).get("totalBlocks") == 10, result

english_slots = []
english_blocks = {}
for key, value in result["schedule"].items():
    if not key.startswith("class_9A_"):
        continue
    for item in value if isinstance(value, list) else [value]:
        if item.get("courseName") == "S. INGILIZCE":
            english_slots.append(key)
            english_blocks.setdefault(item.get("blockId"), []).append(key)

assert len(english_slots) == 12, english_slots
assert sorted(len(keys) for keys in english_blocks.values()) == [4, 4, 4], english_blocks
assert len({key.split("_")[-2] for keys in english_blocks.values() for key in keys}) == 3, english_blocks

course_days = {}
for key, value in result["schedule"].items():
    if not key.startswith("class_9A_"):
        continue
    day = key.split("_")[-2]
    for item in value if isinstance(value, list) else [value]:
        name = item.get("courseName")
        if name in {"Matematik", "Geometri"}:
            course_days.setdefault(name, set()).add(day)

# 4 saat Matematik 2+2 olarak iki farklı güne; aynı öğretmenin Geometri
# dersi de Matematik günlerinden farklı bir güne yerleşmelidir.
assert len(course_days.get("Matematik", set())) == 2, course_days
assert len(course_days.get("Geometri", set())) == 1, course_days
assert course_days["Matematik"].isdisjoint(course_days["Geometri"]), course_days
print("CP-SAT smoke test BASARILI")
print(result.get("details"))


# Büyük okul programlarında kalite modelinin ön hazırlığı yerleşimi
# geciktirmemeli. Eşiği test için düşürerek hafif tam-kapsama yolunu küçük ve
# deterministik bir veri setinde doğruluyoruz.
large_coverage_payload = deepcopy(payload)
large_coverage_payload["config"] = {
    **large_coverage_payload["config"],
    "largeModelThreshold": 1,
    "timeLimitSeconds": 15,
}
large_coverage_result = solve(large_coverage_payload)
assert large_coverage_result.get("success"), large_coverage_result
assert not large_coverage_result.get("unplacedBlocks"), large_coverage_result
assert large_coverage_result.get("statistics", {}).get("coverageOnly") is True, large_coverage_result
assert large_coverage_result.get("statistics", {}).get("coverageAttempts") == 1, large_coverage_result
print("CP-SAT büyük program tam-kapsama testi BASARILI")


# Öğretmen dağıtımında eski otomatik sınıf kaydı yeniden dağıtılmalı; yalnız
# teacherId ile bağlı ders de seçili öğretmene ait kabul edilmelidir. Dersin
# blokları aynı güne yeniden eklenmemelidir.
blocked_days = {
    f"blocked_class_9A_{day}_{hour}": True
    for day in ["Perşembe", "Cuma"]
    for hour in range(1, 9)
}
teacher_scope_payload = {
    "config": {
        "scope": "local",
        "selectedId": "t1",
        "viewType": "teacher",
        "timeLimitSeconds": 8,
        "seed": 20260830,
    },
    "currentSchedule": {
        **blocked_days,
        "class_9A_Pazartesi_1": [{
            "courseName": "Matematik",
            "teacherId": "t1",
            "classId": "9A",
            "className": "9-A",
            "isManual": False,
        }],
    },
    "teachers": [{"id": "t1", "name": "Math Teacher", "status": "Aktif"}],
    "classrooms": [{
        "id": "9A",
        "name": "9-A",
        "assignedCourses": [{
            "courseName": "Matematik",
            "weeklyHours": 4,
            "teacherId": "t1",
            "type": "Zorunlu Ders",
        }],
    }],
    "courses": [],
    "unwantedTeacherDays": {},
    "settings": {
        "maxDailyCourseHours": 1,
        "maxTeacherDailyHours": 1,
        "maxTeacherConsecutiveHours": 1,
    },
}

teacher_scope_result = solve(teacher_scope_payload)
assert teacher_scope_result.get("success"), teacher_scope_result
teacher_hours = sum(
    len(value if isinstance(value, list) else [value])
    for key, value in teacher_scope_result["schedule"].items()
    if key.startswith("teacher_t1_")
)
assert teacher_hours == 4, teacher_scope_result
teacher_course_days = set()
for key, value in teacher_scope_result["schedule"].items():
    if not key.startswith("class_9A_"):
        continue
    if any(item.get("courseName") == "Matematik" for item in (value if isinstance(value, list) else [value])):
        teacher_course_days.add(key.split("_")[-2])
assert len(teacher_course_days) == 2, teacher_scope_result
print("CP-SAT öğretmen kapsamı ve yumuşak limit testi BASARILI")


# Ön kontrol, algoritmadan bağımsız gerçek sınıf kapasitesi açığını açıklamalı.
capacity_payload = {
    "config": {"scope": "global", "timeLimitSeconds": 4, "portfolioSize": 1},
    "currentSchedule": {
        **{
            f"blocked_class_9A_{day}_{hour}": True
            for day in ["Salı", "Çarşamba", "Perşembe", "Cuma"]
            for hour in range(1, 9)
        },
        **{f"blocked_class_9A_Pazartesi_{hour}": True for hour in range(3, 9)},
    },
    "teachers": [{"id": "t1", "name": "Math Teacher"}],
    "classrooms": [{
        "id": "9A",
        "name": "9-A",
        "assignedCourses": [{
            "courseId": "math-9a",
            "courseName": "Matematik",
            "weeklyHours": 4,
            "teacherId": "t1",
        }],
    }],
    "courses": [],
    "unwantedTeacherDays": {},
    "settings": {},
}
capacity_result = solve(capacity_payload)
capacity_codes = {
    item.get("code") for item in capacity_result.get("preflight", {}).get("capacityIssues", [])
}
assert "class_capacity_shortage" in capacity_codes, capacity_result
assert capacity_result.get("unplacedBlocks"), capacity_result
print("CP-SAT kapasite ön kontrol testi BASARILI")
