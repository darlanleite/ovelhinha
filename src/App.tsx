import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cadastro from "./pages/Cadastro";
import Acionar from "./pages/Acionar";
import Pulseiras from "./pages/Pulseiras";
import TiaDaSala from "./pages/TiaDaSala";
import Gestor from "./pages/Gestor";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import { UpdateBanner } from "./components/UpdateBanner";
import { PushBanner } from "./components/PushBanner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, require }: { children: React.ReactNode; require: 'staff' | 'tia' }) => {
  const { loading, isStaff, role, tiaRoom } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-4xl animate-pulse">🐑</span>
      </div>
    );
  }
  if (require === 'staff' && !isStaff) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }
  if (require === 'tia' && !(role === 'tia' && tiaRoom)) {
    // staff também pode abrir a visão da tia? Não — cada perfil na sua tela
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};

const ReceptionPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute require="staff">
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner position="bottom-center" toastOptions={{ className: 'font-body' }} />
        <UpdateBanner />
        <PushBanner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ReceptionPage><Dashboard /></ReceptionPage>} />
            <Route path="/cadastro" element={<ReceptionPage><Cadastro /></ReceptionPage>} />
            <Route path="/acionar" element={<ReceptionPage><Acionar /></ReceptionPage>} />
            <Route path="/pulseiras" element={<ReceptionPage><Pulseiras /></ReceptionPage>} />
            <Route path="/relatorios" element={<ReceptionPage><Relatorios /></ReceptionPage>} />
            <Route path="/configuracoes" element={<ReceptionPage><Configuracoes /></ReceptionPage>} />
            <Route path="/tia" element={<ProtectedRoute require="tia"><TiaDaSala /></ProtectedRoute>} />
            <Route path="/gestor" element={<ProtectedRoute require="staff"><Gestor /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
