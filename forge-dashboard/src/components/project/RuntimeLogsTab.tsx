"use client";

import { RotateCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { LogTerminal, StreamIndicator, type TerminalLine } from "@/components/LogTerminal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { Project, RuntimeLogLine } from "@/lib/types";
import { useEventStream } from "@/lib/useEventStream";

const MAX_LINES = 5000;

export function RuntimeLogsTab({ project }: { project: Project }) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const counter = useRef(0);

  const stream = useEventStream(
    api.deployments.runtimeStreamPath(project.id),
    {
      log: (data) => {
        const l = data as RuntimeLogLine;
        const key = ++counter.current;
        setLines((prev) => {
          const next = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev.slice();
          next.push({ key, line: l.line, ts: l.ts, source: "RUNTIME" });
          return next;
        });
      },
    },
    // The server ends the stream when the app stops; don't let EventSource reopen it in a loop.
    { reconnect: false },
  );

  const ended = stream.state === "closed" || stream.state === "error";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-zinc-500">
          Live stdout/stderr of the running container
          {project.liveDeploymentId ? "" : " — nothing is deployed yet"}.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setLines([])} icon={<Trash2 className="size-3.5" aria-hidden />}>
            Clear
          </Button>
          {ended && (
            <Button size="sm" onClick={stream.restart} icon={<RotateCw className="size-3.5" aria-hidden />}>
              Reconnect
            </Button>
          )}
        </div>
      </div>
      <LogTerminal
        className="h-[560px] max-h-[70vh]"
        title={`${project.slug} · runtime`}
        lines={lines}
        status={<StreamIndicator state={stream.state} />}
        empty={ended ? "The stream ended." : "Waiting for the app to write something…"}
      />
    </div>
  );
}
