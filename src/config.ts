const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const config = {
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  apiSecretKey: required('API_SECRET_KEY'),
  port: parseInt(process.env.PORT ?? '3000', 10),
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
}
