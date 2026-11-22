
import {
  Activity,
  Compass,
  LayoutDashboard,
  Menu,
  Orbit,
  Route,
  ScanSearch,
  X,
} from "lucide-react";

import { useState } from "react";

function Navbar({ activePage, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "mission",
      label: "Mission Planner",
      icon: Compass,
    },
    {
      id: "routes",
      label: "Route Planner",
      icon: Route,
    },
    {
      id: "terrain-ai",
      label: "AI Terrain Intelligence",
      icon: ScanSearch,
    },
  ];

  const handleNavigation = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-[1000] border-b border-white/[0.07] bg-space-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* BRAND */}
        <button
          onClick={() => handleNavigation("dashboard")}
          className="flex items-center gap-3 text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-mars-500/20 bg-mars-500/10">
            <Orbit size={25} className="text-mars-400" />
          </div>

          <div>
            <h1 className="font-display text-xl font-bold tracking-[0.12em] text-white">
              MARS<span className="text-mars-400">WALK</span>
            </h1>

            <p className="text-[9px] font-semibold tracking-[0.2em] text-slate-500">
              MISSION CONTROL
            </p>
          </div>
        </button>

        {/* DESKTOP NAVIGATION */}
        <nav className="hidden items-center gap-1 md:flex">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-mars-500/10 text-mars-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* SYSTEM STATUS */}
        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 lg:flex">
          <Activity size={14} className="text-emerald-400" />

          <span className="text-xs font-medium text-emerald-400">
            SYSTEM ONLINE
          </span>

          <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 md:hidden"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* MOBILE NAVIGATION */}
      {mobileMenuOpen && (
        <div className="border-t border-white/[0.07] bg-space-900 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
                    isActive
                      ? "bg-mars-500/10 text-mars-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-white/5 px-4 pt-3 text-xs text-emerald-400">
            <Activity size={14} />
            System online
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
