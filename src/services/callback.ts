import type { EnrichResponse } from '../schemas/response.js'

export interface CallbackPayload {
  jobId: string
  status: 'done' | 'error'
  data?: EnrichResponse
  error?: string
}

export async function postCallback(
  callbackUrl: string,
  payload: CallbackPayload,
  headers: Record<string, string> = {},
): Promise<void> {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error(`[callback] Failed to POST to ${callbackUrl}:`, err)
  }
}
