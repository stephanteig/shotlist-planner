import { Minus, Square, X, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitlebarProps {
  title?: string;
}

async function getWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export function Titlebar({ title }: TitlebarProps) {
  const handleMinimize = async () => (await getWindow())?.minimize();
  const handleMaximize = async () => {
    const win = await getWindow();
    if (!win) return;
    const isMax = await win.isMaximized();
    isMax ? win.unmaximize() : win.maximize();
  };
  const handleClose = async () => (await getWindow())?.close();

  return (
    <div
      className="flex items-center justify-between h-10 px-3 border-b border-border bg-sidebar select-none flex-shrink-0"
      data-tauri-drag-region
    >
      {/* Left — wordmark */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <Clapperboard className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold tracking-tight text-foreground">Markr</span>
        {title && (
          <>
            <span className="text-muted-foreground/40 text-sm">/</span>
            <span className="text-sm text-muted-foreground truncate max-w-48">{title}</span>
          </>
        )}
      </div>

      {/* Center — menu bar */}
      <div className="flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2" data-tauri-drag-region>
        {["App", "File", "Edit", "View"].map((item) => (
          <button
            key={item}
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Right — window controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          )}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={handleClose}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-500/20 hover:text-red-400 text-muted-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
