import { Container } from "@/components/shared/container";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <Container className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <img src="/mark-red.png" alt="VinSmart Future" className="block h-10 w-auto sm:h-12" />
            <div className="border-l pl-3 leading-tight sm:pl-4" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="font-display text-lg font-extrabold tracking-[-0.02em] sm:text-[22px]" style={{ color: "var(--text-primary)" }}>
                Speech Playground
              </div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: "var(--vsf-red-500)" }}>
                VinSmart Future
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="vsf-badge vsf-badge--neutral" style={{ gap: 7 }}>
              TTS · ASR · EVAL
            </span>
          </div>
        </div>
      </Container>
    </header>
  );
}
