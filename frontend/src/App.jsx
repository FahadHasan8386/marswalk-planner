
import { useState } from "react";

import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MissionPlanner from "./pages/MissionPlanner.jsx";
import RoutePlanner from "./pages/RoutePlanner.jsx";
import TerrainAI from "./pages/TerrainAI.jsx";

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  // Change page and reset scroll position to the top
  const handlePageChange = (page) => {
    setActivePage(page);

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  };

  return (
    <div className="min-h-screen bg-space-950 text-slate-100">
      <Navbar
        activePage={activePage}
        onNavigate={handlePageChange}
      />

      <main className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">

        {/* DASHBOARD */}
        <div
          className={
            activePage === "dashboard"
              ? "relative visible z-10"
              : "absolute inset-0 invisible pointer-events-none -z-10"
          }
          aria-hidden={activePage !== "dashboard"}
        >
          <Dashboard onNavigate={handlePageChange} />
        </div>

        {/* MISSION PLANNER */}
        <div
          className={
            activePage === "mission"
              ? "relative visible z-10"
              : "absolute inset-0 invisible pointer-events-none -z-10"
          }
          aria-hidden={activePage !== "mission"}
        >
          <MissionPlanner />
        </div>

        {/* ROUTE PLANNER */}
        <div
          className={
            activePage === "routes"
              ? "relative visible z-10"
              : "absolute inset-0 invisible pointer-events-none -z-10"
          }
          aria-hidden={activePage !== "routes"}
        >
          <RoutePlanner />
        </div>

        {/* TERRAIN AI */}
        <div
          className={
            activePage === "terrain-ai"
              ? "relative visible z-10"
              : "absolute inset-0 invisible pointer-events-none -z-10"
          }
          aria-hidden={activePage !== "terrain-ai"}
        >
          <TerrainAI />
        </div>

      </main>

      <footer className="border-t border-white/5 px-6 py-5 text-center text-xs text-slate-500">
        MARSWALK © 2026 · Mars Terrain Intelligence & Rover Mission Planning
      </footer>
    </div>
  );
}

export default App;
