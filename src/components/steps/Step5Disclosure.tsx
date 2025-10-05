// components/steps/Step5Disclosure.tsx
"use client";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export default function Step5Disclosure({
  onNext,
  onPrev,
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const [hideRaw, setHideRaw] = useState(true);
  const [zkLocation, setZkLocation] = useState(true);
  const [zkTimestamp, setZkTimestamp] = useState(true);
  const [zkDevice, setZkDevice] = useState(true);

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-2">STEP 5 • Disclosure Policy</h2>
      <p className="text-white/70 mb-4">
        Choose what to keep private and what to prove (ZK protects sensitive data).
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Toggle checked={hideRaw} onChange={setHideRaw} label="Hide raw values; prove threshold compliance only" />
        <Toggle checked={zkLocation} onChange={setZkLocation} label="Prove within approved zone (hide exact location)" />
        <Toggle checked={zkTimestamp} onChange={setZkTimestamp} label="Prove recency only (hide exact timestamp)" />
        <Toggle checked={zkDevice} onChange={setZkDevice} label="Prove device validity (hide device ID)" />
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


