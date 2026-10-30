"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { refreshAccessToken, streamUrl } from "./api";

export type StreamState = "connecting" | "open" | "reconnecting" | "closed" | "error";

export interface StreamContext {
  /** Close the stream for good (e.g. after a terminal `done` event). */
  close: () => void;
  /** The SSE `id` of the event, if the server set one. */
  lastEventId: string;
}

export type StreamHandler = (data: unknown, ctx: StreamContext) => void;

export interface UseEventStreamOptions {
  /**
   * Let the browser reconnect when the connection drops (default true). The browser sends
   * `Last-Event-ID`, so streams with ids resume where they stopped. Set false for streams the
   * server ends on purpose, otherwise EventSource would reopen them in a loop.
   */
  reconnect?: boolean;
}

const MAX_AUTH_RETRIES = 2;

/**
 * Subscribes to a Server-Sent Events endpoint under /api/v1. `path` null means "not yet".
 * Handler keys are the SSE event names; data is JSON-parsed when possible.
 *
 * EventSource cannot send an Authorization header, so the access token goes in `?access_token=`.
 * If the stream is rejected (e.g. the 15-minute token expired) the token is refreshed and the
 * stream reopened.
 */
export function useEventStream(
  path: string | null,
  handlers: Record<string, StreamHandler>,
  { reconnect = true }: UseEventStreamOptions = {},
) {
  const [state, setState] = useState<StreamState>("connecting");
  const [generation, setGeneration] = useState(0);
  const handlersRef = useRef(handlers);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!path) return;

    let es: EventSource | null = null;
    let disposed = false;
    let authRetries = 0;

    const close = () => {
      if (disposed) return;
      disposed = true;
      es?.close();
      setState("closed");
    };
    closeRef.current = close;

    const open = () => {
      if (disposed) return;
      const source = new EventSource(streamUrl(path));
      es = source;
      let opened = false;

      source.onopen = () => {
        opened = true;
        authRetries = 0;
        setState("open");
      };

      source.onerror = () => {
        if (disposed || es !== source) return;
        if (reconnect && source.readyState === EventSource.CONNECTING) {
          setState("reconnecting");
          return;
        }
        source.close();
        if (!reconnect && opened) {
          // The server finished the stream on purpose.
          disposed = true;
          setState("closed");
          return;
        }
        // Rejected outright (401, 404, ...). Try a token refresh before giving up.
        if (authRetries < MAX_AUTH_RETRIES) {
          authRetries += 1;
          setState("reconnecting");
          refreshAccessToken().then(() => {
            window.setTimeout(open, 500 * authRetries);
          });
          return;
        }
        disposed = true;
        setState("error");
      };

      for (const name of Object.keys(handlersRef.current)) {
        source.addEventListener(name, (ev) => {
          const msg = ev as MessageEvent<string>;
          let data: unknown = msg.data;
          try {
            data = JSON.parse(msg.data);
          } catch {
            // plain-text payload
          }
          handlersRef.current[name]?.(data, { close, lastEventId: msg.lastEventId });
        });
      }
    };

    open();
    return () => {
      disposed = true;
      es?.close();
    };
  }, [path, reconnect, generation]);

  const close = useCallback(() => closeRef.current(), []);
  const restart = useCallback(() => {
    setState("connecting");
    setGeneration((g) => g + 1);
  }, []);

  return { state, close, restart };
}
