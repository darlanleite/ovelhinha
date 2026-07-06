import { useState } from 'react';
import { useChurch } from '@/hooks/useChurch';
import { useBracelets } from '@/hooks/useBracelets';
import { useGateway } from '@/hooks/useGateway';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Cpu } from 'lucide-react';

const Configuracoes = () => {
  const { settings, rooms, updateSettings, generateDailyCode, addRoom, removeRoom, novoCulto } = useChurch();
  const { bracelets, updateBracelet } = useBracelets();
  const { gateways } = useGateway();
  const [confirmando, setConfirmando] = useState(false);
  const [churchName, setChurchName] = useState(settings.churchName);
  const [reactivateMinutes, setReactivateMinutes] = useState(settings.reactivateMinutes);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomEmoji, setNewRoomEmoji] = useState('📚');
  const [newRoomAge, setNewRoomAge] = useState('');

  const saveChurch = async () => {
    await updateSettings({ churchName, reactivateMinutes });
    toast('Configurações salvas! 🐑');
  };

  const handleGenerateCode = async () => {
    const code = await generateDailyCode();
    toast(`Novo código do dia: ${code} 🐑`);
  };

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    await addRoom({ name: newRoomName, emoji: newRoomEmoji, ageRange: newRoomAge });
    setNewRoomName('');
    setNewRoomAge('');
    toast('Sala adicionada! 🐑');
  };

  const handleNovoCulto = async () => {
    await novoCulto();
    setConfirmando(false);
    toast('Novo culto iniciado! Lista limpa. 🐑');
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
              <button onClick={async () => { await removeRoom(room.id); toast('Sala removida'); }} className="text-muted-foreground hover:text-urgent transition-colors">
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
          <button onClick={handleGenerateCode} className="bg-primary text-primary-foreground font-heading font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Gerar novo
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">Compartilhe este código com as tias da sala</p>
      </div>

      {/* Gateway Status */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">📡 Gateway BLE</h2>
        <div className="space-y-3">
          {gateways.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum gateway registrado.</p>
          )}
          {gateways.map((gw) => (
            <div key={gw.name} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${gw.status === 'online' ? 'bg-success animate-pulse' : 'bg-urgent'}`} />
              <p className="font-heading font-bold text-foreground text-sm flex-1">{gw.name}</p>
              <p className="text-xs text-muted-foreground">
                {gw.secsAgo !== null ? `último ping há ${gw.secsAgo}s` : '—'}
              </p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gw.status === 'online' ? 'bg-success/10 text-success' : 'bg-urgent/10 text-urgent'}`}>
                {gw.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ESP IDs */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">📡 ESP32 — Pulseiras</h2>
        <div className="space-y-3">
          {bracelets.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <span className="font-mono font-bold text-foreground text-sm w-8">#{b.number}</span>
              <input value={b.espId || ''} onChange={(e) => updateBracelet(b.id, { espId: e.target.value || null })}
                placeholder="Ex: A4:B2:C1:D3"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
              <Cpu className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* Novo Culto */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">🗂️ Novo Culto</h2>
        <p className="text-sm text-muted-foreground mb-4">Limpa todas as crianças e chamadas do culto atual. As pulseiras voltam para "disponível".</p>
        {!confirmando ? (
          <button onClick={() => setConfirmando(true)} className="bg-urgent text-urgent-foreground font-heading font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
            Iniciar novo culto
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Tem certeza? Isso apaga todos os dados do culto atual.</span>
            <button onClick={handleNovoCulto} className="bg-urgent text-urgent-foreground font-heading font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Confirmar</button>
            <button onClick={() => setConfirmando(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
          </div>
        )}
      </div>

      {/* Sistema */}
      <div className="bg-card rounded-card shadow-soft border border-border p-6">
        <h2 className="font-heading font-extrabold text-lg text-foreground mb-4">⚙️ Sistema</h2>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Tempo para reacionamento: <span className="font-heading font-bold text-primary">{reactivateMinutes} min</span>
          </label>
          <input type="range" min={1} max={15} value={reactivateMinutes}
            onChange={(e) => setReactivateMinutes(Number(e.target.value))}
            className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-muted-foreground"><span>1 min</span><span>15 min</span></div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
