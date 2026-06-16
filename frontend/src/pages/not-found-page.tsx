import { Link } from "react-router-dom";
import { ErrorState } from "@/components/shared/error-state";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";

export function NotFoundPage() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-10">
      <ErrorState
        title="Page not found"
        description="The requested route does not exist. Return to one of the demo tabs below."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              to="/tts"
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90",
              )}
            >
              Go to TTS
            </Link>
            <Link
              to="/asr"
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted",
              )}
            >
              Go to ASR
            </Link>
          </div>
        }
      />
    </Container>
  );
}
