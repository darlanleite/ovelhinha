import { useStore } from '@/store/useStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, Bell, Clock } from 'lucide-react';
import { toast } from 'sonner';

const PIE_COLORS = ['#5B8CFF', '#FFB347', '#FF6B6B', '#3ECFAA', '#6B7280', '#A78BFA'];

const Relatorios = () => {
  const history = useStore((s) => s.history);
  const calls = useStore((s) => s.calls);
  const children = useStore((s) => s.children);

  const barData = history.map((h) => ({ name: h.serviceName.replace('Culto ', ''), criancas: h.childrenCount, chamadas: h.callsCount }));

  const reasonCounts: Record<string, number> = {};
  calls.forEach((c) => { reasonCounts[c.reason] = (reasonCounts[c.reason] || 0) + 1; });
  const pieData = Object.entries(reasonCounts).map(([name, value]) => ({ name, value }));

  const totalChildren = history.reduce((s, h) => s + h.childrenCount, 0);
  const totalCalls = calls.length;
  const avgTime = '3m 42s'; // simulated

  const stats = [
    { label: 'Total de crianças', value: totalChildren, icon: Users, color: 'text-primary' },
    { label: 'Total de chamadas', value: totalCalls, icon: Bell, color: 'text-urgent' },
    { label: 'Tempo médio resposta', value: avgTime, icon: Clock, color: 'text-success' },
  ];

  const handleExport = () => {
    const csv = 'Criança,Motivo,Status,Data\n' + calls.map((c) => {
      const child = children.find((ch) => ch.id === c.childId);
      return `${child?.name || ''},${c.reason},${c.status},${c.createdAt}`;
    }).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'chamadas.csv'; a.click();
    toast('CSV exportado! 🐑');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-black text-2xl text-foreground">Relatórios</h1>
        <button onClick={handleExport} className="bg-primary text-primary-foreground font-heading font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-card shadow-soft border border-border p-5 flex items-center gap-4">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-heading font-black text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-card shadow-soft border border-border p-6">
          <h3 className="font-heading font-bold text-foreground mb-4">Crianças por culto</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8EAF0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="criancas" fill="#5B8CFF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-card shadow-soft border border-border p-6">
          <h3 className="font-heading font-bold text-foreground mb-4">Motivos das chamadas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History table */}
      <div className="bg-card rounded-card shadow-soft border border-border overflow-hidden">
        <h3 className="font-heading font-bold text-foreground p-5 pb-0">Histórico de chamadas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs uppercase text-muted-foreground font-heading font-bold tracking-wider">Criança</th>
                <th className="text-left px-5 py-3 text-xs uppercase text-muted-foreground font-heading font-bold tracking-wider">Motivo</th>
                <th className="text-left px-5 py-3 text-xs uppercase text-muted-foreground font-heading font-bold tracking-wider">Pulseira</th>
                <th className="text-left px-5 py-3 text-xs uppercase text-muted-foreground font-heading font-bold tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs uppercase text-muted-foreground font-heading font-bold tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call, i) => {
                const child = children.find((c) => c.id === call.childId);
                return (
                  <tr key={call.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-5 py-3 font-medium text-foreground">{child?.name || '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{call.reasonIcon} {call.reason}</td>
                    <td className="px-5 py-3 font-mono text-foreground">#{call.braceletNumber}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${call.status === 'open' ? 'bg-urgent/10 text-urgent' : 'bg-success/10 text-success'}`}>
                        {call.status === 'open' ? 'Aberta' : 'Atendida'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(call.createdAt).toLocaleString('pt-BR')}</td>
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

export default Relatorios;
