import Fastify from 'fastify'
import { config } from './config.js'
import { enrichRoute } from './routes/enrich.js'
import { jobsRoute } from './routes/jobs.js'

const fastify = Fastify({ logger: true })

fastify.register(enrichRoute)
fastify.register(jobsRoute)

fastify.get('/health', async () => ({ status: 'ok' }))

const start = async (): Promise<void> => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
