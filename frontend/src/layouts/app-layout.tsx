import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pb-12 pt-6 sm:pt-8">
        <Container className={cn("space-y-8", "animate-fadeUp")}>
          <Outlet />
        </Container>
      </main>
    </div>
  );
}
