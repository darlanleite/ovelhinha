import { useState, useEffect } from 'react';
import { useChildren } from '@/hooks/useChildren';
import { useCalls } from '@/hooks/useCalls';
import { useBracelets } from '@/hooks/useBracelets';
import { useChurch } from '@/hooks/useChurch';
import { braceletOfflineSince, braceletIsRisky } from '@/store/types';
import { toast } from 'sonner';
import { Search, Camera } from 'lucide-react';
import { acionarPulseira, encerrarPulseira } from '@/lib/esp32';

const reasons = [
  { icon: '🚽', label: 'Banheiro' },
  { icon: '🤒', label: 'Passando mal' },
  { icon: '😢', label: 'Chorando' },
  { icon: '⚠️', label: 'Urgência' },
  { icon: '🍼', label: 'Amamentação' },
  { icon: '📝', label: 'Outro' },
];

const Acionar = () => {
  const { children, updateChild } = useChildren();
  const { rooms } = useChurch();
  const { calls, addCall, answerCall, reactivateCall } = useCalls();
  const { bracelets } = useBracelets();

  const [query, setQuery] = useState('');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<number | null>(null);
  const [calling, setCalling] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const filtered = query.trim()
    ? children.filter((c) => c.status !== 'left' && (c.name.toLowerCase().includes(query.toLowerCase()) || (c.braceletNumber && c.braceletNumber.includes(query))))
    : [];

  const child = children.find((c) => c.id === selectedChild);
  const room = child ? rooms.find((r) => r.id === child.roomId) : null;
  const activeCall = activeCallId ? calls.find((c) => c.id === activeCallId) : null;
  const bracelet = child?.braceletNumber ? bracelets.find((b) => b.number === child.braceletNumber) : null;
  const isUnreachable = bracelet?.connectivityStatus === 'unreachable';
  const isWarning = bracelet?.connectivityStatus === 'warning';
  const isBatteryLow = bracelet && bracelet.battery < 15;
  const offlineSecs = bracelet ? braceletOfflineSince(bracelet) : null;

  const handleCall = async () => {
    if (!child || selectedReason === null) return;

    // Pulseira já acionada — mostra tela de espera em vez de criar duplicata
    if (child.status === 'called') {
      const existing = calls.find((c) => c.childId === child.id && (c.status === 'open' || c.status === 'reactivated'));
      if (existing) {
        toast.warning(`Pulseira #${child.braceletNumber} já está acionada`);
        setActiveCallId(existing.id);
        return;
      }
    }

    setCalling(true);
    try {
      const callId = await addCall({
        childId: child.id,
        braceletNumber: child.braceletNumber || '??',
        roomId: child.roomId,
        reason: reasons[selectedReason].label,
        reasonIcon: reasons[selectedReason].icon,
      });
      await updateChild(child.id, { status: 'called' });
      setActiveCallId(callId);
      toast(`Pulseira #${child.braceletNumber || '??'} acionada! 🐑`);
      acionarPulseira(child.braceletNumber || '??', reasons[selectedReason].label).catch(() => {});
    } catch {
      toast.error('Erro ao acionar pulseira');
    } finally {
      setCalling(false);
    }
  };

  const handleAnswered = async () => {
    if (activeCallId && child) {
      await answerCall(activeCallId, 'reception');
      toast('Pai chegou! ✓ 🐑');
      encerrarPulseira(child.braceletNumber || '??').catch(() => {});
      setActiveCallId(null);
      setSelectedChild(null);
      setSelectedReason(null);
    }
  };

  const handleReactivate = async () => {
    if (activeCallId) {
      await reactivateCall(activeCallId);
      toast('Pulseira reacionada! 🐑');
    }
  };

  const handleFallback = (channel: 'whatsapp' | 'microphone' | 'volunteer') => {
    const labels = { whatsapp: 'WhatsApp enviado 🐑', microphone: 'Anúncio registrado 🐑', volunteer: 'Voluntário acionado 🐑' };
    toast(labels[channel]);
  };

  if (calling) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse-urgent mb-6">
          <span className="text-3xl">📡</span>
        </div>
        <p className="font-heading font-extrabold text-xl text-foreground">Acionando pulseira #{child?.braceletNumber}...</p>
        <p className="text-muted-foreground mt-2">Enviando sinal</p>
      </div>
    );
  }

  if (activeCall && (activeCall.status === 'open' || activeCall.status === 'reactivated')) {
    return (
      <WaitingScreen
        call={activeCall}
        childName={child?.name || ''}
        onAnswered={handleAnswered}
        onReactivate={handleReactivate}
        onFallback={handleFallback}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-foreground mb-6">Acionar Pai</h1>

      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedChild(null); }}
            placeholder="Nome ou número da criança..."
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
        </div>
        <button className="w-12 h-12 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors" onClick={() => toast('📷 Scanner de QR Code (simulado)')}>
          <Camera className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {!selectedChild && filtered.length > 0 && (
        <div className="space-y-2 mb-6 animate-fade-in">
          {filtered.map((c) => {
            const r = rooms.find((r) => r.id === c.roomId);
            return (
              <button key={c.id} onClick={() => setSelectedChild(c.id)} className="w-full bg-card rounded-card shadow-soft border border-border p-4 flex items-center gap-4 hover:shadow-medium transition-shadow text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm">{c.name.charAt(0)}</div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-foreground">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{r?.emoji} {r?.name}</p>
                </div>
                {c.braceletNumber && <span className="bg-secondary/20 font-mono font-bold text-sm px-2 py-1 rounded-md text-foreground">#{c.braceletNumber}</span>}
              </button>
            );
          })}
        </div>
      )}

      {child && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-card rounded-card shadow-soft border border-border p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-heading font-black text-primary text-xl">{child.name.charAt(0)}</div>
              <div>
                <h2 className="font-heading font-black text-xl text-foreground">{child.name}</h2>
                <p className="text-muted-foreground text-sm">{room?.emoji} {room?.name} · {child.guardians[0]?.name}</p>
              </div>
              {child.braceletNumber && <span className="ml-auto bg-secondary/20 font-mono font-bold text-lg px-3 py-1.5 rounded-xl text-foreground">#{child.braceletNumber}</span>}
            </div>
          </div>

          {isUnreachable && (
            <div className="bg-urgent/5 border border-urgent/30 rounded-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">📡</span>
                <div>
                  <p className="font-heading font-bold text-urgent text-sm">Pulseira #{child.braceletNumber} sem sinal{offlineSecs !== null ? ` há ${offlineSecs}s` : ''}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pai pode não receber o alerta. Use uma alternativa:</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleFallback('whatsapp')} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors">📱 Enviar WhatsApp</button>
                <button onClick={() => handleFallback('microphone')} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">🎙️ Anunciar no microfone</button>
                <button onClick={() => handleFallback('volunteer')} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary/10 text-foreground border border-secondary/20 hover:bg-secondary/20 transition-colors">🙋 Acionar voluntário</button>
              </div>
            </div>
          )}

          {isWarning && !isUnreachable && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-card px-4 py-3 flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <p className="text-sm font-medium text-foreground">Pulseira com sinal fraco — monitorando</p>
            </div>
          )}

          {isBatteryLow && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-card px-4 py-3 flex items-center gap-2">
              <span className="text-base">🔋</span>
              <p className="text-sm font-medium text-foreground">Bateria crítica ({bracelet?.battery}%) — considere trocar antes de acionar</p>
            </div>
          )}

          <div>
            <h3 className="font-heading font-bold text-foreground mb-3">Motivo da chamada</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {reasons.map((r, i) => (
                <button key={r.label} onClick={() => setSelectedReason(i)}
                  className={`p-4 rounded-card border text-center transition-all ${selectedReason === i ? 'border-primary bg-primary/5 shadow-soft' : 'border-border bg-card hover:bg-muted/30'}`}>
                  <span className="text-2xl block mb-1">{r.icon}</span>
                  <span className="text-sm font-medium text-foreground">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCall} disabled={selectedReason === null}
            className={`w-full font-heading font-extrabold text-lg py-4 rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${isUnreachable ? 'bg-muted text-muted-foreground border border-border hover:opacity-80' : 'bg-urgent text-urgent-foreground hover:opacity-90'}`}>
            {isUnreachable ? 'Tentar mesmo assim' : 'CHAMAR PAI'}
          </button>
        </div>
      )}
    </div>
  );
};

const WaitingScreen = ({ call, childName, onAnswered, onReactivate, onFallback }: {
  call: any; childName: string; onAnswered: () => void; onReactivate: () => void; onFallback: (c: 'whatsapp' | 'microphone' | 'volunteer') => void;
}) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(call.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [call.createdAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const progress = Math.min((elapsed / 300) * 100, 100);

  return (
    <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
      <div className="text-5xl mb-4 animate-pulse-urgent">{call.reasonIcon}</div>
      <h2 className="font-heading font-black text-2xl text-foreground mb-1">Aguardando pai...</h2>
      <p className="text-muted-foreground mb-6">{childName} · {call.reason}</p>
      <div className="font-mono text-5xl font-bold text-foreground mb-4">{mins}:{secs.toString().padStart(2, '0')}</div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-8">
        <div className="h-full bg-urgent rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={onAnswered} className="bg-success text-success-foreground font-heading font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-opacity">✓ Pai Chegou</button>
        <button onClick={onReactivate} className="bg-secondary text-secondary-foreground font-heading font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-opacity">🔁 Reacionar</button>
      </div>
    </div>
  );
};

export default Acionar;
