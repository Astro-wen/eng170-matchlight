import type { LocalizedText } from "./match-types";
import { getMatch } from "./matches/data";

export type PhotoSource = "sample" | "upload" | "camera";

export interface PhotoSample {
  id: string;
  image: string;
  imageAlt: LocalizedText;
  title: LocalizedText;
  note: LocalizedText;
  matchId: string;
  momentId: string;
  hotspots: Array<{
    id: string;
    kind: "athlete" | "score" | "rule";
    /** Normalized position in the uncropped sample image, in the range 0–1. */
    x: number;
    y: number;
    label: LocalizedText;
  }>;
}

export interface PhotoContextInput {
  source: PhotoSource;
  sampleId?: string;
  matchId?: string;
  momentId?: string;
}

export interface PhotoContextSelection {
  status: "preset-demo" | "manual-context";
  source: PhotoSource;
  sampleId?: string;
  matchId: string | null;
  momentId: string | null;
  label: LocalizedText;
  note: LocalizedText;
}

export type PhotoContext = PhotoContextSelection;

const text = (en: string, zh: string): LocalizedText => ({ en, zh });
const historicalMatchId = "paris-2024-diving-women-3m";
const historicalMomentId = "paris-1-dive-5";

const samples: PhotoSample[] = [
  {
    id: "diving-final",
    image: "/images/scan/diving-final.jpg",
    imageAlt: text("Diving photograph used to demonstrate a photo information overlay", "用于演示照片信息标注的跳水照片"),
    title: text("Try a diving photo", "试试跳水照片"),
    note: text("Preset overlay demo. This photo is not claimed to show the selected final dive. The pins open a separate saved Paris 2024 final record; no athlete, event or score is recognized from this image.", "预设标注演示。此照片不代表所选决赛动作；标注打开另一份已保存的巴黎 2024 决赛成绩，未从图片识别运动员、赛事或比分。"),
    matchId: historicalMatchId,
    momentId: historicalMomentId,
    hotspots: [
      { id: "diving-athlete", kind: "athlete", x: 0.42, y: 0.6, label: text("Athlete context", "运动员资料") },
      { id: "diving-score", kind: "score", x: 0.76, y: 0.35, label: text("Score explained", "看懂得分") },
      { id: "diving-rule", kind: "rule", x: 0.21, y: 0.22, label: text("How scoring works", "了解计分规则") },
    ],
  },
  {
    id: "scoreboard",
    image: "/images/scan/scoreboard-sample.svg",
    imageAlt: text("Prototype scoreboard illustration showing a saved Paris 2024 diving score", "展示巴黎 2024 历史跳水得分的原型记分牌插画"),
    title: text("Try a scoreboard", "试试记分牌"),
    note: text("Illustrated scoreboard with a preset link to CHEN Yiwen's last dive, 76.50 points. This prototype does not read numbers from photos.", "记分牌插画预设关联 CHEN Yiwen 最后一跳的 76.50 分。本原型不会从照片读取数字。"),
    matchId: historicalMatchId,
    momentId: historicalMomentId,
    hotspots: [
      { id: "scoreboard-athlete", kind: "athlete", x: 0.24, y: 0.31, label: text("Athlete context", "运动员资料") },
      { id: "scoreboard-score", kind: "score", x: 0.72, y: 0.46, label: text("Why 76.50?", "76.50 分怎么算？") },
      { id: "scoreboard-rule", kind: "rule", x: 0.38, y: 0.76, label: text("Seven-judge calculation", "七裁判计分方式") },
    ],
  },
];

/** Return editable copies; callers cannot change the saved sample definitions. */
export function getPhotoSamples(): PhotoSample[] {
  return structuredClone(samples);
}

export function getPhotoSample(id: string): PhotoSample | undefined {
  const sample = samples.find((candidate) => candidate.id === id);
  return sample ? structuredClone(sample) : undefined;
}

function validateOptionalId(value: unknown, field: string): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== "string" || value.trim().length === 0)) {
    throw new Error(`Invalid ${field}.`);
  }
}

/**
 * Select saved explanation context, never infer it from pixels.
 * Uploads and camera captures stay unassociated until the user selects a match.
 * The helper takes no photo bytes, performs no upload and stores nothing.
 */
export function selectPhotoContext(input: PhotoContextInput): PhotoContextSelection {
  if (!input || typeof input !== "object" || Array.isArray(input) || !["sample", "upload", "camera"].includes(input.source)) {
    throw new Error("Unknown photo source.");
  }
  validateOptionalId(input.sampleId, "sample id");
  validateOptionalId(input.matchId, "match id");
  validateOptionalId(input.momentId, "moment id");

  if (input.source === "sample") {
    const sample = input.sampleId ? getPhotoSample(input.sampleId) : undefined;
    if (!sample) throw new Error("Unknown photo sample.");
    if ((input.matchId && input.matchId !== sample.matchId) || (input.momentId && input.momentId !== sample.momentId)) {
      throw new Error("Photo sample context does not match its preset.");
    }
    validateMatchMoment(sample.matchId, sample.momentId);
    return {
      status: "preset-demo",
      source: "sample",
      sampleId: sample.id,
      matchId: sample.matchId,
      momentId: sample.momentId,
      label: text("Preset demo", "预设演示"),
      note: sample.note,
    };
  }

  if (input.sampleId !== undefined) throw new Error("Own photos cannot use a sample preset.");
  if (!input.matchId && input.momentId) throw new Error("Select a match before selecting a moment.");
  const context = input.matchId ? validateMatchMoment(input.matchId, input.momentId) : null;
  return {
    status: "manual-context",
    source: input.source,
    matchId: context?.matchId ?? null,
    momentId: context?.momentId ?? null,
    label: text(context ? "Manually selected context" : "Choose match context", context ? "手动选择的比赛资料" : "请选择比赛资料"),
    note: text(
      context
        ? "You selected this saved match context. The prototype has not recognized the athlete, event or score in your photo."
        : "Your photo has no automatic match. Select a saved event and moment to explore the photo overlay prototype.",
      context
        ? "这些资料来自你手动选择的比赛。本原型未识别你照片中的运动员、赛事或比分。"
        : "你的照片尚未关联比赛。请选择已保存的赛事和时刻，体验照片信息标注原型。",
    ),
  };
}

function validateMatchMoment(matchId: string, momentId?: string): { matchId: string; momentId: string } {
  const match = getMatch(matchId);
  if (!match) throw new Error("Unknown match context.");
  const selectedMomentId = momentId ?? match.currentMomentId;
  if (!match.moments.some((moment) => moment.id === selectedMomentId)) throw new Error("Unknown or foreign moment context.");
  return { matchId: match.id, momentId: selectedMomentId };
}
