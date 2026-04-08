import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAppStore } from '@/store/useAppStore';
import { useChildren } from '@/hooks/useChildren';
import { useCalls } from '@/hooks/useCalls';
import { useChurch } from '@/hooks/useChurch';
import { Search, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { acionarPulseira } from '@/lib/esp32';
import OvelhinhaLogo from '@/components/OvelhinhaLogo';
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
  const tiaRoom = useAppStore((s) => s.tiaRoom);
  const navigate = useNavigate();
  const { children, updateChild } = useChildren();
  const { calls, addCall } = useCalls();
  const { rooms } = useChurch();

  const room = rooms.find((r) => r.id === tiaRoom);
  const roomChildren = children.filter((c) => c.roomId === tiaRoom && c.status !== 'left');

  const [query, setQuery] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedChildId, setScannedChildId] = useState<string | null>(null);

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
        if (childExists) {
          setQuery(childExists.name);
          setScannedChildId(childExists.id);
          toast.success(`Criança encontrada: ${childExists.name}`);
        } else {
          toast.error("QR Code não reconhecido nesta sala");
        }
      }, () => {});
      return () => { scanner.clear().catch(() => {}); };
    }
  }, [scanning, roomChildren]);

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
      acionarPulseira(child.braceletNumber || '??', reasons[reasonIdx].label).catch(() => {});
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
        <button onClick={() => navigate('/gestor')} className="ml-auto text-primary-foreground/50 hover:text-primary-foreground text-xs px-1 py-1 rounded transition-colors">
          ⚙️
        </button>
        <span className="text-primary-foreground/80 text-sm shrink-0">{room?.emoji} {room?.name}</span>
      </header>

      <div className="p-6 flex justify-center">
        <button onClick={() => setScanning(true)} className="w-28 h-28 rounded-full bg-primary flex flex-col items-center justify-center hover:bg-primary-hover transition-colors shadow-medium">
          <Camera className="w-8 h-8 text-primary-foreground mb-1" />
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

const ChildRow = ({ child, onCall, autoOpen, onClearAutoOpen }: { child: any; onCall: (id: string, reason: number) => void; autoOpen?: boolean; onClearAutoOpen?: () => void }) => {
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
