import { describe, it, expect, vi } from 'vitest'
import { authMiddleware } from '../../src/middleware/auth.js'
import type { FastifyReply, FastifyRequest } from 'fastify'

vi.mock('../../src/config.js', () => ({
  config: {
    anthropicApiKey: 'test-key',
    apiSecretKey: 'valid-secret',
    port: 3000,
    claudeModel: 'claude-sonnet-4-6',
  },
}))

const makeRequest = (authorization?: string) =>
  ({ headers: { authorization } }) as unknown as FastifyRequest

const makeReply = () => {
  const reply = { status: vi.fn(), send: vi.fn() } as unknown as FastifyReply
  ;(reply.status as ReturnType<typeof vi.fn>).mockReturnValue(reply)
  return reply
}

describe('authMiddleware', () => {
  // A1
  it('retorna 401 quando Authorization header está ausente', async () => {
    const reply = makeReply()
    await authMiddleware(makeRequest(undefined), reply)
    expect((reply.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401)
  })

  // A2
  it('retorna 401 quando token é inválido', async () => {
    const reply = makeReply()
    await authMiddleware(makeRequest('Bearer token-errado'), reply)
    expect((reply.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401)
  })

  // A3
  it('não chama reply quando token é válido', async () => {
    const reply = makeReply()
    await authMiddleware(makeRequest('Bearer valid-secret'), reply)
    expect((reply.status as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})
