import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { jobsRoute } from '../../src/routes/jobs.js'
import { jobStore } from '../../src/services/job-store.js'

const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false })
  await app.register(jobsRoute)
  return app
}

describe('GET /jobs/:jobId', () => {
  let app: FastifyInstance

  beforeEach(async () => { app = await buildApp() })
  afterEach(async () => { await app.close() })

  it('retorna 404 para jobId inexistente', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs/nao-existe' })
    expect(res.statusCode).toBe(404)
  })

  it('retorna 200 com status processing para job recém-criado', async () => {
    const job = jobStore.create('test-job-1')
    const res = await app.inject({ method: 'GET', url: `/jobs/${job.jobId}` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('processing')
    expect(body.data).toBeNull()
    expect(body.error).toBeNull()
  })

  it('retorna status done e dados quando job concluído', async () => {
    jobStore.create('test-job-2')
    jobStore.setDone('test-job-2', { account: { name: 'Empresa Teste' } } as never)
    const res = await app.inject({ method: 'GET', url: '/jobs/test-job-2' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('done')
    expect(body.data).toBeTruthy()
  })

  it('retorna status error e mensagem quando job falhou', async () => {
    jobStore.create('test-job-3')
    jobStore.setError('test-job-3', 'Claude indisponível')
    const res = await app.inject({ method: 'GET', url: '/jobs/test-job-3' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('error')
    expect(body.error).toBe('Claude indisponível')
  })
})
