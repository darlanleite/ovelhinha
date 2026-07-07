/**
 * Click-to-chat do WhatsApp (wa.me) — sem API, sem custo:
 * abre a conversa com a mensagem pré-preenchida e quem envia é a
 * pessoa da recepção, do WhatsApp da igreja.
 */

/** Normaliza telefone BR para o formato E.164 sem '+' exigido pelo wa.me */
export function normalizePhoneBR(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 0) return null
  // já tem DDI 55 (12–13 dígitos: 55 + DDD + 8/9 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  // DDD + número (10–11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return null // formato não reconhecido — melhor não abrir link errado
}

export function waLink(phone: string, message: string): string | null {
  const normalized = normalizePhoneBR(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function braceletReturnMessage(guardianName: string, braceletNumber: string, churchName: string): string {
  const firstName = guardianName.trim().split(/\s+/)[0] || guardianName
  return (
    `Olá, ${firstName}! 🐑 Aqui é do ministério infantil da ${churchName}. ` +
    `A pulseirinha #${braceletNumber} do check-in ficou com você. ` +
    `Pode devolvê-la na recepção no próximo culto? Obrigado!`
  )
}

/** Fallback da chamada: pulseira falhou ou o pai não apareceu */
export function callParentMessage(guardianName: string, childName: string, reason: string, churchName: string): string {
  const firstName = guardianName.trim().split(/\s+/)[0] || guardianName
  const childFirst = childName.trim().split(/\s+/)[0] || childName
  return (
    `Olá, ${firstName}! 🐑 Aqui é do ministério infantil da ${churchName}. ` +
    `${childFirst} precisa de você (${reason.toLowerCase()}). ` +
    `Pode vir até a área kids, por favor?`
  )
}
