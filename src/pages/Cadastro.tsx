import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { Check, ChevronRight } from 'lucide-react';

const steps = ['Criança', 'Responsável', 'Pulseira'];

const Cadastro = () => {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const rooms = useStore((s) => s.rooms);
  const addChild = useStore((s) => s.addChild);
  const bracelets = useStore((s) => s.bracelets);
  const updateBracelet = useStore((s) => s.updateBracelet);

  // Form state
  const [childName, setChildName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [roomId, setRoomId] = useState(rooms[0]?.id || '');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardian2Name, setGuardian2Name] = useState('');
  const [guardian2Phone, setGuardian2Phone] = useState('');
  const [showGuardian2, setShowGuardian2] = useState(false);
  const [braceletNumber, setBraceletNumber] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!childName.trim()) e.childName = 'Nome obrigatório';
      if (!birthDate) e.birthDate = 'Data obrigatória';
    } else if (step === 1) {
      if (!guardianName.trim()) e.guardianName = 'Nome obrigatório';
      if (!guardianPhone.trim()) e.guardianPhone = 'Telefone obrigatório';
    } else if (step === 2) {
      if (!braceletNumber.trim()) e.braceletNumber = 'Número obrigatório';
      else {
        const b = bracelets.find((b) => b.number === braceletNumber.padStart(2, '0'));
        if (!b) e.braceletNumber = 'Pulseira não encontrada';
        else if (b.status !== 'available') e.braceletNumber = 'Pulseira não disponível';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) setStep((s) => s + 1);
  };

  const submit = () => {
    if (!validate()) return;
    const id = 'c' + Date.now();
    const padded = braceletNumber.padStart(2, '0');
    const guardians = [{ id: 'g' + Date.now(), name: guardianName, phone: guardianPhone }];
    if (showGuardian2 && guardian2Name) {
      guardians.push({ id: 'g' + (Date.now() + 1), name: guardian2Name, phone: guardian2Phone });
    }
    addChild({
      id, name: childName, birthDate, roomId, medicalNotes, guardians,
      braceletNumber: padded, status: 'present', checkedInAt: new Date().toISOString(),
    });
    const bracelet = bracelets.find((b) => b.number === padded);
    if (bracelet) {
      updateBracelet(bracelet.id, { status: 'in-use', guardianName: guardianName, childId: id });
    }
    toast('Cadastro salvo! ✓ 🐑');
    setDone(true);
  };

  if (done) {
    const padded = braceletNumber.padStart(2, '0');
    return (
      <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="font-heading font-black text-3xl text-foreground mb-2">Cadastro realizado!</h1>
        <p className="text-muted-foreground mb-8">
          Pulseira <span className="font-mono font-bold bg-secondary/20 px-2 py-1 rounded">#{padded}</span> vinculada a <strong>{childName}</strong> ✓
        </p>

        {/* Print label preview */}
        <div className="bg-card rounded-card shadow-soft border border-border p-8 mb-6 inline-block text-left">
          <p className="font-heading font-black text-2xl text-foreground">{childName}</p>
          <p className="font-mono text-4xl font-bold text-primary mt-2">#{padded}</p>
          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span>{rooms.find((r) => r.id === roomId)?.emoji} {rooms.find((r) => r.id === roomId)?.name}</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="mt-4 w-24 h-24 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs">QR Code</div>
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={() => toast('🖨️ Enviando para impressora...')} className="bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-lg hover:bg-primary-hover transition-colors">
            🖨️ Imprimir Etiqueta
          </button>
          <button onClick={() => { setDone(false); setStep(0); setChildName(''); setBraceletNumber(''); setGuardianName(''); setGuardianPhone(''); }} className="bg-muted text-foreground font-heading font-bold px-6 py-3 rounded-lg hover:bg-muted/80 transition-colors">
            📋 Novo Cadastro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-foreground mb-6">Novo Cadastro</h1>

      {/* Stepper */}
      <div className="flex items-center mb-8 gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < step ? 'bg-success text-success-foreground' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`ml-2 text-sm font-medium ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-2 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-card shadow-soft border border-border p-8 animate-fade-in">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Nome da criança" value={childName} onChange={setChildName} error={errors.childName} placeholder="Ex: João Silva" />
            <Field label="Data de nascimento" type="date" value={birthDate} onChange={setBirthDate} error={errors.birthDate} />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Sala</label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name} ({r.ageRange})</option>)}
              </select>
            </div>
            <Field label="Observações médicas" value={medicalNotes} onChange={setMedicalNotes} placeholder="Alergias, medicações..." />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Nome do responsável" value={guardianName} onChange={setGuardianName} error={errors.guardianName} placeholder="Ex: Carlos Silva" />
            <Field label="Telefone" value={guardianPhone} onChange={setGuardianPhone} error={errors.guardianPhone} placeholder="(11) 99999-9999" />
            {!showGuardian2 ? (
              <button type="button" onClick={() => setShowGuardian2(true)} className="text-primary text-sm font-medium hover:underline">+ Adicionar segundo responsável</button>
            ) : (
              <>
                <hr className="border-border" />
                <Field label="Nome do 2º responsável" value={guardian2Name} onChange={setGuardian2Name} />
                <Field label="Telefone do 2º responsável" value={guardian2Phone} onChange={setGuardian2Phone} />
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Número da pulseira</label>
              <input
                value={braceletNumber}
                onChange={(e) => setBraceletNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 07"
                maxLength={2}
                className="w-full px-6 py-4 rounded-lg border border-border bg-card text-foreground font-mono text-3xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {errors.braceletNumber && <p className="text-urgent text-sm mt-1">{errors.braceletNumber}</p>}
            </div>
            {braceletNumber && (
              <div className="text-center animate-fade-in">
                <span className="inline-block bg-secondary/20 text-foreground font-mono font-bold text-2xl px-4 py-2 rounded-xl">
                  #{braceletNumber.padStart(2, '0')}
                </span>
                {!errors.braceletNumber && (
                  <p className="text-success font-medium mt-2">
                    Pulseira #{braceletNumber.padStart(2, '0')} vinculada a {childName} ✓
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="px-6 py-3 rounded-lg border border-border text-foreground font-heading font-bold hover:bg-muted transition-colors">
              Voltar
            </button>
          )}
          {step < 2 ? (
            <button onClick={next} className="flex-1 bg-primary text-primary-foreground font-heading font-bold py-3 rounded-lg hover:bg-primary-hover transition-colors">
              Próximo
            </button>
          ) : (
            <button onClick={submit} className="flex-1 bg-primary text-primary-foreground font-heading font-bold py-3 rounded-lg hover:bg-primary-hover transition-colors">
              Confirmar Cadastro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, error, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; type?: string;
}) => (
  <div>
    <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
    {error && <p className="text-urgent text-sm mt-1">{error}</p>}
  </div>
);

export default Cadastro;
