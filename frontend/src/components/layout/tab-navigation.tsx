import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUiStore, type ActiveTab } from "@/store/ui-store";

const tabs = [
  { label: "Text to Speech", path: "/tts", key: "tts" as const },
  { label: "Automatic Speech Recognition", path: "/asr", key: "asr" as const },
  { label: "TTS Evaluation", path: "/evaluation", key: "evaluation" as const },
  { label: "TTS Dataset", path: "/dataset", key: "dataset" as const },
];

export function TabNavigation() {
  const location = useLocation();
  const setActiveTab = useUiStore((state) => state.setActiveTab);
  const active: ActiveTab =
    location.pathname === "/asr"
      ? "asr"
      : location.pathname === "/evaluation"
        ? "evaluation"
        : location.pathname === "/dataset"
          ? "dataset"
          : "tts";

  useEffect(() => {
    setActiveTab(active);
  }, [active, setActiveTab]);

  return (
    <div className="vsf-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          className={cn("vsf-tab", active === tab.key && "vsf-tab--active")}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
