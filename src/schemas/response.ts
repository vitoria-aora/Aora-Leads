import { z } from 'zod'

const nullableString = z.string().nullable()
const nullableNumber = z.number().nullable()
const nullableInt = z.number().int().nullable()
const nullableBool = z.boolean().nullable()

export const LinkedInInsightsSchema = z.object({
  headline: nullableString,
  professionalSummary: nullableString,
  currentRole: nullableString,
  education: nullableString,
  skills: z.array(z.string()).default([]),
  recentTopics: z.array(z.string()).default([]),
  inferredInterests: z.array(z.string()).default([]),
  relationshipTips: nullableString,
}).nullable()

export const ContactDataSchema = z.object({
  isPrimaryContact: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  email: nullableString,
  title: nullableString,
  department: nullableString,
  phone: nullableString,
  mobilePhone: nullableString,
  linkedinUrl: nullableString,
  role: nullableString,
  cpf: nullableString,
  equityPercentage: nullableNumber,
  linkedinInsights: LinkedInInsightsSchema.optional().default(null),
})

export const AccountDataSchema = z.object({
  name: z.string().nullable(),
  tradingName: nullableString,
  cnpj: nullableString,
  cnpjStatus: nullableString,
  foundingDate: nullableString,
  shareCapital: nullableNumber,
  website: nullableString,
  phone: nullableString,
  industry: nullableString,
  type: nullableString,
  numberOfEmployees: nullableInt,
  annualRevenue: nullableNumber,
  billingStreet: nullableString,
  billingCity: nullableString,
  billingState: nullableString,
  billingPostalCode: nullableString,
  billingCountry: nullableString,
  linkedinUrl: nullableString,
  description: nullableString,
})

export const NewsItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  date: nullableString,
  url: nullableString,
})

export const ReclameAquiDataSchema = z.object({
  score: nullableNumber,
  totalComplaints: nullableInt,
  solutionRate: nullableNumber,
  reputation: nullableString,
  summary: nullableString,
  url: nullableString,
})

export const LegalHistoryDataSchema = z.object({
  hasLawsuits: nullableBool,
  lawsuitCount: nullableInt,
  laborClaims: nullableBool,
  taxExecutions: nullableBool,
  summary: nullableString,
  url: nullableString,
})

export const RiskAnalysisSchema = z.object({
  overallRisk: nullableString,
  reclameAqui: ReclameAquiDataSchema.optional().default({
    score: null, totalComplaints: null, solutionRate: null,
    reputation: null, summary: null, url: null,
  }),
  legalHistory: LegalHistoryDataSchema.optional().default({
    hasLawsuits: null, lawsuitCount: null, laborClaims: null,
    taxExecutions: null, summary: null, url: null,
  }),
  otherRisks: nullableString,
})

export const CompanyReportSchema = z.object({
  summary: z.string(),
  targetAudience: nullableString,
  productsAndServices: z.array(z.string()).default([]),
  market: nullableString,
  recentNews: z.array(NewsItemSchema).default([]),
  competitors: z.array(z.string()).default([]),
  salesIntelligence: nullableString,
  socialPresence: z.object({
    instagram: nullableString,
    youtube: nullableString,
    twitter: nullableString,
    facebook: nullableString,
  }).optional().default({ instagram: null, youtube: null, twitter: null, facebook: null }),
  riskAnalysis: RiskAnalysisSchema.optional().default({
    overallRisk: null, otherRisks: null,
    reclameAqui: { score: null, totalComplaints: null, solutionRate: null, reputation: null, summary: null, url: null },
    legalHistory: { hasLawsuits: null, lawsuitCount: null, laborClaims: null, taxExecutions: null, summary: null, url: null },
  }),
})

export const MetadataSchema = z.object({
  confidence: z.number().min(0).max(1).default(0),
  sources: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
})

export const EnrichResponseSchema = z.object({
  account: AccountDataSchema,
  contacts: z.array(ContactDataSchema).min(1),
  companyReport: CompanyReportSchema,
  metadata: MetadataSchema.optional().default({ confidence: 0, sources: [], warnings: [] }),
})

export type EnrichResponse = z.infer<typeof EnrichResponseSchema>
export type ContactData = z.infer<typeof ContactDataSchema>
export type AccountData = z.infer<typeof AccountDataSchema>
export type CompanyReport = z.infer<typeof CompanyReportSchema>
export type LinkedInInsights = z.infer<typeof LinkedInInsightsSchema>
