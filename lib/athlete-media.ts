/** Official profile photography for the real Paris 2024 finalists only.
 * See docs/athlete-media.md for original image URLs and identity verification.
 * These portraits are not photographs from the final and are not AI-generated.
 */
export interface AthleteMedia {
  src: string;
  alt: string;
  credit: string;
  sourceUrl: string;
}

const mediaByName: Record<string, AthleteMedia> = {
  "chen yiwen": {
      "src": "/images/athletes/chen-yiwen.png",
      "alt": "Yiwen CHEN",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1028322/wd"
  },
  "keeney maddison": {
      "src": "/images/athletes/keeney-maddison.png",
      "alt": "Maddison KEENEY",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1018072/wd"
  },
  "chang yani": {
      "src": "/images/athletes/chang-yani.png",
      "alt": "Yani CHANG",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1033405/wd"
  },
  "pellacani chiara": {
      "src": "/images/athletes/pellacani-chiara.png",
      "alt": "Chiara PELLACANI",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1056063/wd"
  },
  "harper yasmin": {
      "src": "/images/athletes/harper-yasmin.png",
      "alt": "Yasmin HARPER",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1056792/wd"
  },
  "estudillo torres alejandra": {
      "src": "/images/athletes/estudillo-torres-alejandra.png",
      "alt": "Alejandra ESTUDILLO TORRES",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1631109/wd"
  },
  "oettinghaus saskia": {
      "src": "/images/athletes/oettinghaus-saskia.png",
      "alt": "Saskia OETTINGHAUS",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1018724/wd"
  },
  "antolino valeria": {
      "src": "/images/athletes/antolino-valeria.png",
      "alt": "Valeria ANTOLINO",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1028105/wd"
  },
  "nilsson garip emilia": {
      "src": "/images/athletes/nilsson-garip-emilia.png",
      "alt": "Emilia NILSSON GARIP",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1159219/wd"
  },
  "reid grace": {
      "src": "/images/athletes/reid-grace.png",
      "alt": "Grace REID",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1018488/wd"
  },
  "vincent julia": {
      "src": "/images/athletes/vincent-julia.png",
      "alt": "Julia VINCENT",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1018145/wd"
  },
  "sabri nur dhabitah": {
      "src": "/images/athletes/sabri-nur-dhabitah.png",
      "alt": "Nur Dhabitah SABRI",
      "credit": "World Aquatics · official athlete profile",
      "sourceUrl": "https://www.worldaquatics.com/athletes/1021030/wd"
  },
};

/** Accept the provider's surname-first name or the profile's given-name-first name. */
const profileNames: Record<string, string> = {
  "yiwen chen": "chen yiwen",
  "maddison keeney": "keeney maddison",
  "yani chang": "chang yani",
  "chiara pellacani": "pellacani chiara",
  "yasmin harper": "harper yasmin",
  "alejandra estudillo torres": "estudillo torres alejandra",
  "saskia oettinghaus": "oettinghaus saskia",
  "valeria antolino": "antolino valeria",
  "emilia nilsson garip": "nilsson garip emilia",
  "grace reid": "reid grace",
  "julia vincent": "vincent julia",
  "nur dhabitah sabri": "sabri nur dhabitah",
};

export function getAthleteMedia(name: string): AthleteMedia | undefined {
  const normalized = name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const key = Object.hasOwn(profileNames, normalized) ? profileNames[normalized] : normalized;
  return Object.hasOwn(mediaByName, key) ? mediaByName[key] : undefined;
}
