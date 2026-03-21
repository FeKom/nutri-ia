# MVP Roadmap - Nutria Catalog

**Última atualização:** 2026-01-29

## Status Atual do Projeto

### Backend
- **Status:** 95% completo
- **Linhas de código:** ~1.500
- **Testes:** 57 casos de teste implementados
- **Database:** 6 tabelas completamente modeladas e migradas
- **API Endpoints:** 7 grupos de endpoints funcionais (~12 rotas no total)

### Frontend
- **Status:** 10% completo
- **Estado:** Estrutura básica com Next.js, apenas interface de chat implementada
- **Integração:** Não conectado ao backend

### Infraestrutura
- **Docker:** Configurado com PostgreSQL 15 + pgvector
- **Migrations:** Alembic configurado e funcionando
- **CI/CD:** Não implementado
- **Segurança:** Nível básico, não pronto para produção

---

## Análise de Gaps Críticos

### 1. Authentication & Authorization
**Status:** 0% implementado

**Componentes faltando:**
- JWT token authentication
- Middleware de autenticação em todas as rotas
- Sistema de registro e login de usuários
- Role-Based Access Control (RBAC)
- Session management
- Hash de senhas (bcrypt/argon2)
- Refresh token mechanism
- Password reset flow

**Impacto:**
- Sistema completamente inseguro para uso público
- Todos os endpoints estão acessíveis sem autenticação
- Não há verificação de identidade do usuário
- Qualquer pessoa pode acessar/modificar dados de qualquer usuário

**Prioridade:** CRÍTICA

---

### 2. Frontend Development
**Status:** 10% implementado (apenas estrutura básica)

**Componentes faltando:**
- Telas de autenticação (Login/Registro)
- Busca de alimentos com filtros
- Dashboard de rastreamento de refeições
- Interface de recomendações personalizadas
- Perfil do usuário
- Upload e análise de imagens
- Cliente HTTP configurado (axios/fetch wrapper)
- State management (Context API/Zustand/Redux)
- Error handling e loading states
- Design system completo
- Responsive design para mobile

**Impacto:**
- Usuários não conseguem interagir com o sistema
- Backend completo mas sem interface de uso

**Prioridade:** CRÍTICA

---

### 3. Food Analysis API
**Status:** 50% implementado (serviço existe mas não exposto)

**Componentes faltando:**
- Endpoint `/api/v1/foods/analyze` para upload de imagens
- Download e configuração do modelo DETIC
- Variáveis de ambiente para paths dos modelos
- Integração com frontend para upload
- Retorno estruturado com informações nutricionais
- Fallback para análise sem modelo

**Componentes existentes:**
- Serviço de análise com DETIC implementado
- Vocabulário de 70+ alimentos em português
- CLIP-based semantic understanding
- Sistema de embeddings funcionando

**Impacto:**
- Funcionalidade diferenciada não acessível aos usuários
- Valor agregado do produto não disponível

**Prioridade:** ALTA

---

### 4. DevOps & CI/CD
**Status:** 0% implementado

**Componentes faltando:**
- GitHub Actions ou GitLab CI pipeline
- Automated testing on commits
- Automated builds
- Automated deployments
- Staging environment
- Production environment
- Code quality checks (linting, formatting)
- Test coverage reporting
- Docker image building pipeline
- Environment-specific configurations

**Componentes existentes:**
- Docker Compose para desenvolvimento local
- Makefile com comandos úteis
- 57 testes prontos para CI

**Impacto:**
- Deploy manual propenso a erros
- Sem garantia de qualidade em commits
- Desenvolvimento menos ágil

**Prioridade:** ALTA

---

### 5. DevSecOps
**Status:** 20% implementado (apenas básico)

**Componentes faltando:**
- Rate limiting (proteção contra abuse)
- Input validation robusto em todos os endpoints
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- HTTPS enforcement
- Secrets management (AWS Secrets Manager, HashiCorp Vault)
- SAST (Static Application Security Testing)
- DAST (Dynamic Application Security Testing)
- Dependency vulnerability scanning
- Container security scanning
- SQL injection prevention review
- XSS protection review
- CSRF protection
- Audit logging
- Request/response logging com dados sensíveis mascarados

**Componentes existentes:**
- CORS configurado
- Environment variables em .env
- Connection pooling com health checks
- SQLModel (proteção básica contra SQL injection)

**Impacto:**
- Sistema vulnerável a ataques comuns
- Não adequado para dados sensíveis de usuários
- Compliance issues (LGPD, GDPR)

**Prioridade:** ALTA

---

## Roadmap Detalhado

### Fase 1: Fundação de Segurança (Semana 1-2)

#### 1.1 Authentication Backend
**Arquivos a criar:**
- `app/core/security.py` - Funções de hash, JWT, verificação de tokens
- `app/api/v1/auth.py` - Endpoints de autenticação
- `app/models/user.py` - Modelo de usuário
- `app/services/auth_service.py` - Lógica de autenticação
- `app/middleware/auth_middleware.py` - Middleware de verificação

**Tarefas:**
- [ ] Instalar dependências: `python-jose[cryptography]`, `passlib[bcrypt]`
- [ ] Criar modelo User no banco de dados
- [ ] Implementar hash de senhas com bcrypt
- [ ] Implementar geração e validação de JWT tokens
- [ ] Criar endpoints:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
- [ ] Adicionar middleware de autenticação em todas as rotas protegidas
- [ ] Implementar RBAC básico (roles: user, admin)
- [ ] Criar migration para tabela users
- [ ] Adicionar testes de autenticação

#### 1.2 Security Hardening
**Tarefas:**
- [ ] Implementar rate limiting com `slowapi`
- [ ] Adicionar security headers middleware
- [ ] Configurar CORS para produção
- [ ] Implementar request validation com Pydantic V2
- [ ] Adicionar logging de auditoria
- [ ] Implementar sanitização de dados sensíveis em logs

**Estimativa:** 8-12 dias de desenvolvimento

---

### Fase 2: Frontend Core (Semana 3-4)

#### 2.1 Setup de Infraestrutura Frontend
**Arquivos a criar:**
- `lib/api/client.ts` - Cliente HTTP configurado
- `lib/api/endpoints/` - Funções para cada endpoint
- `contexts/AuthContext.tsx` - Context de autenticação
- `hooks/useAuth.ts` - Hook de autenticação
- `hooks/useApi.ts` - Hook genérico para API calls

**Tarefas:**
- [ ] Configurar cliente HTTP (axios ou fetch wrapper)
- [ ] Implementar interceptors para tokens
- [ ] Criar sistema de tratamento de erros
- [ ] Implementar Context API para estado global
- [ ] Criar hooks customizados para data fetching

#### 2.2 Autenticação UI
**Páginas a criar:**
- `app/auth/login/page.tsx`
- `app/auth/register/page.tsx`
- `app/auth/forgot-password/page.tsx`

**Componentes a criar:**
- `components/auth/LoginForm.tsx`
- `components/auth/RegisterForm.tsx`
- `components/auth/ProtectedRoute.tsx`

**Tarefas:**
- [ ] Criar telas de login e registro
- [ ] Implementar validação de formulários (react-hook-form)
- [ ] Integrar com endpoints de autenticação
- [ ] Implementar persistência de token (localStorage/cookies)
- [ ] Criar middleware de proteção de rotas
- [ ] Implementar auto-refresh de token

#### 2.3 Funcionalidades Principais
**Páginas a criar:**
- `app/foods/search/page.tsx` - Busca de alimentos
- `app/dashboard/page.tsx` - Dashboard principal
- `app/meals/page.tsx` - Registro de refeições
- `app/recommendations/page.tsx` - Recomendações
- `app/profile/page.tsx` - Perfil do usuário

**Componentes a criar:**
- `components/foods/FoodSearch.tsx`
- `components/foods/FoodCard.tsx`
- `components/foods/FoodFilters.tsx`
- `components/meals/MealLogger.tsx`
- `components/meals/MealHistory.tsx`
- `components/dashboard/NutritionSummary.tsx`
- `components/dashboard/WeeklyStats.tsx`
- `components/recommendations/RecommendationList.tsx`
- `components/profile/ProfileForm.tsx`

**Tarefas:**
- [ ] Implementar busca de alimentos com filtros
- [ ] Criar interface de logging de refeições
- [ ] Implementar dashboard com gráficos (recharts/chart.js)
- [ ] Criar visualização de recomendações
- [ ] Implementar edição de perfil
- [ ] Adicionar loading states e skeletons
- [ ] Implementar error boundaries
- [ ] Adicionar toast notifications

**Estimativa:** 10-15 dias de desenvolvimento

---

### Fase 3: Food Analysis (Semana 5)

#### 3.1 Backend API Endpoint
**Arquivos a criar/modificar:**
- `app/api/v1/analysis.py` - Endpoints de análise de imagem
- `app/schemas/analysis.py` - Schemas de request/response

**Tarefas:**
- [ ] Criar endpoint `POST /api/v1/analysis/image`
- [ ] Implementar upload de imagem (max 10MB)
- [ ] Integrar com `FoodAnalysisService`
- [ ] Adicionar validação de formato de imagem
- [ ] Implementar retorno estruturado com nutrientes detectados
- [ ] Adicionar testes do endpoint

#### 3.2 Model Setup
**Tarefas:**
- [ ] Documentar processo de download do modelo DETIC
- [ ] Criar script de setup: `scripts/setup_models.sh`
- [ ] Adicionar variáveis de ambiente para model paths
- [ ] Implementar verificação de modelo ao iniciar serviço
- [ ] Adicionar fallback mode se modelo não disponível

#### 3.3 Frontend Integration
**Componentes a criar:**
- `components/analysis/ImageUpload.tsx`
- `components/analysis/AnalysisResult.tsx`
- `components/analysis/DetectedFoods.tsx`

**Tarefas:**
- [ ] Criar interface de upload de imagem
- [ ] Implementar preview de imagem
- [ ] Adicionar drag and drop
- [ ] Implementar loading durante análise
- [ ] Exibir resultados de forma visual
- [ ] Permitir adicionar alimentos detectados ao log de refeições

**Estimativa:** 5-7 dias de desenvolvimento

---

### Fase 4: DevOps & CI/CD (Semana 6)

#### 4.1 GitHub Actions Setup
**Arquivos a criar:**
- `.github/workflows/backend-ci.yml`
- `.github/workflows/frontend-ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

**Tarefas:**
- [ ] Criar workflow de CI para backend:
  - Lint com black, isort, mypy
  - Run tests com pytest
  - Coverage report
  - Build Docker image
- [ ] Criar workflow de CI para frontend:
  - Lint com ESLint
  - Type check com TypeScript
  - Run tests com Jest
  - Build Next.js
- [ ] Configurar Docker registry (GitHub Container Registry)
- [ ] Implementar automated builds de imagens Docker
- [ ] Adicionar badges de status no README

#### 4.2 Deployment Setup
**Tarefas:**
- [ ] Escolher plataforma de hosting (AWS, GCP, DigitalOcean, Vercel)
- [ ] Configurar ambiente de staging
- [ ] Configurar ambiente de produção
- [ ] Criar scripts de deploy automatizado
- [ ] Configurar variáveis de ambiente por ambiente
- [ ] Implementar health checks
- [ ] Configurar rollback automático em caso de falha

#### 4.3 Infrastructure as Code
**Arquivos a criar:**
- `infrastructure/docker-compose.prod.yml`
- `infrastructure/nginx.conf`
- `infrastructure/Dockerfile.prod`

**Tarefas:**
- [ ] Criar Docker Compose para produção
- [ ] Configurar Nginx como reverse proxy
- [ ] Implementar SSL/TLS com Let's Encrypt
- [ ] Configurar backup automatizado do banco
- [ ] Documentar processo de deploy

**Estimativa:** 5-7 dias de setup

---

### Fase 5: Security Hardening (Semana 7)

#### 5.1 Application Security
**Tarefas:**
- [ ] Implementar rate limiting por endpoint
- [ ] Adicionar request validation em todos os endpoints
- [ ] Implementar CSRF protection
- [ ] Adicionar security headers:
  - Strict-Transport-Security
  - X-Content-Type-Options
  - X-Frame-Options
  - Content-Security-Policy
- [ ] Implementar input sanitization
- [ ] Review de SQL injection prevention
- [ ] Review de XSS prevention
- [ ] Implementar audit logging

#### 5.2 Infrastructure Security
**Tarefas:**
- [ ] Configurar secrets management (AWS Secrets Manager ou Vault)
- [ ] Remover secrets de .env para produção
- [ ] Implementar princípio de least privilege
- [ ] Configurar network security groups
- [ ] Implementar backup encryption
- [ ] Configurar log rotation e retention

#### 5.3 Security Scanning
**Tarefas:**
- [ ] Adicionar SAST no CI/CD (Bandit para Python, ESLint security para JS)
- [ ] Adicionar dependency scanning (Dependabot, Snyk)
- [ ] Adicionar container scanning
- [ ] Implementar DAST básico
- [ ] Criar processo de security review

**Estimativa:** 6-8 dias de implementação

---

### Fase 6: Observability & Monitoring (Semana 8)

#### 6.1 Logging
**Tarefas:**
- [ ] Implementar logging estruturado com `structlog` ou `loguru`
- [ ] Configurar diferentes níveis por ambiente
- [ ] Implementar correlation IDs para rastreamento
- [ ] Mascarar dados sensíveis em logs
- [ ] Centralizar logs (CloudWatch, Datadog, ELK)

#### 6.2 Metrics & Monitoring
**Tarefas:**
- [ ] Implementar health checks detalhados
- [ ] Adicionar métricas de aplicação (request rate, latency, errors)
- [ ] Configurar alertas para erros críticos
- [ ] Implementar uptime monitoring
- [ ] Criar dashboard de métricas

#### 6.3 Error Tracking
**Tarefas:**
- [ ] Integrar Sentry ou similar
- [ ] Configurar error grouping
- [ ] Implementar source maps para frontend
- [ ] Adicionar user context em errors
- [ ] Configurar alertas de error rate

**Estimativa:** 4-6 dias de setup

---

## Quick Wins

Itens que podem ser implementados rapidamente para melhorar o sistema:

### Backend (tempo total: ~6 horas)
1. **Rate Limiting** - 2 horas
   - Instalar `slowapi`
   - Adicionar decorator em endpoints sensíveis
   - Configurar limites por IP

2. **Security Headers** - 1 hora
   - Criar middleware de security headers
   - Adicionar ao app

3. **Logging Estruturado** - 2 horas
   - Instalar `loguru`
   - Configurar formatação e rotação
   - Adicionar em endpoints principais

4. **CORS Production Config** - 30 minutos
   - Separar config de desenvolvimento e produção
   - Restringir origins

5. **Input Validation** - 30 minutos
   - Review de schemas Pydantic
   - Adicionar validações faltando

### Frontend (tempo total: ~4 horas)
1. **Error Boundary** - 1 hora
   - Criar componente de error boundary
   - Adicionar em layout principal

2. **Loading States** - 1 hora
   - Criar componentes de skeleton
   - Adicionar em páginas principais

3. **Toast Notifications** - 1 hora
   - Instalar `react-hot-toast` ou `sonner`
   - Criar sistema de notificações

4. **Responsive Design Check** - 1 hora
   - Review de responsividade
   - Ajustes de breakpoints

### DevOps (tempo total: ~2 horas)
1. **GitHub Actions Básico** - 1 hora
   - Workflow de teste automatizado
   - Lint check

2. **Docker Compose Production** - 1 hora
   - Criar docker-compose.prod.yml
   - Configurações de produção

---

## Dependências e Tecnologias Necessárias

### Backend - Novas dependências
```txt
# Autenticação
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Rate Limiting
slowapi==0.1.9

# Logging
loguru==0.7.2

# Validação
email-validator==2.1.0
```

### Frontend - Novas dependências
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "@tanstack/react-query": "^5.17.0",
    "recharts": "^2.10.0",
    "sonner": "^1.3.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0"
  }
}
```

### DevOps
- GitHub Actions (gratuito para repositórios públicos)
- Docker Hub ou GitHub Container Registry (gratuito)
- Plataforma de hosting a definir (Railway, Fly.io, AWS, GCP)

---

## Critérios de Aceitação do MVP

### Funcionalidades Core
- [ ] Usuário consegue se registrar e fazer login
- [ ] Usuário consegue buscar alimentos por nome/categoria
- [ ] Usuário consegue registrar refeições
- [ ] Usuário consegue ver dashboard com resumo nutricional
- [ ] Usuário consegue receber recomendações baseadas no perfil
- [ ] Usuário consegue fazer upload de foto de alimento (se modelo disponível)
- [ ] Sistema está protegido com autenticação
- [ ] Todos os endpoints têm rate limiting

### Qualidade
- [ ] Cobertura de testes > 80%
- [ ] Todos os testes passando no CI
- [ ] Zero vulnerabilidades críticas em dependências
- [ ] Logs estruturados implementados
- [ ] Error tracking configurado

### Deploy
- [ ] Pipeline de CI/CD funcionando
- [ ] Deploy automatizado para staging
- [ ] Ambiente de produção configurado
- [ ] Backups automatizados configurados
- [ ] Monitoramento básico implementado

### Segurança
- [ ] HTTPS enforced
- [ ] Security headers implementados
- [ ] Secrets gerenciados corretamente (não em .env)
- [ ] Rate limiting em todos os endpoints públicos
- [ ] Audit logging de ações sensíveis

### Documentação
- [ ] README atualizado com setup completo
- [ ] API documentation completa (OpenAPI/Swagger)
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## Riscos e Mitigações

### Risco 1: Complexidade do Modelo DETIC
**Impacto:** Alto
**Probabilidade:** Média

**Mitigação:**
- Implementar fallback mode sem análise de imagem
- Considerar APIs alternativas (Google Cloud Vision, AWS Rekognition)
- MVP pode ser lançado sem análise de imagem inicialmente

### Risco 2: Performance com Volume de Dados
**Impacto:** Médio
**Probabilidade:** Alta (com crescimento)

**Mitigação:**
- Implementar caching com Redis
- Adicionar indexes otimizados no banco
- Implementar pagination em todas as listagens
- Monitorar queries lentas

### Risco 3: Custo de Hosting
**Impacto:** Médio
**Probabilidade:** Média

**Mitigação:**
- Começar com tier gratuito (Railway, Fly.io)
- Implementar auto-scaling apenas quando necessário
- Otimizar queries e caching para reduzir carga

### Risco 4: Compliance (LGPD/GDPR)
**Impacto:** Alto
**Probabilidade:** Alta (para lançamento público)

**Mitigação:**
- Implementar CRUD completo de dados do usuário
- Adicionar funcionalidade de export de dados
- Implementar delete account com limpeza de dados
- Criar política de privacidade
- Adicionar consent management

---

## Estimativas de Esforço Total

| Fase | Estimativa (dias úteis) | Semanas |
|------|-------------------------|---------|
| Fase 1: Fundação de Segurança | 8-12 | 1.5-2.5 |
| Fase 2: Frontend Core | 10-15 | 2-3 |
| Fase 3: Food Analysis | 5-7 | 1-1.5 |
| Fase 4: DevOps & CI/CD | 5-7 | 1-1.5 |
| Fase 5: Security Hardening | 6-8 | 1-2 |
| Fase 6: Observability | 4-6 | 0.5-1 |
| **TOTAL** | **38-55 dias** | **7.5-11 semanas** |

**Nota:** Estimativas assumem 1 desenvolvedor full-time. Com equipe maior, fases podem ser paralelizadas.

---

## Próximos Passos Imediatos

1. **Decisão de Stack de Deploy**
   - Avaliar opções: Railway, Fly.io, AWS, GCP, DigitalOcean
   - Considerar custo, facilidade de uso, e escalabilidade

2. **Priorização de Features**
   - Validar com stakeholders quais features são essenciais
   - Confirmar se Food Analysis é bloqueador ou nice-to-have

3. **Setup de Repositórios**
   - Garantir acesso adequado
   - Configurar branch protection
   - Definir workflow de desenvolvimento (gitflow, trunk-based)

4. **Início da Implementação**
   - Começar pela Fase 1 (Authentication)
   - Implementar Quick Wins em paralelo
   - Setup inicial de CI/CD

---

## Referências

- [docs/PROJECT_STATUS.md](./PROJECT_STATUS.md) - Status detalhado da implementação
- [docs/TRACKING_SYSTEM.md](./TRACKING_SYSTEM.md) - Sistema de tracking de refeições
- [docs/TRACKING_QUICKSTART.md](./TRACKING_QUICKSTART.md) - Quickstart do sistema
- [README.md](../README.md) - Documentação principal do projeto
