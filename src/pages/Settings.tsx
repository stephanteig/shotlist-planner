import { Monitor, Moon, Sun, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettingsStore } from "@/store/settingsStore";
import { ACCENT_COLORS } from "@/types";
import type { Theme, FontSize, AccentColor } from "@/types";
import { cn } from "@/lib/utils";

const THEMES: Array<{ value: Theme; label: string; icon: any }> = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

const FONT_SIZES: Array<{ value: FontSize; label: string; description: string }> = [
  { value: "small", label: "Small", description: "87.5%" },
  { value: "medium", label: "Medium", description: "100%" },
  { value: "large", label: "Large", description: "112.5%" },
];

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function Settings() {
  const {
    settings,
    setTheme, setAccentColor, setFontSize, setCompact, setWindowOpacity,
  } = useSettingsStore();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Tilpass Markr etter dine preferanser</p>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Juster utseende, farger og typografi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {/* Theme */}
            <SettingRow label="Tema" description="Velg lyst, mørkt eller la systemet bestemme">
              <div className="flex gap-1.5">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      settings.theme === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </SettingRow>

            {/* Accent color */}
            <SettingRow label="Aksentfarge" description="Velg en primærfarge for knapper og aktive tilstander">
              <div className="flex gap-2">
                {(Object.entries(ACCENT_COLORS) as Array<[AccentColor, { label: string; hex: string }]>).map(([key, { label, hex }]) => (
                  <button
                    key={key}
                    onClick={() => setAccentColor(key)}
                    title={label}
                    className={cn(
                      "relative h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                      settings.accentColor === key ? "ring-white/60" : "ring-transparent"
                    )}
                    style={{ backgroundColor: hex }}
                  >
                    {settings.accentColor === key && (
                      <Check className="h-3.5 w-3.5 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>
            </SettingRow>

            {/* Font size */}
            <SettingRow label="Tekststørrelse" description="Justerer skriftstørrelsen i hele appen">
              <div className="flex gap-1.5">
                {FONT_SIZES.map(({ value, label, description }) => (
                  <button
                    key={value}
                    onClick={() => setFontSize(value)}
                    title={description}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      settings.fontSize === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SettingRow>

            {/* Compact mode */}
            <SettingRow label="Kompakt modus" description="Reduserer padding og mellomrom i hele appen">
              <Switch
                checked={settings.compact}
                onCheckedChange={setCompact}
              />
            </SettingRow>

            {/* Window opacity */}
            <SettingRow
              label="Vindusgjennomsiktighet"
              description={`${settings.windowOpacity}% — juster om du vil se innhold gjennom vinduet`}
            >
              <div className="w-40">
                <Slider
                  min={70}
                  max={100}
                  step={1}
                  value={[settings.windowOpacity]}
                  onValueChange={([v]) => setWindowOpacity(v)}
                />
              </div>
            </SettingRow>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>Om Markr</CardTitle>
            <CardDescription>Versjonsinformasjon og snarveier</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border space-y-0">
            <SettingRow label="Versjon" description="Aktuell appversjon">
              <span className="text-sm font-mono text-muted-foreground">0.1.0</span>
            </SettingRow>
            <SettingRow label="Databeskyttelse" description="All data lagres lokalt på din maskin">
              <span className="text-xs text-emerald-400 font-medium">Kun lokal lagring</span>
            </SettingRow>
            <SettingRow label="Tastatursnarveier" description="Hurtigtaster">
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs text-muted-foreground">
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">F</kbd>{" "}
                  Forhåndsvisning
                </span>
                <span className="text-xs text-muted-foreground">
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">Enter</kbd>{" "}
                  Ny rad
                </span>
              </div>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible handlinger</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Nullstill alle innstillinger</div>
                <div className="text-xs text-muted-foreground mt-0.5">Tilbakestiller tema, farger og layoutvalg</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  localStorage.removeItem("markr-settings");
                  window.location.reload();
                }}
              >
                Nullstill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
