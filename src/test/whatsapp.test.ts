import { describe, it, expect } from 'vitest'
import { normalizePhoneBR, waLink, braceletReturnMessage } from '@/lib/whatsapp'

describe('normalizePhoneBR', () => {
  it('celular com DDD (11 dígitos) ganha DDI 55', () => {
    expect(normalizePhoneBR('21999990000')).toBe('5521999990000')
    expect(normalizePhoneBR('(21) 99999-0000')).toBe('5521999990000')
  })

  it('fixo com DDD (10 dígitos) ganha DDI 55', () => {
    expect(normalizePhoneBR('2133334444')).toBe('552133334444')
  })

  it('número já com DDI 55 é mantido', () => {
    expect(normalizePhoneBR('5521999990000')).toBe('5521999990000')
    expect(normalizePhoneBR('+55 21 99999-0000')).toBe('5521999990000')
  })

  it('formatos não reconhecidos retornam null', () => {
    expect(normalizePhoneBR('')).toBeNull()
    expect(normalizePhoneBR('999')).toBeNull()
    expect(normalizePhoneBR('123456789012345')).toBeNull()
  })
})

describe('waLink', () => {
  it('gera link wa.me com mensagem codificada', () => {
    const link = waLink('(21) 99999-0000', 'Olá, João!')
    expect(link).toBe('https://wa.me/5521999990000?text=Ol%C3%A1%2C%20Jo%C3%A3o!')
  })

  it('retorna null para telefone inválido', () => {
    expect(waLink('abc', 'oi')).toBeNull()
  })
})

describe('braceletReturnMessage', () => {
  it('usa só o primeiro nome e inclui pulseira e igreja', () => {
    const msg = braceletReturnMessage('Maria da Silva', '07', 'Igreja Batista')
    expect(msg).toContain('Olá, Maria!')
    expect(msg).toContain('#07')
    expect(msg).toContain('Igreja Batista')
  })
})
