"use client";

/* eslint-disable @next/next/no-img-element -- Local photo previews and camera frames must remain in the browser. */
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, CameraIcon, CheckIcon, CrosshairIcon, EyeIcon, EyeSlashIcon, GlobeIcon, ImageIcon, InfoIcon, LightbulbIcon, PlusIcon, ScanIcon, ShieldCheckIcon, SparkleIcon, TrophyIcon, UploadSimpleIcon, UserIcon, XIcon } from "@phosphor-icons/react";
import type { Locale } from "@/lib/match-types";
import { getPhotoSamples, getPhotoSample, selectPhotoContext, type PhotoContext, type PhotoSample, type PhotoSource } from "@/lib/photo-prototype";
import { scoreIndividualDive } from "@/lib/matches/scoring";
import { containedPhotoBounds, markerPosition, validatePhotoFile } from "@/lib/photo-input";
import { AthletePortrait, CountryLabel } from "@/components/matchlight/sports-presentation";
import { defaultQuestion, useMatchData } from "@/components/matchlight/use-match-data";
import "./camera.css";

type PinKind = "athlete" | "score" | "rule";
type Photo = { src: string; source: PhotoSource; sampleId?: string; name: string };
type Stage = "capture" | "context" | "review";
const samples = getPhotoSamples();
const pinIcons = { athlete: UserIcon, score: TrophyIcon, rule: LightbulbIcon };
const ui = {
  en: {
    capture: "Capture", discover: "Discover", understand: "Understand", prototype: "INTERACTIVE PROTOTYPE",
    eyebrow: "LOS ANGELES 2028 / SEE MORE OF THE GAME", title: <>YOUR VIEW.<br /><span>MORE TO IT.</span></>,
    intro: "One photo. The people, points, and little details that make the game click.",
    takePhoto: "Take a photo", upload: "Upload photo", sample: "Try sample photo", camera: "Open camera", preparing: "Opening camera…", snap: "Capture this moment",
    preview: "SAMPLE PREVIEW", photoMode: "PHOTO MODE", cameraOn: "CAMERA ON", frameHint: "Point at a player, the action, or the scoreboard.",
    sampleEyebrow: "NO PHOTO? START HERE.", sampleNote: "Sample overlays are preset for this prototype.",
    local: "Your photos stay on this device.", cameraError: "Camera unavailable. You can upload a photo or try a sample.", fileError: "Choose a JPG, PNG, or WebP image up to 10 MB.", imageError: "This image could not be opened. Please try another photo.",
    one: "Point & capture", oneBody: "Start with what you can see.", two: "Tap what catches your eye", twoBody: "People. Scores. Rules. Right on your photo.", three: "Get it. Get back to the game.", threeBody: "A short explanation, when you need it.",
    newPhoto: "New photo", photo: "Your photo", demo: "Preset demo", manual: "Manually linked", photoInsight: "YOUR PHOTO, WITH CONTEXT", clickPin: "Tap a marker to explore.",
    photoCaption: "Sample photo · Paris 2024", credit: "Tsutomu Kishimoto / World Aquatics", scoreboardCaption: "Recreated scoreboard · historical data", photoOnly: "Photo stays in this browser",
    people: "Athlete", score: "Score", rule: "Rules", all: "All labels", hide: "Hide labels", show: "Show labels", move: "Move marker", moveHint: "Tap the photo to place the selected marker.", cancelMove: "Cancel positioning",
    source: "Context for this photo", historical: "Historical record · Paris 2024", fictional: "Fictional sample record", more: "Explain this moment", less: "Show less", sources: "Sources & prototype notes", evidence: "Saved event data", ask: "Ask about this moment", askPlaceholder: "What does this score mean?", send: "Ask", question: "Your question", loading: "Loading the saved explanation…", retry: "Try again",
    chooseTitle: "Add context to your photo.", chooseBody: "Choose a match and moment to try the overlay. Automatic photo recognition is not connected in this prototype.", chooseMatch: "Match in your photo", chooseMoment: "Moment to explain", choosePlaceholder: "Choose a saved match…", add: "Add info to photo", recordNote: "The information comes from your selection, not image recognition.",
    finalRank: "FINAL PLACE", total: "FINAL TOTAL", profile: "Official athlete profile", athleteNote: "This card opens the selected athlete's saved event record.", scoreNote: "This is the selected record's score, not a measurement of the action in the photo.", middle: "Keep the middle three awards.", ruleSummary: "Discard the two highest and two lowest judge awards. Add the three remaining marks, then multiply by difficulty.", next: "A little insight", retake: "Return to capture", sampleContext: "Preset historical context. The action photo is not the selected final dive.",
    close: "Close camera", returnPhoto: "Back to photo",
  },
  zh: {
    capture: "拍摄", discover: "发现", understand: "看懂", prototype: "可交互原型",
    eyebrow: "洛杉矶 2028 / 看见更多精彩", title: <>拍下眼前。<br /><span>看懂精彩。</span></>,
    intro: "拍一张照片，认识运动员、读懂比分，发现比赛里的小门道。",
    takePhoto: "拍一张照片", upload: "上传照片", sample: "体验示例照片", camera: "打开相机", preparing: "正在打开相机…", snap: "拍下这个瞬间",
    preview: "示例预览", photoMode: "拍照模式", cameraOn: "相机已开启", frameHint: "对准运动员、比赛画面或记分牌。",
    sampleEyebrow: "还没照片？先体验一下。", sampleNote: "原型中的示例标注为预设内容。",
    local: "你的照片仅保留在当前设备。", cameraError: "暂时无法打开相机，可以上传照片或体验示例。", fileError: "请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。", imageError: "无法打开这张图片，请换一张照片。",
    one: "对准，拍下", oneBody: "从眼前看到的比赛开始。", two: "点一点想了解的内容", twoBody: "运动员、比分、规则，就在照片上。", three: "看懂，继续享受比赛", threeBody: "需要时，给你一个简明解释。",
    newPhoto: "重新拍摄", photo: "你的照片", demo: "预设演示", manual: "手动关联", photoInsight: "让照片，多一点信息", clickPin: "点击照片上的标记，看看更多。",
    photoCaption: "示例照片 · 巴黎 2024", credit: "Tsutomu Kishimoto / World Aquatics", scoreboardCaption: "记分牌示意 · 历史成绩", photoOnly: "照片仅在当前浏览器中显示",
    people: "运动员", score: "得分", rule: "规则", all: "全部标注", hide: "隐藏标注", show: "显示标注", move: "移动标记", moveHint: "点击照片，放置当前标记。", cancelMove: "取消放置",
    source: "这张照片的关联资料", historical: "历史记录 · 巴黎 2024", fictional: "虚构示例记录", more: "解释这个时刻", less: "收起解释", sources: "来源与原型说明", evidence: "已保存的赛事资料", ask: "问问这个时刻", askPlaceholder: "这个分数是什么意思？", send: "提问", question: "你的问题", loading: "正在加载已保存的解释…", retry: "重试",
    chooseTitle: "为照片添加信息。", chooseBody: "选择比赛和时刻，体验照片标注。当前原型尚未接入自动图片识别。", chooseMatch: "照片对应的比赛", chooseMoment: "想了解的时刻", choosePlaceholder: "选择已保存的比赛…", add: "在照片上显示信息", recordNote: "显示内容来自你选择的资料，不是图片识别结果。",
    finalRank: "最终名次", total: "决赛总分", profile: "官方运动员资料", athleteNote: "这张卡片展示所选运动员的历史赛事资料。", scoreNote: "这是所选记录的得分，不是对照片中动作的评分。", middle: "保留中间的三个分数。", ruleSummary: "去掉两个最高分和两个最低分，将保留的三个裁判评分相加，再乘以难度系数。", next: "多懂一点", retake: "返回拍摄", sampleContext: "预设历史资料。动作照片不代表所选的决赛这一跳。",
    close: "关闭相机", returnPhoto: "回到照片",
  },
};

export function CameraPrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [stage, setStage] = useState<Stage>("capture");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [context, setContext] = useState<PhotoContext | null>(null);
  const [active, setActive] = useState<PinKind>("athlete");
  const [labels, setLabels] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [manualMatch, setManualMatch] = useState("");
  const [pendingMoment, setPendingMoment] = useState("");
  const [moving, setMoving] = useState(false);
  const [imageSize, setImageSize] = useState({width:1280,height:853});
  const [frameSize, setFrameSize] = useState({width:0,height:0});
  const frameRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [positions, setPositions] = useState<Record<string, {x:number;y:number}>>({});
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const cameraGeneration = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const data = useMatchData(locale);
  const c = ui[locale];
  const sample = photo?.sampleId ? getPhotoSample(photo.sampleId) : undefined;
  const currentPhoto = photo?.src ?? samples[0].image;
  const own = photo && photo.source !== "sample";
  const progress = stage === "capture" ? 0 : stage === "context" ? 1 : expanded ? 2 : 1;

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
    const update = () => { const rect = frame.getBoundingClientRect(); setFrameSize({width:rect.width,height:rect.height}); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => { cameraGeneration.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => () => { if (photo?.src.startsWith("blob:")) URL.revokeObjectURL(photo.src); }, [photo?.src]);
  useEffect(() => {
    if (pendingMoment && data.match?.id === context?.matchId) {
      data.selectMoment(pendingMoment);
      setPendingMoment("");
    }
  }, [pendingMoment, data.match, context?.matchId]); // data selection is guarded by the matching record.

  function stopCamera() {
    cameraGeneration.current += 1;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOn(false);
    setCameraPending(false);
  }
  function reset() {
    stopCamera(); setStage("capture"); setPhoto(null); setContext(null); setExpanded(false); setQuestion(""); setError(""); setMoving(false); setManualMatch(""); setPendingMoment(""); setPositions({}); window.scrollTo({top:0,behavior:"smooth"});
  }
  async function openCamera() {
    if (cameraPending) return;
    if (!navigator.mediaDevices?.getUserMedia) { captureInput.current?.click(); return; }
    const generation = ++cameraGeneration.current;
    setCameraPending(true); setError("");
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      if (generation !== cameraGeneration.current) { next.getTracks().forEach((track) => track.stop()); return; }
      stream.current = next; setCameraOn(true); setPhoto(null); setStage("capture");
    } catch { if (generation === cameraGeneration.current) setError(c.cameraError); }
    finally { if (generation === cameraGeneration.current) setCameraPending(false); }
  }
  function receivePhoto(src: string, source: "upload" | "camera", name: string) {
    stopCamera(); setPhoto({src, source, name}); setContext(selectPhotoContext({source})); setStage("context"); setManualMatch(""); setExpanded(false); setError(""); setPositions({}); setMoving(false); setPendingMoment(""); setQuestion(""); setLabels(true); window.scrollTo({top:0,behavior:"smooth"});
  }
  function takePhoto() {
    if (!cameraOn) { void openCamera(); return; }
    const frame = video.current;
    if (!frame?.videoWidth || !frame.videoHeight) { setError(c.cameraError); return; }
    const canvas = document.createElement("canvas");
    canvas.width = frame.videoWidth; canvas.height = frame.videoHeight;
    const drawing = canvas.getContext("2d");
    if (!drawing) { setError(c.cameraError); return; }
    drawing.drawImage(frame, 0, 0);
    receivePhoto(canvas.toDataURL("image/jpeg", .9), "camera", c.photo);
  }
  function upload(event: ChangeEvent<HTMLInputElement>, source: "upload" | "camera") {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (validatePhotoFile(file)) { setError(c.fileError); return; }
    receivePhoto(URL.createObjectURL(file), source, file.name);
  }
  function useSample(item: PhotoSample) {
    stopCamera(); setPhoto({src:item.image, source:"sample", sampleId:item.id, name:item.title[locale]});
    setContext(selectPhotoContext({source:"sample", sampleId:item.id}));
    data.selectMatch(item.matchId); setPendingMoment(item.momentId); setActive("athlete"); setStage("review"); setLabels(true); setExpanded(false); setError(""); setQuestion(""); setPositions({}); setMoving(false); window.scrollTo({top:0,behavior:"smooth"});
  }
  function addContext() {
    if (!photo || photo.source === "sample" || data.match?.id !== manualMatch) return;
    setContext(selectPhotoContext({source:photo.source, matchId:manualMatch, momentId:data.momentId}));
    setStage("review"); setLabels(true); setActive("athlete"); setExpanded(false); setQuestion("");
  }
  function pickPin(kind: PinKind) { setActive(kind); setExpanded(false); setQuestion(""); if (window.innerWidth<=800 && panelRef.current && panelRef.current.getBoundingClientRect().top>window.innerHeight*.5) panelRef.current.scrollIntoView({behavior:"smooth",block:"start"}); }
  function placePin(event: MouseEvent<HTMLDivElement>) {
    if (!moving || !own) return;
    const rect = planeRef.current?.getBoundingClientRect();
    const point = rect ? markerPosition(event.clientX, event.clientY, rect) : null;
    if (point) { setPositions((current) => ({...current, [active]:point})); setMoving(false); }
  }
  function ask(event: FormEvent) { event.preventDefault(); if (question.trim()) { setExpanded(true); void data.ask(question.trim()); } }

  const pins = sample?.hotspots ?? [
    {id:"own-athlete",kind:"athlete" as const,x:.35,y:.38,label:{en:"Athlete context",zh:"运动员资料"}},
    {id:"own-score",kind:"score" as const,x:.72,y:.58,label:{en:"Score explained",zh:"看懂得分"}},
    {id:"own-rule",kind:"rule" as const,x:.27,y:.76,label:{en:"How it works",zh:"了解规则"}},
  ];
  const diveScore = data.moment?.scoring ? scoreIndividualDive(data.moment.scoring.judgeScores,data.moment.scoring.difficulty) : null;
  const standing = data.match?.leaderboard.find((person) => person.name === data.moment?.athlete);
  const selectedReady = data.match && data.moment && data.match.id === context?.matchId && data.moment.id === context?.momentId && !pendingMoment && !data.matchLoading;
  const plane = containedPhotoBounds(imageSize.width,imageSize.height,frameSize.width,frameSize.height);
  const photoCaption = own ? c.photoOnly : sample?.id === "scoreboard" ? c.scoreboardCaption : c.photoCaption;

  return <div className="cp-app">
    <a className="skip-link" href="#camera-workspace">{locale === "en" ? "Skip to camera" : "跳至拍摄区"}</a>
    <header className="cp-header"><button className="cp-brand" onClick={reset} aria-label="Matchlight home"><span aria-hidden="true"><i/><i/><i/></span>matchlight<span className="cp-brand-dot">.</span></button><span className="cp-prototype"><span/>{c.prototype}</span><div className="cp-header-right"><span className="cp-la">LA <b>28</b><small>FAN CONCEPT</small></span><button className="cp-locale" onClick={() => {setLocale(locale === "en" ? "zh" : "en");setQuestion("");}} aria-label={locale === "en" ? "切换为中文" : "Switch to English"}><GlobeIcon size={17}/>{locale === "en" ? "中文" : "EN"}</button></div></header>
    <div className="cp-flow" aria-label={locale === "en" ? "Photo flow" : "拍照流程"}>{[c.capture,c.discover,c.understand].map((step,index) => <span className={progress === index ? "active" : progress > index ? "complete" : ""} key={index}><b>{progress > index ? <CheckIcon size={12}/> : `0${index+1}`}</b>{step}{index<2 && <span className="cp-flow-line"/>}</span>)}</div>
    <main id="camera-workspace" className={`cp-workspace ${stage === "capture" ? "is-capture" : "has-photo"}`}>
      {stage === "capture" && <section className="cp-welcome"><p className="cp-eyebrow"><span/>{c.eyebrow}</p><h1>{c.title}</h1><p className="cp-intro">{c.intro}</p><div className="cp-main-actions"><Button variant="primary" className="cp-primary" onClick={takePhoto} loading={cameraPending}><CameraIcon size={19}/>{cameraOn ? c.snap : c.takePhoto}<ArrowUpRightIcon size={17}/></Button><Button variant="secondary" className="cp-secondary" onClick={() => uploadInput.current?.click()}><UploadSimpleIcon size={18}/>{c.upload}</Button></div><p className="cp-local"><ShieldCheckIcon size={14}/>{c.local}</p><div className="cp-how-mini">{[{icon:CrosshairIcon,title:c.one,body:c.oneBody},{icon:PlusIcon,title:c.two,body:c.twoBody},{icon:SparkleIcon,title:c.three,body:c.threeBody}].map((step,index)=><div key={index}><span><step.icon size={18}/></span><div><h2>{step.title}</h2><p>{step.body}</p></div></div>)}</div></section>}
      <section className="cp-photo-workspace" aria-label={locale === "en" ? "Photo viewfinder" : "照片取景区"}>
        {stage !== "capture" && <div className="cp-photo-toolbar"><button onClick={reset}><ArrowLeftIcon size={15}/>{c.newPhoto}</button><span><span className={`cp-status-dot ${own ? "manual" : ""}`}/>{stage === "context" ? (locale === "en" ? "Choose context" : "选择资料") : own ? c.manual : c.demo}</span><button onClick={() => setLabels(!labels)} disabled={stage !== "review"} aria-label={labels ? c.hide : c.show}>{labels ? <EyeIcon size={17}/> : <EyeSlashIcon size={17}/>}</button></div>}
        <div ref={frameRef} className={`cp-viewfinder ${cameraOn ? "camera-on" : ""} ${stage !== "capture" ? "reviewing" : ""} ${moving ? "placing" : ""} ${own ? "own-photo" : ""}`} onClick={placePin}>
          {cameraOn ? <video ref={video} autoPlay playsInline muted aria-label={locale === "en" ? "Camera preview" : "相机预览"}/> : <div ref={planeRef} className="cp-annotation-plane" style={stage === "capture" || !plane ? {inset:0} : {left:plane.left,top:plane.top,width:plane.width,height:plane.height}}><img className="cp-scene" src={currentPhoto} alt={photo?.source === "sample" ? sample?.imageAlt[locale] : photo ? c.photo : (locale === "en" ? "Sample camera preview: Chen Yiwen at Paris 2024" : "示例取景画面：巴黎 2024 的陈艺文")} onLoad={(event)=>setImageSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={() => setError(c.imageError)} />{stage === "review" && labels && pins.map((pin) => {const Icon=pinIcons[pin.kind];const point=positions[pin.kind]??pin;return <button className={`cp-pin ${pin.kind} ${active === pin.kind ? "active" : ""}`} style={{left:`${point.x*100}%`,top:`${point.y*100}%`}} key={pin.id} onClick={(event) => {event.stopPropagation();pickPin(pin.kind);}} aria-pressed={active === pin.kind}><span className="cp-pin-dot"><Icon size={15} weight="bold"/></span><span className="cp-pin-label">{pin.label[locale]}<ArrowUpRightIcon size={12}/></span></button>;})}</div>}
          <div className="cp-frame-shade"/>
          <div className="cp-viewfinder-top"><span><ScanIcon size={15}/>{stage === "capture" ? c.photoMode : c.photoInsight}</span>{cameraOn ? <button onClick={stopCamera} aria-label={c.close}><XIcon size={17}/></button> : <span className="cp-frame-tag">{stage === "capture" ? c.preview : own ? c.photo : c.demo}</span>}</div>
          {stage === "capture" && <><div className="cp-focus-frame"><i/><i/><i/><i/><CrosshairIcon size={23}/></div><div className="cp-frame-prompt"><span className={cameraOn ? "cp-camera-dot" : ""}/>{cameraOn ? c.cameraOn : c.frameHint}</div></>}

          {moving && <div className="cp-placement-note" role="status">{c.moveHint}<button onClick={(event)=>{event.stopPropagation();setMoving(false);}} aria-label={c.cancelMove}><XIcon size={14}/></button></div>}
          {stage === "capture" && <div className="cp-capture-bar"><button className="cp-gallery-button" aria-label={c.upload} onClick={() => uploadInput.current?.click()}><ImageIcon size={24}/></button><button className={`cp-shutter ${cameraPending ? "pending" : ""}`} onClick={takePhoto} disabled={cameraPending} aria-label={cameraOn ? c.snap : c.takePhoto}><span><CameraIcon size={25}/></span></button><button className="cp-sample-scan" onClick={() => useSample(samples[0])}><SparkleIcon size={18}/><span>{c.sample}</span></button></div>}
          <span className="cp-image-credit">{cameraOn || (stage !== "capture" && own) ? c.photoOnly : sample?.id === "scoreboard" ? c.scoreboardCaption : c.credit}</span>
        </div>
        {error && <div className="cp-error" role="alert"><InfoIcon size={17}/><span>{error}</span><button onClick={() => setError("")} aria-label={locale === "en" ? "Dismiss message" : "关闭提示"}><XIcon size={15}/></button></div>}
        {stage === "capture" ? <div className="cp-sample-tray"><div><span className="cp-eyebrow">{c.sampleEyebrow}</span><p>{c.sampleNote}</p></div><div className="cp-sample-choices">{samples.map((item) => <button key={item.id} onClick={() => useSample(item)}><img src={item.image} alt=""/><span>{item.title[locale]}</span><ArrowRightIcon size={16}/></button>)}</div></div> : <><div className="cp-photo-caption"><span>{photoCaption}</span><span><ShieldCheckIcon size={12}/>{own ? c.local : c.sampleNote}</span></div>{stage === "review" && <div className="cp-layer-toolbar"><span>{c.clickPin}</span><div>{(["athlete","score","rule"] as const).map((kind) => {const Icon=pinIcons[kind];return <button className={active===kind ? "active" : ""} onClick={() => {pickPin(kind);setLabels(true);}} key={kind}><Icon size={15}/>{kind === "athlete" ? c.people : c[kind]}</button>;})}{own && <button className={moving ? "active" : ""} onClick={()=>{setMoving(!moving);setLabels(true);}} aria-label={c.move}><CrosshairIcon size={16}/></button>}</div></div>}</>}
      </section>
      {stage !== "capture" && <aside ref={panelRef} className="cp-context-panel" aria-label={c.source}>
        {stage === "context" ? <section className="cp-manual-card"><span className="cp-sheet-handle"/><p className="cp-eyebrow">{locale === "en" ? "YOUR PHOTO / YOUR CONTEXT" : "你的照片 / 你的选择"}</p><h1>{c.chooseTitle}</h1><p>{c.chooseBody}</p>{data.matchesError && <div className="cp-error" role="alert"><span>{data.matchesError}</span><Button variant="secondary" onClick={data.refresh}>{c.retry}</Button></div>}{data.matchesLoading && <p role="status">{c.loading}</p>}<label>{c.chooseMatch}<select aria-label={c.chooseMatch} value={manualMatch} onChange={(event)=>{setManualMatch(event.target.value);if(event.target.value)data.selectMatch(event.target.value);}}><option value="">{c.choosePlaceholder}</option>{data.matches.map((match)=><option value={match.id} key={match.id}>{match.title[locale]} · {match.mode === "historical" ? (locale === "en" ? "Historical" : "历史记录") : (locale === "en" ? "Demo" : "演示")}</option>)}</select></label>{manualMatch && data.match?.id===manualMatch && <label>{c.chooseMoment}<select aria-label={c.chooseMoment} value={data.momentId} onChange={(event)=>data.selectMoment(event.target.value)}>{data.match.moments.map((moment)=><option value={moment.id} key={moment.id}>{moment.label[locale]}</option>)}</select></label>}{data.matchError && <p role="alert">{data.matchError}<button onClick={data.refresh}>{c.retry}</button></p>}<Button variant="primary" className="cp-primary" disabled={!manualMatch || data.match?.id!==manualMatch || data.matchLoading} onClick={addContext}><PlusIcon size={18}/>{c.add}</Button><p className="cp-card-note"><InfoIcon size={13}/>{c.recordNote}</p></section> : <section className="cp-result-card"><span className="cp-sheet-handle"/><div className="cp-result-header"><span className="cp-eyebrow"><SparkleIcon size={14}/>{locale === "en" ? "IN THE PICTURE" : "照片里的看点"}</span><span className="cp-context-badge">{own ? c.manual : c.demo}</span></div><div className="cp-result-tabs" role="tablist" aria-label={locale === "en" ? "Photo information" : "照片信息"}>{(["athlete","score","rule"] as const).map((kind)=><button key={kind} role="tab" aria-selected={active===kind} onClick={()=>pickPin(kind)}>{kind==="athlete" ? c.people : c[kind]}</button>)}</div>
          {!selectedReady ? <div className="cp-result-loading" role="status"><ScanIcon size={25}/><p>{data.matchError || c.loading}</p>{data.matchError && <Button onClick={data.refresh}>{c.retry}</Button>}</div> : <>
            <p className="cp-record-label">{data.match!.mode==="historical" ? c.historical : c.fictional}</p>
            {active === "athlete" ? <div className="cp-athlete-content"><div className="cp-athlete-heading"><AthletePortrait name={data.moment!.athlete}/><div><CountryLabel code={data.moment!.country} locale={locale}/><h2>{data.moment!.athlete}</h2></div></div><p className="cp-athlete-note">{c.athleteNote}</p><div className="cp-athlete-stats"><div><span>{data.match!.status === "finished" ? c.finalRank : (locale === "en" ? "RECORDED PLACE" : "已记录名次")}</span><strong>{standing ? `#${standing.rank}` : "—"}</strong></div><div><span>{data.match!.status === "finished" ? c.total : (locale === "en" ? "SAVED TOTAL" : "已保存总分")}</span><strong>{standing?.score ?? "—"}</strong></div></div></div> : active === "score" ? <div className="cp-score-content"><span>{data.moment!.label[locale]}</span><h2>{data.moment!.scoreboard}</h2><p>{c.scoreNote}</p>{data.moment!.scoring && <div className="cp-formula"><span>{locale === "en" ? "Retained marks × difficulty" : "保留的评分之和 × 难度系数"}</span><strong>{diveScore ? `${diveScore.sum.toFixed(1)} × ${data.moment!.scoring!.difficulty.toFixed(1)} = ${diveScore.formatted}` : data.moment!.scoreboard}</strong></div>}</div> : <div className="cp-rule-content"><span className="cp-rule-symbol"><LightbulbIcon size={30}/></span><h2>{data.match!.sport==="diving" ? c.middle : data.match!.rules[0].title[locale]}</h2><p>{data.match!.sport==="diving" ? c.ruleSummary : data.match!.rules[0].body[locale]}</p>{data.moment!.scoring && <div className="cp-judge-strip">{data.moment!.scoring.judgeScores.map((mark,index)=><span key={index}>{mark.toFixed(1)}</span>)}</div>}</div>}
            <div className="cp-insight"><span><SparkleIcon size={14}/>{c.next}</span><p>{data.match!.sport==="diving" ? (locale==="en" ? "One great dive earns points. The total across every round decides the final place." : "一跳的精彩带来得分，所有轮次的累计总分决定最终名次。") : data.match!.watchNext.title[locale]}</p></div>
            <Button variant="primary" className="cp-primary cp-explain-button" onClick={()=>{setExpanded(!expanded);if(!expanded && !data.explanation)void data.ask(defaultQuestion(data.match!.sport,locale));}}>{expanded ? c.less : c.more}<ArrowRightIcon size={17}/></Button>
            {expanded && <div className="cp-expanded-explanation" aria-live="polite" aria-busy={data.explainLoading}>{data.explainLoading ? <p>{c.loading}</p> : data.explainError ? <div role="alert"><p>{data.explainError}</p><Button onClick={()=>void data.ask(defaultQuestion(data.match!.sport,locale))}>{c.retry}</Button></div> : data.explanation ? <><h3>{data.explanation.headline}</h3><p>{data.explanation.answer}</p><div className="cp-breakdown">{data.explanation.breakdown.map((row,index)=><div key={index}><span>{row.label}</span><strong>{row.value}</strong></div>)}</div></> : null}</div>}
            <form className="cp-ask" onSubmit={ask}><label htmlFor="photo-question">{c.ask}</label><div><Input id="photo-question" aria-label={c.question} placeholder={c.askPlaceholder} value={question} onValueChange={setQuestion} maxLength={400}/><Button variant="secondary" type="submit" aria-label={c.send} disabled={!question.trim() || data.explainLoading}><ArrowRightIcon size={18}/></Button></div></form>
            <details className="cp-source-notes"><summary><InfoIcon size={13}/>{c.sources}<PlusIcon size={13}/></summary><p>{context?.note[locale]}</p>{sample?.id==="diving-final" && <a href="https://www.worldaquatics.com/news/4183036/high-stakes-splashes-in-2024-the-year-in-diving" target="_blank" rel="noopener noreferrer">{c.credit}<ArrowUpRightIcon size={12}/></a>}{data.match!.sources.map((source)=><div key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ArrowUpRightIcon size={12}/></a> : <strong>{source.label}</strong>}<p>{source.note[locale]}</p></div>)}</details>
          </>}
          <p className="cp-preset-note"><InfoIcon size={13}/>{own ? c.recordNote : sample?.id === "scoreboard" ? (locale === "en" ? "Preset overlay linked to a saved historical score." : "预设标注关联已保存的历史成绩。") : c.sampleContext}</p>
        </section>}
      </aside>}
    </main>
    <input className="cp-file-input" ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>upload(event,"upload")} aria-label={c.upload}/>
    <input className="cp-file-input" ref={captureInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event)=>upload(event,"camera")} aria-label={c.takePhoto}/>
  </div>;
}
