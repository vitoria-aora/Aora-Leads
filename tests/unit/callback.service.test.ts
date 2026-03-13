import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postCallback } from '../../src/services/callback.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('postCallback', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({ ok: true })
  })

  it('faz POST para callbackUrl com payload JSON', async () => {
    const payload = { jobId: 'abc', status: 'done' as const }
    await postCallback('https://example.com/cb', payload)
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/cb', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }))
  })

  it('inclui Content-Type application/json', async () => {
    await postCallback('https://example.com/cb', { jobId: 'abc', status: 'done' })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('mescla callbackHeaders fornecidos', async () => {
    await postCallback('https://example.com/cb', { jobId: 'abc', status: 'done' }, { Authorization: 'Bearer token123' })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe('Bearer token123')
  })

  it('não lança exceção se fetch falhar', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    await expect(postCallback('https://example.com/cb', { jobId: 'abc', status: 'error', error: 'oops' })).resolves.toBeUndefined()
  })
})
