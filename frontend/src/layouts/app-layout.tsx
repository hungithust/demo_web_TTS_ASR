import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { TabNavigation } from "@/components/layout/tab-navigation";

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1060px] flex-1 px-4 pb-20 pt-6 sm:px-6">
        <TabNavigation />
        <div className="mt-6 animate-fadeUp">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
