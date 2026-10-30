"""Every assumption used by the planner lives here and is shown in the UI.

These are ASSUMPTIONS, not official NASA suit specifications. Verify against
published NASA sources before citing them as fact, and update `source`.
"""

ASTRONAUT = {
    "total_mass_kg": {"value": 150, "unit": "kg",
                      "why": "Crew member + suit + pack (Earth mass). Assumption."},
    "gravity_m_s2": {"value": 3.71, "unit": "m/s^2",
                     "why": "Mars surface gravity."},
    "slope_limit_deg": {"value": 15, "unit": "deg",
                        "why": "Conservative walking limit in a pressurized suit. Assumption."},
    "walk_speed_m_s": {"value": 0.8, "unit": "m/s",
                       "why": "Slow suited walking pace. Assumption."},
    "metabolic_base_w": {"value": 300, "unit": "W",
                         "why": "Metabolic rate while walking suited. Assumption."},
    "climb_efficiency": {"value": 0.25, "unit": "-",
                         "why": "Muscle efficiency for climbing work. Assumption."},
    "eva_duration_h": {"value": 8, "unit": "h",
                       "why": "Planned EVA length. Assumption."},
    "reserve_h": {"value": 2, "unit": "h",
                  "why": "Suit consumables reserve beyond EVA. Assumption."},
    "max_return_distance_m": {"value": 4000, "unit": "m",
                              "why": "Walk-back limit if the suit/rover fails. Assumption."},
    "slope_penalty_k": {"value": 4.0, "unit": "-",
                        "why": "Pathfinding penalty weight on (slope/limit)^2."},
}


def values(overrides=None):
    """Plain {name: value} dict, optionally overridden (e.g. from UI sliders)."""
    out = {k: v["value"] for k, v in ASTRONAUT.items()}
    if overrides:
        for k, v in overrides.items():
            if k in out:
                out[k] = float(v)
    return out
