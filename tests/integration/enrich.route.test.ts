import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { enrichRoute } from '../../src/routes/enrich.js'
import { jobsRoute } from '../../src/routes/jobs.js'
import { EnrichError } from '../../src/errors/EnrichError.js'
import { validEnrichResponse } from '../fixtures/enrich-response.js'

// vi.hoisted garante que mockEnrich e mockPostCallback estão disponíveis quando vi.mock é avaliado
const { mockEnrich, mockPostCallback } = vi.hoisted(() => ({
  mockEnrich: vi.fn(),
  mockPostCallback: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/config.js', () => ({
  config: {
    anthropicApiKey: 'test-key',
    apiSecretKey: 'valid-secret',
    port: 3000,
    claudeModel: 'claude-sonnet-4-6',
  },
}))

vi.mock('../../src/services/claude.js', () => ({
  ClaudeService: vi.fn().mockImplementation(() => ({ enrich: mockEnrich })),
}))

vi.mock('../../src/services/callback.js', () => ({
  postCallback: mockPostCallback,
}))

const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false })
  await app.register(enrichRoute)
  await app.register(jobsRoute)
  return app
}

const AUTH = { Authorization: 'Bearer valid-secret' }
const CALLBACK_URL = 'https://example.com/callback'
const PAYLOAD = (email: string) => ({ email, callbackUrl: CALLBACK_URL })

const waitForJob = (app: FastifyInstance, jobId: string, maxMs = 200): Promise<void> =>
  new Promise((resolve) => {
    const interval = setInterval(async () => {
      const res = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
      const body = JSON.parse(res.body)
      if (body.status !== 'processing') { clearInterval(interval); resolve() }
    }, 20)
    setTimeout(() => { clearInterval(interval); resolve() }, maxMs)
  })

describe('POST /enrich', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockEnrich.mockResolvedValue(validEnrichResponse)
    mockPostCallback.mockResolvedValue(undefined)
    app = await buildApp()
  })

  afterEach(async () => { await app.close() })

  // I1
  it('retorna 202 para e-mail válido', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('franciscozandona@sucostial.com.br') })
    expect(res.statusCode).toBe(202)
    const body = JSON.parse(res.body)
    expect(body.jobId).toBeDefined()
    expect(body.status).toBe('processing')
  })

  // I2
  it('account.type é Prospect (via polling)', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).data.account.type).toBe('Prospect')
  })

  // I3
  it('contacts tem ao menos 1 item', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).data.contacts.length).toBeGreaterThanOrEqual(1)
  })

  // I4
  it('contacts[0].isPrimaryContact é true', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).data.contacts[0].isPrimaryContact).toBe(true)
  })

  // I5
  it('contacts[0].email é igual ao e-mail informado', async () => {
    const email = 'franciscozandona@sucostial.com.br'
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD(email) })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).data.contacts[0].email).toBe(email)
  })

  // I6
  it('campos não encontrados são null, não string vazia', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    const primary = JSON.parse(job.body).data.contacts[0]
    expect(primary.phone).toBeNull()
    expect(primary.phone).not.toBe('')
  })

  // I7
  it('metadata.sources é array', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(Array.isArray(JSON.parse(job.body).data.metadata.sources)).toBe(true)
  })

  // I8
  it('companyReport.summary não está vazio', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).data.companyReport.summary).toBeTruthy()
  })

  // I9
  it('retorna 401 sem header Authorization', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', payload: PAYLOAD('test@empresa.com') })
    expect(res.statusCode).toBe(401)
  })

  // I10
  it('retorna 401 com token inválido', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: { Authorization: 'Bearer wrong' }, payload: PAYLOAD('test@empresa.com') })
    expect(res.statusCode).toBe(401)
  })

  // I11
  it('retorna 400 para body sem e-mail', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: {} })
    expect(res.statusCode).toBe(400)
  })

  // I11b
  it('retorna 400 para body sem callbackUrl', async () => {
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: { email: 'test@empresa.com' } })
    expect(res.statusCode).toBe(400)
  })

  // I12
  it('callback recebe status error quando Claude API lança EnrichError', async () => {
    mockEnrich.mockRejectedValueOnce(new EnrichError('Claude indisponível', 502))
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const lastCall = mockPostCallback.mock.calls[mockPostCallback.mock.calls.length - 1]
    expect(lastCall[1].status).toBe('error')
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).status).toBe('error')
  })

  // I13
  it('callback recebe status error quando Claude não chama save_lead_data', async () => {
    mockEnrich.mockRejectedValueOnce(new EnrichError('Claude não chamou save_lead_data', 502))
    const res = await app.inject({ method: 'POST', url: '/enrich', headers: AUTH, payload: PAYLOAD('test@empresa.com') })
    const { jobId } = JSON.parse(res.body)
    await waitForJob(app, jobId)
    const job = await app.inject({ method: 'GET', url: `/jobs/${jobId}` })
    expect(JSON.parse(job.body).status).toBe('error')
  })
})
