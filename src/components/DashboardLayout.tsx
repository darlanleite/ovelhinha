import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, UserPlus, Watch, BarChart3, Settings, LogOut, Bell, Smartphone } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useChurch } from '@/hooks/useChurch';
import { useCalls } from '@/hooks/useCalls';
import OvelhinhaLogo from '@/components/OvelhinhaLogo';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/cadastro', label: 'Novo Cadastro', icon: UserPlus },
  { path: '/acionar', label: 'Acionar Pai', icon: Bell },
  { path: '/pulseiras', label: 'Pulseiras', icon: Watch },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
  { path: '/gestor', label: 'Gestor Mobile', icon: Smartphone },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAppStore((s) => s.logout);
  const { settings } = useChurch();
  const { openCalls } = useCalls();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <OvelhinhaLogo size={32} />
            <span className="font-heading font-black text-xl text-foreground">Ovelhinha</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.path === '/acionar' && openCalls.length > 0 && (
                  <span className="ml-auto bg-urgent text-urgent-foreground text-xs font-bold px-2 py-0.5 rounded-full animate-pulse-urgent">
                    {openCalls.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-primary flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2">
            <OvelhinhaLogo size={28} white={true} />
            <span className="font-heading font-extrabold text-primary-foreground text-lg">Ovelhinha</span>
          </div>
          <div className="ml-auto">
            <span className="text-primary-foreground/80 text-sm font-body">{settings.churchName}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
