import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Film,
  Settings,
  Clapperboard,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/projectStore";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/project", icon: Film, label: "Editor" },
];

const NAV_BOTTOM = [
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { projects, activeProjectId, setActiveProject } = useProjectStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <aside className="flex flex-col w-14 bg-sidebar border-r border-sidebar-border flex-shrink-0">
      {/* Logo mark */}
      <div className="flex items-center justify-center h-10 border-b border-sidebar-border">
        <Clapperboard className="h-5 w-5 text-primary" />
      </div>

      {/* Main nav */}
      <nav className="flex flex-col items-center gap-1 p-2 flex-1">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-4 w-4" />
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-card border border-border px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50">
                  {label}
                </span>
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Recent projects */}
        {projects.length > 0 && (
          <>
            <div className="w-6 h-px bg-sidebar-border my-1" />
            {projects.slice(0, 5).map((project) => (
              <NavLink
                key={project.id}
                to="/project"
                onClick={() => setActiveProject(project.id)}
                className={() =>
                  cn(
                    "group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors text-xs font-bold",
                    project.id === activeProjectId
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <span>{(project.meta.client || project.name).slice(0, 2).toUpperCase()}</span>
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-card border border-border px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50">
                  {project.meta.client || project.name}
                </span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom nav */}
      <nav className="flex flex-col items-center gap-1 p-2">
        {NAV_BOTTOM.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-card border border-border px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
