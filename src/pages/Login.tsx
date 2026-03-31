import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import OvelhinhaLogo from '@/components/OvelhinhaLogo';
import { useIsMobile } from '@/hooks/use-mobile';

const Login = () => {
  const isMobile = useIsMobile();
  const [role, setRole] = useState<'reception' | 'tia' | null>(null);

  // Em mobile, vai direto para o login da Salinha
  const effectiveRole = isMobile ? (role ?? 'tia') : role;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const login = useStore((s) => s.login);
  const settings = useStore((s) => s.settings);
  const rooms = useStore((s) => s.rooms);
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]?.id || '');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveRole === 'reception') {
      if (password === '1234') {
        login('reception');
        toast('Bem-vindo(a)! 🐑');
        navigate('/dashboard');
      } else {
        toast.error('Senha incorreta');
      }
    } else if (effectiveRole === 'tia') {
      if (code === settings.dailyCode) {
        login('tia', selectedRoom);
        toast('Bem-vinda, Tia! 🐑');
        navigate('/tia');
      } else {
        toast.error('Código incorreto');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-wool relative overflow-hidden">
      {/* Subtle dot pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #1A1F36 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-3">
            <OvelhinhaLogo size={96} />
          </div>
          <p className="mt-2 text-muted-foreground font-body text-sm font-medium">Cada criança, no lugar certo.</p>
        </div>

        {/* Role selection — apenas desktop, somente Recepção */}
        {!isMobile && !role && (
          <div className="space-y-4">
            <button
              onClick={() => setRole('reception')}
              className="w-full bg-card rounded-card shadow-soft p-6 flex items-center gap-4 hover:shadow-medium transition-shadow border border-border"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Monitor className="w-7 h-7 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-heading font-extrabold text-lg text-foreground">Recepção</p>
                <p className="text-sm text-muted-foreground">Painel completo do sistema</p>
              </div>
            </button>
          </div>
        )}

        {/* Login form */}
        {effectiveRole && (
          <form onSubmit={handleSubmit} className="bg-card rounded-card shadow-soft p-8 border border-border animate-fade-in">
            {!isMobile && (
              <button type="button" onClick={() => setRole(null)} className="text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">← Voltar</button>
            )}
            <h2 className="font-heading font-extrabold text-xl mb-6 text-foreground">
              {effectiveRole === 'reception' ? '🖥️ Recepção' : '📱 Salinha'}
            </h2>

            {effectiveRole === 'reception' ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a senha"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <p className="text-xs text-muted-foreground">Dica: 1234</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Sala</label>
                  <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Código do dia</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground tracking-[0.3em] text-center font-mono text-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Dica: {settings.dailyCode}</p>
                </div>
              </div>
            )}

            <button type="submit" className="w-full mt-6 bg-primary text-primary-foreground font-heading font-extrabold py-3 rounded-lg hover:bg-primary-hover transition-colors">
              Entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
