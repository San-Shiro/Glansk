import { Routes, Route, Navigate } from "react-router-dom";
import ThemeProvider from "@/lib/theme";
import AuthGate from "@/components/AuthGate";
import Dashboard from "@/dashboard/Dashboard";
import CanvasEditorPage from "@/studio/CanvasEditorPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthGate>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {/* Canonical v2 Editor Route with /v2 suffix */}
          <Route path="/canvas/:id/edit/v2" element={<CanvasEditorPage mode="v2" />} />
          <Route path="/canvas/:id/edit-v2" element={<CanvasEditorPage mode="v2" />} />

          {/* Canonical v1 Classic Editor Route with /v1 suffix */}
          <Route path="/canvas/:id/edit/v1" element={<CanvasEditorPage mode="v1" />} />
          <Route path="/canvas/:id/edit-v1" element={<CanvasEditorPage mode="v1" />} />

          {/* Default /edit route (serves v2 workstation) */}
          <Route path="/canvas/:id/edit" element={<CanvasEditorPage mode="v2" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </ThemeProvider>
  );
}
