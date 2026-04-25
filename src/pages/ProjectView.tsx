import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast";
import { exportProject, parseImportFile } from "@/lib/storage";
import { TEMPLATES } from "@/lib/templates";
import { countShots, formatProjectPreview } from "@/lib/utils";
import { useProjectStore } from "@/store/projectStore";
import { SECTION_COLORS } from "@/types";
import type { Row, RowType, Section } from "@/types";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Info,
  LayoutTemplate,
  Plus,
  Quote,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Row component ──────────────────────────────────────────────────────────

const ROW_CONFIG: Record<RowType, { icon: any; badge: any; placeholder: string; color: string }> = {
  shot: { icon: Camera, badge: "shot", placeholder: "Beskriv shotet...", color: "text-primary" },
  note: {
    icon: FileText,
    badge: "note",
    placeholder: "Merknad eller logistikk...",
    color: "text-amber-400",
  },
  quote: {
    icon: Quote,
    badge: "quote",
    placeholder: "Sitat eller spørsmål...",
    color: "text-purple-400",
  },
};

interface SortableRowProps {
  row: Row;
  shotNumber?: number;
  projectId: string;
  sectionId: string;
}

function SortableRow({ row, shotNumber, projectId, sectionId }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const { updateRow, deleteRow, toggleCheck } = useProjectStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const config = ROW_CONFIG[row.type];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(() => {
    autoResize();
  }, [row.text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Trigger add row of same type — done via custom event
      const el = e.currentTarget;
      el.dispatchEvent(
        new CustomEvent("row-enter", { bubbles: true, detail: { sectionId, type: row.type } })
      );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors ${row.checked ? "opacity-60" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="drag-handle mt-1 flex-shrink-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 text-muted-foreground transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Shot number */}
      {row.type === "shot" && (
        <span className="flex-shrink-0 mt-1 w-5 text-right text-xs font-mono text-muted-foreground/60">
          {shotNumber}
        </span>
      )}
      {row.type !== "shot" && <span className="flex-shrink-0 w-5" />}

      {/* Checkbox */}
      <button
        onClick={() => toggleCheck(projectId, sectionId, row.id)}
        className={`flex-shrink-0 mt-1 h-4 w-4 rounded border transition-colors flex items-center justify-center ${
          row.checked
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-border hover:border-primary/50"
        }`}
      >
        {row.checked && <Check className="h-3 w-3" />}
      </button>

      {/* Type icon */}
      <config.icon className={`flex-shrink-0 mt-1 h-4 w-4 ${config.color}`} />

      {/* Text input */}
      <textarea
        ref={textareaRef}
        data-selectable
        value={row.text}
        onChange={(e) => {
          updateRow(projectId, sectionId, row.id, e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
        placeholder={config.placeholder}
        rows={1}
        className={`flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/40 leading-relaxed mt-0.5 ${
          row.checked ? "line-through text-muted-foreground" : "text-foreground"
        }`}
        style={{ overflowY: "hidden" }}
      />

      {/* Delete */}
      <button
        onClick={() => deleteRow(projectId, sectionId, row.id)}
        className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-destructive text-muted-foreground transition-all"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Section component ──────────────────────────────────────────────────────

interface SortableSectionProps {
  section: Section;
  projectId: string;
  shotOffset: number;
}

function SortableSection({ section, projectId, shotOffset }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const {
    updateSectionName,
    deleteSection,
    toggleCollapse,
    cycleColor: cycleCol,
    addRow,
    reorderRows,
  } = useProjectStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.rows.findIndex((r) => r.id === active.id);
    const newIndex = section.rows.findIndex((r) => r.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderRows(projectId, section.id, arrayMove(section.rows, oldIndex, newIndex));
    }
  };

  // Listen for Enter key events from rows
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sectionId === section.id) {
        addRow(projectId, section.id, detail.type as RowType);
      }
    };
    el.addEventListener("row-enter", handler);
    return () => el.removeEventListener("row-enter", handler);
  }, [projectId, section.id, addRow]);

  let shotNum = shotOffset;
  const shotNumbers: Record<string, number> = {};
  for (const row of section.rows) {
    if (row.type === "shot") shotNumbers[row.id] = ++shotNum;
  }

  return (
    <div
      ref={(el) => {
        (setNodeRef as any)(el);
        (sectionRef as any).current = el;
      }}
      style={style}
      className="animate-fade-in"
    >
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Section header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50"
          style={{ borderLeftWidth: 3, borderLeftColor: section.color, borderLeftStyle: "solid" }}
        >
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="drag-handle text-muted-foreground opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Color dot */}
          <button
            onClick={() => cycleCol(projectId, section.id)}
            className="h-3.5 w-3.5 rounded-full flex-shrink-0 ring-1 ring-white/10 hover:scale-110 transition-transform"
            style={{ backgroundColor: section.color }}
            title="Endre farge"
          />

          {/* Name */}
          <input
            data-selectable
            value={section.name}
            onChange={(e) => updateSectionName(projectId, section.id, e.target.value)}
            className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground min-w-0"
            placeholder="Scenens navn..."
          />

          {/* Row count badge */}
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {section.rows.length} rader
          </span>

          {/* Collapse */}
          <button
            onClick={() => toggleCollapse(projectId, section.id)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {section.collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Delete */}
          <button
            onClick={() => deleteSection(projectId, section.id)}
            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Rows */}
        {!section.collapsed && (
          <div className="px-2 py-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRowDragEnd}
            >
              <SortableContext
                items={section.rows.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                {section.rows.map((row) => (
                  <SortableRow
                    key={row.id}
                    row={row}
                    shotNumber={shotNumbers[row.id]}
                    projectId={projectId}
                    sectionId={section.id}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add row buttons */}
            <div className="flex items-center gap-1 mt-1 pt-1 border-t border-border/40">
              {(["shot", "note", "quote"] as RowType[]).map((type) => {
                const cfg = ROW_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => addRow(projectId, section.id, type)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  >
                    <cfg.icon className="h-3.5 w-3.5" />
                    <span>+ {type === "shot" ? "Shot" : type === "note" ? "Note" : "Quote"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Template dialog ────────────────────────────────────────────────────────

function TemplateDialog({
  open,
  onClose,
  onSelect,
}: { open: boolean; onClose: () => void; onSelect: (key: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Velg mal</DialogTitle>
          <DialogDescription>Start med en ferdig sceneliste for din type shoot.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Object.entries(TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-colors"
            >
              <span className="text-xl">{tpl.emoji}</span>
              <span className="text-sm font-medium text-foreground">{tpl.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview panel ──────────────────────────────────────────────────────────

function PreviewPanel({ project }: { project: any }) {
  const preview = formatProjectPreview(project);
  const { total, done, pct } = countShots(project.sections);

  const handleCopy = () => {
    navigator.clipboard.writeText(preview);
    toast("Kopiert til utklippstavle", "success");
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-sidebar">
      {/* Stats */}
      <div className="p-4 border-b border-border space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Statistikk
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Shots", value: total },
            { label: "Ferdig", value: done },
            { label: "Tid", value: `${Math.ceil((total * 3) / 60)}t` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
              <div className="text-lg font-bold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fremdrift</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        )}
      </div>

      {/* Preview text */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Forhåndsvisning
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Kopier">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {preview || "Ingen innhold ennå..."}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Main ProjectView ───────────────────────────────────────────────────────

export function ProjectView() {
  const navigate = useNavigate();
  const {
    getActiveProject,
    createProject,
    addSection,
    reorderSections,
    updateProjectMeta,
    updateProjectName,
    importProject,
  } = useProjectStore();
  const [showPreview, setShowPreview] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = getActiveProject();

  // If no active project, create one
  useEffect(() => {
    if (!project) createProject();
  }, [project, createProject]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSectionDragEnd = (event: DragEndEvent) => {
    if (!project) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = project.sections.findIndex((s) => s.id === active.id);
    const newIndex = project.sections.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSections(project.id, arrayMove(project.sections, oldIndex, newIndex));
    }
  };

  const handleTemplate = (key: string) => {
    if (!project) return;
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    reorderSections(project.id, tpl.sections());
    toast(`Mal "${tpl.label}" lastet inn`, "success");
  };

  const handleExport = () => {
    if (!project) return;
    exportProject(project);
    toast("Eksportert som .swshot", "success");
  };

  const handleImport = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const parsed = parseImportFile(json);
      if (!parsed) {
        toast("Ugyldig filformat", "error");
        return;
      }
      importProject(parsed);
      toast("Prosjekt importert", "success");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (
      e.key === "f" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      setShowPreview((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!project) return null;

  // Calculate shot offsets per section
  let runningShots = 0;
  const shotOffsets: Record<string, number> = {};
  for (const sec of project.sections) {
    shotOffsets[sec.id] = runningShots;
    for (const row of sec.rows) {
      if (row.type === "shot") runningShots++;
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Editor panel */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0">
          {/* Project meta — inline editing */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <input
              data-selectable
              value={project.meta.client}
              onChange={(e) => updateProjectMeta(project.id, { client: e.target.value })}
              placeholder="Klient"
              className="bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/50 w-32"
            />
            <span className="text-muted-foreground/30">·</span>
            <input
              data-selectable
              type="date"
              value={project.meta.date}
              onChange={(e) => updateProjectMeta(project.id, { date: e.target.value })}
              className="bg-transparent text-sm text-muted-foreground outline-none w-32"
            />
            <span className="text-muted-foreground/30">·</span>
            <input
              data-selectable
              value={project.meta.crew}
              onChange={(e) => updateProjectMeta(project.id, { crew: e.target.value })}
              placeholder="Crew"
              className="bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/40 flex-1 min-w-0"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(true)}
              className="gap-1.5 text-xs"
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              Mal
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleImport} title="Importer .swshot">
              <Upload className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleExport} title="Eksporter .swshot">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPreview((v) => !v)}
              title="Forhåndsvisning (F)"
              className={showPreview ? "text-primary" : ""}
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Sections list */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3 max-w-3xl">
            {project.sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Camera className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="text-base font-semibold text-foreground mb-2">Ingen scener ennå</h2>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                  Legg til en scene, eller velg en mal for å komme raskt i gang.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => addSection(project.id)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Legg til scene
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowTemplates(true)}
                    className="gap-2"
                  >
                    <LayoutTemplate className="h-4 w-4" />
                    Velg mal
                  </Button>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSectionDragEnd}
              >
                <SortableContext
                  items={project.sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {project.sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      projectId={project.id}
                      shotOffset={shotOffsets[section.id] ?? 0}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Add section button */}
            {project.sections.length > 0 && (
              <button
                onClick={() => addSection(project.id)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Plus className="h-4 w-4" />
                Legg til scene
              </button>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Preview panel */}
      {showPreview && (
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <PreviewPanel project={project} />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".swshot,.json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Template dialog */}
      <TemplateDialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplate}
      />
    </div>
  );
}
