import math

import numpy as np
import pytest

from src.compute import astronaut, pathfind, route
from src.compute.dem import DEM, synthetic_dem


def ramp_dem(deg, size=100, pixel_m=10.0):
    """Terrain rising to the east at exactly `deg` degrees."""
    cols = np.arange(size) * pixel_m
    z = np.tile(np.tan(math.radians(deg)) * cols, (size, 1))
    return DEM(z, pixel_m, (0, 0, 0.01, 0.01), "ramp")


def test_ramp_known_gradient():
    dem = ramp_dem(10)
    out = route.analyze_xy(dem, [(50, 500), (850, 500)], spacing_m=20)
    assert out["max_slope_deg"] == pytest.approx(10.0, abs=0.05)
    assert out["total_climb_m"] == pytest.approx(800 * math.tan(math.radians(10)), rel=0.01)
    assert out["passes_slope_limit"]  # 10 deg < 15 deg limit
    # distance is hypotenuse of the horizontal run
    assert out["distance_m"] == pytest.approx(800 / math.cos(math.radians(10)), rel=0.01)


def test_energy_matches_hand_calculation():
    p = astronaut.values()
    dem = ramp_dem(10)
    out = route.analyze_xy(dem, [(50, 500), (850, 500)], spacing_m=20)
    t = out["distance_m"] / p["walk_speed_m_s"]
    climb_j = out["total_climb_m"] * p["total_mass_kg"] * p["gravity_m_s2"] / p["climb_efficiency"]
    expected_wh = (p["metabolic_base_w"] * t + climb_j) / 3600
    assert out["energy_wh"] == pytest.approx(expected_wh, rel=1e-6)


def test_steep_ramp_fails_with_excess():
    dem = ramp_dem(20)
    out = route.analyze_xy(dem, [(50, 500), (450, 500)], spacing_m=20)
    assert not out["passes"]
    assert out["failing_segments"]
    assert out["failing_segments"][0]["excess_deg"] == pytest.approx(5.0, abs=0.1)


def test_downhill_slope_counts_too():
    dem = ramp_dem(20)
    out = route.analyze_xy(dem, [(450, 500), (50, 500)], spacing_m=20)
    assert not out["passes_slope_limit"]


def test_dijkstra_avoids_steep_scarp():
    dem = synthetic_dem(size=200)
    direct = [(100.0, 1500.0), (2800.0, 1500.0)]  # straight across the scarp
    assert not route.analyze_xy(dem, direct)["passes"]
    path = pathfind.least_cost_path(dem, direct[0], direct[1])
    assert path is not None
    out = route.analyze_xy(dem, path, spacing_m=15)
    assert out["passes_slope_limit"]


def test_no_path_when_walled_in():
    dem = ramp_dem(30)  # entire map steeper than the limit going east
    assert pathfind.least_cost_path(dem, (50, 500), (850, 500)) is None
