import { z } from 'zod'

export const EnrichRequestSchema = z.object({
  email: z
    .string({ required_error: 'O campo email é obrigatório' })
    .email('Formato de e-mail inválido')
    .min(1, 'O campo email não pode ser vazio'),
  callbackUrl: z
    .string({ required_error: 'O campo callbackUrl é obrigatório' })
    .url('Formato de URL inválido para callbackUrl'),
  callbackHeaders: z.record(z.string()).optional(),
})

export type EnrichRequest = z.infer<typeof EnrichRequestSchema>
