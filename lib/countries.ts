import type { Locale } from "./match-types";

const countries: Record<string, { flag: string; en: string; zh: string }> = {
  CHN: { flag: "🇨🇳", en: "China", zh: "中国" },
  AUS: { flag: "🇦🇺", en: "Australia", zh: "澳大利亚" },
  ITA: { flag: "🇮🇹", en: "Italy", zh: "意大利" },
  GBR: { flag: "🇬🇧", en: "Great Britain", zh: "英国" },
  MEX: { flag: "🇲🇽", en: "Mexico", zh: "墨西哥" },
  GER: { flag: "🇩🇪", en: "Germany", zh: "德国" },
  ESP: { flag: "🇪🇸", en: "Spain", zh: "西班牙" },
  SWE: { flag: "🇸🇪", en: "Sweden", zh: "瑞典" },
  RSA: { flag: "🇿🇦", en: "South Africa", zh: "南非" },
  MAS: { flag: "🇲🇾", en: "Malaysia", zh: "马来西亚" },
  USA: { flag: "🇺🇸", en: "United States", zh: "美国" },
  FRA: { flag: "🇫🇷", en: "France", zh: "法国" },
  JPN: { flag: "🇯🇵", en: "Japan", zh: "日本" },
  KOR: { flag: "🇰🇷", en: "South Korea", zh: "韩国" },
  IND: { flag: "🇮🇳", en: "India", zh: "印度" },
  BRA: { flag: "🇧🇷", en: "Brazil", zh: "巴西" },
  JAM: { flag: "🇯🇲", en: "Jamaica", zh: "牙买加" },
  IRL: { flag: "🇮🇪", en: "Ireland", zh: "爱尔兰" },
  CAN: { flag: "🇨🇦", en: "Canada", zh: "加拿大" },
  NED: { flag: "🇳🇱", en: "Netherlands", zh: "荷兰" },
  HUN: { flag: "🇭🇺", en: "Hungary", zh: "匈牙利" },
  ROU: { flag: "🇷🇴", en: "Romania", zh: "罗马尼亚" },
  UKR: { flag: "🇺🇦", en: "Ukraine", zh: "乌克兰" },
  POL: { flag: "🇵🇱", en: "Poland", zh: "波兰" },
  CZE: { flag: "🇨🇿", en: "Czechia", zh: "捷克" },
  NZL: { flag: "🇳🇿", en: "New Zealand", zh: "新西兰" },
};

/** Unknown and fictional codes retain their label instead of borrowing a flag. */
export function countryInfo(code: string, locale: Locale = "en") {
  const country = Object.hasOwn(countries, code) ? countries[code] : undefined;
  return {
    flag: country?.flag || "",
    name: country ? country[locale] : code === "DEMO" ? (locale === "zh" ? "示例队伍" : "Demo team") : code,
    code,
  };
}
