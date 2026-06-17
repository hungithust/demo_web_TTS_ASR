import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "TTS", path: "/tts" },
  { label: "ASR", path: "/asr" },
  { label: "TTS Evaluation", path: "/evaluation" },
];

export function TabNavigation() {
  const location = useLocation();

  return (
    <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
