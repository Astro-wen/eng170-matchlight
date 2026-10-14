"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ExplainResponse,
  Locale,
  MatchDetail,
  MatchSummary,
  Sport,
} from "@/lib/match-types";

export function defaultQuestion(sport: Sport, locale: Locale) {
  const questions = {
    en: {
      diving: "How was this score calculated?",
      swimming: "Explain this moment",
      cricket: "How do I read this score?",
    },
    zh: {
      diving: "这个分数是怎么计算出来的？",
      swimming: "这次成绩如何计算？",
      cricket: "这个分数如何计算？",
    },
  };
  return questions[locale][sport];
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export function useMatchData(locale: Locale) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [momentId, setMomentId] = useState("");
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [matchError, setMatchError] = useState("");
  const [explanation, setExplanation] = useState<{ result: ExplainResponse; context: string } | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");
  const [reload, setReload] = useState(0);
  const explainController = useRef<AbortController | null>(null);
  const explainGeneration = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    // Loading state mirrors the lifecycle of an external API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatchesLoading(true);
    setMatchesError("");
    fetch("/api/matches", { signal: controller.signal })
      .then(readJson<{ matches: MatchSummary[] }>)
      .then(({ matches: items }) => {
        if (controller.signal.aborted) return;
        setMatches(items);
        setSelectedId((current) =>
          items.some((item) => item.id === current) ? current : (items.find((item) => item.mode === "historical")?.id ?? items[0]?.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMatchesError(error instanceof Error ? error.message : "Could not load matches.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMatchesLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    explainController.current?.abort();
    explainGeneration.current += 1;
    // Clear the previous external result before requesting the new match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatch(null);
    setExplanation(null);
    setExplainError("");
    setExplainLoading(false);
    setMatchLoading(true);
    setMatchError("");
    fetch(`/api/matches/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(readJson<{ match: MatchDetail }>)
      .then(({ match: item }) => {
        if (controller.signal.aborted) return;
        setMatch(item);
        setMomentId(item.currentMomentId || item.moments[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMatchError(error instanceof Error ? error.message : "Could not load this match.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMatchLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, reload]);

  const explain = useCallback(
    async (matchId: string, selectedMomentId: string, question: string, language: Locale) => {
      explainController.current?.abort();
      const controller = new AbortController();
      explainController.current = controller;
      const generation = ++explainGeneration.current;
      setExplainLoading(true);
      setExplainError("");
      setExplanation(null);
      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ matchId, momentId: selectedMomentId, question, locale: language }),
        });
        const answer = await readJson<ExplainResponse>(response);
        if (!controller.signal.aborted && generation === explainGeneration.current)
          setExplanation({ result: answer, context: `${matchId}|${selectedMomentId}|${language}` });
      } catch (error: unknown) {
        if (!controller.signal.aborted && generation === explainGeneration.current)
          setExplainError(error instanceof Error ? error.message : "Could not explain this moment.");
      } finally {
        if (!controller.signal.aborted && generation === explainGeneration.current)
          setExplainLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!match || !momentId) return;
    // A new moment or language requires a new server explanation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void explain(match.id, momentId, defaultQuestion(match.sport, locale), locale);
    return () => explainController.current?.abort();
  }, [match, momentId, locale, explain]);

  useEffect(() => () => explainController.current?.abort(), []);

  const selectMoment = (id: string) => {
    if (id === momentId) return;
    explainController.current?.abort();
    explainGeneration.current += 1;
    setExplanation(null);
    setExplainError("");
    setMomentId(id);
  };

  return {
    matches,
    selectedId,
    selectMatch: (id: string) => {
      if (id === selectedId) return;
      explainController.current?.abort();
      explainGeneration.current += 1;
      setMatch(null);
      setExplanation(null);
      setMatchLoading(true);
      setSelectedId(id);
    },
    match,
    moment: match?.moments.find((item) => item.id === momentId) ?? null,
    momentId,
    selectMoment,
    matchesLoading,
    matchLoading,
    matchesError,
    matchError,
    explanation: explanation?.context === `${match?.id}|${momentId}|${locale}` ? explanation.result : null,
    explainLoading,
    explainError,
    ask: (question: string) => {
      if (match && momentId) return explain(match.id, momentId, question, locale);
    },
    refresh: () => setReload((value) => value + 1),
  };
}
