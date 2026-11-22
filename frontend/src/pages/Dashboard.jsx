
import { useState } from "react";

import {
  Activity,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Compass,
  Cpu,
  Crosshair,
  Database,
  FlaskConical,
  Layers3,
  Map,
  Mountain,
  Navigation,
  Orbit,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

// ==================================================
// REUSABLE STAT CARD
// ==================================================

function StatCard({ icon: Icon, label, value, unit, description }) {
  return (
    <div className="glass-panel rounded-2xl p-5 transition-all hover:border-mars-500/30">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mars-500/10 text-mars-400">
          <Icon size={20} />
        </div>

        <TrendingUp size={16} className="text-slate-600" />
      </div>

      <p className="mt-5 text-sm text-slate-400">{label}</p>

      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-white">
          {value}
        </span>

        {unit && (
          <span className="text-sm text-slate-500">{unit}</span>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

// ==================================================
// REUSABLE FEATURE CARD
// ==================================================

function FeatureCard({
  icon: Icon,
  title,
  description,
  items,
  benefit,
  color,
  onClick,
  action,
}) {
  return (
    <div className="glass-panel flex flex-col rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-mars-500/30">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}
      >
        <Icon size={23} />
      </div>

      <h3 className="mt-5 text-lg font-bold text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <div className="mt-5 space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-2 text-xs leading-5 text-slate-300"
          >
            <CheckCircle2
              size={14}
              className="mt-0.5 shrink-0 text-emerald-400"
            />
            {item}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.025] p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-mars-400">
          User Benefit
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {benefit}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-mars-400 transition hover:text-mars-300"
      >
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ==================================================
// USER MANUAL STEP
// ==================================================

function ManualStep({
  number,
  icon: Icon,
  title,
  description,
  details,
  isOpen,
  onToggle,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mars-500/10 text-mars-400">
          <Icon size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-mars-400">
            STEP {number}
          </p>

          <h3 className="mt-1 text-sm font-semibold text-white">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 pl-[72px]">
          <p className="text-sm leading-6 text-slate-300">
            {details}
          </p>
        </div>
      )}
    </div>
  );
}

// ==================================================
// MAIN DASHBOARD
// ==================================================

function Dashboard({ onNavigate }) {
  const [openManualStep, setOpenManualStep] = useState(1);

  // Navigation IDs must match the IDs in App.jsx.
  const navigate = (page) => {
    if (typeof onNavigate === "function") {
      onNavigate(page);
    }
  };

  // Exactly three main interactive modules.
  const mainFeatures = [
    {
      icon: Compass,
      title: "Mission Planner",
      description:
        "Configure Mars rover exploration missions and evaluate mission requirements.",
      color: "bg-amber-500/10 text-amber-400",
      status: "Implemented",
      items: [
        "Configure rover mission parameters.",
        "Evaluate mission requirements.",
        "Review rover energy estimates.",
        "Read Gemini-generated explanations where available.",
      ],
      benefit:
        "Understand mission requirements and review estimated rover resources before evaluating an exploration plan.",
      action: "Open Mission Planner",
      page: "mission",
    },
    {
      icon: Route,
      title: "Rover Route Planner",
      description:
        "Calculate and compare navigation routes using Jezero Crater terrain data.",
      color: "bg-blue-500/10 text-blue-400",
      status: "Implemented",
      items: [
        "Set starting and destination coordinates.",
        "Configure maximum allowed slope.",
        "Calculate rover navigation routes.",
        "Compare shortest and safest strategies.",
      ],
      benefit:
        "Explore alternative navigation paths and understand the trade-offs between route distance and terrain-related costs.",
      action: "Open Route Planner",
      page: "routes",
    },
    {
      icon: BrainCircuit,
      title: "AI Terrain Intelligence",
      description:
        "Analyze Mars rover-camera imagery using a PyTorch U-Net segmentation model.",
      color: "bg-purple-500/10 text-purple-400",
      status: "AI Prototype",
      items: [
        "Upload JPG or PNG terrain images.",
        "Generate semantic segmentation maps.",
        "View prediction overlays.",
        "Review displayed Soil, Bedrock and Sand statistics.",
      ],
      benefit:
        "Explore how deep learning can identify terrain categories from rover-camera imagery and support future visual perception systems.",
      action: "Open AI Terrain Intelligence",
      page: "terrain-ai",
    },
  ];

  // User manual: the steps describe workflows, not additional pages.
  const manualSteps = [
    {
      number: 1,
      icon: Orbit,
      title: "Explore the Dashboard",
      description:
        "Understand the project and its three main modules.",
      details:
        "Start here to review the MARSWALK overview, Jezero Crater dataset information, terrain statistics, project capabilities and user manual.",
    },
    {
      number: 2,
      icon: Mountain,
      title: "Understand Jezero Crater Terrain",
      description:
        "Review the elevation, slope and roughness information.",
      details:
        "MARSWALK uses processed Jezero Crater Digital Elevation Model (DEM) data. Terrain information such as elevation, slope and roughness supports the terrain assessment and route-planning workflows. These are supporting capabilities, not separate dashboard pages.",
    },
    {
      number: 3,
      icon: Compass,
      title: "Configure a Rover Mission",
      description:
        "Use Mission Planner to set up an exploration mission.",
      details:
        "Open Mission Planner from the navigation menu or the dashboard. Enter the required mission configuration and destination information, then submit the mission request. Review the generated assessment and available energy estimates.",
    },
    {
      number: 4,
      icon: Route,
      title: "Calculate and Compare Routes",
      description:
        "Use the Rover Route Planner to evaluate navigation options.",
      details:
        "Open Rover Route Planner. Enter the starting and destination coordinates, configure the maximum allowed slope and select Plan Route or Compare Routes. Review the available route results and their reported costs.",
    },
    {
      number: 5,
      icon: BrainCircuit,
      title: "Analyze an Image with AI",
      description:
        "Use the AI Terrain Intelligence module.",
      details:
        "Open AI Terrain Intelligence and upload a supported JPG or PNG rover-camera image within the application's upload limit. Run the U-Net prediction to view the original image, segmentation result, overlay and available terrain-class statistics.",
    },
    {
      number: 6,
      icon: Sparkles,
      title: "Interpret Your Results",
      description:
        "Review the results produced by the platform.",
      details:
        "Review mission assessments, route information, energy estimates and AI prediction outputs in their respective modules. Where available, use Gemini Intelligence to obtain a natural-language explanation of backend-generated mission results. AI image predictions are a separate visual analysis workflow.",
    },
  ];

  return (
    <div className="space-y-10">

      {/* ==================================================
          1. PROJECT HERO
      ================================================== */}

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-space-900 via-space-900 to-mars-950 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-mars-500/10 blur-3xl" />

        <div className="absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-mars-400">
            <Orbit size={16} />
            Mars Exploration Intelligence Platform
          </div>

          <h1 className="max-w-3xl font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            MARSWALK
            <span className="text-gradient">
              {" "}Intelligent Mars Exploration.
            </span>
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            An integrated Mars rover terrain intelligence and
            mission planning platform combining geospatial
            terrain analysis, intelligent route planning,
            rover energy estimation and AI-based visual
            terrain perception using Jezero Crater data.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("mission")}
              className="flex items-center gap-2 rounded-xl mars-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-mars-500/10 transition hover:brightness-110"
            >
              <Compass size={17} />
              Plan a Mission
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => navigate("terrain-ai")}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-mars-400/40 hover:bg-mars-500/10"
            >
              <BrainCircuit size={17} />
              Explore AI Intelligence
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <span className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle2 size={14} />
              DEM Data Integrated
            </span>

            <span className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle2 size={14} />
              Route Engine
            </span>

            <span className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
              <BrainCircuit size={14} />
              U-Net AI Prototype
            </span>
          </div>
        </div>
      </section>

      {/* ==================================================
          2. THREE ACTUAL PROJECT MODULES
      ================================================== */}

      <section>
        <div className="mb-5">
          <div className="flex items-center gap-2 text-mars-400">
            <Layers3 size={18} />

            <span className="text-xs font-semibold uppercase tracking-wider">
              What MARSWALK Offers
            </span>
          </div>

          <h2 className="mt-2 font-display text-2xl font-bold text-white">
            Project Capabilities
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Explore the three main interactive modules available
            in the MARSWALK platform.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {mainFeatures.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.page}
                className="glass-panel flex flex-col rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-mars-500/30"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                  >
                    <Icon size={23} />
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      feature.status === "AI Prototype"
                        ? "border border-amber-500/20 bg-amber-500/5 text-amber-400"
                        : "border border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                    }`}
                  >
                    {feature.status}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-white">
                  {feature.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {feature.description}
                </p>

                <ul className="mt-4 space-y-2">
                  {feature.items.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-xs leading-5 text-slate-300"
                    >
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 shrink-0 text-emerald-400"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => navigate(feature.page)}
                  className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-mars-400 transition hover:text-mars-300"
                >
                  {feature.action}
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================================================
          3. THREE MAIN USER BENEFITS
      ================================================== */}

      <section>
        <div className="mb-5">
          <div className="flex items-center gap-2 text-mars-400">
            <Target size={18} />

            <span className="text-xs font-semibold uppercase tracking-wider">
              Platform Value
            </span>
          </div>

          <h2 className="mt-2 font-display text-2xl font-bold text-white">
            What Can You Do with MARSWALK?
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Three core capabilities designed to support
            intelligent Mars rover exploration.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <FeatureCard
            icon={Mountain}
            title="1. Understand the Terrain"
            description="Explore the physical characteristics of the Martian landscape."
            color="bg-amber-500/10 text-amber-400"
            items={[
              "Inspect elevation data.",
              "Analyze terrain slope.",
              "Examine surface roughness.",
              "Visualize Jezero Crater data.",
            ]}
            benefit="Gain a better understanding of terrain conditions before evaluating rover movement."
            action="Open Route Planner"
            onClick={() => navigate("routes")}
          />

          <FeatureCard
            icon={Navigation}
            title="2. Plan Rover Navigation"
            description="Evaluate possible paths between rover locations."
            color="bg-blue-500/10 text-blue-400"
            items={[
              "Set start and destination coordinates.",
              "Configure maximum allowed slope.",
              "Compare shortest and safest routes.",
              "Review route and energy estimates.",
            ]}
            benefit="Compare navigation alternatives and understand potential terrain and energy trade-offs."
            action="Open Route Planner"
            onClick={() => navigate("routes")}
          />

          <FeatureCard
            icon={BrainCircuit}
            title="3. Analyze Terrain with AI"
            description="Explore deep learning-based visual terrain perception."
            color="bg-purple-500/10 text-purple-400"
            items={[
              "Upload Mars terrain photographs.",
              "Generate U-Net segmentation maps.",
              "View prediction overlays.",
              "Review available class statistics.",
            ]}
            benefit="Explore how AI can interpret rover-camera imagery and support future visual perception systems."
            action="Try AI Analysis"
            onClick={() => navigate("terrain-ai")}
          />
        </div>
      </section>

      {/* ==================================================
          4. JEZERO CRATER DATA
      ================================================== */}

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-space-900">
        <div className="absolute inset-0">
          <img
            src="/jesero_ortho.png"
            alt="Jezero Crater Mars orthomosaic"
            className="h-full w-full object-cover opacity-30"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-space-950 via-space-950/80 to-space-950/30" />
        </div>

        <div className="relative z-10 grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mars-400/20 bg-mars-500/10 px-3 py-1.5 text-xs font-semibold text-mars-300">
              <Crosshair size={13} />
              STUDY REGION
            </div>

            <h2 className="font-display text-3xl font-bold text-white">
              Jezero Crater
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-300">
              MARSWALK uses processed Jezero Crater elevation
              and surface imagery data as the geographical
              foundation for its terrain intelligence and
              rover navigation capabilities.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <Mountain size={14} className="text-mars-400" />
                Mars Terrain
              </span>

              <span className="flex items-center gap-2">
                <Database size={14} className="text-mars-400" />
                DEM Data
              </span>

              <span className="flex items-center gap-2">
                <Target size={14} className="text-mars-400" />
                1m Resolution
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate("routes")}
              className="mt-6 flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-mars-400/40 hover:bg-mars-500/10"
            >
              <Map size={17} className="text-mars-400" />
              Open Route Planner
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-space-950/70 p-4 backdrop-blur-md">
              <Mountain size={20} className="text-mars-400" />

              <p className="mt-3 text-2xl font-bold text-white">
                3900 × 4103
              </p>

              <p className="mt-1 text-xs text-slate-400">
                DEM Dimensions
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-950/70 p-4 backdrop-blur-md">
              <Crosshair size={20} className="text-mars-400" />

              <p className="mt-3 text-2xl font-bold text-white">
                1 m
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Pixel Resolution
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-950/70 p-4 backdrop-blur-md">
              <Activity size={20} className="text-mars-400" />

              <p className="mt-3 text-2xl font-bold text-white">
                4.72°
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Mean Slope
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-950/70 p-4 backdrop-blur-md">
              <TrendingUp size={20} className="text-mars-400" />

              <p className="mt-3 text-2xl font-bold text-white">
                249.18 m
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Elevation Range
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          5. TERRAIN STATISTICS
      ================================================== */}

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Terrain Intelligence
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Statistics calculated from the processed Jezero DEM.
            </p>
          </div>

          <span className="hidden items-center gap-2 text-xs text-emerald-400 sm:flex">
            <ShieldCheck size={15} />
            Raster Loaded
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Mountain}
            label="Elevation Range"
            value="249.18"
            unit="m"
            description="Minimum to maximum elevation difference"
          />

          <StatCard
            icon={Activity}
            label="Mean Slope"
            value="4.72"
            unit="°"
            description="Average calculated terrain slope"
          />

          <StatCard
            icon={Crosshair}
            label="Map Resolution"
            value="1"
            unit="m / pixel"
            description="Projected raster pixel size"
          />

          <StatCard
            icon={Target}
            label="DEM Coverage"
            value="3900 × 4103"
            unit="pixels"
            description="Processed Mars elevation raster"
          />
        </div>
      </section>

      {/* ==================================================
          6. INTERACTIVE USER MANUAL
      ================================================== */}

      <section className="glass-panel rounded-2xl p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mars-500/10 text-mars-400">
              <BookOpen size={24} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-mars-400">
                Getting Started
              </p>

              <h2 className="mt-1 font-display text-xl font-bold text-white">
                MARSWALK User Manual
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Learn how to use the platform step by step.
              </p>
            </div>
          </div>

          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
            6 Steps
          </span>
        </div>

        <div className="space-y-3">
          {manualSteps.map((step) => (
            <ManualStep
              key={step.number}
              {...step}
              isOpen={openManualStep === step.number}
              onToggle={() =>
                setOpenManualStep(
                  openManualStep === step.number
                    ? null
                    : step.number
                )
              }
            />
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-mars-500/15 bg-mars-500/5 p-4">
          <div className="flex items-center gap-2 text-mars-300">
            <FlaskConical size={17} />

            <p className="text-sm font-semibold">
              Important Usage Note
            </p>
          </div>

          <p className="mt-2 text-xs leading-6 text-slate-400">
            MARSWALK is a research and demonstration prototype.
            AI predictions, route assessments and energy estimates
            should not be interpreted as validated autonomous
            rover safety decisions. The AI4MARS model is trained
            on rover-camera imagery and has not been validated
            for Jezero orbital orthomosaic imagery.
          </p>
        </div>
      </section>

      {/* ==================================================
          7. AI MODEL PERFORMANCE AND TECHNOLOGY STACK
      ================================================== */}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <BrainCircuit size={22} />
            </div>

            <div>
              <h2 className="font-display font-bold text-white">
                AI Model Overview
              </h2>

              <p className="text-xs text-slate-500">
                MARSWALK U-Net terrain segmentation
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
              <p className="text-xs text-slate-500">
                Architecture
              </p>

              <p className="mt-2 text-lg font-bold text-white">
                U-Net
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
              <p className="text-xs text-slate-500">
                Framework
              </p>

              <p className="mt-2 text-lg font-bold text-white">
                PyTorch
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
              <p className="text-xs text-slate-500">
                Pixel Accuracy
              </p>

              <p className="mt-2 text-2xl font-bold text-emerald-400">
                92.95%
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
              <p className="text-xs text-slate-500">
                Mean IoU
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                66.43%
              </p>
            </div>
          </div>

          <p className="mt-5 text-xs leading-6 text-slate-500">
            Evaluation results are from the expert-labeled
            AI4MARS test set. The model was trained from scratch.
            These metrics do not establish performance on
            Jezero orbital imagery.
          </p>

          <button
            type="button"
            onClick={() => navigate("terrain-ai")}
            className="mt-4 flex items-center gap-2 text-sm font-semibold text-mars-400 hover:text-mars-300"
          >
            Open AI Terrain Intelligence
            <ArrowRight size={15} />
          </button>
        </div>

        <div className="glass-panel rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Cpu size={22} />
            </div>

            <div>
              <h2 className="font-display font-bold text-white">
                Technology Stack
              </h2>

              <p className="text-xs text-slate-500">
                Technologies powering MARSWALK
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              ["Frontend", "React.js, Vite"],
              ["Styling", "Tailwind CSS v4"],
              ["Backend", "Python, FastAPI"],
              ["AI / Deep Learning", "PyTorch, U-Net"],
              ["Geospatial Processing", "Rasterio, NumPy"],
              ["AI Explanation", "Google Gemini API"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3"
              >
                <span className="text-xs text-slate-400">
                  {label}
                </span>

                <span className="text-xs font-semibold text-white">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================
          8. QUICK ACCESS
      ================================================== */}

      <section className="rounded-2xl border border-mars-500/15 bg-mars-500/5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Ready to Explore Mars?
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Choose one of the three modules and begin your exploration workflow.
            </p>
          </div>

          <Sparkles size={30} className="text-mars-400" />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Mission Planner",
              page: "mission",
              icon: Compass,
            },
            {
              title: "Route Planner",
              page: "routes",
              icon: Route,
            },
            {
              title: "AI Terrain Intelligence",
              page: "terrain-ai",
              icon: BrainCircuit,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.page}
                type="button"
                onClick={() => navigate(item.page)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-space-900/70 p-4 text-left transition hover:border-mars-500/30 hover:bg-space-900"
              >
                <div className="flex items-center gap-3">
                  <Icon size={19} className="text-mars-400" />

                  <span className="text-sm font-semibold text-white">
                    {item.title}
                  </span>
                </div>

                <ArrowRight size={15} className="text-slate-500" />
              </button>
            );
          })}
        </div>
      </section>

      {/* ==================================================
          9. FOOTER
      ================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-5 text-xs text-slate-600">
        <span>
          MARSWALK · Mars Rover Terrain Intelligence
        </span>

        <span>
          Jezero Crater Exploration Prototype
        </span>
      </div>
    </div>
  );
}

export default Dashboard;
