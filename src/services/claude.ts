import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'
import { EnrichError } from '../errors/EnrichError.js'
import { EnrichResponseSchema, type EnrichResponse } from '../schemas/response.js'

const SYSTEM_PROMPT = `Você é um especialista em inteligência comercial e enriquecimento de dados B2B.
Sua missão é, a partir de um e-mail profissional, pesquisar e retornar dados
VERIFICADOS sobre o contato, a empresa, os sócios e um relatório comercial.

━━━ REGRA FUNDAMENTAL — SEM ALUCINAÇÃO ━━━
Você NUNCA deve inventar, inferir ou estimar dados que não encontrou explicitamente
em fontes pesquisadas. Para QUALQUER campo que não tenha sido encontrado com
evidência concreta, retorne null. É preferível um campo null do que um dado incorreto.
Registre em warnings[] cada campo que não pôde ser preenchido.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use a ferramenta de busca (web_search) quantas vezes precisar.
Siga as etapas abaixo em ordem.

─────────────────────────────────────────────
ETAPA 1 — CONTATO PRINCIPAL (dono do e-mail)
─────────────────────────────────────────────
Pesquise a pessoa associada ao endereço de e-mail.

BUSCA DE LINKEDIN — execute as tentativas abaixo em ordem até encontrar:
  Tentativa 1: web_search: "[nome]" "[empresa]" site:linkedin.com/in
  Tentativa 2: web_search: LinkedIn "[nome]" "[empresa]"
  Tentativa 3: web_search: "[nome]" "[domínio do e-mail]" perfil profissional
  Tentativa 4: web_search: "[nome]" "[cargo provável]" "[cidade ou estado]" LinkedIn

  Se encontrar a URL linkedin.com/in/[username]:
    → Execute busca de conteúdo: web_search: site:linkedin.com/in/[username]
    → Extraia todas as informações disponíveis para preencher linkedinInsights (veja abaixo)

Campos a preencher (retorne null se não encontrar):
  • firstName        — Primeiro nome
  • lastName         — Sobrenome
  • email            — O próprio e-mail recebido
  • title            — Cargo atual (ex: CEO, Diretor de TI, Gerente Comercial)
  • department       — Departamento (ex: Comercial, Tecnologia, Financeiro)
  • phone            — Telefone fixo com DDD
  • mobilePhone      — Celular com DDD
  • linkedinUrl      — URL completa do perfil LinkedIn (linkedin.com/in/username)
  • role             — Papel societário, se for sócio (ex: Sócio-Administrador)
  • cpf              — CPF, apenas se disponível em fonte pública oficial
  • equityPercentage — Percentual de participação societária (0 a 100)
  • linkedinInsights — Inteligência estratégica extraída do LinkedIn (veja campo abaixo)

Fontes sugeridas: LinkedIn, site da empresa, Google, redes sociais profissionais.

─────────────────────────────────────────────
ETAPA 2 — EMPRESA (Account)
─────────────────────────────────────────────
Use o domínio do e-mail para identificar e pesquisar a empresa.
Campos a preencher (retorne null se não encontrar):
  • name              — Razão social completa
  • tradingName       — Nome fantasia / marca comercial
  • cnpj              — CNPJ no formato XX.XXX.XXX/XXXX-XX
  • cnpjStatus        — Situação cadastral do CNPJ (ex: Ativa, Baixada, Inapta)
  • foundingDate      — Data de abertura no formato DD/MM/AAAA
  • shareCapital      — Capital social em BRL (número, sem formatação)
  • website           — URL do site oficial
  • phone             — Telefone principal com DDD
  • industry          — Setor (em português: Tecnologia, Varejo, Saúde, Serviços
                        Financeiros, Indústria, Educação, Construção,
                        Consultoria, Alimentos e Bebidas, Transporte, Outro)
  • type              — Sempre "Prospect" para novos leads
  • numberOfEmployees — Número de funcionários (inteiro)
  • annualRevenue     — Faturamento anual estimado em BRL (número, sem formatação)
  • billingStreet     — Logradouro e número
  • billingCity       — Cidade
  • billingState      — UF (2 letras, ex: SP)
  • billingPostalCode — CEP no formato XXXXX-XXX
  • billingCountry    — Sempre "Brasil" para empresas nacionais
  • linkedinUrl       — URL da página da empresa no LinkedIn
  • description       — Descrição do negócio em 2-3 frases objetivas

Fontes sugeridas (use todas que forem relevantes):
  - consultaempresa.com   → razão social, CNPJ, sócios, situação, capital social
  - receitaws.com.br      → dados da Receita Federal
  - CNPJ.biz              → quadro societário, endereço, data de abertura
  - site oficial          → descrição, produtos, contato
  - LinkedIn da empresa   → funcionários, setor, descrição

─────────────────────────────────────────────
ETAPA 3A — QUADRO SOCIETÁRIO (lista de sócios)
─────────────────────────────────────────────
Use o CNPJ encontrado na Etapa 2 para obter a lista completa de sócios.
Para cada sócio colete: nome completo, CPF (se público), papel societário e
percentual de participação.

Fontes sugeridas:
  - consultasocio.com     → nome, CPF, participação societária
  - consultaempresa.com   → quadro societário completo
  - CNPJ.biz              → sócios e administradores
  - receitaws.com.br      → dados oficiais da Receita Federal

CPF só deve ser preenchido se disponível em fonte pública oficial.

─────────────────────────────────────────────
ETAPA 3B — ENRIQUECIMENTO INDIVIDUAL DOS SÓCIOS
─────────────────────────────────────────────
OBRIGATÓRIO: Para CADA sócio listado na Etapa 3A, execute TODAS as buscas abaixo
individualmente. Não pule nenhum sócio. Não agrupe sócios em uma única busca.

━━━ ESTRATÉGIA DE LINKEDIN (execute para cada sócio) ━━━

Nomes compostos: use SEMPRE duas variações em paralelo:
  • Nome completo: "Rafael Carvalho Silva Araujo"
  • Nome reduzido:  "Rafael Araujo" (primeiro + último sobrenome apenas)

TENTATIVA 1 — site:linkedin.com/in (mais precisa):
  web_search: "[Primeiro Nome] [Último Sobrenome]" "[Nome da Empresa]" site:linkedin.com/in
  web_search: "[Nome Completo]" "[Nome da Empresa]" site:linkedin.com/in

TENTATIVA 2 — busca livre com LinkedIn (se tentativa 1 falhar):
  web_search: LinkedIn "[Primeiro Nome] [Último Sobrenome]" "[Nome da Empresa]"
  web_search: "[Primeiro Nome] [Último Sobrenome]" "[Setor]" LinkedIn diretor sócio

TENTATIVA 3 — busca por cargo e localização (se tentativas 1 e 2 falharem):
  web_search: "[Primeiro Nome] [Último Sobrenome]" Diretor "[Nome Fantasia]" perfil
  web_search: "[Primeiro Nome] [Último Sobrenome]" "[UF da empresa]" LinkedIn executivo

TENTATIVA 4 — cross-referência por domínio (último recurso):
  web_search: "@[domínio]" "[Primeiro Nome] [Último Sobrenome]" LinkedIn

Se qualquer tentativa retornar uma URL linkedin.com/in/[username]:
  → Registre em linkedinUrl
  → Execute OBRIGATORIAMENTE a busca de conteúdo:
      web_search: site:linkedin.com/in/[username]
      web_search: "[Nome]" LinkedIn publicações artigos "[empresa]"
  → Extraia todas as informações disponíveis para linkedinInsights

━━━ BUSCA DE PERFIL GERAL (execute sempre, independente do LinkedIn) ━━━

  web_search: "[Primeiro Nome] [Último Sobrenome]" "[Nome da Empresa]" diretor sócio cargo
  Extraia: title, phone, email se disponíveis publicamente

━━━ INFERÊNCIA DE E-MAIL POR PADRÃO ━━━

Identifique o padrão do e-mail do contato principal:
  • franciscozandona@sucostial.com.br → padrão: primeironome+sobrenome@dominio
  • francisco.zandona@empresa.com → padrão: nome.sobrenome@dominio
  • f.zandona@empresa.com → padrão: inicial.sobrenome@dominio

Se o padrão for identificável, gere o e-mail provável para cada sócio e
registre em warnings[]: "E-mail de [nome] inferido por padrão — não verificado"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Campos a preencher por sócio (retorne null se não encontrar):
  • isPrimaryContact  — false (exceto se for o mesmo da Etapa 1)
  • firstName         — Primeiro nome
  • lastName          — Sobrenome
  • email             — Encontrado ou inferido por padrão (marcar inferência em warnings)
  • title             — Cargo atual
  • department        — Departamento
  • phone             — Telefone
  • mobilePhone       — Celular
  • linkedinUrl       — URL completa do perfil LinkedIn (linkedin.com/in/username)
  • role              — Papel societário (ex: Sócio-Administrador, Diretor)
  • cpf               — Apenas se público
  • equityPercentage  — % de participação
  • linkedinInsights  — Inteligência estratégica extraída do LinkedIn (veja campo abaixo)

━━━ DEFINIÇÃO DO CAMPO linkedinInsights ━━━
(Aplicável ao contato principal e a cada sócio que tiver LinkedIn encontrado)

Se o LinkedIn da pessoa foi encontrado, preencha obrigatoriamente:
  • headline              — Título/headline do perfil (ex: "CEO | Inovação em Logística")
  • professionalSummary   — Resumo da trajetória profissional: empresas anteriores,
                            tempo de carreira, especializações, conquistas mencionadas
  • currentRole           — Cargo atual e tempo no cargo
  • education             — Formação acadêmica (instituição, curso, período)
  • skills                — Habilidades listadas no perfil (máx. 10)
  • recentTopics          — Temas das publicações e artigos recentes encontrados
  • inferredInterests     — [Inferência] Interesses profissionais deduzidos a partir
                            de publicações, reações e engajamento público
  • relationshipTips      — Dicas práticas para o vendedor se relacionar com esta
                            pessoa: tom de abordagem, temas para iniciar conversa,
                            pontos em comum a explorar, o que NÃO fazer

Se o LinkedIn NÃO foi encontrado, retorne linkedinInsights: null

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─────────────────────────────────────────────
ETAPA 4 — RELATÓRIO COMERCIAL E DE RISCO
─────────────────────────────────────────────
Elabore um relatório de inteligência para preparar um vendedor para a primeira
reunião com esta empresa. Inclua:
  • summary            — O que a empresa faz (3-5 parágrafos)
  • targetAudience     — Quem são os clientes da empresa
  • productsAndServices— Lista dos principais produtos e/ou serviços oferecidos
  • market             — Mercado em que atua (B2B, B2C, tamanho, segmento)
  • recentNews         — Notícias recentes (máx. 5), com título, resumo, data e URL
  • competitors        — Principais concorrentes conhecidos
  • salesIntelligence  — Observações estratégicas: dores prováveis, momento da empresa,
                         pontos de entrada para uma conversa comercial
  • socialPresence     — Presença nas redes (Instagram, YouTube, Twitter/X, etc.)
  • riskAnalysis       — Análise de riscos baseada em:
      - Reclame Aqui (reclameaqui.com.br): reclamações, nota, índice de solução, reputação
      - Jusbrasil (jusbrasil.com.br): processos judiciais, ações trabalhistas, execuções fiscais
      - Outros indícios de risco reputacional ou financeiro encontrados
      Classifique o risco geral como: Baixo / Médio / Alto

Fontes sugeridas para o relatório:
  - reclameaqui.com.br  → reputação, reclamações, nota e índice de solução
  - jusbrasil.com.br    → processos judiciais, histórico jurídico
  - Google Notícias     → notícias recentes sobre a empresa
  - LinkedIn            → porte, cultura, crescimento
  - site oficial        → produtos, missão, clientes

Para o relatório, você PODE usar inferências razoáveis baseadas em evidências
encontradas, mas deve sinalizar inferências com o prefixo "[Inferência]".
Fatos verificados não precisam de prefixo. Todo o relatório deve ser escrito em português.`

const SAVE_LEAD_TOOL: Anthropic.Tool = {
  name: 'save_lead_data',
  description: 'Salva os dados estruturados do lead após pesquisa completa',
  input_schema: {
    type: 'object' as const,
    required: ['account', 'contacts', 'companyReport'],
    properties: {
      account: {
        type: 'object',
        required: ['name'],
        description: 'Conta Salesforce — empresa',
        properties: {
          name:              { type: ['string', 'null'], description: 'Razão social' },
          tradingName:       { type: ['string', 'null'], description: 'Nome fantasia' },
          cnpj:              { type: ['string', 'null'], description: 'Formato XX.XXX.XXX/XXXX-XX' },
          cnpjStatus:        { type: ['string', 'null'], description: 'Situação cadastral: Ativa, Baixada, Inapta, etc.' },
          foundingDate:      { type: ['string', 'null'], description: 'Data de abertura DD/MM/AAAA' },
          shareCapital:      { type: ['number', 'null'], description: 'Capital social em BRL, sem formatação' },
          website:           { type: ['string', 'null'] },
          phone:             { type: ['string', 'null'] },
          industry:          { type: ['string', 'null'], description: 'Setor em português' },
          type:              { type: ['string', 'null'], description: 'Sempre Prospect para novos leads' },
          numberOfEmployees: { type: ['integer', 'null'] },
          annualRevenue:     { type: ['number', 'null'], description: 'Faturamento estimado em BRL' },
          billingStreet:     { type: ['string', 'null'] },
          billingCity:       { type: ['string', 'null'] },
          billingState:      { type: ['string', 'null'], description: 'UF em 2 letras' },
          billingPostalCode: { type: ['string', 'null'] },
          billingCountry:    { type: ['string', 'null'] },
          linkedinUrl:       { type: ['string', 'null'] },
          description:       { type: ['string', 'null'] },
        },
      },
      contacts: {
        type: 'array',
        description: 'contacts[0] = dono do e-mail (isPrimaryContact=true). Demais = sócios.',
        items: {
          type: 'object',
          required: ['isPrimaryContact', 'firstName', 'lastName'],
          properties: {
            isPrimaryContact:  { type: 'boolean' },
            firstName:         { type: 'string' },
            lastName:          { type: 'string' },
            email:             { type: ['string', 'null'] },
            title:             { type: ['string', 'null'] },
            department:        { type: ['string', 'null'] },
            phone:             { type: ['string', 'null'] },
            mobilePhone:       { type: ['string', 'null'] },
            linkedinUrl:       { type: ['string', 'null'] },
            role:              { type: ['string', 'null'], description: 'Papel societário' },
            cpf:               { type: ['string', 'null'] },
            equityPercentage:  { type: ['number', 'null'] },
            linkedinInsights: {
              type: ['object', 'null'],
              description: 'Inteligência estratégica do LinkedIn. null se LinkedIn não encontrado.',
              properties: {
                headline:            { type: ['string', 'null'], description: 'Título/headline do perfil' },
                professionalSummary: { type: ['string', 'null'], description: 'Resumo de trajetória profissional' },
                currentRole:         { type: ['string', 'null'], description: 'Cargo atual e tempo no cargo' },
                education:           { type: ['string', 'null'], description: 'Formação acadêmica' },
                skills:              { type: 'array', items: { type: 'string' }, description: 'Habilidades listadas (máx. 10)' },
                recentTopics:        { type: 'array', items: { type: 'string' }, description: 'Temas de publicações e artigos recentes' },
                inferredInterests:   { type: 'array', items: { type: 'string' }, description: '[Inferência] Interesses profissionais deduzidos do comportamento público' },
                relationshipTips:    { type: ['string', 'null'], description: 'Dicas práticas para abordagem e relacionamento com esta pessoa' },
              },
            },
          },
        },
      },
      companyReport: {
        type: 'object',
        required: ['summary'],
        description: 'Relatório de inteligência comercial para preparação do vendedor',
        properties: {
          summary:              { type: 'string', description: 'O que a empresa faz — 3 a 5 parágrafos' },
          targetAudience:       { type: ['string', 'null'], description: 'Público-alvo e perfil dos clientes' },
          productsAndServices:  { type: 'array', items: { type: 'string' }, description: 'Lista dos principais produtos e/ou serviços' },
          market:               { type: ['string', 'null'], description: 'Mercado de atuação: B2B/B2C, segmento, abrangência geográfica' },
          recentNews: {
            type: 'array',
            description: 'Máximo 5 notícias recentes encontradas',
            items: {
              type: 'object',
              required: ['title', 'summary'],
              properties: {
                title:   { type: 'string' },
                summary: { type: 'string' },
                date:    { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
                url:     { type: ['string', 'null'] },
              },
            },
          },
          competitors:       { type: 'array', items: { type: 'string' }, description: 'Nomes dos principais concorrentes' },
          salesIntelligence: { type: ['string', 'null'], description: 'Observações estratégicas. Prefixe inferências com [Inferência].' },
          socialPresence: {
            type: 'object',
            description: 'URLs das redes sociais encontradas',
            properties: {
              instagram: { type: ['string', 'null'] },
              youtube:   { type: ['string', 'null'] },
              twitter:   { type: ['string', 'null'] },
              facebook:  { type: ['string', 'null'] },
            },
          },
          riskAnalysis: {
            type: 'object',
            description: 'Análise de riscos',
            properties: {
              overallRisk: { type: ['string', 'null'], description: 'Classificação geral: Baixo, Médio ou Alto' },
              reclameAqui: {
                type: 'object',
                properties: {
                  score:           { type: ['number', 'null'], description: 'Nota de 0 a 10' },
                  totalComplaints: { type: ['integer', 'null'] },
                  solutionRate:    { type: ['number', 'null'], description: '% de reclamações resolvidas' },
                  reputation:      { type: ['string', 'null'], description: 'Ex: Ótimo, Bom, Regular, Ruim, Péssimo' },
                  summary:         { type: ['string', 'null'] },
                  url:             { type: ['string', 'null'] },
                },
              },
              legalHistory: {
                type: 'object',
                properties: {
                  hasLawsuits:   { type: ['boolean', 'null'] },
                  lawsuitCount:  { type: ['integer', 'null'] },
                  laborClaims:   { type: ['boolean', 'null'] },
                  taxExecutions: { type: ['boolean', 'null'] },
                  summary:       { type: ['string', 'null'] },
                  url:           { type: ['string', 'null'] },
                },
              },
              otherRisks: { type: ['string', 'null'] },
            },
          },
        },
      },
      metadata: {
        type: 'object',
        properties: {
          confidence: { type: 'number', description: 'Confiança geral dos dados de 0.0 a 1.0' },
          sources:    { type: 'array', items: { type: 'string' }, description: 'URLs efetivamente consultadas' },
          warnings:   { type: 'array', items: { type: 'string' }, description: 'Campos não encontrados ou dados incertos' },
        },
      },
    },
  },
}

export class ClaudeService {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey })
  }

  extractDomain(email: string): string {
    return email.split('@')[1] ?? ''
  }

  buildUserMessage(email: string, domain: string): string {
    return `Enriqueça os dados a partir do e-mail profissional: ${email}\n\nDomínio da empresa: ${domain}`
  }

  async enrich(email: string): Promise<EnrichResponse> {
    const domain = this.extractDomain(email)

    const response = await this.client.messages.create({
      model: config.claudeModel,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [
        { type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool,
        SAVE_LEAD_TOOL,
      ],
      tool_choice: { type: 'any' },
      messages: [
        { role: 'user', content: this.buildUserMessage(email, domain) },
      ],
    })

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === 'tool_use' && block.name === 'save_lead_data',
    )

    if (!toolUseBlock) {
      throw new EnrichError(
        'Claude não chamou save_lead_data. Verifique o prompt ou tente novamente.',
        502,
      )
    }

    return this.parseToolResult(toolUseBlock.input)
  }

  parseToolResult(input: unknown): EnrichResponse {
    const result = EnrichResponseSchema.safeParse(input)
    if (!result.success) {
      throw new EnrichError(
        `Resposta da IA inválida: ${result.error.message}`,
        502,
      )
    }
    return result.data
  }
}
