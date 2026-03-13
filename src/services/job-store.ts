import type { EnrichResponse } from '../schemas/response.js'

export type JobStatus = 'processing' | 'done' | 'error'

export interface Job {
  jobId: string
  status: JobStatus
  data: EnrichResponse | null
  error: string | null
  createdAt: Date
}

const jobs = new Map<string, Job>()

export const jobStore = {
  create(jobId: string): Job {
    const job: Job = { jobId, status: 'processing', data: null, error: null, createdAt: new Date() }
    jobs.set(jobId, job)
    return job
  },

  get(jobId: string): Job | undefined {
    return jobs.get(jobId)
  },

  setDone(jobId: string, data: EnrichResponse): void {
    const job = jobs.get(jobId)
    if (job) { job.status = 'done'; job.data = data }
  },

  setError(jobId: string, error: string): void {
    const job = jobs.get(jobId)
    if (job) { job.status = 'error'; job.error = error }
  },
}
