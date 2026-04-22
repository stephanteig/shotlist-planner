import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onDismiss?: () => void;
}

export function Toast({ message, type = "success", onDismiss }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss?.(), 2800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg animate-fade-in",
        type === "success" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        type === "error" && "bg-red-500/10 border-red-500/30 text-red-400",
        type === "info" && "bg-blue-500/10 border-blue-500/30 text-blue-400"
      )}
    >
      {message}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type?: "success" | "error" | "info" }>;
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

let toastEmitter: ((msg: string, type?: "success" | "error" | "info") => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = React.useState<Array<{ id: string; message: string; type?: "success" | "error" | "info" }>>([]);

  const addToast = React.useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    toastEmitter = addToast;
    return () => { toastEmitter = null; };
  }, [addToast]);

  return { toasts, addToast, removeToast };
}

export function toast(message: string, type?: "success" | "error" | "info") {
  toastEmitter?.(message, type);
}
