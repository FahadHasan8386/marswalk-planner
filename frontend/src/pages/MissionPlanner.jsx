
import { useMemo, useState } from "react";
import MarsMap from "../components/MarsMap";
import GeminiReport from "../components/GeminiReport";
import useMarsMap from "../hooks/useMarsMap";
import {
  planRoverMission,
  explainMission,
} from "../services/api";

// --------------------------------------------------
// DEFAULT ROVER SPECIFICATIONS
// --------------------------------------------------

const DEFAULT_ROVER = {
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
// REUSABLE NUMBER INPUT
// --------------------------------------------------

function RoverNumberField({
  label,
  name,
  value,
  onChange,
  min = 0,
  step = "any",
  unit,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
        {unit && <span className="ml-1 text-slate-500">({unit})</span>}
      </label>

      <input
        type="number"
        name={name}
        min={min}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-orange-400"
      />
    </div>
  );
}

// --------------------------------------------------
// FORMATTING HELPERS
// --------------------------------------------------

function formatNumber(value, decimals = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(decimals);
}

function getNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function StatCard({ label, value, unit }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-slate-400">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

// --------------------------------------------------
// MAIN MISSION PLANNER
// --------------------------------------------------

export default function MissionPlanner() {
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
  const [routeMode, setRouteMode] = useState("safest");
  const [rover, setRover] = useState(DEFAULT_ROVER);

  const [missionResult, setMissionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Gemini states
  const [geminiExplanation, setGeminiExplanation] = useState("");
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState("");

  // ------------------------------------------------
  // ROUTE POINTS FOR MAP
  // ------------------------------------------------

  const routeDisplayPoints = useMemo(() => {
    if (!missionResult) {
      return [];
    }

    const outbound =
      missionResult.outbound_route_pixels || [];

    const returning =
      missionResult.return_route_pixels || [];

    return [...outbound, ...returning.slice(1)];
  }, [missionResult]);

  // ------------------------------------------------
  // MAP CLICK HANDLER
  // ------------------------------------------------

  const onMarsMapClick = (pixel) => {
    setMissionResult(null);
    setGeminiExplanation("");
    setGeminiError("");
    setError("");
    handleMapClick(pixel);
  };

  // ------------------------------------------------
  // ROVER SPECIFICATION HANDLER
  // ------------------------------------------------

  const handleRoverChange = (event) => {
    const { name, value } = event.target;

    setRover((previous) => ({
      ...previous,
      [name]: value === "" ? "" : Number(value),
    }));

    setMissionResult(null);
    setGeminiExplanation("");
    setGeminiError("");
  };

  // ------------------------------------------------
  // RESET MISSION
  // ------------------------------------------------

  const handleReset = () => {
    resetPoints();
    setMissionResult(null);
    setGeminiExplanation("");
    setGeminiError("");
    setError("");
  };

  // ------------------------------------------------
  // VALIDATE ROVER SETTINGS
  // ------------------------------------------------

  const validateRover = () => {
    for (const [key, value] of Object.entries(rover)) {
      if (!Number.isFinite(Number(value))) {
        return `Please enter a valid value for ${key}.`;
      }

      if (Number(value) < 0) {
        return `${key} cannot be negative.`;
      }
    }

    if (rover.battery_capacity_wh <= 0) {
      return "Battery capacity must be greater than zero.";
    }

    if (rover.average_speed_mps <= 0) {
      return "Rover speed must be greater than zero.";
    }

    if (rover.flat_power_w <= 0 || rover.rover_mass_kg <= 0) {
      return "Rover power and mass must be greater than zero.";
    }

    if (rover.reserve_percent >= 100) {
      return "Battery reserve must be less than 100%.";
    }

    if (rover.max_slope_deg <= 0 || rover.max_slope_deg > 90) {
      return "Maximum slope must be greater than 0 and at most 90 degrees.";
    }

    if (
      rover.drivetrain_efficiency <= 0 ||
      rover.drivetrain_efficiency > 1
    ) {
      return "Drivetrain efficiency must be greater than 0 and at most 1.";
    }

    return null;
  };

  // ------------------------------------------------
  // SEND MISSION RESULTS TO GEMINI
  // ------------------------------------------------

  const generateGeminiExplanation = async (result) => {
    setGeminiLoading(true);
    setGeminiExplanation("");
    setGeminiError("");

    try {
      const energy = result.energy || {};
      const outbound = energy.outbound || {};
      const returning = energy.return || {};
      const roundTrip = energy.round_trip || {};

      const outboundDistance = getNumber(
        result.outbound_distance_m
      );

      const returnDistance = getNumber(
        result.return_distance_m
      );

      const totalDistance = getNumber(
        roundTrip.total_distance_m,
        outboundDistance + returnDistance
      );

      const outboundEnergy = getNumber(
        outbound.total_energy_wh
      );

      const returnEnergy = getNumber(
        returning.total_energy_wh
      );

      const totalEnergy = getNumber(
        roundTrip.total_energy_wh,
        outboundEnergy + returnEnergy
      );

      const outboundSlope = getNumber(
        outbound.maximum_slope_deg
      );

      const returnSlope = getNumber(
        returning.maximum_slope_deg
      );

      const maximumSlope = Math.max(
        outboundSlope,
        returnSlope
      );

      const totalTravelTimeSeconds =
        getNumber(roundTrip.total_time_hours) * 3600;

      const outboundPixels =
        result.outbound_route_pixels || [];

      const returnPixels =
        result.return_route_pixels || [];

      const totalSegments =
        Math.max(0, outboundPixels.length - 1) +
        Math.max(0, returnPixels.length - 1);

      const routeMetrics = {
        distance_m: totalDistance,
        mean_slope_deg: 0,
        max_slope_deg: maximumSlope,
        ascent_m: 0,
        descent_m: 0,
        estimated_energy_wh: totalEnergy,
        estimated_travel_time_seconds: totalTravelTimeSeconds,
        steep_segments: 0,
        total_segments: totalSegments,
      };

      const terrainSummary = `
MISSION RESULT:
- Mission feasibility: ${energy.mission_feasible ? "FEASIBLE" : "NOT FEASIBLE"}
- Python recommendation: ${energy.recommendation || "UNKNOWN"}
- Python recommendation reason: ${energy.recommendation_reason || "Not provided"}
- Pathfinding algorithm: ${result.algorithm || algorithm}
- Route preference: ${result.route_mode || routeMode}

OUTBOUND JOURNEY:
- Distance: ${outboundDistance} meters
- Energy consumption: ${outboundEnergy} Wh
- Travel time: ${getNumber(outbound.travel_time_seconds)} seconds
- Maximum slope: ${outboundSlope} degrees
- Nodes explored: ${getNumber(result.outbound_nodes_explored)}

RETURN JOURNEY:
- Distance: ${returnDistance} meters
- Energy consumption: ${returnEnergy} Wh
- Travel time: ${getNumber(returning.travel_time_seconds)} seconds
- Maximum slope: ${returnSlope} degrees
- Nodes explored: ${getNumber(result.return_nodes_explored)}

ROUND TRIP:
- Total distance: ${totalDistance} meters
- Total energy: ${totalEnergy} Wh
- Total travel time: ${totalTravelTimeSeconds} seconds
- Remaining battery: ${getNumber(roundTrip.remaining_battery_percent)} percent
- Usable battery: ${getNumber(roundTrip.usable_energy_wh)} Wh
- Total explored nodes: ${getNumber(result.total_nodes_explored)}

ROVER SPECIFICATIONS:
- Battery capacity: ${rover.battery_capacity_wh} Wh
- Average speed: ${rover.average_speed_mps} m/s
- Flat terrain power: ${rover.flat_power_w} W
- Rover mass: ${rover.rover_mass_kg} kg
- Required battery reserve: ${rover.reserve_percent} percent
- Maximum allowed slope: ${rover.max_slope_deg} degrees
- Rolling resistance coefficient: ${rover.rolling_resistance_coefficient}
- Drivetrain efficiency: ${rover.drivetrain_efficiency}

SAFETY CHECKS:
- Battery sufficient: ${energy.checks?.battery_sufficient ? "PASS" : "FAIL"}
- Slope sufficient: ${energy.checks?.slope_sufficient ? "PASS" : "FAIL"}
- Slope violations: ${getNumber(energy.checks?.slope_violation_count)}

DATA LIMITATIONS:
- Mean slope is not supplied by the current mission response.
- Elevation ascent and descent are not supplied by the current mission response.
- Steep segment count is not supplied by the current mission response.
- These unavailable metrics are represented by zero placeholders in the required API fields. They are NOT measured zero values.
- Total segments is estimated from the number of returned route pixel steps.
- Do not invent missing terrain measurements.

Explain the calculated results in clear language. Discuss route difficulty, battery sufficiency, slope constraints, outbound and return travel, explored nodes, and practical mission risks.
The Python recommendation is authoritative. Do not change the GO/NO-GO result.
      `.trim();

      const response = await explainMission({
        route_metrics: routeMetrics,
        route_mode: result.route_mode || routeMode,
        terrain_summary: terrainSummary,
      });

      const explanation = response?.explanation;

      if (!explanation) {
        throw new Error(
          "Gemini returned an empty explanation."
        );
      }

      setGeminiExplanation(explanation);
    } catch (err) {
      console.error("Gemini mission explanation error:", err);

      setGeminiError(
        err.response?.data?.detail ||
        err.message ||
        "Could not generate the Gemini mission explanation."
      );
    } finally {
      setGeminiLoading(false);
    }
  };

  // ------------------------------------------------
  // SUBMIT MISSION TO BACKEND
  // ------------------------------------------------

  const handlePlanMission = async () => {
    setError("");
    setMissionResult(null);
    setGeminiExplanation("");
    setGeminiError("");

    if (!startPoint || !destinationPoint) {
      setError(
        "Please select both a starting point and a destination on the Mars map."
      );
      return;
    }

    if (
      startPoint.x === destinationPoint.x &&
      startPoint.y === destinationPoint.y
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
      route_mode: routeMode,

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
      const result = await planRoverMission(payload);

      if (result.status !== "success") {
        throw new Error(
          result.message || "Mission planning failed."
        );
      }

      setMissionResult(result);
      generateGeminiExplanation(result);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        "An unexpected mission planning error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------
  // RESPONSE DATA
  // ------------------------------------------------

  const energy = missionResult?.energy;
  const outbound = energy?.outbound;
  const returning = energy?.return;
  const roundTrip = energy?.round_trip;

  const isGo = energy?.recommendation === "GO";

  // ------------------------------------------------
  // USER INTERFACE
  // ------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">

      <div className="mx-auto mb-8 max-w-7xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-orange-400">
          MARSWALK / ROVER OPERATIONS
        </p>

        <h1 className="text-3xl font-bold md:text-4xl">
          Mission Planner
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Select your Martian starting point and destination,
          configure rover specifications, and calculate a
          round-trip mission.
        </p>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-3">

        <section className="space-y-5 xl:col-span-2">

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:p-5">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Jezero Crater Terrain Map
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Select a point mode, then click the map.
                </p>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
              >
                Reset points
              </button>
            </div>

            {/* ======================================
                IMPORTANT MAP SELECTION NOTICE
            ====================================== */}

            <div className="mb-5 rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 shadow-lg shadow-red-950/20">

              <div className="flex items-start gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <span className="text-xl">⚠️</span>
                </div>

                <div className="min-w-0">

                  <h3 className="text-base font-extrabold uppercase tracking-wide text-red-400">
                    Important — Read Before Selecting Mission Points
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    Choose an appropriate map zoom level before
                    selecting your starting point and destination.
                    For faster route calculation, we recommend
                    selecting locations within a relatively short
                    operational range.
                  </p>

                </div>

              </div>

              {/* ZOOM LEVEL GUIDE */}

              <div className="mt-4 grid gap-2 sm:grid-cols-3">

                <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 p-3">
                  <p className="font-bold text-orange-300">
                    DETAIL
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Recommended for selecting nearby mission locations.
                  </p>
                </div>

                <div className="rounded-lg border border-green-400/30 bg-green-400/10 p-3">
                  <p className="font-bold text-green-300">
                    CLOSE
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Useful for precise selection of start and destination points.
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                  <p className="font-bold text-slate-200">
                    OVERVIEW
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Best for inspecting the wider terrain before choosing locations.
                  </p>
                </div>

              </div>

              {/* WHY SHORTER DISTANCES ARE RECOMMENDED */}

              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3">

                <p className="font-bold text-red-300">
                  Why should you avoid very long-distance selections?
                </p>

                <ul className="mt-2 list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-300">

                  <li>
                    A* and Dijkstra explore terrain pixels to find a traversable route.
                  </li>

                  <li>
                    Longer distances can require exploring many more terrain nodes.
                  </li>

                  <li>
                    A calculation may take more than two minutes depending on terrain complexity and the selected algorithm.
                  </li>

                  <li>
                    The current backend has a search limit of 20,000 node expansions.
                  </li>

                </ul>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-red-300">
                  Recommendation: Select a nearby destination to keep
                  route calculation practical and responsive.
                </p>

              </div>

              {/* ZOOM CLARIFICATION */}

              <div className="mt-3 flex items-start gap-2">

                <span className="text-red-400">ⓘ</span>

                <p className="text-xs leading-relaxed text-slate-400">
                  Changing zoom does not reduce the distance between
                  selected coordinates. If your destination is too
                  far away, zoom in and select a new, closer destination.
                </p>

              </div>

            </div>

            {/* ======================================
                MAP POINT SELECTION
            ====================================== */}

            <div className="mb-4 grid grid-cols-2 gap-3">

              <button
                type="button"
                onClick={selectStartPoint}
                className={`rounded-xl border p-3 text-sm font-semibold transition ${
                  selectionMode === "start"
                    ? "border-green-400 bg-green-400/10 text-green-300"
                    : "border-white/10 bg-slate-950 text-slate-300 hover:border-green-400/50"
                }`}
              >
                <span className="mr-2">🟢</span>
                Select Start
              </button>

              <button
                type="button"
                onClick={selectDestinationPoint}
                className={`rounded-xl border p-3 text-sm font-semibold transition ${
                  selectionMode === "destination"
                    ? "border-red-400 bg-red-400/10 text-red-300"
                    : "border-white/10 bg-slate-950 text-slate-300 hover:border-red-400/50"
                }`}
              >
                <span className="mr-2">🔴</span>
                Select Destination
              </button>

            </div>

            <div className="min-h-[400px] overflow-hidden rounded-xl border border-white/10 bg-slate-950">

              <MarsMap
                startPoint={startPoint}
                destinationPoint={destinationPoint}
                routePoints={routeDisplayPoints}
                onMapClick={onMarsMapClick}
                onClearStartPoint={clearStartPoint}
                onClearDestinationPoint={clearDestinationPoint}
                className="h-[500px] w-full"
              />

            </div>

            {/* SELECTED COORDINATES */}

            <div className="mt-5 grid gap-3 md:grid-cols-2">

              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <p className="text-sm text-green-400">
                  Start coordinates
                </p>

                <p className="mt-2 font-mono text-sm text-white">
                  {startPoint
                    ? `X: ${startPoint.x} | Y: ${startPoint.y}`
                    : "Not selected"}
                </p>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm text-red-400">
                  Destination coordinates
                </p>

                <p className="mt-2 font-mono text-sm text-white">
                  {destinationPoint
                    ? `X: ${destinationPoint.x} | Y: ${destinationPoint.y}`
                    : "Not selected"}
                </p>
              </div>

            </div>

          </div>

          {/* ROUTE CONFIGURATION */}

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">

            <h2 className="mb-5 text-xl font-semibold">
              Route Configuration
            </h2>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Pathfinding Algorithm
                </label>

                <select
                  value={algorithm}
                  onChange={(event) => {
                    setAlgorithm(event.target.value);
                    setMissionResult(null);
                    setGeminiExplanation("");
                    setGeminiError("");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                >
                  <option value="astar">A* Algorithm</option>
                  <option value="dijkstra">Dijkstra Algorithm</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Route Preference
                </label>

                <select
                  value={routeMode}
                  onChange={(event) => {
                    setRouteMode(event.target.value);
                    setMissionResult(null);
                    setGeminiExplanation("");
                    setGeminiError("");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                >
                  <option value="shortest">Shortest Route</option>
                  <option value="safest">Safest Route</option>
                </select>
              </div>

            </div>

          </div>

        </section>

        {/* ROVER SPECIFICATIONS */}

        <aside className="space-y-5">

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">

            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                Rover Specifications
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Configure the rover's engineering parameters.
              </p>
            </div>

            <div className="space-y-5">

              <RoverNumberField
                label="Battery Capacity"
                name="battery_capacity_wh"
                value={rover.battery_capacity_wh}
                onChange={handleRoverChange}
                unit="Wh"
              />

              <RoverNumberField
                label="Average Speed"
                name="average_speed_mps"
                value={rover.average_speed_mps}
                onChange={handleRoverChange}
                unit="m/s"
              />

              <RoverNumberField
                label="Flat Terrain Power"
                name="flat_power_w"
                value={rover.flat_power_w}
                onChange={handleRoverChange}
                unit="W"
              />

              <RoverNumberField
                label="Rover Mass"
                name="rover_mass_kg"
                value={rover.rover_mass_kg}
                onChange={handleRoverChange}
                unit="kg"
              />

              <RoverNumberField
                label="Battery Reserve"
                name="reserve_percent"
                value={rover.reserve_percent}
                onChange={handleRoverChange}
                unit="%"
              />

              <RoverNumberField
                label="Maximum Allowed Slope"
                name="max_slope_deg"
                value={rover.max_slope_deg}
                onChange={handleRoverChange}
                unit="degrees"
              />

              <RoverNumberField
                label="Rolling Resistance Coefficient"
                name="rolling_resistance_coefficient"
                value={rover.rolling_resistance_coefficient}
                onChange={handleRoverChange}
                step="0.001"
              />

              <RoverNumberField
                label="Drivetrain Efficiency"
                name="drivetrain_efficiency"
                value={rover.drivetrain_efficiency}
                onChange={handleRoverChange}
                step="0.01"
              />

            </div>

            <button
              type="button"
              onClick={() => {
                setRover(DEFAULT_ROVER);
                setMissionResult(null);
                setGeminiExplanation("");
                setGeminiError("");
              }}
              className="mt-5 w-full rounded-lg border border-white/10 py-2 text-sm text-slate-400 transition hover:bg-white/5"
            >
              Restore default specifications
            </button>

          </div>

          {/* CALCULATE MISSION */}

          <button
            type="button"
            onClick={handlePlanMission}
            disabled={loading}
            className="w-full rounded-xl bg-orange-500 px-5 py-4 font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Calculating Mission..."
              : "Calculate Rover Mission"}
          </button>

          {loading && (
            <p className="text-center text-sm text-slate-400">
              Calculating outbound and return routes and estimating energy...
            </p>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <p className="font-semibold">Mission Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

        </aside>

      </div>

      {/* ============================================
          MISSION RESULTS
      ============================================ */}

      {missionResult && energy && (

        <section className="mx-auto mt-8 max-w-7xl space-y-6">

          {/* MISSION FEASIBILITY */}

          <div
            className={`rounded-2xl border p-6 ${
              isGo
                ? "border-green-500/30 bg-green-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >

            <div className="flex flex-wrap items-center justify-between gap-4">

              <div>
                <p className="text-sm uppercase tracking-widest text-slate-400">
                  Mission Feasibility Assessment
                </p>

                <h2
                  className={`mt-2 text-4xl font-black ${
                    isGo ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {energy.recommendation || "UNKNOWN"}
                </h2>

                <p className="mt-3 max-w-3xl text-sm text-slate-300">
                  {energy.recommendation_reason}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/50 px-5 py-4">
                <p className="text-xs uppercase text-slate-500">
                  Mission Status
                </p>

                <p className="mt-2 text-lg font-bold text-white">
                  {energy.mission_feasible
                    ? "FEASIBLE"
                    : "NOT FEASIBLE"}
                </p>
              </div>

            </div>

          </div>

          {/* GEMINI EXPLANATION */}

          <GeminiReport
            explanation={geminiExplanation}
            loading={geminiLoading}
            error={geminiError}
          />

          {/* MISSION OVERVIEW */}

          <div>
            <h2 className="mb-4 text-xl font-bold">
              Mission Overview
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard
                label="Round-trip distance"
                value={formatNumber(roundTrip?.total_distance_m)}
                unit="m"
              />

              <StatCard
                label="Total energy"
                value={formatNumber(roundTrip?.total_energy_wh, 3)}
                unit="Wh"
              />

              <StatCard
                label="Remaining battery"
                value={formatNumber(roundTrip?.remaining_battery_percent)}
                unit="%"
              />

              <StatCard
                label="Total explored nodes"
                value={missionResult.total_nodes_explored ?? "—"}
              />

              <StatCard
                label="Round-trip travel time"
                value={formatNumber(roundTrip?.total_time_hours, 3)}
                unit="hours"
              />

              <StatCard
                label="Usable battery"
                value={formatNumber(roundTrip?.usable_energy_wh)}
                unit="Wh"
              />

              <StatCard
                label="Outbound distance"
                value={formatNumber(missionResult.outbound_distance_m)}
                unit="m"
              />

              <StatCard
                label="Return distance"
                value={formatNumber(missionResult.return_distance_m)}
                unit="m"
              />

            </div>
          </div>

          {/* OUTBOUND AND RETURN JOURNEYS */}

          <div className="grid gap-5 lg:grid-cols-2">

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">

              <h3 className="mb-5 text-lg font-bold text-green-400">
                Outbound Journey
              </h3>

              <div className="space-y-4">

                <StatCard
                  label="Distance"
                  value={formatNumber(outbound?.distance_m, 3)}
                  unit="m"
                />

                <StatCard
                  label="Energy consumption"
                  value={formatNumber(outbound?.total_energy_wh, 3)}
                  unit="Wh"
                />

                <StatCard
                  label="Travel time"
                  value={formatNumber(outbound?.travel_time_seconds)}
                  unit="seconds"
                />

                <StatCard
                  label="Maximum slope"
                  value={formatNumber(outbound?.maximum_slope_deg)}
                  unit="degrees"
                />

                <StatCard
                  label="Nodes explored"
                  value={missionResult.outbound_nodes_explored}
                />

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">

              <h3 className="mb-5 text-lg font-bold text-orange-400">
                Return Journey
              </h3>

              <div className="space-y-4">

                <StatCard
                  label="Distance"
                  value={formatNumber(returning?.distance_m, 3)}
                  unit="m"
                />

                <StatCard
                  label="Energy consumption"
                  value={formatNumber(returning?.total_energy_wh, 3)}
                  unit="Wh"
                />

                <StatCard
                  label="Travel time"
                  value={formatNumber(returning?.travel_time_seconds)}
                  unit="seconds"
                />

                <StatCard
                  label="Maximum slope"
                  value={formatNumber(returning?.maximum_slope_deg)}
                  unit="degrees"
                />

                <StatCard
                  label="Nodes explored"
                  value={missionResult.return_nodes_explored}
                />

              </div>

            </div>

          </div>

          {/* MISSION SAFETY CHECKS */}

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">

            <h3 className="mb-4 text-lg font-bold">
              Mission Safety Checks
            </h3>

            <div className="grid gap-3 md:grid-cols-2">

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">
                  Battery sufficiency
                </p>

                <p className={`mt-2 font-bold ${
                  energy.checks?.battery_sufficient
                    ? "text-green-400"
                    : "text-red-400"
                }`}>
                  {energy.checks?.battery_sufficient
                    ? "PASS"
                    : "FAIL"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">
                  Slope safety
                </p>

                <p className={`mt-2 font-bold ${
                  energy.checks?.slope_sufficient
                    ? "text-green-400"
                    : "text-red-400"
                }`}>
                  {energy.checks?.slope_sufficient
                    ? "PASS"
                    : "FAIL"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">
                  Slope violations
                </p>

                <p className="mt-2 font-bold text-white">
                  {energy.checks?.slope_violation_count ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">
                  Required battery reserve
                </p>

                <p className="mt-2 font-bold text-white">
                  {energy.checks?.required_reserve_percent ?? "—"}%
                </p>
              </div>

            </div>

          </div>

          {/* ENGINEERING MODEL ASSUMPTIONS */}

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">

            <h3 className="mb-4 text-lg font-bold">
              Engineering Model Assumptions
            </h3>

            <ul className="list-inside list-disc space-y-2 text-sm text-slate-400">
              {(energy.model_assumptions || []).map(
                (assumption, index) => (
                  <li key={index}>{assumption}</li>
                )
              )}
            </ul>

          </div>

        </section>
      )}

    </div>
  );
}
