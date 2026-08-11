"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRecording } from "@/lib/actions/recordings";
import { formatDateTime } from "@/lib/format";
import { RECORDING_BITRATE_KBPS, RECORDING_MAX_MS } from "@/lib/constants";
import { IconMic, IconStop, IconClose } from "@/components/icons";

type Step = "idle" | "recording" | "review" | "saving";

// Warnschwelle deutlich unter dem next.config.ts-Server-Action-Limit (60 MB),
// damit ein Fehlschlag am Server nie unangekündigt kommt.
const SIZE_WARN_BYTES = 50 * 1024 * 1024;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
}

function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function AudioRecorderButton({
  songId,
  songTitle,
}: {
  songId: number;
  songTitle: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <IconMic className="size-4" />
        Aufnehmen
      </button>
      {open && (
        <AudioRecorderOverlay
          songId={songId}
          songTitle={songTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AudioRecorderOverlay({
  songId,
  songTitle,
  onClose,
}: {
  songId: number;
  songTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [label, setLabel] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimers = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    tickRef.current = null;
    autoStopRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Aufräumen, falls das Overlay während der Aufnahme geschlossen/verlassen wird.
  useEffect(() => {
    return () => {
      stopStream();
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: RECORDING_BITRATE_KBPS * 1000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setBlob(finalBlob);
        setAudioUrl(URL.createObjectURL(finalBlob));
        setLabel(`${songTitle} – ${formatDateTime(new Date())}`);
        setStep("review");
        stopStream();
        stopTimers();
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      startRef.current = Date.now();
      setElapsedMs(0);
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current);
      }, 500);
      autoStopRef.current = setTimeout(() => recorder.stop(), RECORDING_MAX_MS);
      setStep("recording");
    } catch {
      setError(
        "Kein Zugriff aufs Mikrofon. Bitte Berechtigung erteilen und erneut versuchen."
      );
    }
  };

  const stop = () => recorderRef.current?.stop();

  const cleanupAndClose = () => {
    if (step === "recording") recorderRef.current?.stop();
    stopStream();
    stopTimers();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    onClose();
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setBlob(null);
    setAudioUrl(null);
    onClose();
  };

  const save = async () => {
    if (!blob) return;
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    setStep("saving");
    setError(null);
    const fd = new FormData();
    fd.set("songId", String(songId));
    fd.set("label", trimmedLabel);
    fd.set("file", blob, blob.type.includes("mp4") ? "aufnahme.mp4" : "aufnahme.webm");
    const result = await saveRecording(fd);
    if ("error" in result) {
      setError(result.error);
      setStep("review");
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    router.refresh();
    onClose();
  };

  const supported = isSupported();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 p-4">
      <button
        type="button"
        onClick={cleanupAndClose}
        className="absolute right-4 top-4 rounded-lg p-2 text-mute hover:text-ink"
        aria-label="Schließen"
      >
        <IconClose className="size-5" />
      </button>

      <div className="card w-full max-w-sm p-8 text-center">
        <h2 className="headline mb-8 text-lg">Aufnahme</h2>

        {!supported && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Dieser Browser unterstützt keine Audio-Aufnahme.
          </p>
        )}

        {supported && step === "idle" && (
          <>
            <button
              type="button"
              onClick={start}
              className="mx-auto flex size-32 items-center justify-center rounded-full bg-red-500/20 transition hover:bg-red-500/25"
              aria-label="Aufnahme starten"
            >
              <span className="flex size-24 items-center justify-center rounded-full bg-red-500 text-panel shadow-[0_0_40px_rgba(239,68,68,0.45)]">
                <IconMic className="size-10" />
              </span>
            </button>
            <p className="mt-6 text-sm text-mute">Zum Starten tippen</p>
            {error && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </>
        )}

        {step === "recording" && (
          <>
            <div className="mx-auto flex size-32 items-center justify-center rounded-full bg-red-500/20">
              <span className="flex size-24 animate-pulse items-center justify-center rounded-full bg-red-500 text-panel shadow-[0_0_40px_rgba(239,68,68,0.45)]">
                <IconMic className="size-10" />
              </span>
            </div>
            <p className="mono-display mt-6 text-3xl font-semibold">
              {formatElapsed(elapsedMs)}
            </p>
            <button
              type="button"
              onClick={stop}
              className="mx-auto mt-8 flex size-16 items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30"
              aria-label="Aufnahme stoppen"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-red-500 text-panel">
                <IconStop className="size-5" />
              </span>
            </button>
          </>
        )}

        {(step === "review" || step === "saving") && (
          <div className="space-y-4 text-left">
            {audioUrl && <audio controls src={audioUrl} className="w-full" />}
            <div>
              <label className="label" htmlFor="recording-label">
                Bezeichnung
              </label>
              <input
                id="recording-label"
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={step === "saving"}
              />
            </div>
            {blob && blob.size > SIZE_WARN_BYTES && (
              <p className="text-xs text-amber-300">
                Große Aufnahme — Speichern kann etwas dauern.
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={discard}
                disabled={step === "saving"}
              >
                Verwerfen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={step === "saving" || !label.trim()}
              >
                {step === "saving" ? "Speichert …" : "Speichern"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
