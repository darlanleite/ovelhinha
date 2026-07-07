import { useEffect, useState } from 'react';
import { useChildren } from '@/hooks/useChildren';
import { useCalls } from '@/hooks/useCalls';
import { useBracelets } from '@/hooks/useBracelets';
import { useChurch } from '@/hooks/useChurch';
import { Users, Watch, AlertTriangle, BatteryLow, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { encerrarPulseira } from '@/lib/esp32';
import { useAuth } from '@/contexts/AuthContext';
import type { Call } from '@/store/types';

const Dashboard = () => {
  const { churchId } = useAuth();
  const { children, checkoutChild, checkoutOverride } = useChildren();
  const { openCalls, answerCall } = useCalls();
  const { bracelets, stats } = useBracelets();
  const { rooms } = useChurch();

  // Check-out verificado: modal pede o número da pulseira que o
  // responsável devolveu; o servidor confere o par e audita.
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [checkoutBracelet, setCheckoutBracelet] = useState('');
  // Fluxo de exceção: saída sem a pulseira (perda/terceiro autorizado)
  const [overrideMode, setOverrideMode] = useState(false);
  const [overridePickedBy, setOverridePickedBy] = useState('');
  const [overrideReason, setOverrideReason] = useState('Responsável perdeu a pulseira');
  const checkoutTarget = children.find((c) => c.id === checkoutId);

  const closeCheckout = () => {
    setCheckoutId(null);
    setCheckoutBracelet('');
    setOverrideMode(false);
    setOverridePickedBy('');
    setOverrideReason('Responsável perdeu a pulseira');
  };

  const confirmCheckout = async () => {
    if (!checkoutId) return;
    const result = await checkoutChild(checkoutId, checkoutBracelet);
    if (!result.ok) {
      if (result.error === 'BRACELET_MISMATCH') {
        toast.error('Pulseira não confere. Verifique com o responsável.');
      } else {
        toast.error('Erro ao registrar saída');
      }
      return;
    }
    toast(`Saída de ${checkoutTarget?.name} registrada 🐑`);
    closeCheckout();
  };

  const confirmOverride = async () => {
    if (!checkoutId || !overridePickedBy.trim()) return;
    const result = await checkoutOverride(checkoutId, overridePickedBy, overrideReason);
    if (!result.ok) {
      toast.error('Erro ao registrar saída');
      return;
    }
    toast(`Saída de ${checkoutTarget?.name} registrada (sem pulseira) 🐑`);
    closeCheckout();
  };

  const presentChildren = children.filter((c) => c.status !== 'left');
  const lowBattery = bracelets.filter((b) => b.battery < 20);

  const statsCards = [
    { label: 'Crianças presentes', value: presentChildren.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Pulseiras ativas', value: stats.inUse, icon: Watch, color: 'text-secondary', bg: 'bg-secondary/20' },
    { label: 'Chamadas abertas', value: openCalls.length, icon: AlertTriangle, color: 'text-urgent', bg: 'bg-urgent/10', pulse: openCalls.length > 0 },
    { label: 'Bateria baixa', value: lowBattery.length, icon: BatteryLow, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-black text-2xl text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s) => (
          <div key={s.label} className="bg-card rounded-card shadow-soft p-5 border border-border">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center ${s.pulse ? 'animate-pulse-urgent' : ''}`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-heading font-black text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {openCalls.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-extrabold text-lg text-foreground">🔔 Chamadas Abertas</h2>
          <div className="space-y-3">
            {openCalls.map((call) => {
              const child = children.find((c) => c.id === call.childId);
              return (
                <OpenCallCard
                  key={call.id}
                  call={call}
                  childName={child?.name || ''}
                  onAnswer={async () => {
                    await answerCall(call.id, 'reception');
                    const bracelet = child?.braceletNumber || call.braceletNumber;
                    if (bracelet && churchId) encerrarPulseira(churchId, bracelet).catch(() => {});
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-heading font-extrabold text-lg text-foreground">Crianças presentes</h2>
        <div className="bg-card rounded-card shadow-soft border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Nome', 'Sala', 'Pulseira', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase text-muted-foreground font-heading font-bold tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {presentChildren.map((child) => {
                const room = rooms.find((r) => r.id === child.roomId);
                return (
                  <tr key={child.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{child.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{room?.emoji} {room?.name}</td>
                    <td className="px-4 py-3 font-mono text-foreground">
                      {child.braceletNumber ? `#${child.braceletNumber}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        child.status === 'present' ? 'bg-success/10 text-success' :
                        child.status === 'called'  ? 'bg-urgent/10 text-urgent' :
                                                     'bg-muted text-muted-foreground'
                      }`}>
                        {child.status === 'present' ? 'Presente' : child.status === 'called' ? 'Chamado' : 'Saiu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setCheckoutId(child.id); setCheckoutBracelet(''); }} className="text-muted-foreground hover:text-urgent transition-colors" title="Dar saída">
                        <LogOut className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de check-out verificado */}
      {checkoutTarget && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={closeCheckout}>
          <div className="bg-card rounded-card shadow-medium border border-border p-6 w-full max-w-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-extrabold text-lg text-foreground">Registrar saída</h3>

            {!overrideMode ? (
              <>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Peça a pulseira ao responsável de <strong>{checkoutTarget.name}</strong> e digite o número dela:
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={checkoutBracelet}
                  onChange={(e) => setCheckoutBracelet(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 07"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && checkoutBracelet) confirmCheckout(); }}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground font-mono text-2xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <div className="flex gap-3 mt-4">
                  <button onClick={closeCheckout} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground font-bold text-sm">Cancelar</button>
                  <button onClick={confirmCheckout} disabled={!checkoutBracelet} className="flex-1 py-2.5 rounded-lg bg-success text-success-foreground font-bold text-sm disabled:opacity-40">Confirmar Saída</button>
                </div>
                <button onClick={() => setOverrideMode(true)} className="w-full mt-3 text-xs text-muted-foreground hover:text-urgent transition-colors underline">
                  Responsável está sem a pulseira?
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Saída <strong>sem pulseira</strong> de <strong>{checkoutTarget.name}</strong> — confira a identidade
                  e registre quem está retirando. Esta saída fica marcada na auditoria
                  {checkoutTarget.braceletNumber && (
                    <> e a pulseira <span className="font-mono font-bold">#{checkoutTarget.braceletNumber}</span> será
                    marcada como <strong>extraviada</strong> até ser devolvida</>
                  )}.
                </p>
                <div className="bg-muted/30 rounded-lg p-3 mb-3 text-sm space-y-1">
                  <p className="text-xs uppercase text-muted-foreground font-bold tracking-wide">Pessoas esperadas</p>
                  {checkoutTarget.guardians.map((g) => (
                    <p key={g.id} className="text-foreground">👤 {g.name} <span className="text-muted-foreground">· {g.phone}</span></p>
                  ))}
                  {checkoutTarget.authorizedPickup && (
                    <p className="text-foreground">✅ Autorizado: {checkoutTarget.authorizedPickup}</p>
                  )}
                </div>
                <input
                  type="text"
                  value={overridePickedBy}
                  onChange={(e) => setOverridePickedBy(e.target.value)}
                  placeholder="Nome de quem está retirando"
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option>Responsável perdeu a pulseira</option>
                  <option>Pessoa autorizada buscando</option>
                  <option>Outro motivo</option>
                </select>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setOverrideMode(false)} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground font-bold text-sm">Voltar</button>
                  <button onClick={confirmOverride} disabled={!overridePickedBy.trim()} className="flex-1 py-2.5 rounded-lg bg-urgent text-urgent-foreground font-bold text-sm disabled:opacity-40">Registrar Saída</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const OpenCallCard = ({ call, childName, onAnswer }: { call: Call; childName: string; onAnswer: () => void }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(call.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [call.createdAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const overdue = elapsed > 300;

  return (
    <div className={`bg-card rounded-card shadow-soft border p-5 flex items-center gap-4 ${overdue ? 'border-urgent/40' : 'border-border'}`}>
      <div className={`text-3xl ${overdue ? 'animate-pulse-urgent' : ''}`}>{call.reasonIcon}</div>
      <div className="flex-1">
        <p className="font-heading font-bold text-foreground">{childName}</p>
        <p className="text-sm text-muted-foreground">{call.reason} · #{call.braceletNumber}</p>
      </div>
      <div className={`font-mono text-lg font-bold ${overdue ? 'text-urgent' : 'text-foreground'}`}>
        {mins}:{secs.toString().padStart(2, '0')}
      </div>
      <button onClick={onAnswer} className="bg-success text-success-foreground font-heading font-bold text-sm px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
        ✓ Chegou
      </button>
    </div>
  );
};

export default Dashboard;
