import { uid } from "@/lib/utils";
import type { Section } from "@/types";

function s(name: string, color: string, rows: Array<[string, string]>): Section {
  return {
    id: uid(),
    name,
    color,
    collapsed: false,
    rows: rows.map(([type, text]) => ({
      id: uid(),
      type: type as Section["rows"][0]["type"],
      text,
      checked: false,
    })),
  };
}

export const TEMPLATES: Record<
  string,
  { label: string; emoji: string; sections: () => Section[] }
> = {
  bolig: {
    label: "Boligfoto",
    emoji: "🏠",
    sections: () => [
      s("Åpning", "#7c6af7", [
        ["shot", "Drone — bygget utenfra"],
        ["shot", "Fasade fra gaten"],
        ["shot", "Inngangsparti / dør"],
        ["note", "Sjekk lys og skyggeplass ved ankomst"],
      ]),
      s("Kjøkken", "#34d399", [
        ["shot", "Wide — hele kjøkkenet"],
        ["shot", "Detalj — benkeplate / fliser"],
        ["shot", "Skap åpne / innhold"],
        ["shot", "Overskapslys på"],
      ]),
      s("Stue", "#60a5fa", [
        ["shot", "Wide — sofa og TV-vegg"],
        ["shot", "Vinduslys / utsikt"],
        ["shot", "Detalj — peis / bokhylle"],
      ]),
      s("Soverom 1 — Hoved", "#fbbf24", [
        ["shot", "Wide fra dør"],
        ["shot", "Seng — fra siden"],
        ["shot", "Garderobeinnredning"],
      ]),
      s("Bad", "#f472b6", [
        ["shot", "Wide — hele badet"],
        ["shot", "Speil og servant"],
        ["shot", "Dusj / badekar"],
      ]),
      s("Teknisk rom / bod", "#a78bfa", [
        ["shot", "Teknisk rom oversikt"],
        ["note", "Varmtvannstank, el-skap"],
      ]),
      s("Avslutning", "#2dd4bf", [
        ["shot", "Drone — klatrer opp fra hagen"],
        ["shot", "Solnedgang mot fasade"],
      ]),
    ],
  },

  intervju: {
    label: "Intervju",
    emoji: "🎙️",
    sections: () => [
      s("B-roll / Setup", "#7c6af7", [
        ["shot", "Location wide — rom / miljø"],
        ["shot", "Detaljer fra lokalet"],
        ["note", "Sjekk lysnivå og bakgrunnsstøy"],
      ]),
      s("Intervju", "#34d399", [
        ["shot", "Hoved — 85mm portrett"],
        ["shot", "Sidevinkel / over skulder"],
        ["shot", "Tight på ansikt"],
        ["quote", "Hva er du stolt av?"],
        ["quote", "Hva er neste steg?"],
        ["note", "Be dem se mot intervjuer, ikke kamera"],
      ]),
      s("B-roll — Person", "#60a5fa", [
        ["shot", "Person i arbeid / handling"],
        ["shot", "Hender — close-up"],
        ["shot", "Walking shot"],
      ]),
      s("Outro / B-roll extra", "#fbbf24", [
        ["shot", "Firma logo / skilt"],
        ["shot", "Team / miljø"],
      ]),
    ],
  },

  social: {
    label: "Social Media",
    emoji: "📱",
    sections: () => [
      s("Hook (0–3 sek)", "#f87171", [
        ["shot", "Visuell hook — overraskende bilde"],
        ["shot", "Produkt / person i fokus"],
        ["note", "Tekst on-screen: bold og kort"],
      ]),
      s("Hoveddel", "#34d399", [
        ["shot", "Demo / bruk av produkt"],
        ["shot", "Before / After"],
        ["shot", "Testimonialt — 15 sek"],
      ]),
      s("Hook SoMe (vertikal)", "#60a5fa", [
        ["shot", "9:16 — portrett av produkt"],
        ["shot", "Reels-versjon av hook"],
      ]),
      s("Outro / CTA", "#fbbf24", [
        ["shot", "Logo + tagline"],
        ["note", "Legg inn link / swipe up tekst"],
      ]),
    ],
  },

  event: {
    label: "Event",
    emoji: "🎬",
    sections: () => [
      s("Ankomst / Åpning", "#7c6af7", [
        ["shot", "Venue utenfra"],
        ["shot", "Gjester ankommer"],
        ["shot", "Detaljer — pynting, skilt, mat"],
      ]),
      s("Programmet", "#34d399", [
        ["shot", "Scenen / talerstolen — wide"],
        ["shot", "Publikum — reaksjon"],
        ["shot", "Presentatør — portrett"],
        ["note", "Husk lydnivå på kamera"],
      ]),
      s("Networking / Pause", "#60a5fa", [
        ["shot", "Mingling — candid"],
        ["shot", "Detaljer — glass, mat"],
      ]),
      s("Avslutning", "#fbbf24", [
        ["shot", "Gruppe — alle samlet"],
        ["shot", "Venue med stemningslys"],
      ]),
    ],
  },

  produkt: {
    label: "Produktfoto",
    emoji: "📦",
    sections: () => [
      s("Studio — Rent", "#7c6af7", [
        ["shot", "Hvit bakgrunn — product hero"],
        ["shot", "Detalj — logo / tekstur"],
        ["shot", "Flatlay — produkt + props"],
      ]),
      s("Studio — Lifestyle", "#34d399", [
        ["shot", "Produkt i bruk"],
        ["shot", "Hands med produkt"],
        ["shot", "Miljø — kjøkken / kontor"],
      ]),
      s("Emballasje", "#60a5fa", [
        ["shot", "Eske lukket"],
        ["shot", "Eske åpen — unboxing"],
        ["shot", "Innhold spredt ut"],
      ]),
      s("Markedsføring", "#fbbf24", [
        ["shot", "Square 1:1 — Instagram"],
        ["shot", "Story 9:16"],
        ["note", "Bruk merkevarens fargepalett som bakgrunn"],
      ]),
    ],
  },

  podcast: {
    label: "Podcast Video",
    emoji: "🎧",
    sections: () => [
      s("Setup / Location", "#7c6af7", [
        ["shot", "Studio wide — begge verter"],
        ["shot", "Over skulder — Host A"],
        ["shot", "Over skulder — Host B"],
        ["note", "Test lyd og white balance"],
      ]),
      s("Opptak", "#34d399", [
        ["shot", "Close-up Host A — 85mm"],
        ["shot", "Close-up Host B — 85mm"],
        ["shot", "Cutaway — notater / materiell"],
      ]),
      s("Gjest", "#60a5fa", [
        ["shot", "Gjest portrett — intro"],
        ["shot", "Over skulder mot gjest"],
        ["quote", "Introduksjonsspørsmål"],
      ]),
      s("B-roll", "#fbbf24", [
        ["shot", "Mikrofon detalj"],
        ["shot", "Hender på bord"],
        ["shot", "Skjermer / studio-detaljer"],
      ]),
      s("Outro", "#a78bfa", [
        ["shot", "Logo avspark"],
        ["note", "Husk å ta stillbilder for thumbnail"],
      ]),
    ],
  },

  testimonial: {
    label: "Testimonial",
    emoji: "⭐",
    sections: () => [
      s("Intro — Sted", "#7c6af7", [
        ["shot", "Firmaets fasade / logo"],
        ["shot", "Internt miljø — kontor / produksjon"],
      ]),
      s("Testimonial A", "#34d399", [
        ["shot", "Portrett — 85mm mot vindu"],
        ["shot", "Sidevinkel"],
        ["quote", "Hva løste produktet for deg?"],
        ["quote", "Vil du anbefale det?"],
      ]),
      s("Testimonial B", "#60a5fa", [
        ["shot", "Portrett — annen lokasjon"],
        ["shot", "Person i handling / arbeid"],
        ["quote", "Beste opplevelsen?"],
      ]),
      s("B-roll — Resultat", "#fbbf24", [
        ["shot", "Produkt i bruk"],
        ["shot", "Team i arbeid"],
        ["shot", "Resultat / tall på skjerm"],
      ]),
      s("Outro", "#a78bfa", [
        ["shot", "Logo + tagline"],
        ["note", "CTA overlay i post"],
      ]),
    ],
  },

  bts: {
    label: "Behind the Scenes",
    emoji: "🎥",
    sections: () => [
      s("Rigging / Setup", "#7c6af7", [
        ["shot", "Kamera og lens-valg"],
        ["shot", "Lys settes opp — prosess"],
        ["shot", "Location scouting"],
      ]),
      s("Under opptaket", "#34d399", [
        ["shot", "Fotograf i arbeid — wide"],
        ["shot", "Monitor — hva kameraet ser"],
        ["shot", "Crew kommuniserer"],
        ["note", "Candid — ikke poser"],
      ]),
      s("Detaljer / Utstyr", "#60a5fa", [
        ["shot", "Gimbal / kamerarig"],
        ["shot", "Linseskifte"],
        ["shot", "Minnekort / batteri"],
      ]),
      s("Ferdig for dagen", "#fbbf24", [
        ["shot", "Team selfie"],
        ["shot", "Pakker ned — timelapse"],
      ]),
    ],
  },

  brand: {
    label: "Brand Film",
    emoji: "🌟",
    sections: () => [
      s("Åpning — Identitet", "#7c6af7", [
        ["shot", "Drone — by / natur / kontor"],
        ["shot", "Logo reveal"],
        ["note", "Musikk og stemning definerer tonen her"],
      ]),
      s("Verdier — Visuals", "#34d399", [
        ["shot", "Team i arbeid"],
        ["shot", "Produkt nært"],
        ["shot", "Kunde — smil / bruk"],
      ]),
      s("Historiefortelling", "#60a5fa", [
        ["shot", "Grunnlegger — miljø portrett"],
        ["quote", "Hvorfor startet du dette?"],
        ["shot", "Hverdagsscene fra bedriften"],
      ]),
      s("Resultat / Impact", "#fbbf24", [
        ["shot", "Fornøyde kunder"],
        ["shot", "Tall / milestone på skjerm"],
        ["shot", "Produkt i verden"],
      ]),
      s("Outro / CTA", "#a78bfa", [
        ["shot", "Logo — clean black/white"],
        ["shot", "Nettside / kontakt på skjerm"],
        ["note", "Fade til svart — hold 2 sek"],
      ]),
    ],
  },
};
