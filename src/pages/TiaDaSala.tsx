import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Search, Camera } from 'lucide-react';
import { toast } from 'sonner';

const reasons = [
  { icon: '🚽', label: 'Banheiro' },
  { icon: '🤒', label: 'Passando mal' },
  { icon: '😢', label: 'Chorando' },
  { icon: '⚠️', label: 'Urgência' },
  { icon: '🍼', label: 'Amamentação' },
  { icon: '📝', label: 'Outro' },
];

const TiaDaSala = () => {
  const children = useStore((s) => s.children);
  const rooms = useStore((s) => s.rooms);
  const tiaRoom = useStore((s) => s.tiaRoom);
  const addCall = useStore((s) => s.addCall);
  const updateChild = useStore((s) => s.updateChild);
  const calls = useStore((s) => s.calls);

  const room = rooms.find((r) => r.id === tiaRoom);
  const roomChildren = children.filter((c) => c.roomId === tiaRoom && c.status !== 'left');

  const [query, setQuery] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);

  const filtered = query.trim()
    ? roomChildren.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : roomChildren;

  // Check for answered calls to show arrival banner
  useEffect(() => {
    const answered = calls.find((c) => c.status === 'answered' && c.answeredAt && Date.now() - new Date(c.answeredAt).getTime() < 5000);
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

  const handleCall = (childId: string, reasonIdx: number) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    addCall({
      id: 'call' + Date.now(),
      childId: child.id,
      braceletNumber: child.braceletNumber || '??',
      reason: reasons[reasonIdx].label,
      reasonIcon: reasons[reasonIdx].icon,
      status: 'open',
      createdAt: new Date().toISOString(),
      answeredAt: null,
    });
    updateChild(child.id, { status: 'called' });
    setConfirmation(child.name);
    toast(`Pulseira #${child.braceletNumber || '??'} acionada! 🐑`);
    setTimeout(() => setConfirmation(null), 3000);
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

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto">
      {/* Arrival banner */}
      {arrival && (
        <div className="bg-success text-success-foreground py-3 px-4 text-center font-heading font-bold text-sm animate-slide-down">
          {arrival}
        </div>
      )}

      {/* Header */}
      <header className="bg-primary px-4 py-3 flex items-center gap-2">
        <span className="text-lg">🐑</span>
        <span className="font-heading font-extrabold text-primary-foreground">Ovelhinha</span>
        <span className="ml-auto text-primary-foreground/80 text-sm">{room?.emoji} {room?.name}</span>
      </header>

      {/* Scanner button */}
      <div className="p-6 flex justify-center">
        <button onClick={() => toast('📷 Scanner de etiqueta (simulado)')} className="w-28 h-28 rounded-full bg-primary flex flex-col items-center justify-center hover:bg-primary-hover transition-colors shadow-medium">
          <Camera className="w-8 h-8 text-primary-foreground mb-1" />
          <span className="text-primary-foreground text-xs font-bold">Escanear</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar criança..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Children list */}
      <div className="px-4 space-y-2 pb-6">
        {filtered.map((child) => (
          <ChildRow key={child.id} child={child} onCall={handleCall} />
        ))}
      </div>
    </div>
  );
};

const ChildRow = ({ child, onCall }: { child: any; onCall: (id: string, reason: number) => void }) => {
  const [showReasons, setShowReasons] = useState(false);

  return (
    <div className="bg-card rounded-card border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm">
          {child.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-foreground text-sm">{child.name}</p>
          {child.braceletNumber && <span className="font-mono text-xs text-muted-foreground">#{child.braceletNumber}</span>}
        </div>
        {child.status === 'called' ? (
          <span className="text-xs font-bold text-urgent bg-urgent/10 px-2 py-1 rounded-full">Chamado</span>
        ) : (
          <button onClick={() => setShowReasons(!showReasons)} className="bg-urgent text-urgent-foreground text-xs font-bold px-3 py-2 rounded-lg">
            Chamar Pai
          </button>
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
