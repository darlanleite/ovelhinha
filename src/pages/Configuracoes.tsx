import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, RefreshCw } from 'lucide-react';

const Configuracoes = () => {
  const settings = useStore((s) => s.settings);
  const rooms = useStore((s) => s.rooms);
  const updateSettings = useStore((s) => s.updateSettings);
  const addRoom = useStore((s) => s.addRoom);
  const removeRoom = useStore((s) => s.removeRoom);

  const [churchName, setChurchName] = useState(settings.churchName);
  const [reactivateMinutes, setReactivateMinutes] = useState(settings.reactivateMinutes);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomEmoji, setNewRoomEmoji] = useState('📚');
  const [newRoomAge, setNewRoomAge] = useState('');

  const saveChurch = () => {
    updateSettings({ churchName });
    toast('Configurações salvas! 🐑');
  };

  const generateCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    updateSettings({ dailyCode: code });
    toast(`Novo código do dia: ${code} 🐑`);
  };

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return;
    addRoom({
      id: 'r' + Date.now(),
      name: newRoomName,
      emoji: newRoomEmoji,
      ageRange: newRoomAge,
    });
    setNewRoomName('');
    setNewRoomAge('');
    toast('Sala adicionada! 🐑');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-heading font-black text-2xl text-foreground">Configurações</h1>

      {/* Church */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">⛪ Igreja</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome da igreja</label>
            <input value={churchName} onChange={(e) => setChurchName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>
          <button onClick={saveChurch} className="bg-primary text-primary-foreground font-heading font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-primary-hover transition-colors">
            Salvar
          </button>
        </div>
      </div>

      {/* Rooms */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">🏠 Salas</h2>
        <div className="space-y-3 mb-4">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <span className="text-xl">{room.emoji}</span>
              <div className="flex-1">
                <p className="font-heading font-bold text-foreground text-sm">{room.name}</p>
                <p className="text-xs text-muted-foreground">{room.ageRange}</p>
              </div>
              <button onClick={() => { removeRoom(room.id); toast('Sala removida'); }} className="text-muted-foreground hover:text-urgent transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newRoomEmoji} onChange={(e) => setNewRoomEmoji(e.target.value)} className="w-14 px-2 py-2 rounded-lg border border-border bg-card text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary/30" maxLength={2} />
          <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Nome da sala" className="flex-1 px-4 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-sm" />
          <input value={newRoomAge} onChange={(e) => setNewRoomAge(e.target.value)} placeholder="Faixa etária" className="w-32 px-4 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-sm" />
          <button onClick={handleAddRoom} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary-hover transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Daily code */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">🔑 Código do Dia</h2>
        <div className="flex items-center gap-4">
          <span className="font-mono text-4xl font-bold text-primary tracking-[0.2em]">{settings.dailyCode}</span>
          <button onClick={generateCode} className="bg-primary text-primary-foreground font-heading font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Gerar novo
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">Compartilhe este código com as tias da sala</p>
      </div>

      {/* System */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">⚙️ Sistema</h2>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Tempo para reacionamento: <span className="font-heading font-bold text-primary">{reactivateMinutes} min</span>
          </label>
          <input
            type="range" min={1} max={15} value={reactivateMinutes}
            onChange={(e) => { const v = Number(e.target.value); setReactivateMinutes(v); updateSettings({ reactivateMinutes: v }); }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 min</span><span>15 min</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
