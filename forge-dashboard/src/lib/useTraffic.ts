"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { TrafficSnapshot } from "./types";

export interface TrafficPoint {
  rps: number | null;
  errorRate: number | null;
  latencyMs: number | null;
}

export interface TrafficState {
  points: TrafficPoint[];
  latest: TrafficPoint | null;
  totals: TrafficSnapshot | null;
  /** "unavailable" when the endpoint doesn't exist on this server. */
  phase: "idle" | "loading" | "ok" | "unavailable" | "error";
}

const WINDOW = 60;

/**
 * Polls cumulative counters and turns consecutive samples into rates. Mean latency per interval
 * is not derivable from a cumulative mean alone, so it is recovered from total latency
 * (mean × requests) before diffing.
 */
export function useTraffic(deploymentId: string | null, intervalMs = 2000): TrafficState {
  const [state, setState] = useState<TrafficState>({ points: [], latest: null, totals: null, phase: "loading" });
  const prev = useRef<TrafficSnapshot | null>(null);

  useEffect(() => {
    prev.current = null;
    if (!deploymentId) return;
    let alive = true;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const snap = await api.deployments.traffic(deploymentId);
        if (!alive) return;
        const p = prev.current;
        prev.current = snap;
        let point: TrafficPoint | null = null;
        if (p) {
          const dt = Math.max((new Date(snap.sampledAt).getTime() - new Date(p.sampledAt).getTime()) / 1000, 0.001);
          const dReq = snap.requests - p.requests;
          const dErr = snap.serverErrors - p.serverErrors;
          if (dReq >= 0) {
            const lat = dReq > 0 ? (snap.meanLatencyMs * snap.requests - p.meanLatencyMs * p.requests) / dReq : null;
            point = {
              rps: dReq / dt,
              errorRate: dReq > 0 ? Math.max(0, dErr) / dReq : 0,
              latencyMs: lat !== null && Number.isFinite(lat) && lat >= 0 ? lat : null,
            };
          }
        }
        setState((s) => ({
          totals: snap,
          phase: "ok",
          latest: point ?? s.latest,
          points: point ? [...s.points, point].slice(-WINDOW) : s.points,
        }));
        timer = window.setTimeout(tick, intervalMs);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setState((s) => ({ ...s, phase: "unavailable" }));
          timer = window.setTimeout(tick, intervalMs * 5);
        } else {
          setState((s) => ({ ...s, phase: "error" }));
          timer = window.setTimeout(tick, intervalMs * 2);
        }
      }
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [deploymentId, intervalMs]);

  return state;
}
