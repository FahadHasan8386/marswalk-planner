
from math import isfinite

from app.schemas.rover_models import (
    RoverEnergyResponse,
    RoverMissionRequest,
    RoverRouteCandidate,
    RoverRouteComparisonResponse,
)
from app.services.rover_energy_service import rover_energy_service
from app.services.routing_service import get_routing_service


class RoverRouteComparisonService:

    STRATEGIES = (
        "shortest",
        "safest",
        "energy_efficient",
        "balanced",
    )

    WEIGHTS = {
        "distance": 0.40,
        "energy": 0.40,
        "slope": 0.20,
    }

    # Differences within these limits are treated as
    # practically equivalent for route selection.
    DISTANCE_TOLERANCE_M = 1.0
    ENERGY_TOLERANCE_WH = 1.0
    SLOPE_TOLERANCE_DEG = 0.1

    # Deterministic preference when candidate scores are equal.
    TIE_BREAK_PRIORITY = {
        "shortest": 0,
        "safest": 1,
        "energy_efficient": 2,
        "balanced": 3,
    }

    def __init__(self):
        self.routing_service = get_routing_service()
        self.energy_service = rover_energy_service

    # --------------------------------------------------
    # PYDANTIC MODEL TO DICTIONARY
    # --------------------------------------------------

    @staticmethod
    def _rover_specs_to_dict(rover_specs):

        if isinstance(rover_specs, dict):
            return rover_specs

        if hasattr(rover_specs, "model_dump"):
            return rover_specs.model_dump()

        if hasattr(rover_specs, "dict"):
            return rover_specs.dict()

        raise ValueError(
            "Rover specifications must be a dictionary or Pydantic model."
        )

    # --------------------------------------------------
    # ENERGY RESPONSE NORMALIZATION
    # --------------------------------------------------

    @staticmethod
    def _normalize_energy_response(result):

        if isinstance(result, RoverEnergyResponse):
            return result

        if isinstance(result, dict):

            if hasattr(RoverEnergyResponse, "model_validate"):
                return RoverEnergyResponse.model_validate(result)

            return RoverEnergyResponse.parse_obj(result)

        if hasattr(result, "model_dump"):

            data = result.model_dump(by_alias=True)

            if hasattr(RoverEnergyResponse, "model_validate"):
                return RoverEnergyResponse.model_validate(data)

            return RoverEnergyResponse.parse_obj(data)

        if hasattr(result, "dict"):

            data = result.dict(by_alias=True)

            if hasattr(RoverEnergyResponse, "model_validate"):
                return RoverEnergyResponse.model_validate(data)

            return RoverEnergyResponse.parse_obj(data)

        raise ValueError(
            "Energy service returned an unsupported response."
        )

    # --------------------------------------------------
    # GENERIC FIELD ACCESS
    # --------------------------------------------------

    @staticmethod
    def _read_field(obj, field, default=None):

        if obj is None:
            return default

        if isinstance(obj, dict):
            return obj.get(field, default)

        return getattr(obj, field, default)

    # --------------------------------------------------
    # ENERGY EXTRACTION
    # --------------------------------------------------

    def _get_total_energy(self, energy):

        round_trip = self._read_field(
            energy,
            "round_trip",
        )

        total = self._read_field(
            round_trip,
            "total_energy_wh",
        )

        if total is not None:
            return float(total)

        outbound = self._read_field(
            energy,
            "outbound",
        )

        return_leg = self._read_field(
            energy,
            "return_leg",
        )

        outbound_energy = self._read_field(
            outbound,
            "total_energy_wh",
        )

        return_energy = self._read_field(
            return_leg,
            "total_energy_wh",
        )

        if (
            outbound_energy is not None
            and return_energy is not None
        ):
            return (
                float(outbound_energy)
                + float(return_energy)
            )

        raise ValueError(
            "Could not extract total round-trip energy."
        )

    # --------------------------------------------------
    # PATH SLOPE EXTRACTION
    # --------------------------------------------------

    def _get_maximum_path_slope(self, path):

        if not path:
            return 0.0

        maximum = 0.0

        for row, col in path:

            slope = float(
                self.routing_service.slope_map[row, col]
            )

            if not isfinite(slope):
                continue

            maximum = max(maximum, slope)

        return maximum

    # --------------------------------------------------
    # CANDIDATE METRICS
    # --------------------------------------------------

    def _get_candidate_metrics(self, candidate):

        distance = (
            float(candidate["outbound_distance_m"])
            + float(candidate["return_distance_m"])
        )

        energy = self._get_total_energy(
            candidate["energy"]
        )

        outbound_path = [
            (
                int(round(pixel.y)),
                int(round(pixel.x)),
            )
            for pixel in candidate["outbound_route_pixels"]
        ]

        return_path = [
            (
                int(round(pixel.y)),
                int(round(pixel.x)),
            )
            for pixel in candidate["return_route_pixels"]
        ]

        outbound_slope = self._get_maximum_path_slope(
            outbound_path
        )

        return_slope = self._get_maximum_path_slope(
            return_path
        )

        maximum_slope = max(
            outbound_slope,
            return_slope,
        )

        return {
            "distance": distance,
            "energy": energy,
            "slope": maximum_slope,
        }

    # --------------------------------------------------
    # TOLERANCE-AWARE NORMALIZATION
    # --------------------------------------------------

    @staticmethod
    def _normalize_values(values, tolerance):

        minimum = min(values)
        maximum = max(values)

        # Do not exaggerate insignificant differences.
        if maximum - minimum <= tolerance:
            return [0.0 for _ in values]

        return [
            (value - minimum) / (maximum - minimum)
            for value in values
        ]

    # --------------------------------------------------
    # CHECK WHETHER CANDIDATES ARE EFFECTIVELY EQUAL
    # --------------------------------------------------

    def _candidates_effectively_equivalent(self, candidates):

        if len(candidates) <= 1:
            return True

        metrics = [
            self._get_candidate_metrics(candidate)
            for candidate in candidates
        ]

        distances = [
            item["distance"]
            for item in metrics
        ]

        energies = [
            item["energy"]
            for item in metrics
        ]

        slopes = [
            item["slope"]
            for item in metrics
        ]

        distance_equivalent = (
            max(distances) - min(distances)
            <= self.DISTANCE_TOLERANCE_M
        )

        energy_equivalent = (
            max(energies) - min(energies)
            <= self.ENERGY_TOLERANCE_WH
        )

        slope_equivalent = (
            max(slopes) - min(slopes)
            <= self.SLOPE_TOLERANCE_DEG
        )

        return (
            distance_equivalent
            and energy_equivalent
            and slope_equivalent
        )

    # --------------------------------------------------
    # CANDIDATE GENERATION
    # --------------------------------------------------

    def _generate_candidate(self, request, strategy):

        candidate = {
            "route_id": f"route_{strategy}",
            "strategy": strategy,
            "status": "failed",
            "algorithm": request.algorithm,
            "outbound_route_pixels": [],
            "return_route_pixels": [],
            "outbound_nodes_explored": 0,
            "return_nodes_explored": 0,
            "total_nodes_explored": 0,
            "outbound_distance_m": None,
            "return_distance_m": None,
            "energy": None,
            "feasible": False,
            "selection_score": None,
            "selected": False,
            "reason": None,
        }

        try:

            rover_specs = self._rover_specs_to_dict(
                request.rover
            )

            # OUTBOUND ROUTE

            outbound = self.routing_service.plan_route_full(
                start_pixel=request.start_pixel,
                destination_pixel=request.destination_pixel,
                algorithm=request.algorithm,
                route_mode=strategy,
                max_slope=float(
                    request.rover.max_slope_deg
                ),
            )

            # RETURN ROUTE

            return_route = self.routing_service.plan_route_full(
                start_pixel=request.destination_pixel,
                destination_pixel=request.start_pixel,
                algorithm=request.algorithm,
                route_mode=strategy,
                max_slope=float(
                    request.rover.max_slope_deg
                ),
            )

            # ROUND-TRIP ENERGY

            energy_result = self.energy_service.calculate_mission(
                outbound_segments=outbound["segments"],
                return_segments=return_route["segments"],
                rover_specs=rover_specs,
            )

            energy = self._normalize_energy_response(
                energy_result
            )

            feasible = bool(energy.mission_feasible)

            candidate.update({
                "status": "success",
                "outbound_route_pixels": outbound["route_pixels"],
                "return_route_pixels": return_route["route_pixels"],
                "outbound_nodes_explored": outbound["nodes_explored"],
                "return_nodes_explored": return_route["nodes_explored"],
                "total_nodes_explored": (
                    outbound["nodes_explored"]
                    + return_route["nodes_explored"]
                ),
                "outbound_distance_m": outbound["distance_m"],
                "return_distance_m": return_route["distance_m"],
                "energy": energy,
                "feasible": feasible,
                "reason": energy.recommendation_reason,
            })

            if not feasible:
                candidate["reason"] = (
                    energy.recommendation_reason
                    or "Candidate failed rover energy or safety checks."
                )

        except Exception as exc:

            candidate["reason"] = (
                f"{type(exc).__name__}: {str(exc)}"
            )

        return candidate

    # --------------------------------------------------
    # CANDIDATE SELECTION
    # --------------------------------------------------

    def _select_best_candidate(self, candidates):

        feasible_candidates = [
            candidate
            for candidate in candidates
            if candidate["status"] == "success"
            and candidate["feasible"]
        ]

        if not feasible_candidates:
            return None

        metrics = [
            self._get_candidate_metrics(candidate)
            for candidate in feasible_candidates
        ]

        distances = [
            item["distance"]
            for item in metrics
        ]

        energies = [
            item["energy"]
            for item in metrics
        ]

        slopes = [
            item["slope"]
            for item in metrics
        ]

        normalized_distances = self._normalize_values(
            distances,
            self.DISTANCE_TOLERANCE_M,
        )

        normalized_energies = self._normalize_values(
            energies,
            self.ENERGY_TOLERANCE_WH,
        )

        normalized_slopes = self._normalize_values(
            slopes,
            self.SLOPE_TOLERANCE_DEG,
        )

        for index, candidate in enumerate(feasible_candidates):

            score = (
                self.WEIGHTS["distance"]
                * normalized_distances[index]
                + self.WEIGHTS["energy"]
                * normalized_energies[index]
                + self.WEIGHTS["slope"]
                * normalized_slopes[index]
            )

            candidate["selection_score"] = round(
                float(score),
                6,
            )

        selected = min(
            feasible_candidates,
            key=lambda candidate: (
                candidate["selection_score"],
                self.TIE_BREAK_PRIORITY.get(
                    candidate["strategy"],
                    99,
                ),
            ),
        )

        selected["selected"] = True

        return selected

    # --------------------------------------------------
    # RECOMMENDATION EXPLANATION
    # --------------------------------------------------

    def _build_recommendation_reason(self, selected, candidates):

        if selected is None:
            return (
                "NO-GO: No candidate route passed all required "
                "round-trip energy and safety checks. "
                "The rover should not begin this mission."
            )

        selected_strategy = selected["strategy"]

        selected_distance = (
            selected["outbound_distance_m"]
            + selected["return_distance_m"]
        )

        selected_energy = self._get_total_energy(
            selected["energy"]
        )

        selected_score = selected["selection_score"]

        feasible_candidates = [
            candidate
            for candidate in candidates
            if candidate["status"] == "success"
            and candidate["feasible"]
        ]

        # Avoid claiming a meaningful advantage when all
        # candidates are practically equivalent.
        if self._candidates_effectively_equivalent(
            feasible_candidates
        ):

            explanation = (
                f"GO: The backend selected the {selected_strategy} "
                f"route. All feasible candidates were effectively "
                f"equivalent within the configured comparison "
                f"tolerances: {self.DISTANCE_TOLERANCE_M:.1f} m "
                f"for distance, {self.ENERGY_TOLERANCE_WH:.1f} Wh "
                f"for energy, and "
                f"{self.SLOPE_TOLERANCE_DEG:.1f} degrees for "
                f"maximum slope. Therefore, the backend used its "
                f"deterministic tie-break preference rather than "
                f"claiming a measurable performance advantage. "
                f"The selected route has a round-trip distance of "
                f"{selected_distance:.2f} metres and estimated "
                f"round-trip energy of {selected_energy:.2f} Wh."
            )

        else:

            explanation = (
                f"GO: The backend selected the {selected_strategy} "
                f"route. It passed round-trip feasibility checks "
                f"and achieved the lowest weighted selection score "
                f"({selected_score:.4f}) among feasible candidates. "
                f"Its round-trip distance is "
                f"{selected_distance:.2f} metres and estimated "
                f"round-trip energy is "
                f"{selected_energy:.2f} Wh. "
                f"Selection weights: 40% distance, 40% energy, "
                f"and 20% maximum terrain slope. Differences smaller "
                f"than the configured comparison tolerances are "
                f"not treated as meaningful advantages."
            )

        shortest = next(
            (
                candidate
                for candidate in candidates
                if candidate["strategy"] == "shortest"
                and candidate["status"] == "success"
            ),
            None,
        )

        if shortest is not None and not shortest["feasible"]:

            explanation += (
                " The shortest candidate was not feasible. "
                "Reason: "
                f"{shortest['reason']}."
            )

        return explanation

    # --------------------------------------------------
    # MAIN COMPARISON
    # --------------------------------------------------

    def compare_routes(
        self,
        request: RoverMissionRequest,
    ) -> RoverRouteComparisonResponse:

        candidates = []

        for strategy in self.STRATEGIES:

            candidate = self._generate_candidate(
                request=request,
                strategy=strategy,
            )

            candidates.append(candidate)

        successful_candidates = sum(
            candidate["status"] == "success"
            for candidate in candidates
        )

        feasible_candidates = sum(
            candidate["feasible"]
            for candidate in candidates
        )

        selected = self._select_best_candidate(candidates)

        if selected is None:

            recommendation = "NO-GO"
            selected_route_id = None
            recommended_strategy = "none"

            status = (
                "success"
                if successful_candidates > 0
                else "failed"
            )

        else:

            recommendation = "GO"
            selected_route_id = selected["route_id"]
            recommended_strategy = selected["strategy"]
            status = "success"

        recommendation_reason = (
            self._build_recommendation_reason(
                selected,
                candidates,
            )
        )

        response_candidates = [
            RoverRouteCandidate(**candidate)
            for candidate in candidates
        ]

        return RoverRouteComparisonResponse(
            status=status,
            recommendation=recommendation,
            selected_route_id=selected_route_id,
            recommended_strategy=recommended_strategy,
            recommendation_reason=recommendation_reason,
            max_allowed_slope_deg=float(
                request.rover.max_slope_deg
            ),
            candidates=response_candidates,
            successful_candidates=successful_candidates,
            feasible_candidates=feasible_candidates,
            message=(
                "Route comparison completed."
                if selected is not None
                else "No feasible route was found."
            ),
        )


# --------------------------------------------------
# SERVICE INSTANCE
# --------------------------------------------------

rover_route_comparison_service = RoverRouteComparisonService()
