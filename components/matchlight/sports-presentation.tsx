"use client";

/* eslint-disable @next/next/no-img-element -- Locally bundled transparent portraits are served directly by the Worker. */

import { useRef, useState } from "react";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import { Button } from "@cloudflare/kumo/components/button";
import { getAthleteMedia } from "@/lib/athlete-media";
import { countryInfo } from "@/lib/countries";
import type { Locale, MatchSummary, Sport } from "@/lib/match-types";

export function AthletePortrait({ name, className = "", eager = false }: { name: string; className?: string; eager?: boolean }) {
  const media = getAthleteMedia(name);
  const [failedSrc, setFailedSrc] = useState("");
  return <span className={`athlete-portrait ${className}`}>
    {media && failedSrc !== media.src ? <img src={media.src} alt={media.alt} loading={eager ? "eager" : "lazy"} width={350} height={350} onError={() => setFailedSrc(media.src)} /> : <span aria-label={name}>{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>}
  </span>;
}

export function CountryLabel({ code, locale, compact = false }: { code: string; locale: Locale; compact?: boolean }) {
  const country = countryInfo(code, locale);
  return <span className="country-label"><span aria-hidden="true" className="country-flag">{country.flag}</span><span>{compact ? country.code : country.name}</span></span>;
}

export function PhotoCredit({ name, locale }: { name: string; locale: Locale }) {
  const media = getAthleteMedia(name);
  return media ? <a className="photo-credit" href={media.sourceUrl} target="_blank" rel="noopener noreferrer">{locale === "en" ? "Official portrait · World Aquatics" : "官方头像 · World Aquatics"}<ArrowSquareOutIcon size={11} /></a> : null;
}

export function ScoreStrip({ matches, locale, sport, setSport, selectedId, onSelect }: { matches: MatchSummary[]; locale: Locale; sport: Sport | "all"; setSport: (sport: Sport | "all") => void; selectedId: string; onSelect: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const labels = locale === "en" ? { all: "All sports", diving: "Diving", swimming: "Swimming", cricket: "Cricket" } : { all: "全部项目", diving: "跳水", swimming: "游泳", cricket: "板球" };
  const items = matches.filter((match) => sport === "all" || match.sport === sport);
  const scroll = (direction: number) => track.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
  return <section className="score-strip" aria-label={locale === "en" ? "Recorded scoreboards" : "已记录比分"}>
    <div className="score-strip-inner">
      <div className="score-strip-picker"><span>{locale === "en" ? "SCOREBOARD" : "比分速览"}</span><select aria-label={locale === "en" ? "Scoreboard sport" : "比分项目"} value={sport} onChange={(event) => setSport(event.target.value as Sport | "all")}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>{locale === "en" ? "Saved results / samples" : "历史记录 / 示例"}</small></div>
      <div className="score-strip-track" ref={track}>{items.map((match) => <button className={`score-tile ${selectedId === match.id ? "selected" : ""}`} key={match.id} onClick={() => onSelect(match.id)}><span className="score-tile-meta">{labels[match.sport]}<span className={`data-tag ${match.mode}`}>{match.mode === "historical" ? (locale === "en" ? "FINAL · 2024" : "完赛 · 2024") : (locale === "en" ? "SAMPLE" : "示例")}</span></span>{match.preview?.slice(0, 2).map((standing) => <span className="score-tile-row" key={standing.id}><span className="country-flag" aria-label={countryInfo(standing.country, locale).name}>{countryInfo(standing.country, locale).flag}</span><span className="score-tile-name">{standing.name}</span><strong>{standing.score}</strong></span>)}<span className="score-tile-caption">{match.mode === "historical" ? (locale === "en" ? "Women's 3m · Paris" : "女子 3 米板 · 巴黎") : match.title[locale]}</span></button>)}</div>
      <div className="strip-controls"><button aria-label={locale === "en" ? "Previous scores" : "向前查看比分"} onClick={() => scroll(-1)}><CaretLeftIcon size={16} /></button><button aria-label={locale === "en" ? "Next scores" : "向后查看比分"} onClick={() => scroll(1)}><CaretRightIcon size={16} /></button></div>
    </div>
  </section>;
}

export function SportsHero({ historical, locale, onSelect }: { historical?: MatchSummary; locale: Locale; onSelect: (id: string) => void }) {
  const podium = historical?.preview ?? [];
  return <section className="sports-hero">
    <div className="sports-hero-copy"><p className="eyebrow"><span className="pink-square" />{locale === "en" ? "LOS ANGELES 2028 / FAN COMPANION CONCEPT" : "洛杉矶 2028 / 观赛助手概念"}</p><h1>{locale === "en" ? <>GET IN<br />THE <span>GAME.</span></> : <>走进比赛。<br /><span>看懂精彩。</span></>}</h1><p className="sports-hero-description">{locale === "en" ? "Big moments. Clear answers. Know the athletes, decode the score, and find your reason to cheer." : "认识运动员，读懂比分，跟上关键时刻。让每一次欢呼，都多一份理解。"}</p><div className="hero-actions"><Button className="primary-button" variant="primary" size="lg" disabled={!historical} onClick={() => historical && onSelect(historical.id)}>{locale === "en" ? "Explore the final" : "进入决赛"}<ArrowRightIcon size={18} /></Button><a href="#match-center">{locale === "en" ? "Find your sport" : "选择运动项目"}<ArrowRightIcon size={16} /></a></div><p className="hero-data-note">{locale === "en" ? "Paris 2024 archive + fictional samples. No live coverage." : "巴黎 2024 历史记录与虚构示例，不提供实时报道。"}</p></div>
    <div className="hero-podium"><div className="hero-podium-top"><span>{locale === "en" ? "PARIS 2024 / WOMEN'S 3M" : "巴黎 2024 / 女子 3 米跳板"}</span><span className="data-tag historical">{locale === "en" ? "OFFICIAL RESULTS" : "官方成绩"}</span></div><div className="hero-athletes">{podium.map((standing) => <div className={`hero-athlete hero-athlete-${standing.rank}`} key={standing.id}><span className="hero-medal">{String(standing.rank).padStart(2, "0")}</span><AthletePortrait name={standing.name} eager /><div className="hero-athlete-caption"><CountryLabel code={standing.country} locale={locale} compact /><strong>{standing.name}</strong><span>{standing.score}<small>{locale === "en" ? "TOTAL PTS" : "总分"}</small></span></div></div>)}</div><div className="hero-photo-note">{locale === "en" ? "Official profile portraits · World Aquatics" : "官方个人头像 · World Aquatics"}<span>{locale === "en" ? "Recorded final, 9 Aug 2024" : "历史决赛 · 2024 年 8 月 9 日"}</span></div></div>
  </section>;
}

export function AthleteSpotlight({ historical, locale, onSelect }: { historical: MatchSummary; locale: Locale; onSelect: (id: string) => void }) {
  return <section className="athlete-section section-container"><div className="section-heading"><div><p className="eyebrow">{locale === "en" ? "THE PEOPLE BEHIND THE POINTS" : "比分背后的运动员"}</p><h2>{locale === "en" ? "MEET THE MEDALISTS." : "认识奖牌得主。"}</h2></div><span className="section-stamp">PARIS 2024<br />{locale === "en" ? "WOMEN'S 3M FINAL" : "女子 3 米跳板决赛"}</span></div><div className="athlete-spotlight-grid">{historical.preview?.map((standing) => <article className={`athlete-spotlight rank-${standing.rank}`} key={standing.id}><div className="spotlight-photo"><span className="spotlight-rank">{String(standing.rank).padStart(2, "0")}</span><AthletePortrait name={standing.name} /><span className="spotlight-medal">{locale === "en" ? ["", "GOLD", "SILVER", "BRONZE"][standing.rank] : ["", "金牌", "银牌", "铜牌"][standing.rank]}</span></div><div className="spotlight-body"><CountryLabel code={standing.country} locale={locale} /><h3>{standing.name}</h3><div className="spotlight-result"><strong>{standing.score}</strong><span>{locale === "en" ? "FINAL TOTAL" : "决赛总分"}</span><button onClick={() => onSelect(historical.id)} aria-label={`${locale === "en" ? "Explore final featuring" : "查看决赛："} ${standing.name}`}><ArrowRightIcon size={20} /></button></div><PhotoCredit name={standing.name} locale={locale} /></div></article>)}</div></section>;
}
