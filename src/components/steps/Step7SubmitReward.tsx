// components/steps/Step7SubmitReward.tsx
"use client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export default function Step7SubmitReward({
  onPrev,
}: {
  onPrev: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-2">STEP 7 • Submit & Reward</h2>
      <p className="text-white/70 mb-4">
        After on-chain verification, reward in USDC & issue cNFT (demo).
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={() => setSubmitted(true)} disabled={submitted}>
          {submitted ? "Submitted" : "Submit Proof"}
        </Button>
        {submitted && (
          <div className="text-sm">
            <div>✅ Verification success • 5.00 USDC rewarded • cNFT issued</div>
            <div className="text-white/50">Tx: demo#0001 • Fee: 0.001 SOL</div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/15"
        >
          Back
        </button>
        <span className="text-white/60 text-sm">End of flow</span>
      </div>
    </Card>
  );
}


