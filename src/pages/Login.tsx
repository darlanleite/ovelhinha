import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import OvelhinhaLogo from '@/components/OvelhinhaLogo';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Room } from '@/store/types';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from;
  const isMobile = useIsMobile();
  const { signInReception, signInTia, setTiaRoom, isStaff, role: authRole, tiaRoom } = useAuth();

  const receptionRoutes = ['/dashboard', '/cadastro', '/acionar', '/pulseiras', '/relatorios', '/configuracoes', '/gestor'];
  const comingFromReception = from ? receptionRoutes.some((r) => from.startsWith(r)) : false;

  // Redireciona quando a identidade estiver pronta — cobre a corrida entre
  // o navigate do submit e a propagação do AuthContext, e também quem
  // abre "/" já logado
  useEffect(() => {
    if (isStaff) {
      navigate(comingFromReception && from ? from : '/dashboard', { replace: true });
    } else if (authRole === 'tia' && tiaRoom) {
      navigate('/tia', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, authRole, tiaRoom]);

  const [role, setRole] = useState<'reception' | 'tia' | null>(null);
  const effectiveRole = isMobile ? (role ?? (comingFromReception ? 'reception' : 'tia')) : role;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Etapa 2 do fluxo da tia: código validado, falta escolher a sala
  const [tiaRooms, setTiaRooms] = useState<Room[] | null>(null);
  const [selectedRoom, setSelectedRoom] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (effectiveRole === 'reception') {
        await signInReception(email.trim(), password);
        toast('Bem-vindo(a)! 🐑');
        navigate(from || '/dashboard');
      } else if (effectiveRole === 'tia') {
        const { rooms } = await signInTia(code);
        if (rooms.length === 0) {
          toast.error('Nenhuma sala cadastrada — fale com a recepção');
          return;
        }
        setTiaRooms(rooms);
        setSelectedRoom(rooms[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoomConfirm = async () => {
    if (!selectedRoom || submitting) return;
    setSubmitting(true);
    try {
      await setTiaRoom(selectedRoom);
      toast('Bem-vinda, Tia! 🐑');
      navigate('/tia');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao selecionar sala');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-wool relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #1A1F36 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-3">
            <OvelhinhaLogo size={96} />
          </div>
          <p className="mt-2 text-muted-foreground font-body text-sm font-medium">Cada criança, no lugar certo.</p>
        </div>

        {/* Escolha de perfil (desktop) */}
        {!isMobile && !role && !tiaRooms && (
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
            <button
              onClick={() => setRole('tia')}
              className="w-full bg-card rounded-card shadow-soft p-6 flex items-center gap-4 hover:shadow-medium transition-shadow border border-border"
            >
              <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-secondary-foreground" />
              </div>
              <div className="text-left">
                <p className="font-heading font-extrabold text-lg text-foreground">Salinha</p>
                <p className="text-sm text-muted-foreground">Entrar com o código do dia</p>
              </div>
            </button>
          </div>
        )}

        {/* Etapa 2 da tia: escolher a sala */}
        {tiaRooms && (
          <div className="bg-card rounded-card shadow-soft p-8 border border-border animate-fade-in">
            <h2 className="font-heading font-extrabold text-xl mb-6 text-foreground">🏠 Qual é a sua sala?</h2>
            <div className="space-y-2">
              {tiaRooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoom(r.id)}
                  className={`w-full p-4 rounded-lg border text-left flex items-center gap-3 transition-all ${
                    selectedRoom === r.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <span className="text-2xl">{r.emoji}</span>
                  <div>
                    <p className="font-heading font-bold text-foreground">{r.name}</p>
                    {r.ageRange && <p className="text-xs text-muted-foreground">{r.ageRange}</p>}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={handleRoomConfirm}
              disabled={!selectedRoom || submitting}
              className="w-full mt-6 bg-primary text-primary-foreground font-heading font-extrabold py-3 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {submitting ? 'Entrando...' : 'Começar'}
            </button>
          </div>
        )}

        {/* Formulários de login */}
        {effectiveRole && !tiaRooms && (
          <form onSubmit={handleSubmit} className="bg-card rounded-card shadow-soft p-8 border border-border animate-fade-in">
            {!isMobile && (
              <button type="button" onClick={() => setRole(null)} className="text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">← Voltar</button>
            )}
            <h2 className="font-heading font-extrabold text-xl mb-6 text-foreground">
              {effectiveRole === 'reception' ? '🖥️ Recepção' : '📱 Salinha'}
            </h2>

            {effectiveRole === 'reception' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@igreja.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Código do dia</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground tracking-[0.3em] text-center font-mono text-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Peça o código de 4 dígitos à recepção</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (effectiveRole === 'tia' ? code.length !== 4 : !email || !password)}
              className="w-full mt-6 bg-primary text-primary-foreground font-heading font-extrabold py-3 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
