// components/steps/Step3Template.tsx
"use client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

const templates = [
  {
    id: "voc",
    title: "Factory VOC Threshold",
    desc: "Monitor VOC threshold in factory (recommended)",
    default: true,
  },
  { id: "water", title: "Water Quality", desc: "pH / turbidity / contamination" },
  { id: "temp", title: "Supply Chain Temp", desc: "Cold-chain temperature" },
  { id: "energy", title: "Energy Consumption", desc: "Power usage metering" },
  { id: "custom", title: "Custom Configuration", desc: "Define your own rules" },
];

export default function Step3Template({
  onNext,
  onPrev,
  onSelect,
}: {
  onNext: () => void;
  onPrev: () => void;
  onSelect: (id: string) => void;
}) {
  const [selected, setSelected] = useState("voc");

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-2">STEP 3 • Select Template</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelected(t.id);
              onSelect(t.id);
            }}
            className={`rounded-xl border p-4 text-left transition
              ${
                selected === t.id
                  ? "border-brand-blue bg-brand-blue/10"
                  : "border-white/10 hover:border-white/20"
              }`}
          >
            <div className="font-medium">{t.title}</div>
            <div className="text-sm text-white/60">{t.desc}</div>
          </button>
        ))}
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


