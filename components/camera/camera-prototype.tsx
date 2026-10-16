"use client";

/* eslint-disable @next/next/no-img-element -- Uploaded photos and captured camera frames need browser image URLs. */
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, CameraIcon, CheckIcon, ClockIcon, CrosshairIcon, EyeIcon, EyeSlashIcon, GlobeIcon, ImageIcon, InfoIcon, ScanIcon, ShieldCheckIcon, SparkleIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import type { Locale } from "@/lib/match-types";
import type { AnalysisSource, AnalyzeResult } from "@/lib/analysis/types";
import type { EventCompetitor } from "@/lib/analysis/individual-types";
import { countryInfo } from "@/lib/countries";
import { getAthleteMedia } from "@/lib/athlete-media";
import { containedPhotoBounds, validatePhotoFile } from "@/lib/photo-input";
import { captureDateISO, captureDateInput, PhotoAnalysisError, prepareAnalysisImage, requestPhotoAnalysis, requestLiveEvents, liveEventScorecard, safeAthleteImage } from "@/lib/photo-analysis-client";
import "./camera.css";

const samples = [
  { id: "diving" as const, src: "/images/scan/scoreboard-sample.svg", date: "2024-08-09T13:05:00Z", en: "Diving · 3m final", zh: "跳水 · 三米板决赛", hint: "Paris 2024 women's 3m springboard final, 9 August 2024. This is a recreated historical scorecard. Read its visible athlete, round, score and difficulty, then check the official records.", sourceUrl: "https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310" },
  { id: "gymnastics" as const, src: "/images/scan/gymnastics-all-around.svg", date: "2024-08-01T19:00:00Z", en: "Gymnastics · All-around", zh: "体操 · 女子全能", hint: "Paris 2024 women's artistic gymnastics individual all-around final, 1 August 2024. This is a recreated historical scorecard; check the visible names and results against the event records.", sourceUrl: "https://site.web.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=20240801&lang=en&region=us" },
  { id: "athletics" as const, src: "/images/scan/athletics-100m.svg", date: "2024-08-04T19:50:00Z", en: "Athletics · Men's 100m", zh: "田径 · 男子百米", hint: "Paris 2024 men's 100m final, 4 August 2024. This is a recreated historical scorecard. Read the displayed photo-finish times; check actual results before explaining the placings.", sourceUrl: "https://site.web.api.espn.com/apis/site/v2/olympics/summer/2024/results?dates=20240804&lang=en&region=us" },
  { id: "action" as const, src: "/images/scan/diving-final.jpg", date: "2024-08-08T12:00:00Z", en: "Diving · Action photo", zh: "跳水 · 比赛照片", hint: "Paris 2024 women's 3m springboard. Historical photo; the exact dive and athlete are not confirmed. Capture time is approximate: only the event day is known. Do not infer an exact play from this timestamp.", sourceUrl: "https://www.worldaquatics.com/news/4183036/high-stakes-splashes-in-2024-the-year-in-diving" },
];
type Photo = { src: string; source: "upload" | "camera" | "sample"; name: string; sample?: typeof samples[number]["id"]; liveSample?: { checkedAt: string; sources: AnalysisSource[] } };
type AnalysisMode = "live" | "replay";
const previewSample = samples.find((sample) => sample.id === "action")!;
const ui = {
  en: {
    capture: "Capture", discover: "Discover", understand: "Understand", eyebrow: "SEE MORE OF THE GAME", title: <>YOUR VIEW.<br /><span>MORE TO IT.</span></>,
    intro: "Point at the game. Find the match, catch up on the action, and tap into the details.", takePhoto: "Take a photo", upload: "Upload photo", sample: "Try a sample", preparing: "Opening camera…", snap: "Capture this moment", preview: "SAMPLE PREVIEW", photoMode: "PHOTO MODE", cameraOn: "CAMERA ON", frameHint: "A clear scoreboard or team name helps find your game.",
    sampleTitle: "TRY IT WITH A GAME.", sampleNote: "Check current cricket data, or explore a historical moment.", privacy: "You choose when to send a photo for analysis.", cameraError: "Camera unavailable. Upload a photo or try a sample.", fileError: "Choose a JPG, PNG, or WebP image up to 10 MB.", imageError: "This image could not be opened. Try another photo.",
    one: "Capture the game", oneBody: "The action. A player. The scoreboard.", two: "Find your moment", twoBody: "Photo clues meet scores and play-by-play.", three: "Tap to catch up", threeBody: "What happened, and why it matters.", newPhoto: "New photo", photo: "Your photo", close: "Close camera", hide: "Hide labels", show: "Show labels", tap: "Tap a point to find out more", photoCaption: "Historical photo · Paris 2024", credit: "Tsutomu Kishimoto / World Aquatics", scoreboardCaption: "Recreated historical scorecard · Paris 2024", sampleSource: "View record", rule: "General rule", athleteProfile: "Athlete profile", resultLabel: "Recorded result", place: "Place", country: "Country", changePhoto: "Change photo",
    modeLabel: "You’re watching", liveMode: "Live now", replayMode: "Replay / past event", liveBody: "We’ll check current events and use your photo to find the match.", liveAnalyze: "Find current match", liveAnalyzing: "Reading your photo & checking current events…", liveAnalyzingBody: "Looking for current matches, then checking the teams and scoreboard against your photo.", currentSample: "Current match sample", currentLoading: "Checking ESPN…", currentCaption: "ESPN current data · recreated scorecard, not a photo", currentNote: "Current ESPN snapshot. Press Analyze to match the image to the game.", liveUnavailable: "ESPN current data is unavailable. Try again shortly or use your own photo.", liveUnsupported: "The current cricket feed is not available here yet.", liveNone: "ESPN returned no confirmed live cricket match at this check. Try again or use your own photo.", liveUnconfirmed: "ESPN has not confirmed a live match in the returned data. Try again shortly.", currentEvents: "Current events checked", activeEvents: "active matches", noActiveEvents: "No live match returned", feedUnavailable: "Current data unavailable", feedUnsupported: "Current data not covered", matchAmbiguous: "Choose the matching game", matchFound: "Current match found", currentLinked: "Current event linked", statistics: "Match statistics", modeEdit: "Change mode or clues", setupEyebrow: "YOUR PHOTO / YOUR MOMENT", setupTitle: "What are we watching?", setupBody: "We'll read the image, look for the match, and explain what the available game data tells us.", captureTime: "Time shown in this photo", timeNote: "For a replay or an older photo, set the original date and time. Defaults to now.", hint: "Any clues?", hintPlaceholder: "Team, league, player, or event (optional)", analyze: "Analyze photo", analyzing: "Reading your photo & checking match data…", analyzeNote: "Your photo is resized and sent to our server and OpenRouter for image analysis. Match clues go to TypeSafe JEV and sports data sources.", invalidDate: "Enter a valid date and time for this photo.", retry: "Try again", cancel: "Cancel analysis", results: "IN THE PICTURE", live: "LIVE DATA", historical: "HISTORICAL", scheduled: "UPCOMING", unknown: "TIME UNCONFIRMED", notMatched: "MATCH NOT CONFIRMED", selected: "Match selected by you", autoMatch: "Match identified", updated: "Data checked", captured: "Photo time", source: "Sources", observed: "Visible in your photo", provider: "From match data", noSources: "This point describes visible details in the photo.", details: "What you're seeing", candidates: "Which game is in your photo?", candidateNote: "These are possible matches. Choose one only if it matches your photo.", choose: "Use this match", clues: "Clues in the photo", limitations: "Still uncertain", edit: "Edit time or clues", backPhoto: "Back to your photo", failure: "We couldn't finish the analysis. Try again or add a team, league, or date.", timedOut: "The analysis took too long. Try again with a clearer image or a team name.", noPoints: "Try a clearer photo with a scoreboard or team name.", notExact: "The exact play in the photo is not confirmed.", historicalLiveNote: "Historical image. Live mode checks current events.", sampleWarning: "Historical sample. Event date is filled in; you can adjust it.", analyzingBody: "Matching visible names, scores, and the photo time with available sports records. This can take a moment.",
  },
  zh: {
    capture: "拍摄", discover: "发现", understand: "看懂", eyebrow: "看见更多精彩", title: <>拍下眼前。<br /><span>看懂精彩。</span></>,
    intro: "对准比赛，找到这场对决。点开照片上的看点，快速了解发生了什么。", takePhoto: "拍一张照片", upload: "上传照片", sample: "体验示例", preparing: "正在打开相机…", snap: "拍下这个瞬间", preview: "示例预览", photoMode: "拍照模式", cameraOn: "相机已开启", frameHint: "拍清记分牌、队名，更容易找到这场比赛。",
    sampleTitle: "先体验一场比赛。", sampleNote: "查看当前板球赛事，或回看历史时刻。", privacy: "点击分析后，才会发送照片。", cameraError: "暂时无法打开相机，可以上传照片或体验示例。", fileError: "请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。", imageError: "无法打开这张图片，请换一张照片。",
    one: "拍下比赛", oneBody: "比赛画面、运动员，或记分牌。", two: "找到这一刻", twoBody: "结合照片线索、比分与比赛记录。", three: "点一下，跟上比赛", threeBody: "发生了什么，为什么值得关注。", newPhoto: "重新拍摄", photo: "你的照片", close: "关闭相机", hide: "隐藏标注", show: "显示标注", tap: "点击照片上的看点，了解更多", photoCaption: "历史照片 · 巴黎 2024", credit: "Tsutomu Kishimoto / World Aquatics", scoreboardCaption: "历史成绩卡重现 · 巴黎 2024", sampleSource: "查看记录", rule: "官方规则", athleteProfile: "运动员档案", resultLabel: "官方成绩", place: "名次", country: "代表国家 / 地区", changePhoto: "更换照片",
    modeLabel: "正在看什么", liveMode: "当前直播", replayMode: "回放 / 历史赛事", liveBody: "先查询当前赛事，再根据照片里的线索找到这场比赛。", liveAnalyze: "查询当前赛事", liveAnalyzing: "正在读图并查询当前赛事…", liveAnalyzingBody: "正在查找当前比赛，并核对照片里的队名与记分牌。", currentSample: "当前赛事示例", currentLoading: "正在查询 ESPN…", currentCaption: "ESPN 当前数据重现 · 不是实拍照片", currentNote: "这是 ESPN 当前数据快照。点击分析后，识别画面并核对比赛。", liveUnavailable: "ESPN 当前数据暂不可用，请稍后再试，或使用自己的照片。", liveUnsupported: "暂时无法从这里查询当前板球赛事。", liveNone: "本次 ESPN 查询未返回已确认正在进行的板球比赛，可以稍后再试或使用自己的照片。", liveUnconfirmed: "ESPN 返回的数据尚未确认有正在进行的比赛，请稍后再试。", currentEvents: "当前赛事查询", activeEvents: "场进行中的比赛", noActiveEvents: "本次未返回进行中的比赛", feedUnavailable: "当前数据暂不可用", feedUnsupported: "暂不覆盖当前数据", matchAmbiguous: "请选择照片对应的比赛", matchFound: "找到当前赛事", currentLinked: "当前赛事已关联", statistics: "比赛统计", modeEdit: "切换模式或补充线索", setupEyebrow: "你的照片 / 你的时刻", setupTitle: "眼前是哪场比赛？", setupBody: "读取画面，查找比赛，再结合赛事数据解释照片里的看点。", captureTime: "照片对应的比赛时间", timeNote: "回放或旧照片请改成原始日期与时间，默认使用现在。", hint: "还知道什么线索？", hintPlaceholder: "队名、联赛、运动员或赛事（选填）", analyze: "分析照片", analyzing: "正在读图并查询赛事数据…", analyzeNote: "照片会压缩后发送至服务器与 OpenRouter 进行识别；比赛线索会发送至 TypeSafe JEV 和体育数据源，判断对应赛事。", invalidDate: "请输入有效的照片日期与时间。", retry: "重试", cancel: "取消分析", results: "照片里的看点", live: "实时数据", historical: "历史赛事", scheduled: "尚未开始", unknown: "时间未确认", notMatched: "赛事尚未确认", selected: "由你选定赛事", autoMatch: "已识别赛事", updated: "数据查询于", captured: "照片时间", source: "信息来源", observed: "来自照片画面", provider: "来自赛事数据", noSources: "这条信息描述照片中可见的内容。", details: "看懂这个细节", candidates: "照片里是哪一场？", candidateNote: "这些是可能的比赛，请仅在与照片一致时选择。", choose: "选择这场比赛", clues: "照片里的线索", limitations: "尚未确定", edit: "修改时间或补充线索", backPhoto: "回到照片", failure: "分析暂未完成，可以重试，或补充队名、联赛和日期。", timedOut: "分析用时较长，请重试，或上传更清晰的图片并补充队名。", noPoints: "试试包含清晰记分牌或队名的照片。", notExact: "尚未确认照片对应的确切比赛瞬间。", historicalLiveNote: "这是历史照片，直播模式会查询当前赛事。", sampleWarning: "历史示例，已填入赛事日期，可以按需修改。", analyzingBody: "正在结合画面中的名字、比分和照片时间，查询可用的赛事记录，请稍候。",
  },
};

function formatTime(value: string, locale: Locale, timeZone?: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(date);
}
function safeSource(url: string) { try { const parsed = new URL(url); return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : undefined; } catch { return undefined; } }

function AthleteCard({ athlete, locale }: { athlete: EventCompetitor; locale: Locale }) {
  const c = ui[locale];
  const media = getAthleteMedia(athlete.name);
  const image = media?.src ?? safeAthleteImage(athlete.image);
  const profile = safeSource(athlete.profileUrl ?? media?.sourceUrl ?? "");
  const country = athlete.country ? countryInfo(athlete.country, locale) : null;
  return <div className="cp-athlete-card">
    <div className="cp-athlete-identity">{image && <img src={image} alt={athlete.name}/>}<div><strong>{athlete.name}</strong>{country && <span><span aria-hidden="true">{country.flag}</span>{country.name}<small>{country.code}</small></span>}{profile && <a href={profile} target="_blank" rel="noreferrer">{c.athleteProfile}<ArrowUpRightIcon size={10}/></a>}</div></div>
    <div className="cp-athlete-record"><span>{c.place}<strong>{athlete.rank !== undefined ? `#${athlete.rank}` : "—"}</strong></span><span>{c.resultLabel}<strong>{athlete.score ?? "—"}</strong></span></div>
    {media && <small className="cp-athlete-credit">{media.credit}</small>}
  </div>;
}

export function CameraPrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("live");
  const [liveSampleLoading, setLiveSampleLoading] = useState(false);
  const [capturedAt, setCapturedAt] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [hint, setHint] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1280, height: 853 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraGeneration = useRef(0);
  const analysisGeneration = useRef(0);
  const analysisAbort = useRef<AbortController | null>(null);
  const liveSampleAbort = useRef<AbortController | null>(null);
  const liveSampleGeneration = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const c = ui[locale];
  const activePoint = result?.points.find((point) => point.id === activeId) ?? result?.points[0];
  const plane = containedPhotoBounds(imageSize.width, imageSize.height, frameSize.width, frameSize.height);
  const currentPhoto = photo?.src ?? previewSample.src;
  const photoSample = samples.find((sample) => sample.id === photo?.sample);
  const resultLimitations = [...new Set([...(result?.features.limitations ?? []), ...(result?.limitations ?? [])])];
  const progress = !photo ? 0 : result ? 2 : 1;

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setCapturedAt(captureDateInput());
  }, []);
  useEffect(() => { document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"; }, [locale]);
  useEffect(() => {
    if (cameraOn && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {});
    }
  }, [cameraOn]);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => { const rect = frame.getBoundingClientRect(); setFrameSize({ width: rect.width, height: rect.height }); };
    update();
    const observer = new ResizeObserver(update); observer.observe(frame);
    return () => observer.disconnect();
  }, [photo]);
  useEffect(() => () => {
    cameraGeneration.current += 1; analysisGeneration.current += 1;
    stream.current?.getTracks().forEach((track) => track.stop()); analysisAbort.current?.abort(); liveSampleGeneration.current += 1; liveSampleAbort.current?.abort();
  }, []);
  useEffect(() => () => { if (photo?.src.startsWith("blob:")) URL.revokeObjectURL(photo.src); }, [photo?.src]);

  function cancelAnalysis() {
    analysisGeneration.current += 1; analysisAbort.current?.abort(); analysisAbort.current = null; setLoading(false);
  }
  function cancelLiveSample() {
    liveSampleGeneration.current += 1; liveSampleAbort.current?.abort(); liveSampleAbort.current = null; setLiveSampleLoading(false);
  }
  function changeMode(next: AnalysisMode) {
    if (next === mode) return;
    cancelAnalysis(); cancelLiveSample(); setMode(next); setResult(null); setActiveId(null); setError("");
  }
  function stopCamera() {
    cameraGeneration.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCameraOn(false); setCameraPending(false);
  }
  function reset() {
    cancelAnalysis(); cancelLiveSample(); stopCamera(); setMode("live"); setPhoto(null); setResult(null); setActiveId(null); setError(""); setHint(""); setCapturedAt(captureDateInput()); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function changeLocale() {
    cancelAnalysis(); cancelLiveSample(); setLocale(locale === "en" ? "zh" : "en"); setResult(null); setActiveId(null); setError("");
  }
  async function openCamera() {
    if (cameraPending) return;
    if (!navigator.mediaDevices?.getUserMedia) { captureInput.current?.click(); return; }
    cancelAnalysis(); cancelLiveSample();
    const generation = ++cameraGeneration.current;
    setCameraPending(true); setError("");
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      if (generation !== cameraGeneration.current) { next.getTracks().forEach((track) => track.stop()); return; }
      stream.current = next; setCameraOn(true); setPhoto(null); setResult(null);
    } catch { if (generation === cameraGeneration.current) setError(c.cameraError); }
    finally { if (generation === cameraGeneration.current) setCameraPending(false); }
  }
  function receivePhoto(next: Photo, date = new Date(), clue = "", nextMode: AnalysisMode = "live") {
    cancelAnalysis(); cancelLiveSample(); stopCamera(); setMode(nextMode); setPhoto(next); setResult(null); setActiveId(null); setCapturedAt(captureDateInput(date)); setHint(clue); setError(""); setLabels(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function takePhoto() {
    if (!cameraOn) { void openCamera(); return; }
    const frame = video.current;
    if (!frame?.videoWidth || !frame.videoHeight) { setError(c.cameraError); return; }
    const canvas = document.createElement("canvas"); canvas.width = frame.videoWidth; canvas.height = frame.videoHeight;
    const drawing = canvas.getContext("2d");
    if (!drawing) { setError(c.cameraError); return; }
    drawing.drawImage(frame, 0, 0);
    receivePhoto({ src: canvas.toDataURL("image/jpeg", .9), source: "camera", name: c.photo });
  }
  function upload(event: ChangeEvent<HTMLInputElement>, source: "upload" | "camera") {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (validatePhotoFile(file)) { setError(c.fileError); return; }
    receivePhoto({ src: URL.createObjectURL(file), source, name: file.name });
  }
  function useSample(item: typeof samples[number]) {
    receivePhoto({ src: item.src, source: "sample", name: item[locale], sample: item.id }, new Date(item.date), item.hint, "replay");
  }
  async function useCurrentSample() {
    cancelLiveSample(); cancelAnalysis();
    const generation = ++liveSampleGeneration.current;
    const controller = new AbortController(); liveSampleAbort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setLiveSampleLoading(true); setError("");
    try {
      const current = await requestLiveEvents(controller.signal);
      if (generation !== liveSampleGeneration.current) return;
      if (current.status !== "ok") { setError(current.status === "unsupported" ? c.liveUnsupported : c.liveUnavailable); return; }
      const event = current.events.find((item) => item.status === "live" && item.teams.length >= 2);
      if (!event) { setError(current.limited || current.events.some((item) => item.status === "unknown") ? c.liveUnconfirmed : c.liveNone); return; }
      const src = URL.createObjectURL(new Blob([liveEventScorecard(event, current.checkedAt)], { type: "image/svg+xml" }));
      receivePhoto({ src, source: "sample", name: c.currentSample, liveSample: { checkedAt: current.checkedAt, sources: current.sources } }, new Date(current.checkedAt), `${event.name}. Cricket, ${event.league}. ESPN current scoreboard checked ${current.checkedAt}.`, "live");
    } catch {
      if (generation === liveSampleGeneration.current) setError(c.liveUnavailable);
    } finally {
      clearTimeout(timeout);
      if (generation === liveSampleGeneration.current) { setLiveSampleLoading(false); liveSampleAbort.current = null; }
    }
  }
  async function analyze(selectedEvent?: { league: string; eventId: string }) {
    if (!photo) return;
    const timestamp = mode === "live" ? new Date().toISOString() : captureDateISO(capturedAt);
    if (!timestamp) { setError(c.invalidDate); return; }
    cancelAnalysis();
    const generation = ++analysisGeneration.current;
    const controller = new AbortController(); analysisAbort.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);
    setLoading(true); setError("");
    try {
      const imageDataUrl = await prepareAnalysisImage(photo.src, controller.signal);
      const next = await requestPhotoAnalysis({ imageDataUrl, capturedAt: timestamp, timeZone, locale, mode, hint: hint.trim() || undefined, selectedEvent }, controller.signal);
      if (generation !== analysisGeneration.current) return;
      setResult(next); setActiveId(next.points[0]?.id ?? null); setLabels(true);
    } catch (cause) {
      if (generation !== analysisGeneration.current) return;
      if (timedOut) setError(c.timedOut);
      else if (!controller.signal.aborted) setError(cause instanceof PhotoAnalysisError && cause.message !== "ANALYSIS_FAILED" && cause.message !== "INVALID_RESPONSE" ? cause.message : c.failure);
    } finally {
      clearTimeout(timeout);
      if (generation === analysisGeneration.current) { setLoading(false); analysisAbort.current = null; }
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void analyze(); }
  function pickPoint(id: string) {
    setActiveId(id);
    if (window.innerWidth <= 800 && panelRef.current && panelRef.current.getBoundingClientRect().top > window.innerHeight * .6) panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function edit() { cancelAnalysis(); setResult(null); setError(""); }
  const event = result?.event;
  const analysisHeading = mode === "live" ? c.liveAnalyzing : c.analyzing;
  const temporalLabel = result ? ({ live: c.live, historical: c.historical, scheduled: c.scheduled, unknown: c.unknown })[result.temporal] : "";

  return <div className="cp-app">
    <header className="cp-header"><button className="cp-brand" onClick={reset} aria-label="Matchlight"><span aria-hidden="true"><i/><i/><i/></span><span>matchlight<span className="cp-brand-dot">.</span></span></button><div className="cp-header-right"><span className="cp-la" aria-hidden="true">LA<b>28</b></span><button className="cp-locale" onClick={changeLocale}><GlobeIcon size={15}/>{locale === "en" ? "中文" : "EN"}</button></div></header>
    <nav className="cp-flow" aria-label={locale === "en" ? "Photo steps" : "照片步骤"}>{[c.capture, c.discover, c.understand].map((label, index) => <span key={index} className={`${index === progress ? "active" : ""} ${index < progress ? "complete" : ""}`} aria-current={index === progress ? "step" : undefined}><b>{index < progress ? <CheckIcon size={12}/> : `0${index + 1}`}</b>{label}{index < 2 && <i className="cp-flow-line"/>}</span>)}</nav>
    <main className={`cp-workspace ${photo ? "has-photo" : "is-capture"}`}>
      {!photo && <section className="cp-welcome"><p className="cp-eyebrow"><span/>{c.eyebrow}</p><h1>{c.title}</h1><p className="cp-intro">{c.intro}</p><div className="cp-main-actions"><Button variant="primary" className="cp-primary" onClick={takePhoto} loading={cameraPending}><CameraIcon size={19}/>{cameraOn ? c.snap : c.takePhoto}<ArrowUpRightIcon size={17}/></Button><Button variant="secondary" className="cp-secondary" onClick={() => uploadInput.current?.click()}><UploadSimpleIcon size={18}/>{c.upload}</Button></div><p className="cp-privacy"><ShieldCheckIcon size={14}/>{c.privacy}</p><div className="cp-how-mini">{[{ icon: CrosshairIcon, title: c.one, body: c.oneBody }, { icon: ScanIcon, title: c.two, body: c.twoBody }, { icon: SparkleIcon, title: c.three, body: c.threeBody }].map((step, index) => <div key={index}><span><step.icon size={18}/></span><div><h2>{step.title}</h2><p>{step.body}</p></div></div>)}</div></section>}
      <section className="cp-photo-workspace" aria-label={c.photo}>
        {photo && <div className="cp-photo-toolbar"><button onClick={reset}><ArrowLeftIcon size={14}/>{c.newPhoto}</button><span><ClockIcon size={12}/>{mode === "live" ? c.liveMode : formatTime(captureDateISO(capturedAt) ?? new Date().toISOString(), locale, timeZone)}</span><button onClick={() => uploadInput.current?.click()} aria-label={c.changePhoto}><ImageIcon size={15}/></button></div>}
        <div ref={frameRef} className={`cp-viewfinder ${photo ? "reviewing" : ""} ${loading ? "analyzing" : ""}`}>
          {cameraOn ? <video ref={video} autoPlay muted playsInline className="cp-camera-video"/> : photo ? <div className="cp-annotation-plane" style={plane ? { left: plane.left, top: plane.top, width: plane.width, height: plane.height } : { inset: 0 }}><img className="cp-scene" src={currentPhoto} alt={photo.name} onLoad={(load) => setImageSize({ width: load.currentTarget.naturalWidth, height: load.currentTarget.naturalHeight })} onError={() => setError(c.imageError)}/>{result && labels && !loading && result.points.map((point, index) => <button key={point.id} className={`cp-pin ${point.kind} ${activePoint?.id === point.id ? "active" : ""} ${point.x > .62 ? "pin-left" : ""}`} style={{ left: `${Math.max(.04, Math.min(.96, point.x)) * 100}%`, top: `${Math.max(.05, Math.min(.95, point.y)) * 100}%` }} onClick={() => pickPoint(point.id)} aria-label={point.title} aria-pressed={activePoint?.id === point.id}><span className="cp-pin-dot">{index + 1}</span><span className="cp-pin-label">{point.title}<ArrowUpRightIcon size={11}/></span></button>)}</div> : <img className="cp-scene cp-preview" src={previewSample.src} alt={locale === "en" ? "Diver in action at Paris 2024" : "巴黎 2024 跳水比赛画面"}/>}
          {!photo && <><div className="cp-frame-shade"/><div className="cp-viewfinder-top"><span><span className="cp-camera-dot"/>{cameraOn ? c.cameraOn : c.photoMode}</span><span className="cp-frame-tag">{cameraOn ? c.photoMode : c.preview}</span>{cameraOn && <button aria-label={c.close} onClick={stopCamera}><XIcon size={17}/></button>}</div><div className="cp-focus-frame"><i/><i/><i/><i/></div><p className="cp-frame-prompt">{c.frameHint}</p><div className="cp-capture-bar"><button className="cp-gallery-button" aria-label={c.upload} onClick={() => uploadInput.current?.click()}><ImageIcon size={23}/></button><button className="cp-shutter" onClick={takePhoto} disabled={cameraPending} aria-label={cameraOn ? c.snap : c.takePhoto}><span><CameraIcon size={25}/></span></button><button className="cp-sample-scan" onClick={() => void useCurrentSample()} disabled={liveSampleLoading}><SparkleIcon size={16}/><span>{liveSampleLoading ? c.currentLoading : c.sample}</span></button></div><span className="cp-image-credit">{c.credit}</span></>}
          {loading && <div className="cp-analysis-overlay"><span className="cp-analysis-ring"><ScanIcon size={29}/></span><strong>{analysisHeading}</strong></div>}
        </div>
        {photo ? <><div className="cp-photo-caption"><span>{photo.liveSample ? c.currentCaption : photo.sample === "action" ? c.photoCaption : photo.sample ? c.scoreboardCaption : photo.name}</span>{photoSample?.sourceUrl && <a href={photoSample.sourceUrl} target="_blank" rel="noreferrer">{photo.sample === "action" ? c.credit : c.sampleSource}<ArrowUpRightIcon size={10}/></a>}</div>{photo.liveSample && <div className="cp-live-snapshot"><span><ClockIcon size={11}/>{c.updated}: {formatTime(photo.liveSample.checkedAt, locale, timeZone)}</span>{photo.liveSample.sources.filter((source) => safeSource(source.url)).map((source) => <a key={source.id} href={safeSource(source.url)} target="_blank" rel="noreferrer">{source.label}<ArrowUpRightIcon size={10}/></a>)}</div>}{result && <div className="cp-layer-toolbar"><span>{c.tap}</span><button aria-label={labels ? c.hide : c.show} aria-pressed={labels} onClick={() => setLabels(!labels)}>{labels ? <EyeIcon size={15}/> : <EyeSlashIcon size={15}/>}{labels ? c.hide : c.show}</button></div>}</> : <div className="cp-sample-tray"><div><p className="cp-eyebrow">{c.sampleTitle}</p><p>{c.sampleNote}</p></div><button className="cp-current-sample" onClick={() => void useCurrentSample()} disabled={liveSampleLoading}><span className={liveSampleLoading ? "cp-spinning" : ""}><ScanIcon size={19}/></span><span><strong>{liveSampleLoading ? c.currentLoading : c.currentSample}</strong><small>ESPN · Cricket</small></span><ArrowUpRightIcon size={15}/></button><div className="cp-sample-choices">{samples.map((item) => <button key={item.id} onClick={() => useSample(item)}><img src={item.src} alt=""/><span>{item[locale]}</span><ArrowUpRightIcon size={15}/></button>)}</div></div>}
        {error && <div className="cp-error" role="alert"><InfoIcon size={16}/><span>{error}</span><button onClick={() => setError("")} aria-label={locale === "en" ? "Dismiss error" : "关闭错误提示"}><XIcon size={15}/></button></div>}
      </section>
      {photo && <aside className="cp-context-panel" ref={panelRef}>
        <div className="cp-mode-control" role="group" aria-label={c.modeLabel}><button type="button" aria-pressed={mode === "live"} onClick={() => changeMode("live")}><span/>{c.liveMode}</button><button type="button" aria-pressed={mode === "replay"} onClick={() => changeMode("replay")}><ClockIcon size={13}/>{c.replayMode}</button></div>
        {loading ? <section className="cp-result-card cp-loading-card" role="status"><ScanIcon className="cp-spinning" size={28}/><h1>{analysisHeading}</h1><p>{mode === "live" ? c.liveAnalyzingBody : c.analyzingBody}</p><Button variant="secondary" className="cp-secondary" onClick={cancelAnalysis}>{c.cancel}</Button></section> : !result ? <form className="cp-result-card cp-setup" onSubmit={submit}><p className="cp-eyebrow"><span/>{c.setupEyebrow}</p><h1>{c.setupTitle}</h1><p>{mode === "live" ? c.liveBody : c.setupBody}</p>{mode === "replay" && <><label htmlFor="capture-time">{c.captureTime}</label><Input id="capture-time" type="datetime-local" value={capturedAt} onValueChange={setCapturedAt} required/><span className="cp-time-zone"><GlobeIcon size={12}/>{timeZone}</span><p className="cp-field-note">{c.timeNote}</p></>}<label htmlFor="match-hint">{c.hint}</label><Input id="match-hint" value={hint} onValueChange={setHint} placeholder={c.hintPlaceholder} maxLength={400}/>{photo.source === "sample" && <p className="cp-sample-note"><ClockIcon size={12}/>{photo.liveSample ? c.currentNote : mode === "live" ? c.historicalLiveNote : c.sampleWarning}</p>}<p className="cp-service-note"><ShieldCheckIcon size={14}/><span>{c.analyzeNote}</span></p><Button variant="primary" className="cp-primary cp-analyze-button" type="submit"><ScanIcon size={18}/>{error ? c.retry : mode === "live" ? c.liveAnalyze : c.analyze}<ArrowRightIcon size={17}/></Button></form> : <section className="cp-result-card"><div className="cp-result-header"><p className="cp-eyebrow"><SparkleIcon size={14}/>{c.results}</p><span className={`cp-context-badge ${result.temporal}`}>{result.outcome === "matched" ? temporalLabel : c.notMatched}</span></div><h1 className="cp-result-title">{result.headline}</h1><p className="cp-result-message">{result.message}</p><p className="cp-result-updated"><ClockIcon size={11}/>{c.updated}: {formatTime(result.generatedAt, locale, timeZone)}</p>{result.coverage && <div className="cp-coverage"><span>{result.coverage.label}</span><p>{result.coverage.detail}</p></div>}{result.discovery && <div className={`cp-discovery ${result.discovery.status}`} role="status"><div><span/><strong>{({ matched: c.matchFound, ambiguous: c.matchAmbiguous, empty: c.noActiveEvents, unavailable: c.feedUnavailable, unsupported: c.feedUnsupported })[result.discovery.status]}</strong></div>{["matched", "ambiguous"].includes(result.discovery.status) && <b>{result.discovery.activeCount} {c.activeEvents}</b>}<p>{result.discovery.detail}</p><small>{c.currentEvents}: {formatTime(result.discovery.checkedAt, locale, timeZone)}</small></div>}
          {event && <div className="cp-event-card"><div><span>{event.league.toUpperCase()}</span><span>{event.statusDetail || event.clock || temporalLabel}</span></div><h2>{event.name}</h2>{event.phase && <span className="cp-event-phase">{event.phase}</span>}{event.competitors?.length ? <ol className="cp-standings" aria-label={c.resultLabel}>{event.competitors.map((person) => { const country = person.country ? countryInfo(person.country, locale) : null; return <li key={person.id}><span className="cp-standing-rank" aria-label={`${c.place}: ${person.rank ?? "—"}`}>{person.rank ?? "—"}</span><span className="cp-standing-person"><strong>{person.name}</strong>{country && <small><span aria-hidden="true">{country.flag}</span>{country.code}</small>}</span><strong className="cp-standing-score">{person.score ?? "—"}</strong></li>; })}</ol> : event.teams.map((team) => <div className="cp-team" key={team.id}><span>{team.logo && safeSource(team.logo) && <img src={team.logo} alt=""/>}{team.name}</span><strong>{team.score ?? "—"}</strong></div>)}<p>{formatTime(event.date, locale, timeZone)}</p><small>{result.matchMethod === "user" ? c.selected : result.matchMethod === "current" ? c.currentLinked : c.autoMatch}</small></div>}
          {result.candidates.length > 0 && result.outcome !== "matched" && <div className="cp-candidates"><h2>{c.candidates}</h2><p>{c.candidateNote}</p>{result.candidates.map((candidate) => <button key={`${candidate.league}-${candidate.id}`} onClick={() => void analyze({ league: candidate.league, eventId: candidate.id })}><span><strong>{candidate.name}</strong><small>{candidate.league.toUpperCase()} · {formatTime(candidate.date, locale, timeZone)}</small></span><ArrowRightIcon size={16}/><span className="cp-sr-only">{c.choose}</span></button>)}</div>}
          {result.points.length > 0 && <><div className="cp-point-list" role="tablist" aria-label={c.details}>{result.points.map((point, index) => <button key={point.id} id={`tab-${point.id}`} role="tab" aria-selected={activePoint?.id === point.id} aria-controls={`detail-${point.id}`} onClick={() => pickPoint(point.id)}><b>{index + 1}</b><span>{point.title}</span><ArrowUpRightIcon size={12}/></button>)}</div>{activePoint && <div className="cp-point-detail" id={`detail-${activePoint.id}`} role="tabpanel" aria-labelledby={`tab-${activePoint.id}`}><span className={`cp-evidence ${activePoint.evidence}`}><span/>{activePoint.evidence === "photo" ? c.observed : activePoint.evidence === "rule" ? c.rule : c.provider}</span><h2>{activePoint.title}</h2>{activePoint.athlete && <AthleteCard athlete={activePoint.athlete} locale={locale}/>}<p className="cp-point-summary">{activePoint.summary}</p>{activePoint.detail.trim() && activePoint.detail.trim() !== activePoint.summary.trim() && <p>{activePoint.detail}</p>}{activePoint.sourceIds.length > 0 ? <div className="cp-point-sources">{activePoint.sourceIds.map((id) => result.sources.find((source) => source.id === id)).filter((source) => source && safeSource(source.url)).map((source) => <a key={source!.id} href={safeSource(source!.url)} target="_blank" rel="noreferrer">{source!.label}<ArrowUpRightIcon size={11}/></a>)}</div> : <p className="cp-source-note">{c.noSources}</p>}</div>}</>}
          {!result.points.length && <p className="cp-no-points">{c.noPoints}</p>}
          {result.moment && <div className="cp-moment"><ClockIcon size={15}/><div><strong>{result.moment.label}</strong><p>{result.moment.detail}</p>{!result.moment.exact && <small>{c.notExact}</small>}</div></div>}
          {!!result.statistics?.length && <details className="cp-source-notes cp-statistics"><summary>{c.statistics}<span>+</span></summary><dl>{result.statistics.map((stat, index) => <div key={`${stat.subject ?? ""}-${stat.label}-${index}`}><dt>{stat.subject && <small>{stat.subject}</small>}{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></details>}
          <details className="cp-source-notes"><summary>{c.clues}<span>+</span></summary><div><p>{[result.features.sport, ...result.features.teams, ...result.features.athletes].filter(Boolean).join(" · ")}</p>{result.features.visibleText.length > 0 && <p>{result.features.visibleText.join(" / ")}</p>}{resultLimitations.length > 0 && <><h3>{c.limitations}</h3><ul>{resultLimitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></>}</div></details>
          <details className="cp-source-notes"><summary>{c.source}<span>+</span></summary><div><p>{c.captured}: {formatTime(result.capturedAt, locale, timeZone)}<br/>{c.updated}: {formatTime(result.generatedAt, locale, timeZone)}</p>{result.sources.filter((source) => safeSource(source.url)).map((source) => <a key={source.id} href={safeSource(source.url)} target="_blank" rel="noreferrer">{source.label}<ArrowUpRightIcon size={11}/><small>{formatTime(source.fetchedAt, locale, timeZone)}</small></a>)}</div></details>
          <Button variant="secondary" className="cp-secondary cp-edit-button" onClick={edit}><ClockIcon size={15}/>{c.modeEdit}</Button>
        </section>}
      </aside>}
    </main>
    <input className="cp-file-input" ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event, "upload")} aria-label={c.upload}/>
    <input className="cp-file-input" ref={captureInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => upload(event, "camera")} aria-label={c.takePhoto}/>
  </div>;
}
