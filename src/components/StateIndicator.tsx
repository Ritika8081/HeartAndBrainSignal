// components/StateIndicator.tsx
import React from "react";

const icons = {
    stressed: "😰",
    relaxed: "😌",
    happy: "😄",
    focused: "🧠",
};

const colors = {
    stressed: "bg-red-100 text-red-800",
    relaxed: "bg-blue-100 text-blue-800",
    happy: "bg-green-100 text-green-800",
    focused: "bg-yellow-100 text-yellow-800",
};

export type State = keyof typeof icons;

export function StateIndicator({ state }: { state: State }) {
    return (
        <div className={`px-1 rounded-lg flex items-center space-x-2 ${colors[state]}`}>
            <span className="text-2xl">{icons[state]}</span>
            <span className="font-semibold capitalize">{state}</span>
        </div>
    );
}