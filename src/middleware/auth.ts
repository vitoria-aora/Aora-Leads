import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    reply.status(401).send({ error: 'Authorization header ausente' })
    return
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || token !== config.apiSecretKey) {
    reply.status(401).send({ error: 'Token inválido' })
    return
  }
}
