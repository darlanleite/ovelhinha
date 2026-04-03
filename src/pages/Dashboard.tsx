import { useStore } from '@/store/useStore';
import { Users, Watch, AlertTriangle, BatteryLow, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { emitSync } from '@/lib/syncClient';

const Dashboard = () => {
  const children = useStore((s) => s.children);
  const bracelets = useStore((s) => s.bracelets);
  const calls = useStore((s) => s.calls);
  const rooms = useStore((s) => s.rooms);
  const answerCall = useStore((s) => s.answerCall);
  const updateChild = useStore((s) => s.updateChild);
  const updateBracelet = useStore((s) => s.updateBracelet);

  const checkout = (childId: string) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    updateChild(childId, { status: 'left', braceletNumber: null });
    if (child.braceletNumber) {
      const bracelet = bracelets.find((b) => b.number === child.braceletNumber);
      if (bracelet) updateBracelet(bracelet.id, { status: 'available', guardianName: null, childId: null });
    }
    emitSync({ type: 'checkout', payload: { childId, braceletNumber: child.braceletNumber } });
    toast(`Saída de ${child.name} registrada 🐑`);
  };

  const presentChildren = children.filter((c) => c.status !== 'left');
  const activeBracelets = bracelets.filter((b) => b.status === 'in-use');
  const openCalls = calls.filter((c) => c.status === 'open');
  const lowBattery = bracelets.filter((b) => b.battery < 20);

  const stats = [
    { label: 'Crianças presentes', value: presentChildren.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Pulseiras ativas', value: activeBracelets.length, icon: Watch, color: 'text-secondary', bg: 'bg-secondary/20' },
    { label: 'Chamadas abertas', value: openCalls.length, icon: AlertTriangle, color: 'text-urgent', bg: 'bg-urgent/10', pulse: openCalls.length > 0 },
    { label: 'Bateria baixa', value: lowBattery.length, icon: BatteryLow, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-black text-2xl text-foreground">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
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

      {/* Open Calls */}
      {openCalls.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-extrabold text-lg text-foreground">🔔 Chamadas Abertas</h2>
          <div className="space-y-3">
            {openCalls.map((call) => {
              const child = children.find((c) => c.id === call.childId);
              return (
                <OpenCallCard key={call.id} call={call} childName={child?.name || ''} onAnswer={() => { answerCall(call.id, 'reception'); emitSync({ type: 'answerCall', payload: { callId: call.id, answeredBy: 'reception' } }); }} />
              );
            })}
          </div>
        </div>
      )}

      {/* Present Children */}
      <div className="space-y-3">
        <h2 className="font-heading font-extrabold text-lg text-foreground">Crianças presentes</h2>
        <div className="bg-card rounded-card shadow-soft border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 font-heading font-bold text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 font-heading font-bold text-muted-foreground text-xs uppercase tracking-wider">Sala</th>
                <th className="text-left px-5 py-3 font-heading font-bold text-muted-foreground text-xs uppercase tracking-wider">Pulseira</th>
                <th className="text-left px-5 py-3 font-heading font-bold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {children.filter((c) => c.status !== 'left').map((child) => {
                const room = rooms.find((r) => r.id === child.roomId);
                const statusStyles = {
                  present: 'bg-success/10 text-success',
                  called: 'bg-urgent/10 text-urgent',
                  left: 'bg-muted text-muted-foreground',
                };
                const statusLabel = { present: 'Presente', called: 'Chamado', left: 'Saiu' };
                return (
                  <tr key={child.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{child.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{room?.emoji} {room?.name}</td>
                    <td className="px-5 py-3">
                      {child.braceletNumber ? (
                        <span className="bg-secondary/20 text-secondary-foreground font-mono text-xs font-bold px-2 py-1 rounded-md">#{child.braceletNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyles[child.status]}`}>
                        {statusLabel[child.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {child.status !== 'called' && (
                        <button
                          onClick={() => checkout(child.id)}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-urgent transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Saída
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const OpenCallCard = ({ call, childName, onAnswer }: { call: any; childName: string; onAnswer: () => void }) => {
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
  const isOverdue = elapsed > 300;

  return (
    <div className={`bg-card rounded-card border p-5 flex items-center gap-4 ${isOverdue ? 'border-urgent animate-pulse-urgent' : 'border-urgent/30'}`} style={{ backgroundColor: isOverdue ? 'hsl(0 100% 98%)' : undefined }}>
      <div className="w-10 h-10 rounded-full bg-urgent/10 flex items-center justify-center text-xl animate-pulse-urgent">
        {call.reasonIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-extrabold text-foreground">{childName}</p>
        <p className="text-sm text-muted-foreground">{call.reason} · Pulseira <span className="font-mono">#{call.braceletNumber}</span></p>
      </div>
      <div className="text-right">
        <p className={`font-mono font-bold text-lg ${isOverdue ? 'text-urgent' : 'text-foreground'}`}>
          {mins}:{secs.toString().padStart(2, '0')}
        </p>
      </div>
      <button onClick={onAnswer} className="bg-success text-success-foreground font-heading font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
        ✓ Chegou
      </button>
    </div>
  );
};

export default Dashboard;
