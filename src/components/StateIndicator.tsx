// components/StateIndicator.tsx
import React from "react";

const icons = {
  stressed: "😰",
  relaxed: "😌",
  happy: "😄",
  focused: "🧠",
  neutral: "😐",
  mild_stress: "😟",
  no_data: "⏳"
};

const colors = {
  stressed: "bg-red-100 text-red-800",
  relaxed: "bg-blue-100 text-blue-800",
  happy: "bg-green-100 text-green-800",
  focused: "bg-yellow-100 text-yellow-800",
  neutral: "bg-gray-100 text-gray-800",
  mild_stress: "bg-orange-100 text-orange-800",
  no_data: "bg-gray-200 text-gray-500 animate-pulse"
};

export type State = keyof typeof icons;

export function StateIndicator({ state }: { state: State }) {
  const displayText = state === "no_data" ? "Analyzing..." : state.replace("_", " ");
  
  return (
    <div className={`px-2 rounded-lg flex items-center space-x-2 ${colors[state]}`}>
      <span className="">{icons[state]}</span>
      <span className="font-semibold capitalize text-[0.3em] sm:text-[0.4em] md:text-[0.8em]">
        {displayText}
      </span>
    </div>
  );
}

