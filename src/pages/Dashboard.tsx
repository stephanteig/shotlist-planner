import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast";
import { countShots, formatDateNO } from "@/lib/utils";
import { useProjectStore } from "@/store/projectStore";
import type { Project } from "@/types";
import {
  Calendar,
  CheckCircle2,
  Clapperboard,
  Film,
  Folder,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </span>
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: { project: Project; onOpen: () => void; onDelete: () => void }) {
  const { total, done, pct } = countShots(project.sections);
  const dateStr = project.meta.date ? formatDateNO(project.meta.date) : null;

  return (
    <Card
      className="group cursor-pointer hover:border-primary/40 transition-all hover:bg-card/80"
      onClick={onOpen}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {project.meta.client || project.name}
            </CardTitle>
            {project.meta.client && (
              <CardDescription className="text-xs mt-0.5 truncate">{project.name}</CardDescription>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Meta info */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {dateStr && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {dateStr}
            </span>
          )}
          {project.meta.crew && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {project.meta.crew}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Folder className="h-3 w-3" />
            {project.sections.length} {project.sections.length === 1 ? "scene" : "scener"}
          </span>
        </div>

        {/* Progress */}
        {total > 0 ? (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {done}/{total} shots
              </span>
              <span className="text-xs font-medium text-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1" />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Ingen shots ennå</div>
        )}

        {/* Status badge */}
        <div className="flex justify-end">
          {pct === 100 && total > 0 ? (
            <Badge variant="success">Ferdig</Badge>
          ) : total === 0 ? (
            <Badge variant="outline">Tom</Badge>
          ) : (
            <Badge variant="info">{total} shots</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { projects, createProject, deleteProject, setActiveProject } = useProjectStore();
  const navigate = useNavigate();

  // Global stats
  let totalShots = 0;
  let totalDone = 0;
  const upcoming = projects.filter((p) => {
    if (!p.meta.date) return false;
    return new Date(p.meta.date) >= new Date();
  }).length;

  for (const p of projects) {
    const { total, done } = countShots(p.sections);
    totalShots += total;
    totalDone += done;
  }

  const handleNewProject = () => {
    const project = createProject();
    navigate("/project");
    toast("Nytt prosjekt opprettet", "success");
  };

  const handleOpenProject = (id: string) => {
    setActiveProject(id);
    navigate("/project");
  };

  const handleDelete = (id: string, name: string) => {
    deleteProject(id);
    toast(`"${name}" slettet`, "info");
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length === 0
                ? "Ingen prosjekter ennå — kom i gang!"
                : `${projects.length} ${projects.length === 1 ? "prosjekt" : "prosjekter"}`}
            </p>
          </div>
          <Button onClick={handleNewProject} className="gap-2">
            <Plus className="h-4 w-4" />
            Nytt prosjekt
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Folder} label="Prosjekter" value={projects.length} />
          <StatCard icon={Film} label="Totale shots" value={totalShots} />
          <StatCard
            icon={CheckCircle2}
            label="Shots fullført"
            value={totalDone}
            sub={
              totalShots > 0 ? `${Math.round((totalDone / totalShots) * 100)}% totalt` : undefined
            }
          />
          <StatCard icon={Calendar} label="Kommende" value={upcoming} sub="planlagte shoots" />
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Clapperboard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Ingen prosjekter</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Opprett ditt første shotlist-prosjekt og kom i gang med planleggingen.
            </p>
            <Button onClick={handleNewProject} className="gap-2">
              <Plus className="h-4 w-4" />
              Opprett prosjekt
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Alle prosjekter
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects
                .slice()
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => handleOpenProject(project.id)}
                    onDelete={() => handleDelete(project.id, project.meta.client || project.name)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
