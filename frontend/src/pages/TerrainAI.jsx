
import { useEffect, useState } from "react";

import {
  Activity,
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanSearch,
  Upload,
} from "lucide-react";

import { predictTerrain } from "../services/api.js";

// --------------------------------------------------
// FOUR TERRAIN CLASSES
// These colors will be synchronized with the backend.
// --------------------------------------------------

const TERRAIN_CLASSES = [
  {
    id: 0,
    name: "Soil",
    color: "#D8B365",
  },
  {
    id: 1,
    name: "Bedrock",
    color: "#5B8DB8",
  },
  {
    id: 2,
    name: "Sand",
    color: "#2E9D72",
  },
  {
    id: 3,
    name: "Big Rock",
    color: "#D9534F",
  },
];

const formatPercentage = (value) => {
  return `${Number(value || 0).toFixed(2)}%`;
};

const formatConfidence = (value) => {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
};

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

function TerrainAI() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Display all four terrain classes, including Big Rock.
  const visibleClasses = prediction?.classes || [];

  // Use backend-provided RGB colors when available.
  // Otherwise, use the frontend's standard color palette.
  const getTerrainColor = (classId) => {
    const rgb = prediction?.class_colors?.[String(classId)];

    if (
      Array.isArray(rgb) &&
      rgb.length >= 3
    ) {
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }

    return (
      TERRAIN_CLASSES.find(
        (terrain) => terrain.id === Number(classId)
      )?.color || "#64748b"
    );
  };

  // Clean up temporary image preview URLs.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // --------------------------------------------------
  // IMAGE SELECTION
  // --------------------------------------------------

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setPrediction(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Please upload a JPG or PNG image.");
      event.target.value = "";
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("Image size must not exceed 15 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // --------------------------------------------------
  // RUN AI PREDICTION
  // --------------------------------------------------

  const handlePrediction = async () => {
    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setPrediction(null);

      const result = await predictTerrain(selectedFile);

      if (!result || !result.success) {
        throw new Error("Terrain prediction was unsuccessful.");
      }

      setPrediction(result);
    } catch (err) {
      setError(
        err.message || "Unable to process the terrain image."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // RESET
  // --------------------------------------------------

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPrediction(null);
    setError("");
  };

  // --------------------------------------------------
  // IMAGE DISPLAY HELPER
  // --------------------------------------------------

  const getImageSource = (base64) => {
    if (!base64) return null;

    return `data:image/png;base64,${base64}`;
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="space-y-8">

      {/* PAGE HEADER */}

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-space-900 via-space-900 to-mars-950 p-6 sm:p-8">

        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-mars-500/10 blur-3xl" />

        <div className="relative z-10">

          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-mars-400">
            <BrainCircuit size={18} />
            Artificial Intelligence
          </div>

          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            AI Terrain Intelligence
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
            Analyze Mars terrain imagery using the MARSWALK
            U-Net deep learning model. Identify soil, bedrock,
            sand and big rock regions through semantic segmentation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">

            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
              <Activity size={14} />
              AI MODEL AVAILABLE
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              <ScanSearch size={14} />
              4 TERRAIN CLASSES
            </div>

          </div>
        </div>
      </section>

      {/* UPLOAD SECTION */}

      <section className="rounded-2xl border border-white/10 bg-space-900 p-5 sm:p-7">

        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">
            Terrain Image Analysis
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Upload a Mars terrain image to generate an AI
            segmentation prediction.
          </p>
        </div>

        <label
          htmlFor="terrain-image"
          className="flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-6 text-center transition hover:border-mars-500/50 hover:bg-mars-500/5"
        >

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected Mars terrain"
              className="max-h-[300px] max-w-full rounded-lg object-contain"
            />
          ) : (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-mars-500/10 text-mars-400">
                <ImagePlus size={32} />
              </div>

              <h3 className="text-lg font-semibold text-white">
                Upload Mars Terrain Image
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Click to browse and select a JPG or PNG image.
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Maximum file size: 15 MB
              </p>
            </>
          )}

          <input
            id="terrain-image"
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageSelection}
            className="hidden"
          />

        </label>

        {selectedFile && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {selectedFile.name}
              </p>

              <p className="text-xs text-slate-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>

            <button
              onClick={handleReset}
              disabled={loading}
              className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remove image
            </button>

          </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* ACTION BUTTONS */}

        <div className="mt-6 flex flex-wrap gap-3">

          <button
            onClick={handlePrediction}
            disabled={!selectedFile || loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-mars-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-mars-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing Image...
              </>
            ) : (
              <>
                <ScanSearch size={18} />
                Predict Terrain
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            disabled={loading || (!selectedFile && !prediction)}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            <RefreshCw size={16} />
            Reset
          </button>

        </div>

        {loading && (
          <div className="mt-5 rounded-lg border border-mars-500/20 bg-mars-500/5 p-4">

            <div className="flex items-center gap-3 text-sm text-mars-300">
              <Loader2 size={18} className="animate-spin" />
              Running MARSWALK U-Net inference on the backend...
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Image preprocessing, model inference and
              segmentation generation are in progress.
            </p>

          </div>
        )}

      </section>

      {/* PREDICTION RESULTS */}

      {prediction && (
        <section className="space-y-7">

          {/* SUCCESS HEADER */}

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={20} />

                <span className="text-sm font-semibold">
                  TERRAIN PREDICTION COMPLETED
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-bold text-white">
                Segmentation Results
              </h2>
            </div>

            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
              {prediction.device?.toUpperCase() || "CPU"} INFERENCE
            </span>

          </div>

          {/* SUMMARY CARDS */}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <div className="rounded-xl border border-white/10 bg-space-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Overall Mean Confidence
              </p>

              <p className="mt-3 text-3xl font-bold text-mars-400">
                {formatConfidence(prediction.overall_mean_confidence)}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Mean maximum softmax probability
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Input Resolution
              </p>

              <p className="mt-3 text-3xl font-bold text-white">
                {prediction.input_image?.width} ×{" "}
                {prediction.input_image?.height}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Original uploaded image
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Model Output
              </p>

              <p className="mt-3 text-3xl font-bold text-white">
                {prediction.output_image?.width} ×{" "}
                {prediction.output_image?.height}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Segmentation resolution
              </p>
            </div>

          </div>

          {/* IMAGE VISUALIZATIONS */}

          <div>
            <h3 className="mb-4 text-xl font-bold text-white">
              Segmentation Visualization
            </h3>

            <div className="grid gap-5 lg:grid-cols-3">

              {/* ORIGINAL */}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-space-900">

                <div className="border-b border-white/10 p-4">
                  <h4 className="font-semibold text-white">
                    Original Image
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    Uploaded terrain photograph
                  </p>
                </div>

                <div className="flex min-h-[220px] items-center justify-center bg-black/20 p-3">
                  <img
                    src={previewUrl}
                    alt="Original terrain"
                    className="max-h-[300px] max-w-full rounded-lg object-contain"
                  />
                </div>

              </div>

              {/* SEGMENTATION */}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-space-900">

                <div className="border-b border-white/10 p-4">
                  <h4 className="font-semibold text-white">
                    Segmentation Map
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    Backend-generated predicted terrain classes
                  </p>
                </div>

                <div className="flex min-h-[220px] items-center justify-center bg-black/20 p-3">
                  <img
                    src={getImageSource(prediction.segmentation_base64)}
                    alt="Terrain segmentation map"
                    className="max-h-[300px] max-w-full rounded-lg object-contain"
                  />
                </div>

                <a
                  href={getImageSource(prediction.segmentation_base64)}
                  download="marswalk_segmentation.png"
                  className="block border-t border-white/10 p-3 text-center text-xs font-medium text-mars-400 hover:bg-white/5"
                >
                  Download Segmentation
                </a>

              </div>

              {/* OVERLAY */}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-space-900">

                <div className="border-b border-white/10 p-4">
                  <h4 className="font-semibold text-white">
                    Segmentation Overlay
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    Terrain prediction blended with image
                  </p>
                </div>

                <div className="flex min-h-[220px] items-center justify-center bg-black/20 p-3">
                  <img
                    src={getImageSource(prediction.overlay_base64)}
                    alt="Terrain segmentation overlay"
                    className="max-h-[300px] max-w-full rounded-lg object-contain"
                  />
                </div>

                <a
                  href={getImageSource(prediction.overlay_base64)}
                  download="marswalk_overlay.png"
                  className="block border-t border-white/10 p-3 text-center text-xs font-medium text-mars-400 hover:bg-white/5"
                >
                  Download Overlay
                </a>

              </div>

            </div>
          </div>

          {/* FOUR-CLASS TERRAIN LEGEND AND DISTRIBUTION */}

          <div className="rounded-xl border border-white/10 bg-space-900 p-5">

            <h3 className="mb-5 text-lg font-bold text-white">
              Terrain Class Distribution
            </h3>

            {/* FOUR-CLASS LEGEND */}

            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">

              {TERRAIN_CLASSES.map((terrain) => (
                <div
                  key={terrain.id}
                  className="flex items-center gap-2 text-sm text-slate-300"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: getTerrainColor(terrain.id),
                    }}
                  />

                  {terrain.name}
                </div>
              ))}

            </div>

            {/* FOUR-CLASS DISTRIBUTION BAR */}

            <div className="flex h-6 w-full overflow-hidden rounded-full bg-white/5">

              {visibleClasses.map((terrain) => (
                <div
                  key={terrain.class_id}
                  title={`${terrain.class_name}: ${formatPercentage(terrain.percentage)}`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, Number(terrain.percentage))
                    )}%`,
                    backgroundColor: getTerrainColor(terrain.class_id),
                  }}
                />
              ))}

            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              All four model-predicted terrain classes are displayed.
              Distribution percentages retain their original model-reported values.
            </p>

            {/* FOUR-CLASS STATISTICS */}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {visibleClasses.map((terrain) => (
                <div
                  key={terrain.class_id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
                >

                  <div className="flex items-center gap-2">

                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: getTerrainColor(terrain.class_id),
                      }}
                    />

                    <span className="text-sm font-medium text-slate-300">
                      {terrain.class_name}
                    </span>

                  </div>

                  <p className="mt-3 text-2xl font-bold text-white">
                    {formatPercentage(terrain.percentage)}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {Number(terrain.pixel_count).toLocaleString()} pixels
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Mean confidence:{" "}
                    {formatConfidence(terrain.mean_confidence)}
                  </p>

                </div>
              ))}

            </div>
          </div>

          {/* SCIENTIFIC NOTE */}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">

            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle size={19} />

              <h3 className="font-semibold">
                Scientific Limitations
              </h3>
            </div>

            <p className="mt-3 text-sm leading-7 text-slate-300">
              {prediction.scientific_note ||
                "These predictions are based on the AI4MARS training dataset and have not been validated for orbital Jezero orthomosaic imagery or autonomous rover safety decisions."}
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Model confidence is not equivalent to measured
              prediction accuracy or verified terrain safety.
            </p>

          </div>

        </section>
      )}

      {/* EMPTY RESULTS STATE */}

      {!prediction && !loading && (
        <div className="rounded-xl border border-white/10 bg-space-900/60 p-6 text-center">

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-mars-500/10 text-mars-400">
            <Upload size={24} />
          </div>

          <h3 className="mt-4 font-semibold text-white">
            Ready for Terrain Analysis
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Select a terrain image and click Predict Terrain.
            Your trained U-Net model will generate a segmentation
            map and terrain statistics for all four terrain classes.
          </p>

        </div>
      )}

    </div>
  );
}

export default TerrainAI;
