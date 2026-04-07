import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cadastro from "./pages/Cadastro";
import Acionar from "./pages/Acionar";
import Pulseiras from "./pages/Pulseiras";
import TiaDaSala from "./pages/TiaDaSala";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import { UpdateBanner } from "./components/UpdateBanner";
import { useAppStore } from "./store/useAppStore";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: 'reception' | 'tia' }) => {
  const userRole = useAppStore((s) => s.userRole);
  if (!userRole) return <Navigate to="/" replace />;
  if (role && userRole !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const ReceptionPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute role="reception">
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" toastOptions={{ className: 'font-body' }} />
      <UpdateBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<ReceptionPage><Dashboard /></ReceptionPage>} />
          <Route path="/cadastro" element={<ReceptionPage><Cadastro /></ReceptionPage>} />
          <Route path="/acionar" element={<ReceptionPage><Acionar /></ReceptionPage>} />
          <Route path="/pulseiras" element={<ReceptionPage><Pulseiras /></ReceptionPage>} />
          <Route path="/relatorios" element={<ReceptionPage><Relatorios /></ReceptionPage>} />
          <Route path="/configuracoes" element={<ReceptionPage><Configuracoes /></ReceptionPage>} />
          <Route path="/tia" element={<ProtectedRoute role="tia"><TiaDaSala /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
