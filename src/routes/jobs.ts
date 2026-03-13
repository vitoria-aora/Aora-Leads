import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { jobStore } from '../services/job-store.js'

export async function jobsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/jobs/:jobId', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params
    const job = jobStore.get(jobId)
    if (!job) {
      return reply.status(404).send({ error: 'Job não encontrado' })
    }
    return reply.status(200).send({
      jobId: job.jobId,
      status: job.status,
      data: job.data,
      error: job.error,
    })
  })
}
