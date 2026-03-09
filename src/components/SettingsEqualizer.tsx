import { useEffect, useMemo, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { EQ_BANDS } from "@/lib/audioEngineShared";
import { cn } from "@/lib/utils";

const EQ_GAIN_MIN = -12;
const EQ_GAIN_MAX = 12;
const PREAMP_MIN = -20;
const PREAMP_MAX = 20;
const CURVE_THUMB_SIZE = 18;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatFrequencyLabel(frequency: number) {
  if (frequency < 1000) return String(frequency);
  if (frequency % 1000 === 0) return `${frequency / 1000}K`;
  return `${(frequency / 1000).toFixed(1)}K`;
}

function formatDbValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const normalized = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${rounded > 0 ? "+" : ""}${normalized}`;
}

type SettingsEqualizerProps = {
  enabled: boolean;
  gains: number[];
  preset: string;
  preampDb: number;
  onToggleEnabled: (enabled: boolean) => void;
  onSetBandGain: (bandIndex: number, gainDb: number) => void;
  onApplyPreset: (preset: string) => void;
  onReset: () => void;
  onSetPreampDb: (value: number) => void;
};

export function SettingsEqualizer({
  enabled,
  gains,
  preset,
  preampDb,
  onToggleEnabled,
  onSetBandGain,
  onApplyPreset,
  onReset,
  onSetPreampDb,
}: SettingsEqualizerProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bandsWrapperRef = useRef<HTMLDivElement | null>(null);
  const sliderRefs = useRef<Array<HTMLInputElement | null>>([]);

  const presetOptions = useMemo(() => [
    { value: "flat", label: t("settings.flat") },
    { value: "bassBoost", label: t("settings.bassBooster") },
    { value: "bassReducer", label: t("settings.bassReducer") },
    { value: "vocalBoost", label: t("settings.vocalBooster") },
    { value: "trebleBoost", label: t("settings.trebleBooster") },
    { value: "loudness", label: t("settings.loudness") },
    { value: "rock", label: t("settings.rock") },
    { value: "electronic", label: t("settings.electronic") },
  ], [t]);

  const selectedPreset = presetOptions.some((option) => option.value === preset) ? preset : "custom";

  useEffect(() => {
    const wrapper = bandsWrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const drawCurve = () => {
      const activeWrapper = bandsWrapperRef.current;
      const activeCanvas = canvasRef.current;
      if (!activeWrapper || !activeCanvas) return;

      const sliders = sliderRefs.current.filter((slider): slider is HTMLInputElement => Boolean(slider));
      if (sliders.length === 0) return;

      const wrapperRect = activeWrapper.getBoundingClientRect();
      if (wrapperRect.width === 0 || wrapperRect.height === 0) return;

      const context = activeCanvas.getContext("2d");
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      activeCanvas.width = Math.round(wrapperRect.width * dpr);
      activeCanvas.height = Math.round(wrapperRect.height * dpr);
      activeCanvas.style.width = `${wrapperRect.width}px`;
      activeCanvas.style.height = `${wrapperRect.height}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rootStyle = getComputedStyle(document.documentElement);
      const accentHsl = rootStyle.getPropertyValue("--dynamic-accent").trim() || "0 0% 78%";

      const points = sliders.map((slider, index) => {
        const sliderRect = slider.getBoundingClientRect();
        const centerX = sliderRect.left + (sliderRect.width / 2) - wrapperRect.left;
        const clampedValue = clamp(gains[index] ?? 0, EQ_GAIN_MIN, EQ_GAIN_MAX);
        const normalizedValue = (clampedValue - EQ_GAIN_MIN) / (EQ_GAIN_MAX - EQ_GAIN_MIN);
        const usableTrackHeight = Math.max(sliderRect.height - CURVE_THUMB_SIZE, 0);
        const centerY = sliderRect.top - wrapperRect.top
          + (CURVE_THUMB_SIZE / 2)
          + ((1 - normalizedValue) * usableTrackHeight);

        return { x: centerX, y: centerY };
      });

      if (points.length === 0) return;

      const zeroNormalized = (0 - EQ_GAIN_MIN) / (EQ_GAIN_MAX - EQ_GAIN_MIN);
      const firstSliderRect = sliders[0].getBoundingClientRect();
      const zeroY = firstSliderRect.top - wrapperRect.top
        + (CURVE_THUMB_SIZE / 2)
        + ((1 - zeroNormalized) * Math.max(firstSliderRect.height - CURVE_THUMB_SIZE, 0));

      context.beginPath();
      context.moveTo(points[0].x, zeroY);
      context.lineTo(points[points.length - 1].x, zeroY);
      context.strokeStyle = `hsl(${accentHsl} / ${enabled ? 0.22 : 0.1})`;
      context.lineWidth = 1;
      context.stroke();

      if (points.length === 1) {
        context.beginPath();
        context.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2);
        context.fillStyle = `hsl(${accentHsl} / ${enabled ? 0.92 : 0.5})`;
        context.fill();
        return;
      }

      const getControlPoints = (pointIndex: number) => {
        const previousPoint = points[pointIndex === 0 ? pointIndex : pointIndex - 1];
        const startPoint = points[pointIndex];
        const endPoint = points[pointIndex + 1];
        const nextPoint = points[pointIndex + 2] || endPoint;

        return {
          cp1x: startPoint.x + ((endPoint.x - previousPoint.x) / 6),
          cp1y: startPoint.y + ((endPoint.y - previousPoint.y) / 6),
          cp2x: endPoint.x - ((nextPoint.x - startPoint.x) / 6),
          cp2y: endPoint.y - ((nextPoint.y - startPoint.y) / 6),
        };
      };

      const gradient = context.createLinearGradient(0, 0, 0, wrapperRect.height);
      gradient.addColorStop(0, `hsl(${accentHsl} / ${enabled ? 0.3 : 0.12})`);
      gradient.addColorStop(1, `hsl(${accentHsl} / 0.02)`);

      context.beginPath();
      context.moveTo(points[0].x, wrapperRect.height);
      context.lineTo(points[0].x, points[0].y);

      for (let index = 0; index < points.length - 1; index += 1) {
        const { cp1x, cp1y, cp2x, cp2y } = getControlPoints(index);
        const endPoint = points[index + 1];
        context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endPoint.x, endPoint.y);
      }

      context.lineTo(points[points.length - 1].x, wrapperRect.height);
      context.closePath();
      context.fillStyle = gradient;
      context.fill();

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);

      for (let index = 0; index < points.length - 1; index += 1) {
        const { cp1x, cp1y, cp2x, cp2y } = getControlPoints(index);
        const endPoint = points[index + 1];
        context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endPoint.x, endPoint.y);
      }

      context.strokeStyle = `hsl(${accentHsl} / ${enabled ? 0.94 : 0.5})`;
      context.lineWidth = 2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();

      points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
        context.fillStyle = `hsl(${accentHsl} / ${enabled ? 0.98 : 0.52})`;
        context.fill();

        context.beginPath();
        context.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 255, 255, 0.9)";
        context.fill();
      });
    };

    let frameId = window.requestAnimationFrame(drawCurve);
    const redraw = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(drawCurve);
    };

    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(wrapper);

    window.addEventListener("resize", redraw);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [enabled, gains]);

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <div className="settings-row grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{t("settings.equalizer")}</p>
          <div className="mt-1 text-sm text-muted-foreground">{t("settings.equalizerDescription")}</div>
        </div>
        <div className="shrink-0 pt-1">
          <Switch
            checked={enabled}
            onCheckedChange={onToggleEnabled}
            className="data-[state=checked]:bg-[hsl(var(--dynamic-accent))] data-[state=unchecked]:bg-white/25"
          />
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className={cn("settings-eq-shell", !enabled && "is-disabled")}>
          <div className="settings-eq-toolbar">
            <div className="settings-eq-preset-group">
              <label htmlFor="settings-eq-preset" className="settings-eq-label">
                {t("settings.presets")}
              </label>
              <select
                id="settings-eq-preset"
                className="settings-eq-select website-form-control"
                value={selectedPreset}
                disabled={!enabled}
                onChange={(event) => {
                  const nextPreset = event.target.value;
                  if (nextPreset === "custom") return;

                  const nextOption = presetOptions.find((option) => option.value === nextPreset);
                  onApplyPreset(nextPreset);
                  toast.success(t("settings.presetApplied", { preset: nextOption?.label ?? nextPreset }));
                }}
              >
                {presetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">{t("settings.custom")}</option>
              </select>
            </div>

            <button
              type="button"
              className="settings-eq-button website-form-control menu-sweep-hover"
              onClick={() => {
                onReset();
                toast.success(t("settings.equalizerReset"));
              }}
              disabled={!enabled}
            >
              <RotateCcw className="h-4 w-4" />
              {t("settings.reset")}
            </button>
          </div>

          <div ref={bandsWrapperRef} className="settings-eq-bands-wrapper">
            <canvas ref={canvasRef} className="settings-eq-response-canvas" aria-hidden="true" />
            <div className="settings-eq-bands">
              {EQ_BANDS.map((frequency, index) => {
                const rawGain = gains[index] ?? 0;
                const clampedGain = clamp(rawGain, EQ_GAIN_MIN, EQ_GAIN_MAX);

                return (
                  <div key={frequency} className="settings-eq-band">
                    <span
                      className={cn(
                        "settings-eq-value",
                        clampedGain > 0 && "is-positive",
                        clampedGain < 0 && "is-negative",
                      )}
                    >
                      {formatDbValue(clampedGain)}
                    </span>
                    <input
                      ref={(element) => {
                        sliderRefs.current[index] = element;
                      }}
                      type="range"
                      min={EQ_GAIN_MIN}
                      max={EQ_GAIN_MAX}
                      step="0.5"
                      value={clampedGain}
                      disabled={!enabled}
                      className="settings-eq-slider"
                      aria-label={`${formatFrequencyLabel(frequency)} Hz`}
                      onChange={(event) => onSetBandGain(index, Number(event.target.value))}
                      onDoubleClick={() => onSetBandGain(index, 0)}
                    />
                    <span className="settings-eq-frequency">{formatFrequencyLabel(frequency)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-eq-scale" aria-hidden="true">
            <span>{`+${EQ_GAIN_MAX} dB`}</span>
            <span>0 dB</span>
            <span>{`${EQ_GAIN_MIN} dB`}</span>
          </div>

          <div className="settings-eq-preamp-row">
            <label htmlFor="settings-eq-preamp" className="settings-eq-label">
              {t("settings.preamp")}
            </label>
            <input
              id="settings-eq-preamp"
              type="range"
              min={PREAMP_MIN}
              max={PREAMP_MAX}
              step="0.5"
              value={clamp(preampDb, PREAMP_MIN, PREAMP_MAX)}
              disabled={!enabled}
              className="settings-eq-preamp-slider"
              onChange={(event) => onSetPreampDb(Number(event.target.value))}
            />
            <span
              className={cn(
                "settings-eq-preamp-value",
                preampDb > 0 && "is-positive",
                preampDb < 0 && "is-negative",
              )}
            >
              {formatDbValue(clamp(preampDb, PREAMP_MIN, PREAMP_MAX))} dB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
