import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { enrichRoute } from '../../src/routes/enrich.js'
import { EnrichResponseSchema } from '../../src/schemas/response.js'

/**
 * Teste E2E — faz chamada real à Claude API.
 * Skipped em CI (variável CI=true).
 * Para rodar localmente: npm run test:e2e
 * Requer .env com ANTHROPIC_API_KEY e API_SECRET_KEY válidos.
 */
describe.skipIf(process.env.CI === 'true')('E2E — chamada real ao Claude', () => {
  it('enriquece e-mail real e retorna estrutura válida', async () => {
    const app = Fastify()
    await app.register(enrichRoute)

    const apiKey = process.env.API_SECRET_KEY ?? 'test'
    const res = await app.inject({
      method: 'POST',
      url: '/enrich',
      headers: { Authorization: `Bearer ${apiKey}` },
      payload: { email: process.env.TEST_EMAIL ?? 'contato@anthropic.com' },
    })

    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    const result = EnrichResponseSchema.safeParse(body)

    // Valida estrutura — não valida conteúdo (depende da web)
    expect(result.success, `Resposta inválida: ${!result.success ? result.error.message : ''}`).toBe(true)

    if (result.success) {
      expect(result.data.contacts[0]?.isPrimaryContact).toBe(true)
      expect(result.data.companyReport.summary).toBeTruthy()
    }

    await app.close()
  }, 120_000) // 2 minutos de timeout para chamada real
})
