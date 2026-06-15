import { AudioLines, FileAudio2 } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

const tabs = [
  { label: "Text to Speech", path: "/tts", icon: AudioLines },
  { label: "Automatic Speech Recognition", path: "/asr", icon: FileAudio2 },
];

export function Header() {
  const location = useLocation();
  const setActiveTab = useUiStore((state) => state.setActiveTab);

  useEffect(() => {
    setActiveTab(location.pathname === "/asr" ? "asr" : "tts");
  }, [location.pathname, setActiveTab]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <Container className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <AudioLines className="size-5" />
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-1 shadow-sm">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  onClick={() => setActiveTab(tab.path.slice(1) as "tts" | "asr")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </Container>
    </header>
  );
}
