// components/steps/Step4Dashboard.tsx
"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEffect, useRef, useState } from "react";
import { useInterval } from "@/lib/core";
import { RealtimeLineChart } from "@/components/charts/RealtimeLineChart";

/**
 * Live ダッシュボード（Recharts 版）
 * - Start/Stop（購読の代わりにランダムウォークで擬似ライブ）
 * - Pause/Resume（購読維持のまま描画だけ止める）
 * - しきい値スライダーで ReferenceLine を可視化
 */
export default function Step4Dashboard({
  onNext,
  onPrev,
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const [values, setValues] = useState<number[]>([20, 22, 21, 23, 24, 22, 21]);
  const [live, setLive] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(50);
  const [breach, setBreach] = useState<boolean>(false);

  // 最新 threshold を interval 内で参照するための ref
  const thresholdRef = useRef(threshold);
  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  // 初回マウント時は live ON にする（不要なら削除可）
  useEffect(() => setLive(true), []);

  useInterval(
    () => {
      setValues((prev) => {
        // 直近値を安全に取得
        const safePrev = Array.isArray(prev) && prev.length > 0 ? prev : [50];
        const lastVal = safePrev[safePrev.length - 1] ?? 50;

        // ランダムウォーク（±4）
        const delta = Math.random() * 8 - 4;
        const nextValRaw = lastVal + delta;
        const nextVal = clamp(isFinite(nextValRaw) ? nextValRaw : lastVal, 0, 100);

        // 直近50点だけ保持
        const nextSeries = [...safePrev.slice(-49), nextVal];

        // しきい値判定
        const th = Number(thresholdRef.current) || 0;
        setBreach(nextVal > th);

        return nextSeries;
      });
    },
    live ? 600 : null // 600msごとに更新（live=false で停止）
  );

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-2">STEP 4 • Live Dashboard</h2>
      <p className="text-white/70 mb-4">
        Real-time sensor values with auto threshold detection.
      </p>

      <div className="grid md:grid-cols-3 gap-4 items-center">
        {/* チャート（Recharts） */}
        <div className="md:col-span-2">
          <RealtimeLineChart values={values} threshold={threshold} height={240} />
        </div>

        {/* 右サイドのコントロール */}
        <div className="space-y-3">
          <div className="text-sm text-white/70">
            Threshold
            <input
              type="range"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-white/80">{Math.round(threshold)}</div>
          </div>

          <div className="text-sm">
            Status:
            {breach ? (
              <span className="text-red-400"> Above threshold</span>
            ) : (
              <span className="text-blue-400"> Normal</span>
            )}
          </div>

          <div className="text-sm flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
              />
              Live update
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/15"
        >
          Back
        </button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </Card>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
