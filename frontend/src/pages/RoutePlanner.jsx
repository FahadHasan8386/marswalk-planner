
import { useMemo, useState } from "react";

import MarsMap from "../components/MarsMap";
import GeminiReport from "../components/GeminiReport";
import useMarsMap from "../hooks/useMarsMap";

import {
  compareRoverRoutes,
  explainMission,
} from "../services/api";

// --------------------------------------------------
// DEFAULT ROVER SPECIFICATIONS
// --------------------------------------------------

const INITIAL_ROVER = {
  battery_capacity_wh: 7200,
  average_speed_mps: 0.05,
  flat_power_w: 100,
  rover_mass_kg: 200,
  reserve_percent: 20,
  max_slope_deg: 25,
  rolling_resistance_coefficient: 0.02,
  drivetrain_efficiency: 0.75,
};

// --------------------------------------------------
// STRATEGY CONFIGURATION
// --------------------------------------------------

const STRATEGY_LABELS = {
  shortest: "Shortest Route",
  safest: "Safest Route",
  energy_efficient: "Energy-Efficient Route",
  balanced: "Balanced Route",
};

const STRATEGY_COLORS = {
  shortest: "#38bdf8",
  safest: "#22c55e",
  energy_efficient: "#c084fc",
  balanced: "#f97316",
};

const DEFAULT_ROUTE_COLOR = "#facc15";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, decimals = 2) {
  const number = getOptionalNumber(value);

  return number !== null ? number.toFixed(decimals) : "N/A";
}

function getCandidateEnergy(candidate) {
  return candidate?.energy || {};
}

function getCandidateRoundTrip(candidate) {
  return getCandidateEnergy(candidate).round_trip || {};
}

function getCandidateOutbound(candidate) {
  return getCandidateEnergy(candidate).outbound || {};
}

function getCandidateReturn(candidate) {
  return getCandidateEnergy(candidate)["return"] || {};
}

function getCandidateMaximumSlope(candidate) {
  const energy = getCandidateEnergy(candidate);

  const outboundSlope = getOptionalNumber(
    energy.outbound?.maximum_slope_deg
  );

  const returnSlope = getOptionalNumber(
    energy["return"]?.maximum_slope_deg
  );

  const slopes = [outboundSlope, returnSlope].filter(
    (value) => value !== null
  );

  return slopes.length ? Math.max(...slopes) : null;
}

function getCandidateTotalDistance(candidate) {
  const roundTrip = getCandidateRoundTrip(candidate);

  const backendTotal = getOptionalNumber(
    roundTrip.total_distance_m
  );

  if (backendTotal !== null) return backendTotal;

  const outbound = getOptionalNumber(candidate?.outbound_distance_m);
  const returning = getOptionalNumber(candidate?.return_distance_m);

  if (outbound === null && returning === null) return null;

  return (outbound || 0) + (returning || 0);
}

function getCandidateTotalEnergy(candidate) {
  return getOptionalNumber(
    getCandidateRoundTrip(candidate).total_energy_wh
  );
}

function getCandidateRemainingBattery(candidate) {
  return getOptionalNumber(
    getCandidateRoundTrip(candidate).remaining_battery_percent
  );
}

function getTravelTimeSeconds(segment) {
  const seconds = getOptionalNumber(segment?.total_time_seconds);

  if (seconds !== null) return seconds;

  const hours = getOptionalNumber(segment?.total_time_hours);

  return hours !== null ? hours * 3600 : null;
}

function getCombinedRoutePoints(candidate) {
  if (!candidate) return [];

  const outbound = candidate.outbound_route_pixels || [];
  const returning = candidate.return_route_pixels || [];

  if (!outbound.length) return returning;
  if (!returning.length) return outbound;

  const lastOutbound = outbound[outbound.length - 1];
  const firstReturn = returning[0];

  const samePoint =
    lastOutbound?.x === firstReturn?.x &&
    lastOutbound?.y === firstReturn?.y;

  return [
    ...outbound,
    ...(samePoint ? returning.slice(1) : returning),
  ];
}

// --------------------------------------------------
// INPUT COMPONENTS
// --------------------------------------------------

function NumberField({ label, name, value, onChange, step = "any" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">
        {label}
      </span>

      <input
        type="number"
        name={name}
        min="0"
        step={step}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-orange-400"
      />
    </label>
  );
}

function ResultValue({ label, value, unit = "" }) {
  const available = value !== null && value !== undefined;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{label}</p>

      <p className="mt-2 text-xl font-semibold text-white">
        {available ? value : "N/A"}
        {available ? unit : ""}
      </p>
    </div>
  );
}

// --------------------------------------------------
// ROUTE CANDIDATE CARD
// --------------------------------------------------

function RouteCandidateCard({
  candidate,
  selected,
  onSelect,
}) {
  const roundTrip = getCandidateRoundTrip(candidate);

  const recommendation =
    candidate.energy?.recommendation ||
    (candidate.feasible ? "GO" : "NO-GO");

  const feasible = candidate.feasible === true;

  const routeColor =
    STRATEGY_COLORS[candidate.strategy] || DEFAULT_ROUTE_COLOR;

  return (
    <div
      className={`rounded-xl border p-5 ${
        selected
          ? "border-orange-400 bg-orange-500/10"
          : "border-slate-700 bg-slate-950/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: routeColor }}
            />

            <h3 className="text-lg font-bold text-white">
              {STRATEGY_LABELS[candidate.strategy] ||
                candidate.strategy}
            </h3>
          </div>

          <p className="mt-1 text-xs text-slate-400">
            Route ID: {candidate.route_id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {selected && (
            <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
              SELECTED ROUTE
            </span>
          )}

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              feasible
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {recommendation}
          </span>
        </div>
      </div>

      {candidate.status === "failed" ? (
        <div className="mt-4 rounded-lg bg-red-950/40 p-3 text-sm text-red-300">
          Route calculation failed:{" "}
          {candidate.reason || "No details provided."}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResultValue
              label="Round-trip Distance"
              value={formatNumber(getCandidateTotalDistance(candidate))}
              unit=" m"
            />

            <ResultValue
              label="Round-trip Energy"
              value={formatNumber(getCandidateTotalEnergy(candidate), 3)}
              unit=" Wh"
            />

            <ResultValue
              label="Maximum Slope"
              value={formatNumber(getCandidateMaximumSlope(candidate))}
              unit="°"
            />

            <ResultValue
              label="Remaining Battery"
              value={formatNumber(roundTrip.remaining_battery_percent)}
              unit="%"
            />

            <ResultValue
              label="Nodes Explored"
              value={candidate.total_nodes_explored ?? null}
            />

            <ResultValue
              label="Selection Score"
              value={formatNumber(candidate.selection_score, 4)}
            />
          </div>

          {candidate.reason && (
            <p className="mt-4 text-sm text-slate-400">
              {candidate.reason}
            </p>
          )}

          <button
            type="button"
            onClick={() => onSelect(candidate)}
            className="mt-4 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-orange-400 hover:bg-slate-800"
          >
            Highlight This Route on Map
          </button>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------
// ROUTE PLANNER
// --------------------------------------------------

export default function RoutePlanner() {
  const {
    startPoint,
    destinationPoint,
    selectionMode,
    handleMapClick,
    clearStartPoint,
    clearDestinationPoint,
    resetPoints,
    selectStartPoint,
    selectDestinationPoint,
  } = useMarsMap();

  const [algorithm, setAlgorithm] = useState("astar");
  const [rover, setRover] = useState(INITIAL_ROVER);

  const [result, setResult] = useState(null);
  const [displayedCandidate, setDisplayedCandidate] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [geminiExplanation, setGeminiExplanation] = useState("");
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState("");

  // ------------------------------------------------
  // BACKEND-SELECTED CANDIDATE
  // ------------------------------------------------

  const selectedCandidate = useMemo(() => {
    if (!result) return null;

    return (
      result.candidates?.find(
        (candidate) =>
          candidate.route_id === result.selected_route_id
      ) ||
      result.candidates?.find(
        (candidate) => candidate.selected === true
      ) ||
      null
    );
  }, [result]);

  const activeCandidate = displayedCandidate || selectedCandidate;

  // ------------------------------------------------
  // ALL ROUTES FOR MAP DISPLAY
  // ------------------------------------------------

  const mapRoutes = useMemo(() => {
    if (!result?.candidates) return [];

    return result.candidates
      .filter((candidate) => candidate.status !== "failed")
      .map((candidate, index) => {
        const points = getCombinedRoutePoints(candidate);

        return {
          id: candidate.route_id || `route-${index}`,
          strategy: candidate.strategy,
          points,
          color:
            STRATEGY_COLORS[candidate.strategy] ||
            DEFAULT_ROUTE_COLOR,
          selected:
            candidate.route_id === activeCandidate?.route_id,
        };
      })
      .filter((route) => route.points.length > 1);
  }, [result, activeCandidate]);

  const routePoints = useMemo(
    () => getCombinedRoutePoints(activeCandidate),
    [activeCandidate]
  );

  // ------------------------------------------------
  // CLEAR RESULTS
  // ------------------------------------------------

  function clearResults() {
    setResult(null);
    setDisplayedCandidate(null);
    setError("");
    setGeminiExplanation("");
    setGeminiError("");
  }

  // ------------------------------------------------
  // ROVER INPUT HANDLER
  // ------------------------------------------------

  function handleRoverChange(event) {
    const { name, value } = event.target;

    setRover((previous) => ({
      ...previous,
      [name]: value === "" ? "" : Number(value),
    }));

    clearResults();
  }

  // ------------------------------------------------
  // MAP SELECTION
  // ------------------------------------------------

  function handleMapSelection(pixel) {
    clearResults();
    handleMapClick(pixel);
  }

  function startNewSelection() {
    resetPoints();
    clearResults();
  }

  // ------------------------------------------------
  // VALIDATE ROVER
  // ------------------------------------------------

  function validateRover() {
    for (const [key, value] of Object.entries(rover)) {
      if (value === "" || !Number.isFinite(Number(value))) {
        return `Please enter a valid number for ${key}.`;
      }

      if (Number(value) < 0) {
        return `${key} cannot be negative.`;
      }
    }

    if (Number(rover.battery_capacity_wh) <= 0) {
      return "Battery capacity must be greater than zero.";
    }

    if (
      Number(rover.average_speed_mps) <= 0 ||
      Number(rover.flat_power_w) <= 0 ||
      Number(rover.rover_mass_kg) <= 0
    ) {
      return "Rover speed, power, and mass must be greater than zero.";
    }

    if (
      Number(rover.reserve_percent) < 0 ||
      Number(rover.reserve_percent) >= 100
    ) {
      return "Battery reserve must be at least 0% and less than 100%.";
    }

    if (
      Number(rover.max_slope_deg) <= 0 ||
      Number(rover.max_slope_deg) > 90
    ) {
      return "Maximum slope must be greater than 0 and at most 90 degrees.";
    }

    if (
      Number(rover.drivetrain_efficiency) <= 0 ||
      Number(rover.drivetrain_efficiency) > 1
    ) {
      return "Drivetrain efficiency must be greater than 0 and at most 1.";
    }

    return null;
  }

  // ------------------------------------------------
  // GEMINI COMPARISON EXPLANATION
  // ------------------------------------------------

  async function generateGeminiExplanation(data) {
    setGeminiLoading(true);
    setGeminiExplanation("");
    setGeminiError("");

    try {
      const candidates = data.candidates || [];

      const comparisonSummary = candidates.map((candidate) => {
        const energy = getCandidateEnergy(candidate);

        return {
          route_id: candidate.route_id,
          strategy: candidate.strategy,
          status: candidate.status,
          feasible: candidate.feasible,
          selected: candidate.selected,
          outbound_distance_m: getOptionalNumber(
            candidate.outbound_distance_m
          ),
          return_distance_m: getOptionalNumber(
            candidate.return_distance_m
          ),
          round_trip_distance_m: getCandidateTotalDistance(candidate),
          round_trip_energy_wh: getCandidateTotalEnergy(candidate),
          maximum_slope_deg: getCandidateMaximumSlope(candidate),
          remaining_battery_percent: getCandidateRemainingBattery(candidate),
          selection_score: getOptionalNumber(candidate.selection_score),
          recommendation: energy.recommendation ?? null,
          reason: candidate.reason ?? null,
        };
      });

      const selected =
        candidates.find(
          (candidate) =>
            candidate.route_id === data.selected_route_id
        ) ||
        candidates.find((candidate) => candidate.selected === true);

      if (!selected) {
        throw new Error(
          "No selected route was returned by the backend."
        );
      }

      const selectedOutbound = getCandidateOutbound(selected);
      const selectedReturn = getCandidateReturn(selected);
      const selectedRoundTrip = getCandidateRoundTrip(selected);

      const selectedDistance = getCandidateTotalDistance(selected);
      const selectedConsumption = getCandidateTotalEnergy(selected);
      const selectedSlope = getCandidateMaximumSlope(selected);

      const outboundTime = getTravelTimeSeconds(selectedOutbound);
      const returnTime = getTravelTimeSeconds(selectedReturn);

      const totalTime =
        outboundTime !== null && returnTime !== null
          ? outboundTime + returnTime
          : getTravelTimeSeconds(selectedRoundTrip);

      const routeMetrics = {
        distance_m: getOptionalNumber(selected.outbound_distance_m) ?? 0,
        mean_slope_deg: 0,
        max_slope_deg: selectedSlope ?? 0,
        ascent_m: 0,
        descent_m: 0,
        estimated_energy_wh:
          getOptionalNumber(selectedOutbound.total_energy_wh) ?? 0,
        estimated_travel_time_seconds: outboundTime ?? 0,
        steep_segments: 0,
        total_segments: Math.max(
          0,
          (selected.outbound_route_pixels || []).length - 1
        ),
      };

      const terrainSummary = `
MARSWALK FOUR-STRATEGY ROVER ROUTE COMPARISON

MISSION DECISION FROM PYTHON BACKEND:
- Overall recommendation: ${data.recommendation ?? "Unavailable"}
- Selected route ID: ${data.selected_route_id || selected.route_id}
- Selected strategy: ${data.recommended_strategy || selected.strategy}
- Selection reason: ${data.recommendation_reason || "Not supplied"}
- Successful candidates: ${data.successful_candidates ?? "Unavailable"}
- Feasible candidates: ${data.feasible_candidates ?? "Unavailable"}
- Maximum allowed slope: ${data.max_allowed_slope_deg ?? "Unavailable"} degrees

MISSION COORDINATES:
- Start pixel: X=${startPoint?.x}, Y=${startPoint?.y}
- Destination pixel: X=${destinationPoint?.x}, Y=${destinationPoint?.y}

ROVER SPECIFICATIONS:
${JSON.stringify(rover, null, 2)}

ALL ROUTE CANDIDATES:
${JSON.stringify(comparisonSummary, null, 2)}

SELECTED ROUTE DETAILS:
- Outbound distance: ${selected.outbound_distance_m ?? "Unavailable"} meters
- Return distance: ${selected.return_distance_m ?? "Unavailable"} meters
- Round-trip distance: ${selectedDistance ?? "Unavailable"} meters
- Outbound energy: ${selectedOutbound.total_energy_wh ?? "Unavailable"} Wh
- Return energy: ${selectedReturn.total_energy_wh ?? "Unavailable"} Wh
- Round-trip energy: ${selectedConsumption ?? "Unavailable"} Wh
- Maximum slope: ${selectedSlope ?? "Unavailable"} degrees
- Remaining battery: ${getCandidateRemainingBattery(selected) ?? "Unavailable"} percent
- Outbound travel time: ${outboundTime ?? "Unavailable"} seconds
- Return travel time: ${returnTime ?? "Unavailable"} seconds
- Total round-trip time: ${totalTime ?? "Unavailable"} seconds

IMPORTANT ANALYSIS INSTRUCTIONS:

1. Compare shortest, safest, energy-efficient and balanced strategies.
2. Explain actual measured differences in distance, energy, maximum slope and remaining battery.
3. Explain why Python selected the recommended route using the supplied selection reason and scores.
4. If the selected route is longer than the shortest route, explain whether its measured slope or energy differences justify the additional distance.
5. If measurements are identical or nearly identical, explicitly state that no measurable advantage was demonstrated.
6. Discuss infeasible candidates and their supplied reasons.
7. Explain practical trade-offs between distance, terrain constraints and energy.
8. Never invent missing terrain measurements.
9. Never change the Python GO/NO-GO decision or independently select another route.
10. Do not claim a route is safer unless supplied slope or feasibility measurements support that statement.
11. Clearly distinguish outbound measurements from round-trip measurements.
12. Do not confuse outbound travel time with round-trip travel time.

DATA LIMITATIONS:

- Mean slope is unavailable. The numeric zero in route_metrics is only a schema placeholder, not a measured value.
- Elevation ascent is unavailable. The numeric zero in route_metrics is only a schema placeholder, not a measured value.
- Elevation descent is unavailable. The numeric zero in route_metrics is only a schema placeholder, not a measured value.
- Steep segment count is unavailable. The numeric zero in route_metrics is only a schema placeholder, not a measured value.
- If outbound travel time is unavailable, its numeric zero is only a schema placeholder, not a measured value.
- Total segment count is derived from the returned outbound route points.
- Missing measurements must be described as unavailable, never as measured zero.
- This is a prototype engineering estimate, not a flight-qualified rover model.

Write a detailed, understandable comparison report with headings and bullet points. Explain why the backend selected its route over the alternatives.
      `.trim();

      const response = await explainMission({
        route_metrics: routeMetrics,
        route_mode:
          data.recommended_strategy ||
          selected.strategy ||
          "balanced",
        terrain_summary: terrainSummary,
      });

      if (!response?.explanation) {
        throw new Error(
          "Gemini returned an empty comparison explanation."
        );
      }

      setGeminiExplanation(response.explanation);
    } catch (err) {
      console.error("Gemini comparison explanation error:", err);

      setGeminiError(
        err?.response?.data?.detail ||
          err?.message ||
          "Could not generate the Gemini route comparison explanation."
      );
    } finally {
      setGeminiLoading(false);
    }
  }

  // ------------------------------------------------
  // COMPARE FOUR ROUTES
  // ------------------------------------------------

  async function calculateRoute() {
    clearResults();

    if (!startPoint || !destinationPoint) {
      setError(
        "Select both a starting point and a destination on the Mars map."
      );
      return;
    }

    if (
      !Number.isFinite(Number(startPoint.x)) ||
      !Number.isFinite(Number(startPoint.y)) ||
      !Number.isFinite(Number(destinationPoint.x)) ||
      !Number.isFinite(Number(destinationPoint.y))
    ) {
      setError("The selected map coordinates are invalid.");
      return;
    }

    if (
      Number(startPoint.x) === Number(destinationPoint.x) &&
      Number(startPoint.y) === Number(destinationPoint.y)
    ) {
      setError("Start and destination cannot be the same pixel.");
      return;
    }

    const validationError = validateRover();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      start_pixel: {
        x: Number(startPoint.x),
        y: Number(startPoint.y),
      },
      destination_pixel: {
        x: Number(destinationPoint.x),
        y: Number(destinationPoint.y),
      },
      algorithm,
      rover: {
        battery_capacity_wh: Number(rover.battery_capacity_wh),
        average_speed_mps: Number(rover.average_speed_mps),
        flat_power_w: Number(rover.flat_power_w),
        rover_mass_kg: Number(rover.rover_mass_kg),
        reserve_percent: Number(rover.reserve_percent),
        max_slope_deg: Number(rover.max_slope_deg),
        rolling_resistance_coefficient: Number(
          rover.rolling_resistance_coefficient
        ),
        drivetrain_efficiency: Number(
          rover.drivetrain_efficiency
        ),
      },
    };

    setLoading(true);

    try {
      const response = await compareRoverRoutes(payload);
      const data = response?.data ?? response;

      if (!data || typeof data !== "object") {
        throw new Error("The backend returned an invalid response.");
      }

      if (data.status !== "success") {
        throw new Error(
          data.message || "The backend could not compare the routes."
        );
      }

      if (!Array.isArray(data.candidates)) {
        throw new Error(
          "The comparison response does not contain route candidates. Check the /api/rover/routes/compare endpoint."
        );
      }

      setResult(data);

      const selected =
        data.candidates.find(
          (candidate) =>
            candidate.route_id === data.selected_route_id
        ) ||
        data.candidates.find(
          (candidate) => candidate.selected === true
        );

      setDisplayedCandidate(selected || null);

      if (selected) {
        await generateGeminiExplanation(data);
      } else {
        setGeminiError(
          "The backend returned candidates but did not identify a selected route."
        );
      }
    } catch (err) {
      console.error("Route comparison error:", err);

      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Could not compare rover routes. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------
  // USER INTERFACE
  // ------------------------------------------------

  return (
    <div className="min-h-screen space-y-6 bg-slate-950 p-4 text-white md:p-8">

      {/* PAGE HEADER */}

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
          Navigation Intelligence
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Rover Route Planner
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Compare four rover navigation strategies using Jezero Crater
          terrain data. Evaluate distance, slope constraints and energy
          consumption before selecting a mission route.
        </p>
      </div>

      {/* MAP SELECTION */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Select Mission Locations
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Choose a selection mode, then click the Jezero map.
            </p>
          </div>

          <button
            type="button"
            onClick={startNewSelection}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Clear Both Points
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Current Map Selection Mode
          </p>

          <p
            className={`mt-1 text-sm font-semibold ${
              selectionMode === "start"
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {selectionMode === "start"
              ? "Select Starting Point"
              : "Select Destination Point"}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={selectStartPoint}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              selectionMode === "start"
                ? "bg-green-600 text-white"
                : "border border-slate-600 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Select Start
          </button>

          <button
            type="button"
            onClick={selectDestinationPoint}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              selectionMode === "destination"
                ? "bg-red-600 text-white"
                : "border border-slate-600 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Select Destination
          </button>
        </div>

        {/* IMPORTANT MAP SELECTION GUIDANCE */}

        <div className="mb-4 rounded-xl border border-red-500 bg-red-950/30 p-4 sm:p-5">

          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-lg">
              ⚠️
            </span>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-red-400">
                Important — Read Before Selecting Mission Points
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Choose an appropriate map zoom level before selecting
                your starting point and destination. For faster route
                calculation, we recommend selecting locations within
                a relatively short operational range.
              </p>
            </div>
          </div>

          {/* THREE MAP ZOOM LEVELS */}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">

            <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-3">
              <p className="text-sm font-bold text-orange-400">
                DETAIL
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Recommended for selecting nearby mission locations
                with precise point placement.
              </p>
            </div>

            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
              <p className="text-sm font-bold text-green-400">
                CLOSE
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Useful for accurately selecting start and destination
                points across a local area.
              </p>
            </div>

            <div className="rounded-lg border border-slate-600 bg-slate-950/70 p-3">
              <p className="text-sm font-bold text-slate-200">
                OVERVIEW
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Best for inspecting the wider Jezero terrain before
                choosing mission locations.
              </p>
            </div>

          </div>

          {/* WHY LONG DISTANCES ARE NOT RECOMMENDED */}

          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3 sm:p-4">

            <h4 className="text-sm font-bold text-red-400">
              Why should you avoid very long-distance selections?
            </h4>

            <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-200">
              <li>
                A* and Dijkstra explore terrain pixels to find a
                traversable route.
              </li>

              <li>
                Longer distances can require exploring many more
                terrain nodes.
              </li>

              <li>
                A calculation may take more than two minutes depending
                on terrain complexity and the selected algorithm.
              </li>

              <li>
                The current backend search limit is 20,000 node
                expansions.
              </li>
            </ul>

            <p className="mt-3 text-xs font-semibold leading-relaxed text-red-300">
              Recommendation: Select a nearby destination to keep
              route comparison practical and responsive.
            </p>

          </div>

          {/* ZOOM EXPLANATION */}

          <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
            <span className="text-red-400">ⓘ</span>

            <p>
              Changing zoom does not reduce the distance between
              selected coordinates. If your destination is too far
              away, zoom in and select a new, closer destination.
              Your selected starting point remains a separate
              coordinate unless you change it.
            </p>
          </div>

        </div>

        {/* SELECTED COORDINATES */}

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-slate-800 p-3">
            <p className="text-slate-400">Starting Pixel</p>

            <p className="mt-1 font-mono text-green-400">
              {startPoint
                ? `X: ${startPoint.x}, Y: ${startPoint.y}`
                : "Not selected"}
            </p>

            {startPoint && (
              <button
                type="button"
                onClick={() => {
                  clearStartPoint();
                  clearResults();
                }}
                className="mt-2 text-xs text-red-300 hover:text-red-200"
              >
                Remove start point
              </button>
            )}
          </div>

          <div className="rounded-lg bg-slate-800 p-3">
            <p className="text-slate-400">Destination Pixel</p>

            <p className="mt-1 font-mono text-red-400">
              {destinationPoint
                ? `X: ${destinationPoint.x}, Y: ${destinationPoint.y}`
                : "Not selected"}
            </p>

            {destinationPoint && (
              <button
                type="button"
                onClick={() => {
                  clearDestinationPoint();
                  clearResults();
                }}
                className="mt-2 text-xs text-red-300 hover:text-red-200"
              >
                Remove destination point
              </button>
            )}
          </div>
        </div>

        {/* ROUTE MAP */}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-700">
          <MarsMap
            className="h-[480px] w-full"
            startPoint={startPoint}
            destinationPoint={destinationPoint}
            routePoints={routePoints}
            routes={mapRoutes}
            onMapClick={handleMapSelection}
            onClearStartPoint={() => {
              clearStartPoint();
              clearResults();
            }}
            onClearDestinationPoint={() => {
              clearDestinationPoint();
              clearResults();
            }}
          />
        </div>

        {/* MAP LEGEND */}

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <p className="mb-3 text-sm font-semibold text-white">
            Route Strategy Legend
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {Object.entries(STRATEGY_LABELS).map(
              ([strategy, label]) => (
                <div
                  key={strategy}
                  className="flex items-center gap-2 text-xs text-slate-300"
                >
                  <span
                    className="h-3 w-6 rounded-full"
                    style={{
                      backgroundColor:
                        STRATEGY_COLORS[strategy],
                    }}
                  />
                  {label}
                </div>
              )
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            After comparison, all successful strategy routes appear
            on the map. The selected route is drawn thicker and on top.
          </p>
        </div>
      </section>

      {/* NAVIGATION CONFIGURATION */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-xl font-semibold">
          Navigation Configuration
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">
              Pathfinding Algorithm
            </span>

            <select
              value={algorithm}
              onChange={(event) => {
                setAlgorithm(event.target.value);
                clearResults();
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-white"
            >
              <option value="astar">A* Search</option>
              <option value="dijkstra">Dijkstra Search</option>
            </select>
          </label>

          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <p className="text-sm font-semibold text-orange-400">
              Four-Strategy Comparison
            </p>

            <p className="mt-1 text-xs text-slate-400">
              The backend evaluates shortest, safest,
              energy-efficient and balanced strategies.
            </p>
          </div>
        </div>

        <h3 className="mt-7 text-lg font-semibold">
          Rover Specifications
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Configure the rover values used by the energy and feasibility model.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="Battery Capacity (Wh)"
            name="battery_capacity_wh"
            value={rover.battery_capacity_wh}
            onChange={handleRoverChange}
          />

          <NumberField
            label="Average Speed (m/s)"
            name="average_speed_mps"
            value={rover.average_speed_mps}
            onChange={handleRoverChange}
          />

          <NumberField
            label="Flat Power (W)"
            name="flat_power_w"
            value={rover.flat_power_w}
            onChange={handleRoverChange}
          />

          <NumberField
            label="Rover Mass (kg)"
            name="rover_mass_kg"
            value={rover.rover_mass_kg}
            onChange={handleRoverChange}
          />

          <NumberField
            label="Battery Reserve (%)"
            name="reserve_percent"
            value={rover.reserve_percent}
            onChange={handleRoverChange}
          />

          <NumberField
            label="Maximum Slope (degrees)"
            name="max_slope_deg"
            value={rover.max_slope_deg}
            onChange={handleRoverChange}
          />

          <NumberField
            label="Rolling Resistance Coefficient"
            name="rolling_resistance_coefficient"
            value={rover.rolling_resistance_coefficient}
            onChange={handleRoverChange}
            step="0.001"
          />

          <NumberField
            label="Drivetrain Efficiency (0–1)"
            name="drivetrain_efficiency"
            value={rover.drivetrain_efficiency}
            onChange={handleRoverChange}
            step="0.01"
          />
        </div>

        <button
          type="button"
          onClick={calculateRoute}
          disabled={loading || !startPoint || !destinationPoint}
          className="mt-6 w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Comparing Four Route Strategies..."
            : "Compare Four Routes"}
        </button>

        {loading && (
          <p className="mt-3 text-center text-sm text-slate-400">
            Calculating outbound and return routes, evaluating rover
            energy and generating the comparison...
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>

      {/* COMPARISON RESULTS */}

      {result && (
        <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">

          <div>
            <h2 className="text-2xl font-bold">
              Route Comparison Results
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Algorithm: {algorithm.toUpperCase()} ·
              Successful candidates: {result.successful_candidates} ·
              Feasible candidates: {result.feasible_candidates}
            </p>
          </div>

          {/* BACKEND RECOMMENDATION */}

          <div
            className={`rounded-xl border p-5 ${
              result.recommendation === "GO"
                ? "border-green-500/30 bg-green-500/5"
                : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <p className="text-sm uppercase tracking-wider text-slate-400">
              Python Backend Recommendation
            </p>

            <h3
              className={`mt-2 text-3xl font-black ${
                result.recommendation === "GO"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {result.recommendation || "NO-GO"}
            </h3>

            <p className="mt-2 text-lg font-semibold text-white">
              Selected strategy:{" "}
              {STRATEGY_LABELS[result.recommended_strategy] ||
                result.recommended_strategy ||
                "Not available"}
            </p>

            <p className="mt-3 text-sm text-slate-300">
              {result.recommendation_reason ||
                "No recommendation reason was supplied."}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ResultValue
                label="Successful Routes"
                value={result.successful_candidates ?? null}
              />

              <ResultValue
                label="Feasible Routes"
                value={result.feasible_candidates ?? null}
              />
            </div>
          </div>

          {/* GEMINI REPORT */}

          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  Gemini Mission Analysis
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Gemini explains the Python backend results.
                  Python remains responsible for the GO/NO-GO decision.
                </p>
              </div>

              {geminiLoading && (
                <span className="text-xs text-orange-400">
                  Generating analysis...
                </span>
              )}
            </div>

            <GeminiReport
              explanation={geminiExplanation}
              loading={geminiLoading}
              error={geminiError}
            />

            {geminiError && (
              <button
                type="button"
                onClick={() => generateGeminiExplanation(result)}
                disabled={geminiLoading}
                className="mt-4 rounded-lg border border-orange-400 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/10 disabled:opacity-50"
              >
                Retry Gemini Analysis
              </button>
            )}
          </div>

          {/* ALL ROUTE CANDIDATES */}

          <div>
            <h3 className="text-xl font-bold">
              Compare All Route Strategies
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              All successful routes are shown on the map.
              Select a candidate below to highlight it.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {(result.candidates || []).map((candidate, index) => (
              <RouteCandidateCard
                key={candidate.route_id || `${candidate.strategy}-${index}`}
                candidate={candidate}
                selected={
                  candidate.route_id === activeCandidate?.route_id
                }
                onSelect={setDisplayedCandidate}
              />
            ))}
          </div>

          {/* ACTIVE ROUTE DETAILS */}

          {activeCandidate && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5">
              <h3 className="text-lg font-bold text-orange-400">
                Route Highlighted on Map
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                {STRATEGY_LABELS[activeCandidate.strategy] ||
                  activeCandidate.strategy}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Route ID: {activeCandidate.route_id}
              </p>

              <p className="mt-3 text-sm text-slate-400">
                The highlighted route displays its outbound path
                followed by its return path, when both are supplied
                by the backend.
              </p>
            </div>
          )}

          {/* RAW BACKEND RESPONSE */}

          <details className="rounded-lg border border-slate-700 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">
              View Complete Backend Comparison Response
            </summary>

            <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap break-words text-xs text-green-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>

        </section>
      )}
    </div>
  );
}
