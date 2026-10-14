"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import {
  ArrowRightIcon as ArrowRight,
  ArrowUpRightIcon as ArrowUpRight,
  CheckIcon as Check,
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  QuestionIcon as CircleHelp,
  ClockIcon as Clock3,
  ArrowSquareOutIcon as ExternalLink,
  GlobeIcon as Globe2,
  MapPinIcon as MapPin,
  ArrowCounterClockwiseIcon as RotateCcw,
  MagnifyingGlassIcon as Search,
  SparkleIcon as Sparkles,
  TrophyIcon as Trophy,
  WavesIcon as Waves,
} from "@phosphor-icons/react";
import type { DataMode, Locale, MatchDetail, MatchSummary, Source, Sport } from "@/lib/match-types";
import { defaultQuestion, useMatchData } from "./use-match-data";

const copy = {
  en: {
    explore: "Explore matches", understand: "Understand", follow: "Watch next",
    demo: "Interactive demo", demoTag: "Demo", historical: "Historical", live: "Live data",
    demoNote: "Fictional competitors & sample results. No live coverage.",
    historicalNote: "Recorded historical results. No live coverage.",
    catalogNote: "Historical results & fictional samples. No live coverage.",
    heroEyebrow: "FOR THE MOMENTS THAT MAKE YOU WONDER",
    heroTitle: "See the sport.", heroItalic: "Get the story.",
    heroBody: "The score is only the start. Make sense of every point, follow the turning moments, and know what to watch next.",
    tryDemo: "Explore a match", heroLink: "How it works", aiArt: "AI-generated illustration",
    heroCardLabel: "LESS GUESSING. MORE GETTING IT.", heroCardText: "“Wait — how did they get that score?”", heroCardAnswer: "There’s a clearer way to watch.",
    discoverEyebrow: "YOUR SEAT IS WAITING", discoverTitle: "Find your next moment.",
    discoverBody: "Pick a sport. We’ll help you follow the story.", all: "All sports", diving: "Diving", swimming: "Swimming", cricket: "Cricket",
    search: "Search matches", searchPlaceholder: "Search a match, sport, or venue…", available: "matches to explore",
    matchAction: "Get into the match", selected: "Selected", emptyTitle: "No matches found.", emptyText: "Try another sport or a shorter search.", reset: "Clear filters",
    loading: "Getting your seat ready…", retry: "Try again", loadingMatches: "Loading matches…", errorTitle: "We couldn’t load the matches.",
    matchErrorTitle: "This match couldn’t be opened.", noMoments: "This match has no recorded moments yet.",
    back: "All matches", changeMatch: "Change match", momentTab: "Understand the moment", nextTab: "Follow the match",
    momentEyebrow: "THE MOMENT, MADE CLEAR", recorded: "Recorded moment", moments: "Key moments", selectedMoment: "Selected moment", selectMoment: "Choose a moment to understand",
    score: "Recorded score", judgeMarks: "Recorded judges’ marks", difficulty: "Difficulty", explanation: "Here’s what happened.",
    explainLoading: "Putting the moment into words…", explainError: "We couldn’t explain this moment.", defaultPrompt: "Explain this moment",
    grounded: "Rule-based · recorded facts & scoring rules", aiMode: "AI-assisted explanation", breakdown: "Behind the numbers", askLabel: "Still wondering about something?",
    askPlaceholder: "Ask about this moment…", ask: "Ask Matchlight", questionHint: "Ask about scores, rules, or what to watch next.", scorePrompt: "How does scoring work?", nextPrompt: "What should I watch next?",
    whatNext: "Keep your eyes on this.", upNext: "WHAT TO WATCH NEXT", followCta: "See what to watch next", nextMoment: "Next recorded moment", finalMoment: "You’re at the last recorded moment.",
    rankings: "The standings", rank: "Rank", competitor: "Competitor", result: "Result", standingsNote: "Standings reflect the full sample match. They don’t rewind when you select an earlier moment.",
    rules: "A little context goes a long way.", ruleEyebrow: "KNOW THE SPORT", sourceTitle: "Sources & data notes", sources: "View sources & data notes", updated: "Sample updated", reload: "Reload sample", details: "Scoring details", question: "Your question", rulesSources: "Recorded scores explained with published sport rules.",
    howTitle: "From “what?” to “wow.”", howBody: "A little understanding changes the whole experience.",
    step1Title: "Find the match.", step1Body: "Pick the sport you’re watching and step into the moment.",
    step2Title: "Get the explanation.", step2Body: "See what happened, where the score came from, and why it matters.",
    step3Title: "Stay in the story.", step3Body: "Follow the standings and know what to look for next.",
    footer: "Made for the curious spectator.", footerProject: "ENGR 170 · Team 4 · MVP", skip: "Skip to content", artCaption: "A fresh perspective on every sport.",
  },
  zh: {
    explore: "探索比赛", understand: "看懂比赛", follow: "接下来看点",
    demo: "交互演示", demoTag: "演示", historical: "历史记录", live: "实时数据",
    demoNote: "选手与成绩均为虚构示例，不提供实时赛事报道。",
    historicalNote: "已记录的历史赛事成绩，不提供实时赛事报道。",
    catalogNote: "历史赛事成绩与虚构示例，不提供实时赛事报道。",
    heroEyebrow: "为每一个「为什么」而来", heroTitle: "看见比赛。", heroItalic: "读懂精彩。",
    heroBody: "比分只是开始。弄懂每一次得分，跟上比赛的转折，知道接下来该关注什么。",
    tryDemo: "探索一场比赛", heroLink: "如何使用", aiArt: "AI 生成插画",
    heroCardLabel: "少一点疑惑，多一点理解", heroCardText: "「等等——这个分数是怎么来的？」", heroCardAnswer: "让每一刻都看得更明白。",
    discoverEyebrow: "给好奇心留个座位", discoverTitle: "找到你的下一个精彩瞬间。",
    discoverBody: "选一个运动项目，我们带你读懂比赛。", all: "全部项目", diving: "跳水", swimming: "游泳", cricket: "板球",
    search: "搜索比赛", searchPlaceholder: "搜索比赛、项目或场馆…", available: "场比赛可探索",
    matchAction: "进入比赛", selected: "已选择", emptyTitle: "没有找到比赛。", emptyText: "试试其他项目或更简短的关键词。", reset: "清除筛选",
    loading: "正在准备你的观赛席位…", retry: "重试", loadingMatches: "正在加载比赛…", errorTitle: "比赛加载失败。",
    matchErrorTitle: "无法打开这场比赛。", noMoments: "这场比赛暂时没有已记录的时刻。",
    back: "全部比赛", changeMatch: "切换比赛", momentTab: "看懂这个瞬间", nextTab: "跟上比赛",
    momentEyebrow: "把这个瞬间，讲明白", recorded: "已记录时刻", moments: "关键时刻", selectedMoment: "当前时刻", selectMoment: "选择一个想要了解的时刻",
    score: "已记录得分", judgeMarks: "已记录的裁判评分", difficulty: "难度系数", explanation: "刚才发生了什么。",
    explainLoading: "正在把这个瞬间讲明白…", explainError: "暂时无法解释这个时刻。", defaultPrompt: "解释这个瞬间",
    grounded: "规则解释 · 依据已记录事实与计分规则", aiMode: "AI 辅助解释", breakdown: "数字背后的逻辑", askLabel: "还有什么想弄明白？",
    askPlaceholder: "问问这个瞬间…", ask: "问 Matchlight", questionHint: "可以询问得分、规则或接下来的看点。", scorePrompt: "评分规则是什么？", nextPrompt: "接下来我该关注什么？",
    whatNext: "接下来，留意这里。", upNext: "接下来的看点", followCta: "看看接下来该关注什么", nextMoment: "下一个已记录时刻", finalMoment: "你已看到最后一个已记录时刻。",
    rankings: "当前排名", rank: "名次", competitor: "参赛者", result: "成绩", standingsNote: "排名对应整场示例比赛；选择更早的时刻时，排名不会回溯。",
    rules: "懂一点规则，多一份精彩。", ruleEyebrow: "认识这个运动", sourceTitle: "来源与数据说明", sources: "查看来源与数据说明", updated: "示例更新时间", reload: "重新加载示例", details: "计分详情", question: "你的问题", rulesSources: "结合已记录成绩与公开运动规则解释。",
    howTitle: "从「为什么」到「原来如此」。", howBody: "多懂一点，观赛就多一份乐趣。",
    step1Title: "找到比赛。", step1Body: "选择正在观看的运动项目，进入关键时刻。",
    step2Title: "读懂解释。", step2Body: "了解发生了什么、分数怎么来，以及它意味着什么。",
    step3Title: "跟上精彩。", step3Body: "掌握排名，知道接下来该关注什么。",
    footer: "为每一个好奇的观众而做。", footerProject: "ENGR 170 · 第 4 组 · MVP", skip: "跳至主要内容", artCaption: "换一个视角，看懂每一场比赛。",
  },
};

type Copy = (typeof copy)["en"] | (typeof copy)["zh"];
type View = "discover" | "explain" | "follow";

function modeLabel(mode: DataMode, c: Copy) {
  return mode === "demo" ? c.demoTag : mode === "historical" ? c.historical : c.live;
}

function SportGlyph({ sport, className = "" }: { sport: Sport; className?: string }) {
  return (
    <span className={`sport-glyph ${sport} ${className}`} aria-hidden="true">
      {sport === "cricket" ? (
        <svg viewBox="0 0 40 40" fill="none"><path d="m12 27 11-16 6 4-11 16-6-4ZM23 11l5-7 3 2-5 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="29" cy="29" r="4" stroke="currentColor" strokeWidth="2"/><path d="m28 25 3 7" stroke="currentColor"/></svg>
      ) : sport === "diving" ? (
        <svg viewBox="0 0 40 40" fill="none"><circle cx="24" cy="9" r="3" fill="currentColor"/><path d="m10 8 10 7 5 5-7 4-5 6M20 15l-3 8M25 20l7-1M7 34c3-3 5 3 8 0s5 3 8 0 5 3 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ) : <Waves size={30} strokeWidth={1.6} />}
    </span>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? "compact" : ""}`}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>matchlight<span className="brand-period">.</span></span></span>;
}

function ErrorState({ title, message, retry, c }: { title: string; message: string; retry: () => void; c: Copy }) {
  return <div className="error-state" role="alert"><CircleHelp size={28} /><h3>{title}</h3><p>{message}</p><Button variant="secondary" onClick={retry}><RotateCcw size={16} />{c.retry}</Button></div>;
}

function Sources({ sources, locale, c }: { sources: Source[]; locale: Locale; c: Copy }) {
  return <details className="source-details"><summary><CircleHelp size={15} />{c.sources}<ChevronRight size={15} /></summary><div className="source-content"><h4>{c.sourceTitle}</h4>{sources.map((source) => <div className="source-row" key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={12} /></a> : <strong>{source.label}</strong>}<p>{source.note[locale]}</p></div>)}</div></details>;
}

function MatchCard({ match, locale, c, onSelect }: { match: MatchSummary; locale: Locale; c: Copy; onSelect: () => void }) {
  return <button type="button" className={`match-card ${match.sport}`} onClick={onSelect}>
    <div className="match-card-art" style={{ backgroundImage: `url(${match.heroImage})` }}>
      <div className="match-card-art-shade" /><span className="card-sport-label"><SportGlyph sport={match.sport} />{c[match.sport]}</span><span className="card-mode-label">{modeLabel(match.mode, c)}</span>
      <span className="card-art-note">{c.aiArt}</span>
    </div>
    <div className="match-card-body"><span className="match-phase"><span className="status-dot" />{match.phase[locale]}</span><h3>{match.title[locale]}</h3><p>{match.subtitle[locale]}</p><div className="match-venue"><MapPin size={13} /><span>{match.venue}</span></div><div className="match-card-bottom"><span>{c.matchAction}</span><span className="circle-arrow"><ArrowUpRight size={18} /></span></div></div>
  </button>;
}

function Standings({ match, locale, c }: { match: MatchDetail; locale: Locale; c: Copy }) {
  return <section className="standings-card" aria-labelledby="standings-title"><div className="panel-heading"><span className="little-icon"><Trophy size={17} /></span><h3 id="standings-title">{c.rankings}</h3><Badge variant="outline">{modeLabel(match.mode, c)}</Badge></div><table><thead><tr><th scope="col">{c.rank}</th><th scope="col">{c.competitor}</th><th scope="col">{c.result}</th></tr></thead><tbody>{match.leaderboard.map((standing) => <tr key={standing.id}><td><span className={`rank-number rank-${standing.rank}`}>{String(standing.rank).padStart(2, "0")}</span></td><th scope="row"><span className="standing-name">{standing.name}</span><span className="standing-country">{standing.country}</span></th><td className="standing-score">{standing.score}{standing.delta && <small>{standing.delta}</small>}</td></tr>)}</tbody></table><p className="standings-note">{c.standingsNote}</p><div className="standings-footer"><Check size={13} />{match.mode === "historical" ? (locale === "en" ? "Recorded historical standings" : "已记录的历史排名") : (locale === "en" ? "Recorded sample standings" : "已记录的示例排名")}</div></section>;
}

export function Matchlight() {
  const [locale, setLocale] = useState<Locale>("en");
  const [view, setView] = useState<View>("discover");
  const [sport, setSport] = useState<Sport | "all">("all");
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const data = useMatchData(locale);
  const momentList = useRef<HTMLDivElement>(null);
  const c = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectMatch = (id: string) => {
    data.selectMatch(id);
    setQuestion("");
    navigate("explain");
  };
  const changeLocale = () => {
    setLocale((current) => current === "en" ? "zh" : "en");
    setQuestion("");
  };
  useEffect(() => {
    const list = momentList.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !active) return;
    const top = active.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + active.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + active.offsetHeight - list.clientHeight;
  }, [view, data.momentId, data.match?.id]);
  const aiSummary = data.explanation && "aiSummary" in data.explanation && typeof data.explanation.aiSummary === "string"
    ? data.explanation.aiSummary : null;
  const filteredMatches = data.matches.filter((match) => {
    const text = `${match.title.en} ${match.title.zh} ${match.subtitle.en} ${match.subtitle.zh} ${match.sport} ${c[match.sport]} ${match.venue}`.toLocaleLowerCase();
    return (sport === "all" || match.sport === sport) && text.includes(query.trim().toLocaleLowerCase());
  });
  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    if (data.match) void data.ask(question.trim() || defaultQuestion(data.match.sport, locale));
  };
  const momentIndex = data.match?.moments.findIndex((moment) => moment.id === data.momentId) ?? -1;
  const nextMoment = data.match?.moments[momentIndex + 1];
  const updated = data.match && new Date(data.match.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return <div className="matchlight-app">
    <a href="#main-content" className="skip-link">{c.skip}</a>
    <header className="site-header"><div className="site-header-inner"><button className="brand-button" onClick={() => navigate("discover")} aria-label="Matchlight home"><Brand /></button><nav className="main-navigation" aria-label={locale === "en" ? "Main navigation" : "主导航"}><button className={view === "discover" ? "active" : ""} onClick={() => navigate("discover")}>{c.explore}</button><button className={view === "explain" ? "active" : ""} onClick={() => navigate("explain")} disabled={!data.selectedId}>{c.understand}</button><button className={view === "follow" ? "active" : ""} onClick={() => navigate("follow")} disabled={!data.selectedId}>{c.follow}</button></nav><div className="header-actions"><span className="header-demo"><span />{c.demo}</span><Button variant="ghost" size="sm" onClick={changeLocale} className="locale-button" aria-label={locale === "en" ? "切换为中文" : "Switch to English"}><Globe2 size={16} /><span>{locale === "en" ? "中文" : "EN"}</span></Button></div></div></header>
    <main id="main-content">
      {view === "discover" ? <>
        <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" />{c.heroEyebrow}</p><h1>{c.heroTitle}<br /><em>{c.heroItalic}</em><span className="hero-title-star" aria-hidden="true">✳</span></h1><p className="hero-description">{c.heroBody}</p><div className="hero-actions"><Button variant="primary" size="lg" className="primary-button" disabled={!data.matches.length} onClick={() => selectMatch(data.selectedId || data.matches[0].id)}>{c.tryDemo}<ArrowRight size={18} /></Button><a href="#how-it-works" className="text-link">{c.heroLink}<ArrowUpRight size={16} /></a></div><p className="hero-demo-note"><span className="tiny-demo-label">{c.demoTag}</span>{c.catalogNote}</p></div><div className="hero-art" role="img" aria-label={locale === "en" ? "AI illustration of a sunlit aquatics arena" : "AI 绘制的阳光下水上运动场馆"}><div className="hero-art-caption"><span className="caption-dot" />{c.artCaption}</div><span className="hero-art-credit">{c.aiArt}</span><div className="hero-note"><span className="hero-note-icon"><Sparkles size={20} /></span><p className="eyebrow">{c.heroCardLabel}</p><p className="hero-note-question">{c.heroCardText}</p><span>{c.heroCardAnswer}</span></div></div></section>
        <section className="discover-section section-container" aria-labelledby="discover-title"><div className="section-heading"><div><p className="eyebrow">{c.discoverEyebrow}</p><h2 id="discover-title">{c.discoverTitle}</h2><p>{c.discoverBody}</p></div><span className="match-count">{data.matches.length.toString().padStart(2, "0")}<small>{c.available}</small></span></div><div className="discovery-toolbar"><Tabs variant="segmented" tabs={[{ value: "all", label: c.all }, { value: "diving", label: c.diving }, { value: "swimming", label: c.swimming }, { value: "cricket", label: c.cricket }]} selectedValue={sport} onValueChange={(value) => setSport(value as Sport | "all")} className="sport-tabs" /><div className="match-search"><Search size={17} /><Input aria-label={c.search} placeholder={c.searchPlaceholder} value={query} onValueChange={setQuery} className="search-input" /></div></div>
          {data.matchesLoading && !data.matches.length ? <div className="matches-skeleton" role="status" aria-label={c.loadingMatches}>{[1, 2, 3].map((key) => <div className="match-card-skeleton skeleton" key={key} />)}</div> : data.matchesError ? <ErrorState title={c.errorTitle} message={data.matchesError} retry={data.refresh} c={c} /> : filteredMatches.length ? <div className="match-grid">{filteredMatches.map((match) => <MatchCard key={match.id} match={match} locale={locale} c={c} onSelect={() => selectMatch(match.id)} />)}</div> : <div className="empty-state"><Search size={28} /><h3>{c.emptyTitle}</h3><p>{c.emptyText}</p><Button variant="secondary" onClick={() => { setQuery(""); setSport("all"); }}>{c.reset}</Button></div>}
        </section>
        <section id="how-it-works" className="how-section"><div className="section-container"><div className="how-heading"><span className="how-spark" aria-hidden="true">✳</span><div><h2>{c.howTitle}</h2><p>{c.howBody}</p></div></div><div className="steps-grid">{[{ number: "01", title: c.step1Title, body: c.step1Body, icon: Search }, { number: "02", title: c.step2Title, body: c.step2Body, icon: Sparkles }, { number: "03", title: c.step3Title, body: c.step3Body, icon: ArrowUpRight }].map((step) => <div className="how-step" key={step.number}><div className="step-top"><span>{step.number}</span><step.icon size={24} strokeWidth={1.4} /></div><h3>{step.title}</h3><p>{step.body}</p></div>)}</div></div></section>
      </> : <section className="viewer-section section-container">
        <div className="viewer-back-row"><Button variant="ghost" size="sm" className="back-button" onClick={() => navigate("discover")}><ChevronLeft size={16} />{c.back}</Button><Button variant="ghost" size="sm" className="reload-button" onClick={data.refresh} disabled={data.matchLoading}><RotateCcw size={14} />{c.reload}</Button></div>
        {data.matchLoading || data.matchesLoading && !data.match ? <div className="viewer-loading" role="status"><span className="loader-orbit" /><p>{c.loading}</p><div className="viewer-skeleton skeleton" /></div> : data.matchError || data.matchesError ? <ErrorState title={c.matchErrorTitle} message={data.matchError || data.matchesError} retry={data.refresh} c={c} /> : data.match && data.moment ? <>
          <div className="match-heading"><div className="match-heading-text"><div className="viewer-eyebrow"><SportGlyph sport={data.match.sport} /><span>{c[data.match.sport]}</span><span className="eyebrow-separator">/</span><Badge variant="outline">{modeLabel(data.match.mode, c)}</Badge></div><h1>{data.match.title[locale]}</h1><div className="match-heading-meta"><span><MapPin size={13} />{data.match.venue}</span><span><span className="status-dot" />{data.match.phase[locale]}</span></div></div><p className="viewer-demo-note">{data.match.mode === "historical" ? c.historicalNote : data.match.mode === "demo" ? c.demoNote : ""}</p></div>
          <div className="viewer-tabs"><Tabs variant="underline" tabs={[{ value: "explain", label: c.momentTab }, { value: "follow", label: c.nextTab }]} selectedValue={view} onValueChange={(value) => setView(value as "explain" | "follow")} /><span className="sample-updated"><Clock3 size={12} />{c.updated} {updated}</span></div>
          {view === "explain" ? <div className="viewer-grid"><div className="viewer-main"><section className="moment-panel"><div className="moment-panel-top"><p className="eyebrow">{c.momentEyebrow}</p><span className="recorded-badge"><span />{c.recorded}</span></div><div className="moment-score-row"><div className="moment-athlete"><span className="athlete-avatar">{data.moment.athlete.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span><div><span className="moment-label">{data.moment.label[locale]}</span><h2>{data.moment.athlete}</h2><p>{data.moment.country}<span>·</span>{data.moment.clock}</p></div></div><div className="recorded-score"><span>{c.score}</span><strong>{data.moment.scoreboard}</strong></div></div><p className="moment-summary">{data.moment.summary[locale]}</p><div className="moment-stats">{data.moment.stats.map((stat, index) => <div key={`${stat.label.en}-${index}`}><span>{stat.label[locale]}</span><strong>{stat.value}</strong></div>)}</div>{data.moment.scoring && <details className="judge-details"><summary>{c.judgeMarks}<span>{c.difficulty} {data.moment.scoring.difficulty}<ChevronRight size={14} /></span></summary><div className="judge-marks">{data.moment.scoring.judgeScores.map((score, index) => <div key={index}><small>{locale === "en" ? `Judge ${index + 1}` : `裁判 ${index + 1}`}</small><strong>{score.toFixed(1)}</strong></div>)}</div></details>}</section>
            <section className="explanation-panel" aria-live="polite" aria-busy={data.explainLoading}><div className="explanation-heading"><span className="explanation-icon"><Sparkles size={20} /></span><div><h2>{c.explanation}</h2><p>{c.grounded}</p></div></div>{data.explainLoading ? <div className="explain-loading" role="status"><p>{c.explainLoading}</p><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div> : data.explainError ? <ErrorState title={c.explainError} message={data.explainError} retry={() => { void data.ask(question.trim() || defaultQuestion(data.match!.sport, locale)); }} c={c} /> : data.explanation ? <><h3 className="answer-headline">{data.explanation.headline}</h3><p className="answer-copy">{data.explanation.answer}</p>{aiSummary && <aside className="ai-paraphrase"><span><Sparkles size={14} />{locale === "en" ? "AI paraphrase" : "AI 简述"}</span><p>{aiSummary}</p></aside>}<div className="breakdown"><div className="breakdown-label">{c.breakdown}</div>{data.explanation.breakdown.map((item, index) => <div className="breakdown-row" key={`${item.label}-${index}`}><div><span>{item.label}</span>{item.detail && <p>{item.detail}</p>}</div><strong>{item.value}</strong></div>)}</div><Button variant="ghost" className="follow-inline-button" onClick={() => navigate("follow")}>{c.followCta}<ArrowRight size={16} /></Button></> : null}<Sources sources={data.match.sources.filter((source) => !data.explanation || data.explanation.sourceIds.includes(source.id))} locale={locale} c={c} /></section>
            <section className="ask-panel"><div className="ask-title"><CircleHelp size={18} /><h3>{c.askLabel}</h3></div><form onSubmit={submitQuestion}><Input aria-label={c.question} placeholder={c.askPlaceholder} value={question} onValueChange={setQuestion} maxLength={400} className="question-input" /><Button type="submit" variant="primary" className="primary-button" loading={data.explainLoading}>{c.ask}<ArrowRight size={16} /></Button></form><div className="question-suggestions"><button onClick={() => { const q = defaultQuestion(data.match!.sport, locale); setQuestion(q); void data.ask(q); }} disabled={data.explainLoading}>{c.scorePrompt}<ArrowUpRight size={12} /></button><button onClick={() => { setQuestion(c.nextPrompt); void data.ask(c.nextPrompt); }} disabled={data.explainLoading}>{c.nextPrompt}<ArrowUpRight size={12} /></button></div><p className="ask-hint">{c.questionHint}</p></section>
          </div><aside className="viewer-side"><section className="moment-list-panel"><div className="panel-heading"><h3>{c.moments}</h3><span className="moment-count">{data.match.moments.length.toString().padStart(2, "0")}</span></div><div className="moment-list" aria-label={c.selectMoment} ref={momentList}>{data.match.moments.map((moment, index) => <button className={`moment-list-item ${data.momentId === moment.id ? "active" : ""}`} key={moment.id} aria-pressed={data.momentId === moment.id} onClick={() => { data.selectMoment(moment.id); setQuestion(""); }}><span className="moment-sequence">{String(index + 1).padStart(2, "0")}</span><div><span className="moment-list-label">{moment.label[locale]}</span><strong>{moment.athlete}</strong><small>{moment.clock}</small></div><span className="moment-list-score">{moment.scoreboard}{data.momentId === moment.id ? <Check size={13} /> : <ChevronRight size={13} />}</span></button>)}</div></section><Standings match={data.match} locale={locale} c={c} /><button className="watch-teaser" onClick={() => navigate("follow")}><span className="eyebrow">{c.upNext}</span><strong>{data.match.watchNext.title[locale]}</strong><span className="watch-teaser-bottom">{c.follow}<ArrowUpRight size={20} /></span></button></aside></div> : <div className="follow-grid"><div><section className="watch-next-card"><div className="watch-next-top"><p className="eyebrow">{c.upNext}</p><span className="watch-next-star" aria-hidden="true">✳</span></div><h2>{c.whatNext}</h2><h3>{data.match.watchNext.title[locale]}</h3><p>{data.explanation?.watchNext || data.match.watchNext.description[locale]}</p>{data.match.watchNext.athlete && <div className="watch-athlete"><span>{locale === "en" ? "Keep an eye on" : "关注选手"}</span><strong>{data.match.watchNext.athlete}</strong></div>}{data.match.watchNext.target && <div className="watch-target"><span>{locale === "en" ? "The number to watch" : "值得关注的数字"}</span><strong>{data.match.watchNext.target}</strong></div>}<div className="watch-next-bottom"><Button variant="secondary" className="watch-button" disabled={!nextMoment} onClick={() => { if (nextMoment) { data.selectMoment(nextMoment.id); setQuestion(""); navigate("explain"); } }}>{c.nextMoment}<ArrowRight size={17} /></Button>{!nextMoment && <span>{c.finalMoment}</span>}</div></section><section className="rules-panel"><p className="eyebrow">{c.ruleEyebrow}</p><h2>{c.rules}</h2>{data.match.rules.map((rule) => <details className="rule-item" key={rule.id}><summary>{rule.title[locale]}<ChevronRight size={16} /></summary><p>{rule.body[locale]}</p></details>)}<Sources sources={data.match.sources} locale={locale} c={c} /></section></div><aside className="follow-side"><Standings match={data.match} locale={locale} c={c} /><div className="selected-moment-recap"><p className="eyebrow">{c.selectedMoment}</p><h3>{data.moment.athlete}</h3><p>{data.moment.summary[locale]}</p><Button variant="ghost" onClick={() => navigate("explain")}>{c.momentTab}<ArrowRight size={15} /></Button></div></aside></div>}
        </> : <div className="empty-state"><CircleHelp size={28} /><h3>{c.noMoments}</h3><Button variant="secondary" onClick={() => navigate("discover")}>{c.back}</Button></div>}
      </section>}
    </main>
    <footer className="site-footer"><div className="section-container footer-inner"><div><Brand compact /><p>{c.footer}</p></div><div className="footer-meta"><span>{c.footerProject}</span><span>{c.catalogNote}</span></div></div></footer>
  </div>;
}
