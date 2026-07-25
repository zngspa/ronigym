import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, SkipForward, SkipBack, X, Dumbbell, PartyPopper } from "lucide-react";

export type PlayerItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  durationSeconds: number;
  restAfterSeconds: number;
};

type Step = { type: "exercise" | "rest"; itemIndex: number };

function buildSteps(items: PlayerItem[]): Step[] {
  const steps: Step[] = [];
  items.forEach((item, i) => {
    steps.push({ type: "exercise", itemIndex: i });
    if (i < items.length - 1 && item.restAfterSeconds > 0) {
      steps.push({ type: "rest", itemIndex: i });
    }
  });
  return steps;
}

function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // ignore — audio not critical
  }
}

function fmtTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WorkoutPlayer({
  planName,
  items,
  onClose,
}: {
  planName: string;
  items: PlayerItem[];
  onClose: () => void;
}) {
  const steps = useRef(buildSteps(items)).current;
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const endTimeRef = useRef<number>(0);
  const totalMsRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);

  const step = steps[stepIndex];
  const item = step ? items[step.itemIndex] : null;
  const stepTotalSeconds = step
    ? step.type === "exercise"
      ? item!.durationSeconds
      : item!.restAfterSeconds
    : 0;

  const doneCount =
    steps.slice(0, stepIndex).filter((s) => s.type === "exercise").length +
    (step?.type === "rest" ? 1 : 0);
  const totalExercises = items.length;

  const goToStep = (idx: number, autoStart = true) => {
    if (idx >= steps.length) {
      setFinished(true);
      setRunning(false);
      setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      return;
    }
    const s = steps[idx];
    const it = items[s.itemIndex];
    const totalSec = s.type === "exercise" ? it.durationSeconds : it.restAfterSeconds;
    setStepIndex(idx);
    setRemainingMs(totalSec * 1000);
    totalMsRef.current = totalSec * 1000;
    endTimeRef.current = Date.now() + totalSec * 1000;
    setRunning(autoStart);
  };

  const start = () => {
    setStarted(true);
    startedAtRef.current = Date.now();
    goToStep(0, true);
  };

  const togglePause = () => {
    if (running) {
      setRunning(false);
    } else {
      endTimeRef.current = Date.now() + remainingMs;
      setRunning(true);
    }
  };

  const skip = () => goToStep(stepIndex + 1, true);
  const back = () => {
    // If mid-rest, restart current exercise. Otherwise go to previous exercise.
    if (step?.type === "rest") {
      const idx = steps.findIndex((s) => s.type === "exercise" && s.itemIndex === step.itemIndex);
      goToStep(idx, true);
      return;
    }
    if (step && step.itemIndex > 0) {
      const prevIdx = steps.findIndex(
        (s) => s.type === "exercise" && s.itemIndex === step.itemIndex - 1,
      );
      goToStep(prevIdx, true);
    } else if (step) {
      goToStep(stepIndex, true); // restart first exercise
    }
  };

  const finishNow = () => {
    setFinished(true);
    setRunning(false);
    setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
  };

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const rem = Math.max(0, endTimeRef.current - Date.now());
      setRemainingMs(rem);
      if (rem <= 0) {
        playBeep();
        goToStep(stepIndex + 1, true);
      }
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stepIndex]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const fraction = totalMsRef.current > 0 ? remainingMs / totalMsRef.current : 0;
  const isRest = step?.type === "rest";

  const RADIUS = 100;
  const CIRC = 2 * Math.PI * RADIUS;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col text-white transition-colors duration-500 ${
        finished ? "bg-emerald-700" : isRest ? "bg-slate-700" : "bg-slate-900"
      }`}
    >
      <div className="flex items-center justify-between p-4">
        <div className="text-sm opacity-80 truncate">{planName}</div>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {started && !finished && (
        <div className="px-4">
          <Progress value={(doneCount / totalExercises) * 100} className="h-1.5" />
          <div className="text-xs opacity-70 mt-1 text-center">
            {doneCount} מתוך {totalExercises} תרגילים
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 overflow-y-auto">
        {!started ? (
          <div className="text-center space-y-6 max-w-sm">
            <Dumbbell className="h-14 w-14 mx-auto opacity-80" />
            <div>
              <div className="text-2xl font-bold">{planName}</div>
              <div className="text-sm opacity-70 mt-1">{items.length} תרגילים</div>
            </div>
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-white/90 gap-2 px-8"
              onClick={start}
            >
              <Play className="h-5 w-5" /> התחל אימון
            </Button>
          </div>
        ) : finished ? (
          <div className="text-center space-y-4">
            <PartyPopper className="h-14 w-14 mx-auto" />
            <div className="text-3xl font-bold">האימון הסתיים!</div>
            <div className="text-lg opacity-90">זמן כולל: {fmtTime(elapsedSeconds)}</div>
            <Button size="lg" variant="secondary" className="mt-4" onClick={onClose}>
              סגור
            </Button>
          </div>
        ) : (
          <>
            {isRest ? (
              <div className="text-xl font-semibold opacity-90">מנוחה</div>
            ) : (
              <div className="text-xs uppercase tracking-wide opacity-60">
                תרגיל {step!.itemIndex + 1}
              </div>
            )}

            <div className="text-2xl md:text-3xl font-bold text-center">
              {isRest ? `הבא: ${items[step!.itemIndex + 1]?.name ?? ""}` : item!.name}
            </div>

            {!isRest && item?.video_url ? (
              <video
                src={item.video_url}
                className="h-40 w-40 md:h-56 md:w-56 object-cover rounded-2xl shadow-lg"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              !isRest &&
              item?.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-40 w-40 md:h-56 md:w-56 object-cover rounded-2xl shadow-lg"
                />
              )
            )}
            {!isRest && item?.description && (
              <div className="text-sm md:text-base opacity-80 text-center max-w-md">
                {item.description}
              </div>
            )}

            <div className="relative h-56 w-56 grid place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 220 220">
                <circle
                  cx="110"
                  cy="110"
                  r={RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="10"
                />
                <circle
                  cx="110"
                  cy="110"
                  r={RADIUS}
                  fill="none"
                  stroke="white"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - fraction)}
                  style={{ transition: "stroke-dashoffset 100ms linear" }}
                />
              </svg>
              <div className="text-5xl font-bold tabular-nums">{fmtTime(remainingSeconds)}</div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 h-12 w-12"
                onClick={back}
                disabled={stepIndex === 0}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                className="bg-white text-slate-900 hover:bg-white/90 h-16 w-16"
                onClick={togglePause}
              >
                {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 h-12 w-12"
                onClick={skip}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
            <Button variant="link" className="text-white/70" onClick={finishNow}>
              סיים אימון
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
