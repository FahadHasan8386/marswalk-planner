
import { useCallback, useMemo, useState } from "react";

const RASTER_WIDTH = 3900;
const RASTER_HEIGHT = 4103;

// The projected DEM has a 1 metre pixel resolution.
const METRES_PER_PIXEL = 1;

function useMarsMap() {
  const [startPoint, setStartPoint] = useState(null);
  const [destinationPoint, setDestinationPoint] = useState(null);
  const [selectionMode, setSelectionMode] = useState("start");

  const handleMapClick = useCallback(
    ({ pixel_x, pixel_y }) => {
      if (
        !Number.isFinite(pixel_x) ||
        !Number.isFinite(pixel_y) ||
        pixel_x < 0 ||
        pixel_x >= RASTER_WIDTH ||
        pixel_y < 0 ||
        pixel_y >= RASTER_HEIGHT
      ) {
        return;
      }

      const point = {
        x: Math.round(pixel_x),
        y: Math.round(pixel_y),
      };

      if (selectionMode === "start") {
        setStartPoint(point);
        setSelectionMode("destination");
      } else {
        setDestinationPoint(point);
        setSelectionMode("start");
      }
    },
    [selectionMode]
  );

  const clearStartPoint = useCallback(() => {
    setStartPoint(null);
    setSelectionMode("start");
  }, []);

  const clearDestinationPoint = useCallback(() => {
    setDestinationPoint(null);
    setSelectionMode("destination");
  }, []);

  const resetPoints = useCallback(() => {
    setStartPoint(null);
    setDestinationPoint(null);
    setSelectionMode("start");
  }, []);

  const selectStartPoint = useCallback(() => {
    setSelectionMode("start");
  }, []);

  const selectDestinationPoint = useCallback(() => {
    setSelectionMode("destination");
  }, []);

  // Keep the original start point and allow the user
  // to choose a different destination.
  const reselectDestination = useCallback(() => {
    setDestinationPoint(null);
    setSelectionMode("destination");
  }, []);

  // Approximate straight-line distance, not routed distance.
  const straightLineDistanceMeters = useMemo(() => {
    if (!startPoint || !destinationPoint) {
      return null;
    }

    const pixelDistance = Math.hypot(
      destinationPoint.x - startPoint.x,
      destinationPoint.y - startPoint.y
    );

    return pixelDistance * METRES_PER_PIXEL;
  }, [startPoint, destinationPoint]);

  return {
    startPoint,
    destinationPoint,
    selectionMode,

    handleMapClick,
    clearStartPoint,
    clearDestinationPoint,
    resetPoints,

    selectStartPoint,
    selectDestinationPoint,
    reselectDestination,
    setSelectionMode,

    straightLineDistanceMeters,

    hasBothPoints: Boolean(startPoint && destinationPoint),
  };
}

export default useMarsMap;
