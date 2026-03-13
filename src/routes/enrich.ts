import { randomUUID } from 'crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { EnrichError } from '../errors/EnrichError.js'
import { authMiddleware } from '../middleware/auth.js'
import { EnrichRequestSchema } from '../schemas/request.js'
import { postCallback } from '../services/callback.js'
import { ClaudeService } from '../services/claude.js'
import { jobStore } from '../services/job-store.js'

const claudeService = new ClaudeService()

async function processEnrich(
  jobId: string,
  email: string,
  callbackUrl: string,
  callbackHeaders: Record<string, string> = {},
): Promise<void> {
  try {
    const data = await claudeService.enrich(email)
    jobStore.setDone(jobId, data)
    await postCallback(callbackUrl, { jobId, status: 'done', data }, callbackHeaders)
  } catch (err) {
    const message = err instanceof EnrichError ? err.message : 'Erro interno do servidor'
    jobStore.setError(jobId, message)
    await postCallback(callbackUrl, { jobId, status: 'error', error: message }, callbackHeaders)
  }
}

export async function enrichRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/enrich', {
    preHandler: authMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = EnrichRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return reply.status(400).send({ error: firstError?.message ?? 'Requisição inválida' })
    }

    const { email, callbackUrl, callbackHeaders } = parsed.data
    const jobId = randomUUID()
    jobStore.create(jobId)

    // Fire and forget — do not await
    void processEnrich(jobId, email, callbackUrl, callbackHeaders ?? {})

    return reply.status(202).send({ jobId, status: 'processing' })
  })
}
