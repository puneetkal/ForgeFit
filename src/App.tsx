// App.tsx — Routes + theme bootstrap
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Coach from "./pages/Coach";
import Client from "./pages/Client";

// Apply saved theme to <html> before first render
function initTheme() {
  const saved = localStorage.getItem("ff_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}
initTheme();

export default function App() {
  // Re-apply on mount in case of SSR or HMR edge cases
  useEffect(() => {
    const saved = localStorage.getItem("ff_theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/client" element={<Client />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
