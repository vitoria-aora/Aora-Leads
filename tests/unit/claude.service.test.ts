import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeService } from '../../src/services/claude.js'
import { EnrichError } from '../../src/errors/EnrichError.js'
import { validEnrichResponse } from '../fixtures/enrich-response.js'

vi.mock('../../src/config.js', () => ({
  config: {
    anthropicApiKey: 'test-key',
    apiSecretKey: 'test-secret',
    port: 3000,
    claudeModel: 'claude-sonnet-4-6',
  },
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

describe('ClaudeService', () => {
  let service: ClaudeService

  beforeEach(() => {
    service = new ClaudeService()
  })

  // U1
  describe('extractDomain', () => {
    it('extrai domínio de e-mail brasileiro', () => {
      expect(service.extractDomain('joao@empresa.com.br')).toBe('empresa.com.br')
    })

    it('extrai domínio de e-mail simples', () => {
      expect(service.extractDomain('user@company.com')).toBe('company.com')
    })
  })

  // U2
  describe('buildUserMessage', () => {
    it('inclui e-mail e domínio na mensagem', () => {
      const msg = service.buildUserMessage('joao@empresa.com.br', 'empresa.com.br')
      expect(msg).toContain('joao@empresa.com.br')
      expect(msg).toContain('empresa.com.br')
    })
  })

  // U3
  describe('parseToolResult', () => {
    it('mapeia campos corretamente a partir de input válido', () => {
      const result = service.parseToolResult(validEnrichResponse)
      expect(result.account.name).toBe('Sucostial Distribuidora Ltda')
      expect(result.contacts).toHaveLength(2)
      expect(result.companyReport.summary).toBeTruthy()
    })

    // U4
    it('preserva null para campos ausentes — nunca retorna string vazia', () => {
      const result = service.parseToolResult(validEnrichResponse)
      const primary = result.contacts[0]
      expect(primary?.phone).toBeNull()
      expect(primary?.linkedinUrl).toBeNull()
      expect(primary?.phone).not.toBe('')
    })

    // U5
    it('lança EnrichError se account.name for null e inválido', () => {
      const invalidInput = {
        ...validEnrichResponse,
        account: { ...validEnrichResponse.account, name: undefined },
        contacts: [{ isPrimaryContact: true, firstName: 'A', lastName: 'B' }],
      }
      expect(() => service.parseToolResult(invalidInput)).toThrow(EnrichError)
    })

    // U6
    it('garante que contacts[0].isPrimaryContact é true', () => {
      const result = service.parseToolResult(validEnrichResponse)
      expect(result.contacts[0]?.isPrimaryContact).toBe(true)
    })
  })

  // U7
  describe('enrich', () => {
    it('extrai input do ToolUseBlock save_lead_data', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default as ReturnType<typeof vi.fn>
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          { type: 'tool_use', name: 'save_lead_data', input: validEnrichResponse },
        ],
      })
      Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }))

      const svc = new ClaudeService()
      const result = await svc.enrich('franciscozandona@sucostial.com.br')
      expect(result.account.name).toBe('Sucostial Distribuidora Ltda')
    })

    // U8
    it('lança EnrichError se Claude não chamar save_lead_data', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default as ReturnType<typeof vi.fn>
      Anthropic.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Não encontrei dados.' }],
          }),
        },
      }))

      const svc = new ClaudeService()
      await expect(svc.enrich('test@empresa.com')).rejects.toThrow(EnrichError)
    })
  })
})
