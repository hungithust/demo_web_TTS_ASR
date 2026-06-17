import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/app-layout";
import { AsrPage } from "@/pages/asr-page";
import { EvaluationPage } from "@/pages/EvaluationPage";
import { NotFoundPage } from "@/pages/not-found-page";
import { TtsPage } from "@/pages/tts-page";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/tts" replace />} />
        <Route path="/tts" element={<TtsPage />} />
        <Route path="/asr" element={<AsrPage />} />
        <Route path="/evaluation" element={<EvaluationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
