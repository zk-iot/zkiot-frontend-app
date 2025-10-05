// components/steps/Step6ZKProof.tsx
"use client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export default function Step6ZKProof({
  onNext,
  onPrev,
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [ok, setOk] = useState(false);

  const generate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1200)); // demo delay
    setOk(true);
    setGenerating(false);
  };

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-2">STEP 6 • Generate Proof</h2>
      <p className="text-white/70 mb-4">Generate ZK circuits with one click.</p>

      <div className="flex items-center gap-3">
        <Button disabled={generating || ok} onClick={generate}>
          {generating ? "Generating…" : ok ? "Generated" : "Generate Proof"}
        </Button>
        {ok && <span className="text-brand-blue text-sm">✅ Ready</span>}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/15"
        >
          Back
        </button>
        <Button disabled={!ok} onClick={onNext}>
          Next
        </Button>
      </div>
    </Card>
  );
}


