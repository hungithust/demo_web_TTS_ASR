import { useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/shared/primary-button";

const FLAG_KEY = "dataset_admin_ok";
const ADMIN_PASSWORD = "admin";

export function AdminGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(FLAG_KEY) === "1",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function submit() {
    if (value === ADMIN_PASSWORD) {
      sessionStorage.setItem(FLAG_KEY, "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Page content, blurred and non-interactive behind the gate */}
      <div className="pointer-events-none select-none blur-sm" aria-hidden>
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-sm">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-lg">
          <div>
            <h2 className="text-lg font-semibold">Khu vực quản trị</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhập mật khẩu để truy cập tab Dataset.
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Mật khẩu"
            className="w-full rounded-2xl border border-border bg-background p-3 text-sm"
          />
          {error ? <p className="text-sm text-destructive">Mật khẩu không đúng.</p> : null}
          <PrimaryButton type="button" size="md" className="w-full" onClick={submit}>
            Mở khoá
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
