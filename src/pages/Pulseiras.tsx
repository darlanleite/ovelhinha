import { useState } from 'react';
import { useBracelets } from '@/hooks/useBracelets';
import { useChildren } from '@/hooks/useChildren';
import { braceletOfflineSince } from '@/store/types';
import type { Bracelet } from '@/store/types';
import { toast } from 'sonner';
import { Plus, Battery, Wifi, WifiOff, LogOut } from 'lucide-react';

const statusConfig = {
  'available': { label: 'Disponível', dot: 'bg-success', bg: 'bg-success/10' },
  'in-use':    { label: 'Em uso',      dot: 'bg-secondary', bg: 'bg-secondary/10' },
  'charging':  { label: 'Carregando', dot: 'bg-primary', bg: 'bg-primary/10' },
  'offline':   { label: 'Offline',    dot: 'bg-muted-foreground', bg: 'bg-muted' },
};

const filters = ['Todas', 'Disponíveis', 'Em uso', 'Bateria baixa'] as const;

const ConnectivityBadge = ({ bracelet }: { bracelet: Bracelet }) => {
  if (bracelet.status !== 'in-use') return null;
  const secs = braceletOfflineSince(bracelet);
  const sinceLabel = secs !== null ? `${secs}s atrás` : 'nunca';

  if (bracelet.connectivityStatus === 'unreachable') {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-urgent/10 text-urgent animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-urgent animate-ping" />sem sinal
        </span>
        <span className="text-xs text-muted-foreground">{sinceLabel}</span>
      </div>
    );
  }
  if (bracelet.connectivityStatus === 'warning') {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />atenção
        </span>
        <span className="text-xs text-muted-foreground">{sinceLabel}</span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />online
      </span>
      <span className="text-xs text-muted-foreground">{sinceLabel}</span>
    </div>
  );
};

const Pulseiras = () => {
  const { bracelets, addBracelet, updateBracelet } = useBracelets();
  const { updateChild } = useChildren();
  const [filter, setFilter] = useState<typeof filters[number]>('Todas');

  const handleCheckout = async (b: Bracelet) => {
    if (!b.childId) return;
    try {
      await updateChild(b.childId, { status: 'left', braceletNumber: null });
      await updateBracelet(b.id, { status: 'available', guardianName: null, childId: null });
      toast(`Pulseira #${b.number} liberada e criança sofreu check-out! 🐑`);
    } catch {
      toast.error('Erro ao liberar pulseira');
    }
  };

  const filtered = bracelets.filter((b) => {
    if (filter === 'Disponíveis') return b.status === 'available';
    if (filter === 'Em uso') return b.status === 'in-use';
    if (filter === 'Bateria baixa') return b.battery < 20;
    return true;
  });

  const handleAdd = async () => {
    const nextNum = (bracelets.length + 1).toString().padStart(2, '0');
    try {
      await addBracelet({ number: nextNum, status: 'available', battery: 100, guardianName: null, childId: null, espId: null, lastHeartbeat: null, connectivityStatus: 'online', lastGatewayId: null });
      toast(`Pulseira #${nextNum} registrada! 🐑`);
    } catch {
      toast.error('Erro ao registrar pulseira');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-black text-2xl text-foreground">Pulseiras</h1>
        <button onClick={handleAdd} className="bg-primary text-primary-foreground font-heading font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Registrar pulseira
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-muted'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((b) => {
          const cfg = statusConfig[b.status];
          return (
            <div key={b.id} className="bg-card rounded-card shadow-soft border border-border p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-2xl font-bold text-foreground">#{b.number}</span>
                {b.status === 'offline' ? <WifiOff className="w-4 h-4 text-muted-foreground" /> : <Wifi className="w-4 h-4 text-success" />}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} text-foreground`}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Battery className={`w-4 h-4 ${b.battery < 15 ? 'text-urgent' : b.battery < 20 ? 'text-secondary' : 'text-muted-foreground'}`} />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.battery < 15 ? 'bg-urgent' : b.battery < 50 ? 'bg-secondary' : 'bg-success'}`} style={{ width: `${b.battery}%` }} />
                </div>
                <span className="text-xs text-muted-foreground font-mono">{b.battery}%</span>
              </div>
              {b.battery < 15 && <p className="text-xs text-urgent font-medium mt-1">⚠ Bateria crítica</p>}
              {b.guardianName && <p className="text-xs text-muted-foreground mt-2 truncate">{b.guardianName}</p>}
              <ConnectivityBadge bracelet={b} />
              
              {b.status === 'in-use' && (
                <button onClick={() => handleCheckout(b)} className="mt-4 w-full bg-muted text-muted-foreground hover:bg-urgent/10 hover:text-urgent text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                  Desvincular
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pulseiras;
