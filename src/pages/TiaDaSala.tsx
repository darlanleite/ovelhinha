import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '@/contexts/AuthContext';
import { useChildren } from '@/hooks/useChildren';
import { useCalls } from '@/hooks/useCalls';
import { useChurch } from '@/hooks/useChurch';
import { Search, Camera, Users, Bell, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { acionarPulseira } from '@/lib/esp32';
import OvelhinhaLogo from '@/components/OvelhinhaLogo';
import { GatewayAlertBanner } from '@/components/GatewayAlertBanner';
import type { Child } from '@/store/types';
import { useNavigate } from 'react-router-dom';

const reasons = [
  { icon: '🚽', label: 'Banheiro' },
  { icon: '🤒', label: 'Passando mal' },
  { icon: '😢', label: 'Chorando' },
  { icon: '⚠️', label: 'Urgência' },
  { icon: '🍼', label: 'Amamentação' },
  { icon: '📝', label: 'Outro' },
];

const TiaDaSala = () => {
  const { tiaRoom, churchId } = useAuth();
  const navigate = useNavigate();
  const { children, updateChild, checkoutChild: doCheckout } = useChildren();
  const { calls, addCall } = useCalls();
  const { rooms } = useChurch();

  const room = rooms.find((r) => r.id === tiaRoom);
  const roomChildren = children.filter((c) => c.roomId === tiaRoom && c.status !== 'left');
  const calledChildren = roomChildren.filter((c) => c.status === 'called');
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'call' | 'checkout'>('call');
  const [scannedChildId, setScannedChildId] = useState<string | null>(null);
  const [checkoutChild, setCheckoutChild] = useState<string | null>(null); // childId aguardando confirmação
  const [checkoutBracelet, setCheckoutBracelet] = useState('');
  const [checkoutQuery, setCheckoutQuery] = useState('');
  const [checkoutMode, setCheckoutMode] = useState(false);

  const filtered = query.trim()
    ? roomChildren.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : roomChildren;

  useEffect(() => {
    const answered = calls.find(
      (c) => c.status === 'answered' && c.answeredAt && Date.now() - new Date(c.answeredAt).getTime() < 5000
    );
    if (answered) {
      const child = children.find((ch) => ch.id === answered.childId);
      if (child) setArrival(`Pai de ${child.name} chegou · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    }
  }, [calls, children]);

  useEffect(() => {
    if (arrival) {
      const t = setTimeout(() => setArrival(null), 5000);
      return () => clearTimeout(t);
    }
  }, [arrival]);

  useEffect(() => {
    if (scanning) {
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((text) => {
        scanner.clear();
        setScanning(false);
        const childExists = roomChildren.find(c => c.id === text);
        if (!childExists) { toast.error("QR Code não reconhecido nesta sala"); return; }
        if (scanMode === 'checkout') {
          setCheckoutChild(childExists.id);
          setCheckoutBracelet('');
        } else {
          setQuery(childExists.name);
          setScannedChildId(childExists.id);
          toast.success(`Criança encontrada: ${childExists.name}`);
        }
      }, () => {});
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [scanning, roomChildren, scanMode]);

  const handleCheckoutConfirm = async () => {
    const child = children.find((c) => c.id === checkoutChild);
    if (!child) return;
    // Verificação no servidor: confere o par, libera a pulseira e audita.
    // Nunca revelar o número correto — a tia digita o que vê na pulseira física.
    const result = await doCheckout(child.id, checkoutBracelet);
    if (!result.ok) {
      if (result.error === 'BRACELET_MISMATCH') {
        toast.error('Pulseira não confere. Confirme com o responsável.');
      } else {
        toast.error('Erro ao registrar saída');
      }
      return;
    }
    toast.success(`${child.name} liberado(a) ✅`);
    setCheckoutChild(null);
    setCheckoutBracelet('');
    setCheckoutQuery('');
    setCheckoutMode(false);
  };

  const handleEmergency = async () => {
    if (emergencyLoading) return;
    setEmergencyLoading(true);
    try {
      const uncalled = roomChildren.filter((c) => c.status !== 'called');
      for (const child of uncalled) {
        await addCall({
          childId: child.id,
          childName: child.name,
          braceletNumber: child.braceletNumber || '??',
          roomId: child.roomId,
          reason: 'Urgência',
          reasonIcon: '⚠️',
        });
        await updateChild(child.id, { status: 'called' });
        if (churchId) acionarPulseira(churchId, child.braceletNumber || '??', 'Urgência').catch(() => {});
      }
      toast.error(`⚠️ Emergência! ${uncalled.length} pais acionados`);
    } catch {
      toast.error('Erro ao acionar emergência');
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleCall = async (childId: string, reasonIdx: number) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return;
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
      setConfirmation(child.name);
      toast(`Pulseira #${child.braceletNumber || '??'} acionada! 🐑`);
      if (churchId) acionarPulseira(churchId, child.braceletNumber || '??', reasons[reasonIdx].label).catch(() => {});
      setTimeout(() => setConfirmation(null), 3000);
    } catch {
      toast.error('Erro ao acionar pulseira');
    }
  };

  if (confirmation) {
    return (
      <div className="min-h-screen bg-success flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="font-heading font-black text-3xl text-success-foreground">Pai de {confirmation} foi chamado!</h1>
        </div>
      </div>
    );
  }

  if (scanning) {
    return (
      <div className="min-h-screen bg-black flex flex-col pt-[env(safe-area-inset-top)]">
        <header className="px-4 py-4 flex items-center justify-between">
          <span className="text-white font-bold">Escaneando Etiqueta...</span>
          <button onClick={() => setScanning(false)} className="text-white text-sm bg-white/20 px-3 py-1 rounded-lg">Cancelar</button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center bg-black overflow-hidden relative">
          <div id="qr-reader" className="w-full max-w-[400px] h-[400px] bg-white rounded-lg overflow-hidden [&_*]:font-sans [&_button]:bg-primary [&_button]:text-white [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-lg [&_button]:font-bold [&_button]:border-0" />
        </div>
      </div>
    );
  }

  // Tela de confirmação de check-out
  if (checkoutChild) {
    const child = children.find((c) => c.id === checkoutChild);
    return (
      <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col animate-fade-in">
        <header className="bg-primary px-4 pb-3 flex items-center gap-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <OvelhinhaLogo size={28} white />
          <span className="font-heading font-extrabold text-primary-foreground">Confirmar Saída</span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-2xl mx-auto mb-3">
              {child?.name.charAt(0)}
            </div>
            <h2 className="font-heading font-black text-xl text-foreground">{child?.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">Peça a pulseira ao responsável e digite o número dela</p>
          </div>
          <div className="w-full">
            <p className="text-sm font-medium text-foreground mb-2">Número da pulseira do responsável:</p>
            <input
              type="number"
              value={checkoutBracelet}
              onChange={(e) => setCheckoutBracelet(e.target.value)}
              placeholder="Ex: 07"
              className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground text-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
          </div>
          <div className="w-full flex gap-3">
            <button onClick={() => { setCheckoutChild(null); setCheckoutBracelet(''); }} className="flex-1 py-3 rounded-lg border border-border text-muted-foreground font-bold">Cancelar</button>
            <button onClick={handleCheckoutConfirm} disabled={!checkoutBracelet} className="flex-1 py-3 rounded-lg bg-success text-success-foreground font-bold disabled:opacity-40">Confirmar Saída</button>
          </div>
        </div>
      </div>
    );
  }

  // Modo check-out — buscar criança por nome ou número
  if (checkoutMode) {
    const checkoutFiltered = roomChildren.filter((c) =>
      c.name.toLowerCase().includes(checkoutQuery.toLowerCase()) ||
      (c.braceletNumber || '').includes(checkoutQuery)
    );
    return (
      <div className="min-h-screen bg-background max-w-[430px] mx-auto">
        <header className="bg-primary px-4 pb-3 flex items-center gap-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <OvelhinhaLogo size={28} white />
          <span className="font-heading font-extrabold text-primary-foreground flex-1">Registrar Saída</span>
          <button onClick={() => setCheckoutMode(false)} className="text-primary-foreground/80 text-sm">Cancelar</button>
        </header>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={checkoutQuery} onChange={(e) => setCheckoutQuery(e.target.value)}
                placeholder="Nome ou número da pulseira..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoFocus />
            </div>
            <button onClick={() => { setScanMode('checkout'); setScanning(true); }}
              className="px-3 py-3 rounded-lg bg-card border border-border">
              <Camera className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            {checkoutFiltered.map((child) => (
              <button key={child.id} onClick={() => { setCheckoutChild(child.id); setCheckoutBracelet(''); }}
                className="w-full bg-card rounded-xl border border-border p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm">{child.name.charAt(0)}</div>
                <div>
                  <p className="font-heading font-bold text-foreground text-sm">{child.name}</p>
                  {child.braceletNumber && <span className="font-mono text-xs text-muted-foreground">#{child.braceletNumber}</span>}
                </div>
              </button>
            ))}
            {checkoutFiltered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhuma criança encontrada</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto">
      <header className="bg-primary px-4 pb-3 flex items-center gap-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <OvelhinhaLogo size={28} white />
        <span className="font-heading font-extrabold text-primary-foreground">Ovelhinha</span>
        {arrival && (
          <div className="flex-1 text-center text-primary-foreground font-bold text-xs animate-fade-in truncate px-2">
            ✓ {arrival}
          </div>
        )}
        <button onClick={() => setCheckoutMode(true)} className="ml-auto text-primary-foreground text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">
          Saída
        </button>
        <button onClick={() => navigate('/gestor')} className="text-primary-foreground/50 hover:text-primary-foreground text-xs px-1 py-1 rounded transition-colors">
          ⚙️
        </button>
        <span className="text-primary-foreground/80 text-sm shrink-0">{room?.emoji} {room?.name}</span>
      </header>

      <GatewayAlertBanner />

      {/* Painel de presença */}
      <div className="px-4 pt-4 pb-2 grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl border border-border p-3 flex flex-col items-center gap-1">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-heading font-black text-xl text-foreground">{roomChildren.length}</span>
          <span className="text-[10px] text-muted-foreground text-center">Presentes</span>
        </div>
        <div className={`rounded-xl border p-3 flex flex-col items-center gap-1 ${calledChildren.length > 0 ? 'bg-urgent/10 border-urgent/30' : 'bg-card border-border'}`}>
          <Bell className={`w-4 h-4 ${calledChildren.length > 0 ? 'text-urgent' : 'text-muted-foreground'}`} />
          <span className={`font-heading font-black text-xl ${calledChildren.length > 0 ? 'text-urgent' : 'text-foreground'}`}>{calledChildren.length}</span>
          <span className="text-[10px] text-muted-foreground text-center">Chamados</span>
        </div>
        <button
          onClick={handleEmergency}
          disabled={emergencyLoading || roomChildren.length === 0}
          className="bg-urgent/10 border border-urgent/30 rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform disabled:opacity-40"
        >
          <AlertTriangle className="w-4 h-4 text-urgent" />
          <span className="font-heading font-black text-xs text-urgent text-center leading-tight">
            {emergencyLoading ? '...' : 'Emergência'}
          </span>
        </button>
      </div>

      <div className="p-4 flex justify-center">
        <button onClick={() => setScanning(true)} className="w-24 h-24 rounded-full bg-primary flex flex-col items-center justify-center hover:bg-primary-hover transition-colors shadow-medium">
          <Camera className="w-7 h-7 text-primary-foreground mb-1" />
          <span className="text-primary-foreground text-xs font-bold">Escanear</span>
        </button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar criança..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
        </div>
      </div>

      <div className="px-4 space-y-2 pb-6">
        {filtered.map((child) => (
          <ChildRow key={child.id} child={child} onCall={handleCall} autoOpen={scannedChildId === child.id} onClearAutoOpen={() => setScannedChildId(null)} />
        ))}
      </div>
    </div>
  );
};

const ChildRow = ({ child, onCall, autoOpen, onClearAutoOpen }: { child: Child; onCall: (id: string, reason: number) => void; autoOpen?: boolean; onClearAutoOpen?: () => void }) => {
  const [showReasons, setShowReasons] = useState(false);
  
  useEffect(() => {
    if (autoOpen) {
      setShowReasons(true);
      if (onClearAutoOpen) onClearAutoOpen();
    }
  }, [autoOpen, onClearAutoOpen]);

  return (
    <div className="bg-card rounded-card border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm">{child.name.charAt(0)}</div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-foreground text-sm">{child.name}</p>
          {child.braceletNumber && <span className="font-mono text-xs text-muted-foreground">#{child.braceletNumber}</span>}
        </div>
        {child.status === 'called' ? (
          <span className="text-xs font-bold text-urgent bg-urgent/10 px-2 py-1 rounded-full">Chamado</span>
        ) : (
          <button onClick={() => setShowReasons(!showReasons)} className="bg-urgent text-urgent-foreground text-xs font-bold px-3 py-2 rounded-lg">Chamar Pai</button>
        )}
      </div>
      {showReasons && (
        <div className="grid grid-cols-3 gap-2 p-3 pt-0 animate-fade-in">
          {reasons.map((r, i) => (
            <button key={r.label} onClick={() => { onCall(child.id, i); setShowReasons(false); }} className="p-2 rounded-lg border border-border text-center hover:bg-muted/50 transition-colors">
              <span className="text-lg block">{r.icon}</span>
              <span className="text-[10px] text-muted-foreground">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TiaDaSala;
