
"""
MARSWALK Rover Energy and Mission Feasibility Engine.

Prototype engineering model for outbound and return rover missions.

Elevation changes are signed:
    Positive = uphill
    Zero = flat
    Negative = downhill

Downhill regenerative braking is not credited.
"""

from __future__ import annotations

import math
from typing import Any


MARS_GRAVITY = 3.711


class RoverEnergyService:
    """Calculate rover energy consumption and mission feasibility."""

    def __init__(self) -> None:
        self.gravity = MARS_GRAVITY

    @staticmethod
    def _number(
        name: str,
        value: Any,
        allow_zero: bool = False,
    ) -> float:

        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{name} must be a number.")

        if not math.isfinite(number):
            raise ValueError(f"{name} must be finite.")

        if allow_zero:
            if number < 0:
                raise ValueError(f"{name} cannot be negative.")
        elif number <= 0:
            raise ValueError(
                f"{name} must be greater than zero."
            )

        return number

    def _validate_specs(
        self,
        specs: dict[str, Any],
    ) -> dict[str, float]:

        if not isinstance(specs, dict):
            raise ValueError(
                "Rover specifications must be a dictionary."
            )

        battery = self._number(
            "battery_capacity_wh",
            specs.get("battery_capacity_wh"),
        )

        speed = self._number(
            "average_speed_mps",
            specs.get("average_speed_mps"),
        )

        power = self._number(
            "flat_power_w",
            specs.get("flat_power_w"),
        )

        mass = self._number(
            "rover_mass_kg",
            specs.get("rover_mass_kg"),
        )

        reserve = self._number(
            "reserve_percent",
            specs.get("reserve_percent", 20),
            allow_zero=True,
        )

        max_slope = self._number(
            "max_slope_deg",
            specs.get("max_slope_deg", 25),
        )

        rolling_coefficient = self._number(
            "rolling_resistance_coefficient",
            specs.get("rolling_resistance_coefficient", 0.02),
            allow_zero=True,
        )

        efficiency = self._number(
            "drivetrain_efficiency",
            specs.get("drivetrain_efficiency", 0.75),
        )

        if reserve >= 100:
            raise ValueError(
                "reserve_percent must be less than 100."
            )

        if max_slope > 90:
            raise ValueError(
                "max_slope_deg cannot exceed 90."
            )

        if efficiency > 1:
            raise ValueError(
                "drivetrain_efficiency must be between 0 and 1."
            )

        return {
            "battery_capacity_wh": battery,
            "average_speed_mps": speed,
            "flat_power_w": power,
            "rover_mass_kg": mass,
            "reserve_percent": reserve,
            "max_slope_deg": max_slope,
            "rolling_resistance_coefficient": rolling_coefficient,
            "drivetrain_efficiency": efficiency,
        }

    def _calculate_leg(
        self,
        segments: list[dict[str, Any]],
        specs: dict[str, float],
    ) -> dict[str, Any]:

        if not isinstance(segments, list):
            raise ValueError(
                "Route segments must be a list."
            )

        if not segments:
            raise ValueError(
                "Route segments cannot be empty."
            )

        distance_total = 0.0
        time_total = 0.0

        base_energy_total = 0.0
        uphill_energy_total = 0.0
        rolling_adjustment_total = 0.0

        maximum_slope = 0.0
        slope_violations = 0

        mass = specs["rover_mass_kg"]
        speed = specs["average_speed_mps"]
        power = specs["flat_power_w"]
        efficiency = specs["drivetrain_efficiency"]
        coefficient = specs["rolling_resistance_coefficient"]

        for index, segment in enumerate(segments):

            if not isinstance(segment, dict):
                raise ValueError(
                    f"Segment {index} must be a dictionary."
                )

            distance = self._number(
                f"segment[{index}].distance_m",
                segment.get("distance_m"),
                allow_zero=True,
            )

            # Elevation change is SIGNED.
            # Negative values are valid for downhill travel.
            try:
                elevation_change = float(
                    segment.get("elevation_change_m", 0)
                )
            except (TypeError, ValueError):
                raise ValueError(
                    f"segment[{index}].elevation_change_m "
                    "must be a number."
                )

            if not math.isfinite(elevation_change):
                raise ValueError(
                    f"segment[{index}].elevation_change_m "
                    "must be finite."
                )

            slope = self._number(
                f"segment[{index}].slope_deg",
                segment.get("slope_deg", 0),
                allow_zero=True,
            )

            if slope > 90:
                raise ValueError(
                    f"Slope in segment {index} "
                    "cannot exceed 90 degrees."
                )

            distance_total += distance

            maximum_slope = max(
                maximum_slope,
                slope,
            )

            if slope > specs["max_slope_deg"]:
                slope_violations += 1

            if distance == 0:
                continue

            # Travel time.
            travel_seconds = distance / speed
            time_total += travel_seconds

            # Baseline flat-terrain electrical energy.
            base_energy = (
                power * travel_seconds / 3600.0
            )

            base_energy_total += base_energy

            # Additional gravitational energy applies ONLY uphill.
            uphill_energy = 0.0

            if elevation_change > 0:

                gravitational_work_j = (
                    mass
                    * self.gravity
                    * elevation_change
                )

                uphill_energy = (
                    gravitational_work_j
                    / (3600.0 * efficiency)
                )

            uphill_energy_total += uphill_energy

            # Rolling-resistance adjustment relative to flat terrain.
            slope_radians = math.radians(slope)

            rolling_force_adjustment = (
                coefficient
                * mass
                * self.gravity
                * (math.cos(slope_radians) - 1.0)
            )

            rolling_work_adjustment_j = (
                rolling_force_adjustment * distance
            )

            rolling_adjustment_wh = (
                rolling_work_adjustment_j
                / (3600.0 * efficiency)
            )

            rolling_adjustment_total += (
                rolling_adjustment_wh
            )

        total_energy = (
            base_energy_total
            + uphill_energy_total
            + rolling_adjustment_total
        )

        total_energy = max(0.0, total_energy)

        return {
            "distance_m": round(distance_total, 3),
            "travel_time_seconds": round(time_total, 2),
            "base_energy_wh": round(base_energy_total, 3),
            "uphill_energy_wh": round(uphill_energy_total, 3),
            "rolling_adjustment_wh": round(
                rolling_adjustment_total,
                3,
            ),
            "total_energy_wh": round(total_energy, 3),
            "maximum_slope_deg": round(maximum_slope, 3),
            "slope_violation_count": slope_violations,
        }

    def calculate_mission(
        self,
        outbound_segments: list[dict[str, Any]],
        return_segments: list[dict[str, Any]],
        rover_specs: dict[str, Any],
    ) -> dict[str, Any]:

        specs = self._validate_specs(rover_specs)

        outbound = self._calculate_leg(
            outbound_segments,
            specs,
        )

        return_leg = self._calculate_leg(
            return_segments,
            specs,
        )

        total_distance = (
            outbound["distance_m"]
            + return_leg["distance_m"]
        )

        total_time = (
            outbound["travel_time_seconds"]
            + return_leg["travel_time_seconds"]
        )

        total_energy = (
            outbound["total_energy_wh"]
            + return_leg["total_energy_wh"]
        )

        battery = specs["battery_capacity_wh"]

        reserve_energy = (
            battery * specs["reserve_percent"] / 100.0
        )

        usable_energy = battery - reserve_energy

        remaining_energy = battery - total_energy

        remaining_percent = (
            remaining_energy / battery
        ) * 100.0

        battery_sufficient = (
            total_energy <= usable_energy
        )

        slope_violations = (
            outbound["slope_violation_count"]
            + return_leg["slope_violation_count"]
        )

        slope_sufficient = slope_violations == 0

        mission_feasible = (
            battery_sufficient and slope_sufficient
        )

        if mission_feasible:
            recommendation = "GO"
            reason = (
                "Estimated round-trip energy is within the "
                "usable battery budget, and all route segments "
                "are within the configured slope limit."
            )

        else:
            recommendation = "NO-GO"
            reasons = []

            if not battery_sufficient:
                reasons.append(
                    "Round-trip energy exceeds the usable "
                    "battery budget."
                )

            if not slope_sufficient:
                reasons.append(
                    "One or more route segments exceed the "
                    "configured maximum slope."
                )

            reason = " ".join(reasons)

        return {
            "status": "success",
            "mission_feasible": mission_feasible,
            "recommendation": recommendation,
            "recommendation_reason": reason,

            "rover_specifications": specs,

            "outbound": outbound,
            "return": return_leg,

            "round_trip": {
                "total_distance_m": round(total_distance, 3),
                "total_time_seconds": round(total_time, 2),
                "total_time_hours": round(
                    total_time / 3600.0,
                    3,
                ),
                "total_energy_wh": round(total_energy, 3),
                "usable_energy_wh": round(usable_energy, 3),
                "reserve_energy_wh": round(reserve_energy, 3),
                "remaining_battery_wh": round(
                    remaining_energy,
                    3,
                ),
                "remaining_battery_percent": round(
                    remaining_percent,
                    2,
                ),
            },

            "checks": {
                "battery_sufficient": battery_sufficient,
                "slope_sufficient": slope_sufficient,
                "slope_violation_count": slope_violations,
                "required_reserve_percent": specs["reserve_percent"],
            },

            "model_assumptions": [
                "Mars gravity is 3.711 m/s^2.",
                "Flat-terrain power includes baseline propulsion "
                "and flat-ground rolling resistance.",
                "Uphill gravitational energy is added separately.",
                "Rolling resistance is adjusted relative to flat "
                "terrain to avoid double-counting.",
                "Downhill regenerative braking is not credited.",
                "Outbound and return routes are calculated separately.",
                "The model is a prototype engineering estimate, "
                "not a flight-qualified rover model.",
            ],
        }


rover_energy_service = RoverEnergyService()
