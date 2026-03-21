# Sistema de Autenticação e Nova Interface - Nutri.a

## O que foi implementado

### Backend (nutria-backend)

1. **Better Auth configurado** seguindo melhores práticas 2026:
   - Session-based authentication (cookies) para segurança
   - Cookie caching para performance
   - Database sessions (LibSQL/SQLite) para controle completo
   - Campos customizados: `planType` e `avatarUrl`

2. **Arquivos criados**:
   - `/src/lib/auth.ts` - Configuração do Better Auth
   - `/src/lib/auth-routes.ts` - Handlers de autenticação
   - `/data/` - Diretório para banco de dados

3. **Rotas de API** (integradas ao Mastra):
   - `POST /auth/sign-up` - Registro de usuário
   - `POST /auth/sign-in/email` - Login
   - `POST /auth/sign-out` - Logout
   - `GET /auth/get-session` - Obter sessão atual
   - `GET /me` - Obter perfil do usuário autenticado

### Frontend (nutria-frontend)

1. **Cliente Better Auth**:
   - `/src/lib/auth-client.ts` - Cliente configurado para conectar ao backend

2. **Páginas de autenticação**:
   - `/src/app/login/page.tsx` - Página de login
   - `/src/app/register/page.tsx` - Página de registro

3. **Componentes de layout**:
   - `/src/components/layout/sidebar.tsx` - Sidebar com menu de navegação
   - `/src/components/layout/header.tsx` - Header com botão "Nova conversa"
   - `/src/components/ui/label.tsx` - Componente Label (Radix UI)

4. **Página de chat atualizada**:
   - Nova interface seguindo o design do `chat.png`
   - Tela inicial com logo, mensagem de boas-vindas e cards de sugestão
   - Sidebar com menu de navegação
   - Header com título e botão de nova conversa
   - Input redesenhado com botões de anexar arquivo e tirar foto
   - Proteção de rota (requer autenticação)

## Como testar

### 1. Iniciar o backend

```bash
cd nutria-backend
pnpm dev
```

O backend estará rodando em `http://localhost:4111`

### 2. Iniciar o frontend

```bash
cd nutria-frontend
pnpm dev
```

O frontend estará rodando em `http://localhost:3000`

### 3. Testar o fluxo de autenticação

1. Acesse `http://localhost:3000/chat`
2. Você será redirecionado para `http://localhost:3000/login`
3. Clique em "Criar conta" ou vá para `http://localhost:3000/register`
4. Preencha:
   - Nome completo
   - Email
   - Senha (mínimo 8 caracteres)
   - Confirmar senha
5. Clique em "Criar conta"
6. Você será redirecionado automaticamente para `/chat`
7. Verá a nova interface com:
   - Sidebar à esquerda com seu perfil
   - Menu de navegação
   - Tela inicial com logo e cards de sugestão
   - Input na parte inferior

### 4. Testar o chat

1. Clique em um dos cards de sugestão OU
2. Digite uma mensagem no input
3. Clique em "Enviar"
4. A interface mudará para mostrar a conversa

### 5. Testar logout

Atualmente o logout não está visível na UI. Para implementar:
- Adicionar botão de logout na sidebar ou no menu de configurações
- Chamar `signOut()` do auth-client

## Configuração de ambiente

### Backend (.env)

```env
# Opcional - já configurado com valores padrão
BETTER_AUTH_BASE_URL=http://localhost:4111
NODE_ENV=development
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4111
```

## Estrutura das cores (já configurada no globals.css)

- `--nutria-verde`: #9AAD54 (verde principal)
- `--nutria-laranja`: #E88C1F
- `--nutria-bege`: #F2DFD0
- `--nutria-vermelho`: #B81C1C
- `--nutria-bordo`: #5C1010 (texto principal)
- `--nutria-creme`: #F5F1EB (background)

## Próximos passos sugeridos

1. **Implementar outras páginas do menu**:
   - `/receitas` - Receitas saudáveis
   - `/metas` - Planejamento de metas
   - `/atividades` - Histórico de atividades
   - `/progresso` - Gráficos e estatísticas
   - `/configuracoes` - Configurações do usuário (incluindo logout)

2. **Melhorias no sistema de autenticação**:
   - Adicionar recuperação de senha
   - Adicionar verificação de email
   - Adicionar OAuth (Google, GitHub, etc.)
   - Adicionar edição de perfil (avatar, nome, etc.)

3. **Persistência de conversa**:
   - Salvar conversas no banco de dados por usuário
   - Listar conversas antigas na sidebar
   - Implementar "Nova conversa" corretamente

4. **Upload de avatar**:
   - Permitir upload de foto de perfil
   - Integrar com serviço de armazenamento (S3, Cloudinary, etc.)

5. **Integração com catalog API**:
   - Conectar as ferramentas do agente com o perfil do usuário
   - Personalizar recomendações baseadas no plano do usuário

## Tecnologias utilizadas

- **Backend**: Node.js, TypeScript, Mastra.ai, Better Auth, LibSQL
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Better Auth, Radix UI
- **Autenticação**: Better Auth (session-based, cookie caching)
- **Database**: SQLite (LibSQL) - pode ser migrado para Turso em produção

## Arquitetura de autenticação escolhida

Baseado em pesquisas de melhores práticas 2026:
- ✅ Session-based authentication (mais seguro que JWT para web apps)
- ✅ Cookie caching (evita consultas frequentes ao DB)
- ✅ Integrado no backend existente (não serviço separado)
- ✅ HttpOnly cookies (proteção contra XSS)
- ✅ CSRF protection habilitado
- ✅ Rate limiting habilitado

## Troubleshooting

### Erro de conexão com backend

Verifique se:
1. O backend está rodando em `http://localhost:4111`
2. O arquivo `.env.local` está configurado corretamente
3. Não há firewall bloqueando a porta 4111

### Erro ao criar conta

Verifique:
1. A senha tem pelo menos 8 caracteres
2. As senhas coincidem
3. O email não está já cadastrado

### Erro ao fazer login

Verifique:
1. O email e senha estão corretos
2. O usuário foi criado com sucesso
3. O banco de dados `./data/auth.db` existe

### Redirecionamento infinito

Se houver loop de redirecionamento:
1. Limpe os cookies do navegador
2. Reinicie o backend e frontend
3. Tente criar uma nova conta
