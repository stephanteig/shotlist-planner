import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { firebaseEnabled } from "@/lib/firebase";
import { isTauri } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { ACCENT_COLORS } from "@/types";
import type { AccentColor, FontSize, Theme } from "@/types";
import { Check, Cloud, HardDrive, LogIn, Monitor, Moon, Sun } from "lucide-react";

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

function SettingRow({
  label,
  description,
  children,
}: { label: string; description?: string; children: React.ReactNode }) {
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
    setTheme,
    setAccentColor,
    setFontSize,
    setCompact,
    setWindowOpacity,
    setStorageMode,
  } = useSettingsStore();
  const { user, signInWithGoogle, signOut } = useAuthStore();
  const isDesktop = isTauri();

  const cloudEnabled = settings.storageMode === "cloud";

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Tilpass Markr etter dine preferanser</p>
        </div>

        {/* Account */}
        {firebaseEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>Konto</CardTitle>
              <CardDescription>Google-konto og synkronisering</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border space-y-0">
              {user ? (
                <SettingRow
                  label={user.displayName ?? user.email ?? "Innlogget"}
                  description={user.email ?? undefined}
                >
                  <Button variant="outline" size="sm" onClick={signOut}>
                    Logg ut
                  </Button>
                </SettingRow>
              ) : (
                <SettingRow
                  label="Ikke innlogget"
                  description="Logg inn med Google for å aktivere cloud sync"
                >
                  <Button size="sm" onClick={signInWithGoogle} className="gap-1.5">
                    <LogIn className="h-3.5 w-3.5" />
                    Logg inn med Google
                  </Button>
                </SettingRow>
              )}

              {/* Storage mode toggle — desktop only */}
              {isDesktop && (
                <SettingRow
                  label="Lagring"
                  description={
                    cloudEnabled
                      ? "Prosjekter synkroniseres til skyen og lagres lokalt"
                      : "Prosjekter lagres kun lokalt på denne maskinen"
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setStorageMode("local")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                        !cloudEnabled
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <HardDrive className="h-3.5 w-3.5" />
                      Lokal
                    </button>
                    <button
                      onClick={() => {
                        if (!user) {
                          signInWithGoogle();
                          return;
                        }
                        setStorageMode("cloud");
                      }}
                      disabled={!user}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                        cloudEnabled
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      <Cloud className="h-3.5 w-3.5" />
                      Cloud
                    </button>
                  </div>
                </SettingRow>
              )}

              {!isDesktop && user && (
                <SettingRow
                  label="Cloud sync"
                  description="Alle prosjekter synkroniseres automatisk til skyen"
                >
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Cloud className="h-3.5 w-3.5" /> Aktiv
                  </span>
                </SettingRow>
              )}
            </CardContent>
          </Card>
        )}

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Juster utseende, farger og typografi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
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

            <SettingRow
              label="Aksentfarge"
              description="Velg en primærfarge for knapper og aktive tilstander"
            >
              <div className="flex gap-2">
                {(
                  Object.entries(ACCENT_COLORS) as Array<
                    [AccentColor, { label: string; hex: string }]
                  >
                ).map(([key, { label, hex }]) => (
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

            <SettingRow
              label="Kompakt modus"
              description="Reduserer padding og mellomrom i hele appen"
            >
              <Switch checked={settings.compact} onCheckedChange={setCompact} />
            </SettingRow>

            {isDesktop && (
              <SettingRow label="Vindusgjennomsiktighet" description={`${settings.windowOpacity}%`}>
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
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>Om Markr</CardTitle>
            <CardDescription>Versjonsinformasjon og snarveier</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border space-y-0">
            <SettingRow label="Versjon">
              <span className="text-sm font-mono text-muted-foreground">0.1.0</span>
            </SettingRow>
            <SettingRow
              label="Databeskyttelse"
              description="All data lagres lokalt — cloud sync kun når aktivert"
            >
              <span className="text-xs text-emerald-400 font-medium">Privat</span>
            </SettingRow>
            <SettingRow label="Tastatursnarveier" description="Hurtigtaster">
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs text-muted-foreground">
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">F</kbd>{" "}
                  Forhåndsvisning
                </span>
                <span className="text-xs text-muted-foreground">
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">Enter</kbd> Ny
                  rad
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
                <div className="text-sm font-medium text-foreground">
                  Nullstill alle innstillinger
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Tilbakestiller tema, farger og layoutvalg
                </div>
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
