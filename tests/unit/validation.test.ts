import { describe, it, expect } from 'vitest'
import { EnrichRequestSchema } from '../../src/schemas/request.js'

describe('EnrichRequestSchema', () => {
  // V1
  it('rejeita body vazio', () => {
    const result = EnrichRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  // V2
  it('rejeita email vazio', () => {
    const result = EnrichRequestSchema.safeParse({ email: '' })
    expect(result.success).toBe(false)
  })

  // V3
  it('rejeita string que não é e-mail', () => {
    const result = EnrichRequestSchema.safeParse({ email: 'nao-e-email' })
    expect(result.success).toBe(false)
  })

  // V4
  it('aceita e-mail e callbackUrl válidos', () => {
    const result = EnrichRequestSchema.safeParse({ email: 'joao@empresa.com.br', callbackUrl: 'https://example.com/cb' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('joao@empresa.com.br')
  })

  // V5
  it('rejeita quando callbackUrl está ausente', () => {
    const result = EnrichRequestSchema.safeParse({ email: 'joao@empresa.com.br' })
    expect(result.success).toBe(false)
  })

  // V6
  it('rejeita quando callbackUrl não é URL válida', () => {
    const result = EnrichRequestSchema.safeParse({ email: 'joao@empresa.com.br', callbackUrl: 'nao-e-url' })
    expect(result.success).toBe(false)
  })
})
