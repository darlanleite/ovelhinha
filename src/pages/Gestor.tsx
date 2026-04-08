import { useState, useEffect } from 'react';
import { Search, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useChildren } from '@/hooks/useChildren';
import { useCalls } from '@/hooks/useCalls';
import { useBracelets } from '@/hooks/useBracelets';
import { useChurch } from '@/hooks/useChurch';
import { useGateway } from '@/hooks/useGateway';
import { acionarPulseira, encerrarPulseira } from '@/lib/esp32';
import OvelhinhaLogo from '@/components/OvelhinhaLogo';
import type { Call } from '@/store/types';

const reasons = [
  { icon: '🚽', label: 'Banheiro' },
  { icon: '🤒', label: 'Passando mal' },
  { icon: '😢', label: 'Chorando' },
  { icon: '⚠️', label: 'Urgência' },
  { icon: '🍼', label: 'Amamentação' },
  { icon: '📝', label: 'Outro' },
];

// ─── Chamadas tab ─────────────────────────────────────────────────────────────

function CallsTab() {
  const { children } = useChildren();
  const { openCalls, answerCall } = useCalls();
  const { rooms } = useChurch();
  const [answering, setAnswering] = useState<string | null>(null);

  const sorted = [...openCalls].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <span className="text-5xl mb-4">✅</span>
        <p className="font-heading font-bold text-lg text-foreground">Nenhuma chamada aberta</p>
        <p className="text-muted-foreground text-sm mt-1">Tudo tranquilo por aqui</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {sorted.map((call) => (
        <CallCard
          key={call.id}
          call={call}
          childName={children.find((c) => c.id === call.childId)?.name ?? '—'}
          roomLabel={(() => { const r = rooms.find((r) => r.id === call.roomId); return r ? `${r.emoji} ${r.name}` : ''; })()}
          answering={answering === call.id}
          onAnswer={async () => {
            setAnswering(call.id);
            const child = children.find((c) => c.id === call.childId);
            await answerCall(call.id, 'reception', child?.name);
            encerrarPulseira(call.braceletNumber).catch(() => {});
            toast('Pai chegou! ✓ 🐑');
            setAnswering(null);
          }}
        />
      ))}
    </div>
  );
}

function CallCard({ call, childName, roomLabel, answering, onAnswer }: {
  call: Call; childName: string; roomLabel: string; answering: boolean; onAnswer: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(call.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call.createdAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isUrgent = elapsed > 120;

  return (
    <div className={`bg-card rounded-card border p-4 shadow-soft ${isUrgent ? 'border-urgent/40' : 'border-border'}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{call.reasonIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading font-bold text-foreground">{childName}</span>
            <span className="font-mono text-xs bg-secondary/20 px-1.5 py-0.5 rounded text-foreground">#{call.braceletNumber}</span>
          </div>
          <p className="text-sm text-muted-foreground">{roomLabel} · {call.reason}</p>
          <p className={`text-xs font-mono mt-1 font-bold ${isUrgent ? 'text-urgent' : 'text-muted-foreground'}`}>
            {mins}:{secs.toString().padStart(2, '0')}
          </p>
        </div>
        <button
          onClick={onAnswer}
          disabled={answering}
          className="shrink-0 bg-success text-success-foreground text-sm font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {answering ? '...' : '✓ Chegou'}
        </button>
      </div>
    </div>
  );
}

// ─── Acionar tab ──────────────────────────────────────────────────────────────

function AcionarTab() {
  const { children, updateChild } = useChildren();
  const { calls, addCall } = useCalls();
  const { rooms } = useChurch();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  const present = children.filter((c) => c.status !== 'left');
  const filtered = query.trim()
    ? present.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.braceletNumber?.includes(query) ?? false))
    : present;

  const child = children.find((c) => c.id === selectedId);
  const room = child ? rooms.find((r) => r.id === child.roomId) : null;

  const handleCall = async (reasonIdx: number) => {
    if (!child) return;

    if (child.status === 'called') {
      const existing = calls.find((c) => c.childId === child.id && (c.status === 'open' || c.status === 'reactivated'));
      if (existing) {
        toast.warning(`Pulseira #${child.braceletNumber} já está acionada`);
        return;
      }
    }

    setCalling(true);
    try {
      await addCall({
        childId: child.id,
        childName: child.name,
        braceletNumber: child.braceletNumber || '??',
        roomId: child.roomId,
        reason: reasons[reasonIdx].label,
        reasonIcon: reasons[reasonIdx].icon,
      });
      await updateChild(child.id, { status: 'called' });
      acionarPulseira(child.braceletNumber || '??', reasons[reasonIdx].label).catch(() => {});
      toast(`Pulseira #${child.braceletNumber || '??'} acionada! 🐑`);
      setSelectedId(null);
      setQuery('');
    } catch {
      toast.error('Erro ao acionar pulseira');
    } finally {
      setCalling(false);
    }
  };

  if (calling) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse mb-4">
          <span className="text-2xl">📡</span>
        </div>
        <p className="font-heading font-bold text-foreground">Acionando #{child?.braceletNumber}...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
          placeholder="Nome ou número da pulseira..."
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {child ? (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-card rounded-card border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary">{child.name.charAt(0)}</div>
            <div className="flex-1">
              <p className="font-heading font-bold text-foreground">{child.name}</p>
              <p className="text-sm text-muted-foreground">{room?.emoji} {room?.name}</p>
            </div>
            {child.braceletNumber && <span className="font-mono text-sm bg-secondary/20 px-2 py-1 rounded font-bold">#{child.braceletNumber}</span>}
            <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none ml-1">✕</button>
          </div>
          <p className="text-sm font-medium text-muted-foreground px-1">Motivo da chamada:</p>
          <div className="grid grid-cols-3 gap-2">
            {reasons.map((r, i) => (
              <button
                key={r.label}
                onClick={() => handleCall(i)}
                className="p-3 rounded-card border border-border bg-card text-center hover:bg-urgent/5 hover:border-urgent/30 transition-all active:scale-95"
              >
                <span className="text-xl block mb-1">{r.icon}</span>
                <span className="text-xs text-muted-foreground">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 20).map((c) => {
            const r = rooms.find((r) => r.id === c.roomId);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full bg-card rounded-card border border-border p-3 flex items-center gap-3 hover:shadow-soft transition-shadow text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm shrink-0">{c.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-foreground text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{r?.emoji} {r?.name}</p>
                </div>
                {c.status === 'called' && <span className="text-xs font-bold text-urgent bg-urgent/10 px-2 py-0.5 rounded-full shrink-0">Chamado</span>}
                {c.braceletNumber && c.status !== 'called' && <span className="font-mono text-xs text-muted-foreground shrink-0">#{c.braceletNumber}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && query.trim() && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma criança encontrada</p>
          )}
          {!query.trim() && filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma criança presente</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status tab ───────────────────────────────────────────────────────────────

function StatusTab() {
  const { children } = useChildren();
  const { openCalls } = useCalls();
  const { bracelets } = useBracelets();
  const { status, secsAgo, name } = useGateway();

  const present = children.filter((c) => c.status !== 'left').length;
  const called = children.filter((c) => c.status === 'called').length;
  const unreachable = bracelets.filter((b) => b.connectivityStatus === 'unreachable' && b.status === 'in-use');
  const warning = bracelets.filter((b) => b.connectivityStatus === 'warning' && b.status === 'in-use');
  const inUse = bracelets.filter((b) => b.status === 'in-use');

  const gatewayColor = status === 'online' ? 'bg-success' : status === 'offline' ? 'bg-urgent' : 'bg-muted-foreground';
  const gatewayLabel = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Desconhecido';

  return (
    <div className="p-4 space-y-4">
      {/* Gateway */}
      <div className="bg-card rounded-card border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Gateway BLE</p>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full shrink-0 ${gatewayColor} ${status === 'online' ? 'animate-pulse' : ''}`} />
          <span className="font-heading font-bold text-foreground">{name}</span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${status === 'online' ? 'bg-success/10 text-success' : 'bg-urgent/10 text-urgent'}`}>{gatewayLabel}</span>
        </div>
        {secsAgo !== null && <p className="text-xs text-muted-foreground mt-2">Último ping há {secsAgo}s</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Crianças presentes" value={present} color="text-primary" />
        <StatCard label="Chamadas abertas" value={openCalls.length} color={openCalls.length > 0 ? 'text-urgent' : 'text-success'} />
        <StatCard label="Pulseiras em uso" value={inUse.length} color="text-foreground" />
        <StatCard label="Pulseiras chamadas" value={called} color={called > 0 ? 'text-urgent' : 'text-foreground'} />
      </div>

      {/* Pulseiras com problema */}
      {(unreachable.length > 0 || warning.length > 0) && (
        <div className="bg-card rounded-card border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Pulseiras com problema</p>
          <div className="space-y-2">
            {unreachable.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-urgent shrink-0" />
                <span className="font-mono text-sm font-bold text-foreground">#{b.number}</span>
                <span className="text-xs text-urgent">{b.guardianName ?? '—'} · sem sinal</span>
              </div>
            ))}
            {warning.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                <span className="font-mono text-sm font-bold text-foreground">#{b.number}</span>
                <span className="text-xs text-muted-foreground">{b.guardianName ?? '—'} · sinal fraco</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bateria baixa */}
      {bracelets.filter((b) => b.battery < 15 && b.status === 'in-use').length > 0 && (
        <div className="bg-card rounded-card border border-secondary/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Bateria crítica</p>
          <div className="space-y-2">
            {bracelets.filter((b) => b.battery < 15 && b.status === 'in-use').map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <span className="text-sm">🔋</span>
                <span className="font-mono text-sm font-bold text-foreground">#{b.number}</span>
                <span className="text-xs text-muted-foreground">{b.battery}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-card border border-border p-4 text-center">
      <p className={`font-heading font-black text-3xl ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ─── PIN gate (auth independente do Zustand) ──────────────────────────────────

const GESTOR_KEY = 'ovelhinha-gestor'
const GESTOR_PIN = '1234'

function GestorPin({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === GESTOR_PIN) {
      localStorage.setItem(GESTOR_KEY, '1')
      onAuth()
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-xs animate-fade-in">
        <div className="flex justify-center mb-6">
          <OvelhinhaLogo size={64} />
        </div>
        <form onSubmit={handleSubmit} className="bg-card rounded-card border border-border p-6 shadow-soft space-y-4">
          <h2 className="font-heading font-extrabold text-lg text-foreground text-center">Gestor</h2>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false) }}
            placeholder="Senha"
            autoFocus
            className={`w-full px-4 py-3 rounded-lg border text-center text-xl tracking-widest font-mono bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${error ? 'border-urgent' : 'border-border focus:border-primary'}`}
          />
          {error && <p className="text-xs text-urgent text-center">Senha incorreta</p>}
          <button type="submit" className="w-full bg-primary text-primary-foreground font-heading font-extrabold py-3 rounded-lg hover:opacity-90 transition-opacity">
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'calls' | 'acionar' | 'status';

const Gestor = () => {
  const [authed, setAuthed] = useState(() => localStorage.getItem(GESTOR_KEY) === '1')
  const { openCalls } = useCalls();
  const [tab, setTab] = useState<Tab>('calls');

  if (!authed) return <GestorPin onAuth={() => setAuthed(true)} />

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'calls', label: 'Chamadas', icon: '🔔' },
    { id: 'acionar', label: 'Acionar', icon: '📡' },
    { id: 'status', label: 'Status', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">
      <header className="bg-primary px-4 pb-3 flex items-center gap-2 shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <OvelhinhaLogo size={26} white />
        <span className="font-heading font-extrabold text-primary-foreground">Gestor</span>
        {openCalls.length > 0 && (
          <span className="bg-urgent text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse-urgent">
            {openCalls.length}
          </span>
        )}
        <button
          onClick={() => { localStorage.removeItem(GESTOR_KEY); setAuthed(false) }}
          className="ml-auto text-primary-foreground/70 hover:text-primary-foreground transition-colors p-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === 'calls' && <CallsTab />}
        {tab === 'acionar' && <AcionarTab />}
        {tab === 'status' && <StatusTab />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card border-t border-border flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors relative ${tab === t.id ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[10px] font-medium">{t.label}</span>
            {t.id === 'calls' && openCalls.length > 0 && (
              <span className="absolute top-2 right-[calc(50%-20px)] w-4 h-4 bg-urgent rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                {openCalls.length}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Gestor;
