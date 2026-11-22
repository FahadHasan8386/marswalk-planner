
import heapq
import math

import numpy as np

from app.core.config import settings
from app.schemas.pydantic_models import (
    Coordinate,
    MissionRequest,
    RasterPixel,
    RouteMetrics,
    RouteResponse,
)
from app.services.raster_service import get_raster_service
from app.services.terrain_service import get_terrain_service


class RoutingService:
    """
    Mars rover route planning using A* or Dijkstra.

    Route strategies:
        shortest
        safest
        energy_efficient
        balanced

    Maximum allowed slope is always a hard constraint.
    All physical distances are calculated in metres.
    """

    MAX_EXPANSIONS = 20_000
    MAX_ROUTE_COORDINATES = 300

    NEIGHBORS = (
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),
        (-1, -1),
        (-1, 1),
        (1, -1),
        (1, 1),
    )

    VALID_ALGORITHMS = ("astar", "dijkstra")

    VALID_ROUTE_MODES = (
        "shortest",
        "safest",
        "energy_efficient",
        "balanced",
    )

    def __init__(self):

        self.raster = get_raster_service()
        self.terrain = get_terrain_service()

        self.dem = self.terrain.elevation_data
        self.slope_map = self.terrain.slope_map
        self.roughness_map = self.terrain.roughness_map

        self.pixel_width, self.pixel_height = (
            self.raster.get_metric_pixel_size()
        )

        self.energy_per_m = float(
            settings.DEFAULT_ENERGY_WH_PER_M
        )

        self.climb_energy_per_m = float(
            settings.DEFAULT_CLIMB_WH_PER_M
        )

        self.slope_weight = float(
            settings.DEFAULT_SLOPE_WEIGHT
        )

        self.uphill_weight = float(
            settings.DEFAULT_UPHILL_WEIGHT
        )

        self.valid_mask = self.terrain._valid_mask

    # --------------------------------------------------
    # ALGORITHM VALIDATION
    # --------------------------------------------------

    def _validate_options(self, algorithm, route_mode):

        if algorithm not in self.VALID_ALGORITHMS:
            raise ValueError(
                "Invalid algorithm. Choose 'astar' or 'dijkstra'."
            )

        if route_mode not in self.VALID_ROUTE_MODES:
            raise ValueError(
                "Invalid route strategy. Choose "
                "'shortest', 'safest', "
                "'energy_efficient', or 'balanced'."
            )

    # --------------------------------------------------
    # DISTANCE AND HEURISTIC
    # --------------------------------------------------

    def _heuristic(
        self,
        row,
        col,
        goal_row,
        goal_col,
        algorithm,
    ):

        if algorithm == "dijkstra":
            return 0.0

        dx = (goal_col - col) * self.pixel_width
        dy = (goal_row - row) * self.pixel_height

        return math.hypot(dx, dy)

    def _edge_distance(self, dr, dc):

        dx = dc * self.pixel_width
        dy = dr * self.pixel_height

        return math.hypot(dx, dy)

    # --------------------------------------------------
    # TERRAIN VALIDATION
    # --------------------------------------------------

    def _is_traversable(self, row, col, max_slope):

        if (
            row < 0
            or col < 0
            or row >= self.dem.shape[0]
            or col >= self.dem.shape[1]
        ):
            return False

        if not self.valid_mask[row, col]:
            return False

        slope = self.slope_map[row, col]

        if not np.isfinite(slope):
            return False

        return float(slope) <= float(max_slope)

    # --------------------------------------------------
    # EDGE COST
    # --------------------------------------------------

    def _edge_cost(
        self,
        current_row,
        current_col,
        next_row,
        next_col,
        route_mode,
        max_slope,
    ):

        dr = next_row - current_row
        dc = next_col - current_col

        distance = self._edge_distance(dr, dc)

        if route_mode == "shortest":
            return distance

        current_slope = float(
            self.slope_map[current_row, current_col]
        )

        next_slope = float(
            self.slope_map[next_row, next_col]
        )

        average_slope = (
            current_slope + next_slope
        ) / 2.0

        elevation_change = float(
            self.dem[next_row, next_col]
            - self.dem[current_row, current_col]
        )

        uphill = max(elevation_change, 0.0)

        normalized_slope = min(
            average_slope / max(1.0, float(max_slope)),
            1.0,
        )

        slope_penalty = (
            max(self.slope_weight, 0.0)
            * normalized_slope ** 2
        )

        uphill_penalty = (
            max(self.uphill_weight, 0.0)
            * uphill / 10.0
        )

        if route_mode == "safest":

            return (
                distance * (
                    1.0 + 3.0 * slope_penalty
                )
                + 1.5 * uphill_penalty
            )

        if route_mode == "energy_efficient":

            energy_reference = max(
                self.energy_per_m,
                0.001,
            )

            uphill_energy_cost = (
                uphill
                * max(self.climb_energy_per_m, 0.0)
                / energy_reference
            )

            return distance + uphill_energy_cost

        if route_mode == "balanced":

            return (
                distance * (
                    1.0 + 1.5 * slope_penalty
                )
                + 0.75 * uphill_penalty
            )

        raise ValueError(
            f"Unsupported route strategy: {route_mode}"
        )

    # --------------------------------------------------
    # PATH SEARCH: A* AND DIJKSTRA
    # --------------------------------------------------

    def _search_path(
        self,
        start,
        destination,
        algorithm,
        route_mode,
        max_slope,
    ):

        self._validate_options(
            algorithm,
            route_mode,
        )

        start_row, start_col = start
        goal_row, goal_col = destination

        if not self._is_traversable(
            start_row,
            start_col,
            max_slope,
        ):
            raise ValueError(
                "The starting location is not traversable "
                "under the selected maximum slope."
            )

        if not self._is_traversable(
            goal_row,
            goal_col,
            max_slope,
        ):
            raise ValueError(
                "The destination is not traversable "
                "under the selected maximum slope."
            )

        if start == destination:
            raise ValueError(
                "Start and destination resolve to the same raster pixel."
            )

        open_heap = []

        initial_heuristic = self._heuristic(
            start_row,
            start_col,
            goal_row,
            goal_col,
            algorithm,
        )

        heapq.heappush(
            open_heap,
            (
                initial_heuristic,
                0.0,
                start_row,
                start_col,
            ),
        )

        came_from = {}

        g_score = {
            start: 0.0
        }

        closed = set()

        nodes_explored = 0

        while open_heap:

            _, current_cost, row, col = heapq.heappop(
                open_heap
            )

            current = (row, col)

            if current in closed:
                continue

            if current_cost > g_score.get(
                current,
                float("inf"),
            ):
                continue

            if current == (goal_row, goal_col):

                path = self._reconstruct_path(
                    came_from,
                    current,
                )

                return {
                    "path": path,
                    "nodes_explored": nodes_explored,
                    "total_cost": float(current_cost),
                    "algorithm": algorithm,
                    "route_mode": route_mode,
                }

            closed.add(current)

            nodes_explored += 1

            if nodes_explored >= self.MAX_EXPANSIONS:
                raise RuntimeError(
                    "Search reached its expansion limit. "
                    "Try a closer destination or increase "
                    "the search limit."
                )

            for dr, dc in self.NEIGHBORS:

                next_row = row + dr
                next_col = col + dc

                neighbor = (
                    next_row,
                    next_col,
                )

                if neighbor in closed:
                    continue

                if not self._is_traversable(
                    next_row,
                    next_col,
                    max_slope,
                ):
                    continue

                # Prevent diagonal movement through blocked corners.
                if dr != 0 and dc != 0:

                    if not (
                        self._is_traversable(
                            row + dr,
                            col,
                            max_slope,
                        )
                        and self._is_traversable(
                            row,
                            col + dc,
                            max_slope,
                        )
                    ):
                        continue

                step_cost = self._edge_cost(
                    row,
                    col,
                    next_row,
                    next_col,
                    route_mode,
                    max_slope,
                )

                tentative_cost = (
                    current_cost + step_cost
                )

                if tentative_cost < g_score.get(
                    neighbor,
                    float("inf"),
                ):

                    came_from[neighbor] = current

                    g_score[neighbor] = tentative_cost

                    heuristic = self._heuristic(
                        next_row,
                        next_col,
                        goal_row,
                        goal_col,
                        algorithm,
                    )

                    heapq.heappush(
                        open_heap,
                        (
                            tentative_cost + heuristic,
                            tentative_cost,
                            next_row,
                            next_col,
                        ),
                    )

        raise ValueError(
            "No traversable route was found between "
            "the selected locations."
        )

    # --------------------------------------------------
    # LEGACY SEARCH METHOD
    # --------------------------------------------------

    def _find_path(
        self,
        start,
        destination,
        route_mode,
        max_slope,
        algorithm="astar",
    ):

        result = self._search_path(
            start=start,
            destination=destination,
            algorithm=algorithm,
            route_mode=route_mode,
            max_slope=max_slope,
        )

        return result["path"]

    # --------------------------------------------------
    # PATH RECONSTRUCTION
    # --------------------------------------------------

    def _reconstruct_path(self, came_from, current):

        path = [current]

        while current in came_from:

            current = came_from[current]

            path.append(current)

        path.reverse()

        return path

    # --------------------------------------------------
    # FAST ELEVATION ACCESS
    # --------------------------------------------------

    def _get_elevation(self, row, col):

        elevation = float(self.dem[row, col])

        if not math.isfinite(elevation):
            raise ValueError(
                f"Invalid elevation at raster pixel ({col}, {row})."
            )

        return elevation

    # --------------------------------------------------
    # FULL-RESOLUTION TERRAIN SEGMENTS
    # --------------------------------------------------

    def _extract_segments(self, path):

        segments = []

        for index in range(1, len(path)):

            previous = path[index - 1]
            current = path[index]

            dr = current[0] - previous[0]
            dc = current[1] - previous[1]

            distance = self._edge_distance(
                dr,
                dc,
            )

            previous_elevation = self._get_elevation(
                previous[0],
                previous[1],
            )

            current_elevation = self._get_elevation(
                current[0],
                current[1],
            )

            elevation_change = (
                current_elevation - previous_elevation
            )

            slope = math.degrees(
                math.atan2(
                    abs(elevation_change),
                    distance,
                )
            )

            segments.append({
                "distance_m": float(distance),
                "elevation_change_m": float(
                    elevation_change
                ),
                "slope_deg": float(slope),
            })

        return segments

    # --------------------------------------------------
    # ROUTE METRICS
    # --------------------------------------------------

    def _calculate_metrics(
        self,
        path,
        battery_capacity,
        reserve_percent,
        rover_speed,
    ):

        if len(path) < 2:
            raise ValueError(
                "Route must contain at least two pixels."
            )

        if rover_speed <= 0:
            raise ValueError(
                "Rover speed must be greater than zero."
            )

        elevations = np.array(
            [
                self._get_elevation(row, col)
                for row, col in path
            ],
            dtype=np.float64,
        )

        slopes = np.array(
            [
                self.slope_map[row, col]
                for row, col in path
            ],
            dtype=np.float64,
        )

        total_distance = 0.0

        ascent = 0.0
        descent = 0.0

        segment_slopes = []

        for index in range(1, len(path)):

            previous = path[index - 1]
            current = path[index]

            dr = current[0] - previous[0]
            dc = current[1] - previous[1]

            distance = self._edge_distance(
                dr,
                dc,
            )

            elevation_change = (
                elevations[index] - elevations[index - 1]
            )

            total_distance += distance

            if elevation_change > 0:

                ascent += float(elevation_change)

            elif elevation_change < 0:

                descent += abs(float(elevation_change))

            segment_slope = math.degrees(
                math.atan2(
                    abs(float(elevation_change)),
                    distance,
                )
            )

            segment_slopes.append(segment_slope)

        mean_slope = float(np.mean(slopes))

        maximum_slope = float(np.max(slopes))

        steep_segments = sum(
            slope > 15.0
            for slope in segment_slopes
        )

        total_segments = len(segment_slopes)

        estimated_energy = (
            total_distance * self.energy_per_m
            + ascent * self.climb_energy_per_m
        )

        travel_time = (
            total_distance / rover_speed
        )

        remaining_battery = (
            battery_capacity - estimated_energy
        )

        required_reserve = (
            battery_capacity * reserve_percent / 100.0
        )

        reserve_satisfied = (
            remaining_battery >= required_reserve
        )

        metrics = RouteMetrics(
            distance_m=float(total_distance),
            mean_slope_deg=mean_slope,
            max_slope_deg=maximum_slope,
            ascent_m=float(ascent),
            descent_m=float(descent),
            estimated_energy_wh=float(estimated_energy),
            estimated_travel_time_seconds=float(travel_time),
            steep_segments=int(steep_segments),
            total_segments=int(total_segments),
        )

        return (
            metrics,
            float(remaining_battery),
            bool(reserve_satisfied),
        )

    # --------------------------------------------------
    # DISPLAY PATH SAMPLING
    # --------------------------------------------------

    def _select_display_path(self, path):

        if len(path) <= self.MAX_ROUTE_COORDINATES:
            return path

        indices = np.linspace(
            0,
            len(path) - 1,
            self.MAX_ROUTE_COORDINATES,
            dtype=int,
        )

        return [
            path[index]
            for index in indices
        ]

    # --------------------------------------------------
    # PATH TO GEOGRAPHIC COORDINATES
    # --------------------------------------------------

    def _path_to_coordinates(self, path):

        coordinates = []

        for row, col in path:

            latitude, longitude = (
                self.raster.pixel_to_coordinate(
                    row,
                    col,
                )
            )

            coordinates.append(
                Coordinate(
                    latitude=float(latitude),
                    longitude=float(longitude),
                )
            )

        return coordinates

    # --------------------------------------------------
    # PATH TO RASTER PIXELS
    # --------------------------------------------------

    def _path_to_pixels(self, path):

        return [
            RasterPixel(
                x=float(col),
                y=float(row),
            )
            for row, col in path
        ]

    # --------------------------------------------------
    # FULL ROUTE DETAILS FOR ENERGY INTEGRATION
    # --------------------------------------------------

    def plan_route_full(
        self,
        start_pixel,
        destination_pixel,
        algorithm="astar",
        route_mode="safest",
        max_slope=25.0,
    ):

        start = (
            int(round(start_pixel.y)),
            int(round(start_pixel.x)),
        )

        destination = (
            int(round(destination_pixel.y)),
            int(round(destination_pixel.x)),
        )

        search_result = self._search_path(
            start=start,
            destination=destination,
            algorithm=algorithm,
            route_mode=route_mode,
            max_slope=float(max_slope),
        )

        full_path = search_result["path"]

        segments = self._extract_segments(
            full_path
        )

        return {
            "status": "success",
            "algorithm": algorithm,
            "route_mode": route_mode,
            "path": full_path,
            "route_pixels": self._path_to_pixels(
                full_path
            ),
            "route_coordinates": self._path_to_coordinates(
                self._select_display_path(full_path)
            ),
            "segments": segments,
            "nodes_explored": search_result[
                "nodes_explored"
            ],
            "total_cost": search_result[
                "total_cost"
            ],
            "distance_m": float(
                sum(
                    segment["distance_m"]
                    for segment in segments
                )
            ),
        }

    # --------------------------------------------------
    # EXISTING API ROUTE PLANNING
    # --------------------------------------------------

    def plan_route(
        self,
        request: MissionRequest,
        algorithm="astar",
    ):

        try:

            self._validate_options(
                algorithm,
                request.route_mode,
            )

            start = self.raster.coordinate_to_pixel(
                request.start.latitude,
                request.start.longitude,
            )

            destination = self.raster.coordinate_to_pixel(
                request.destination.latitude,
                request.destination.longitude,
            )

            search_result = self._search_path(
                start=start,
                destination=destination,
                algorithm=algorithm,
                route_mode=request.route_mode,
                max_slope=float(request.max_slope_deg),
            )

            path = search_result["path"]

            (
                metrics,
                remaining_battery,
                reserve_satisfied,
            ) = self._calculate_metrics(
                path=path,
                battery_capacity=float(
                    request.battery_capacity_wh
                ),
                reserve_percent=float(
                    request.reserve_percent
                ),
                rover_speed=float(
                    request.rover_speed_mps
                ),
            )

            display_path = self._select_display_path(
                path
            )

            coordinates = self._path_to_coordinates(
                display_path
            )

            pixels = self._path_to_pixels(
                display_path
            )

            message = "Route generated successfully."

            if not reserve_satisfied:

                message = (
                    "A traversable route was found, but the "
                    "estimated remaining battery is below "
                    "the requested reserve."
                )

            return RouteResponse(
                status="success",
                route_mode=request.route_mode,
                route_coordinates=coordinates,
                route_pixels=pixels,
                metrics=metrics,
                estimated_remaining_battery_wh=remaining_battery,
                battery_reserve_satisfied=reserve_satisfied,
                message=message,
            )

        except (ValueError, RuntimeError) as exc:

            return RouteResponse(
                status="failed",
                route_mode=request.route_mode,
                route_coordinates=[],
                route_pixels=[],
                message=str(exc),
            )


# --------------------------------------------------
# SERVICE INSTANCE
# --------------------------------------------------

_routing_service = None


def get_routing_service():

    global _routing_service

    if _routing_service is None:

        _routing_service = RoutingService()

    return _routing_service
