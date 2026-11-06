"""
KorayUçar -> OR-Tools CP-SAT warm-start bridge.

Bu yardımcı modül, rota_cp_sat_solver.py içinde değişkenlerinizi block_id/day/hour
anahtarlarıyla indekslediğinizde KorayUçar aday programını model.AddHint ile CP-SAT'e
başlangıç çözümü olarak vermek için kullanılır.

Örnek:
    from korayucar_warm_start import apply_korayucar_hints

    apply_korayucar_hints(
        model,
        payload.get("korayUcarWarmStartHint", []),
        start_vars_by_block_slot,
    )

start_vars_by_block_slot örnek anahtar:
    {
      ("korayucar_...", "Pazartesi", 1): BoolVar,
      ...
    }
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping, Tuple


def apply_korayucar_hints(
    model: Any,
    hints: Iterable[Mapping[str, Any]],
    start_vars_by_block_slot: Mapping[Tuple[str, str, int], Any],
) -> int:
    """KorayUçar başlangıç çözümünü CP-SAT BoolVar'larına hint olarak uygular.

    Desteklenmeyen veya bulunamayan hint'ler sessizce atlanır.
    Dönen değer gerçekten uygulanan hint sayısıdır.
    """
    applied = 0

    for hint in hints or []:
        block_id = str(hint.get("blockId") or "").strip()
        day = str(hint.get("day") or "").strip()
        try:
            hour = int(hint.get("hour"))
        except (TypeError, ValueError):
            continue

        if not block_id or not day:
            continue

        var = start_vars_by_block_slot.get((block_id, day, hour))
        if var is None:
            continue

        try:
            model.AddHint(var, 1)
            applied += 1
        except Exception:
            # Hint hiçbir zaman ana çözümü kırmamalı.
            continue

    return applied
