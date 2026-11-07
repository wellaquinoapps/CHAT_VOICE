# Guia de Configuração e Implantação do Backend

Este documento detalha o passo a passo para configurar, migrar, testar e implantar a infraestrutura de backend do aplicativo de comunicação familiar privada no **Supabase**.

---

## 1. Estrutura de Arquivos Entregue

```text
CHAT_VOICE/
├── supabase/
│   ├── migrations/
│   │   ├── 20261107000001_initial_schema.sql     # Tabelas, enums, constraints e triggers
│   │   ├── 20261107000002_rls_policies.sql        # Funções de segurança e RLS policies
│   │   ├── 20261107000003_functions_and_rpcs.sql   # RPCs atômicas (convites, vínculo)
│   │   └── 20261107000004_realtime_setup.sql      # Configuração de publicação Realtime
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts                            # Headers CORS reutilizáveis
│   │   │   ├── supabaseClient.ts                  # Fábricas de clientes (User e Admin)
│   │   │   └── webpush.ts                         # Envio seguro de Web Push com VAPID
│   │   ├── create-family-invite/                  # Geração de convite de uso único
│   │   ├── redeem-family-invite/                  # Vínculo da conta infantil
│   │   ├── create-call/                           # Início de chamada WebRTC
│   │   ├── update-call-status/                    # Transição de status da chamada
│   │   ├── register-push-subscription/            # Registro de Web Push subscription
│   │   ├── send-message-push/                     # Disparo de notificação de mensagem
│   │   ├── send-incoming-call-push/               # Disparo de notificação de chamada
│   │   ├── revoke-device/                         # Revogação de sessão de dispositivo
│   │   └── get-turn-credentials/                  # Entrega segura de credenciais TURN
│   └── tests/
│       └── rls_isolation_tests.sql                # Bateria de testes SQL de isolamento
├── src/
│   └── types/
│       └── database.types.ts                      # Tipos TypeScript estritos do schema
├── docs/
│   ├── BACKEND_SETUP.md                           # Este guia
│   ├── ARCHITECTURE.md                            # Diagramas de arquitetura e fluxos
│   ├── TURN_SETUP.md                              # Guia de implantação STUN/TURN
│   └── SECURITY_AUDIT.md                          # Auditoria e validação de segurança
└── .env.example                                   # Modelo de variáveis de ambiente
```

---

## 2. Pré-requisitos
- Conta no [Supabase](https://supabase.com).
- Node.js 18+ instalado.
- Supabase CLI instalado ou executável via `npx supabase`.

---

## 3. Configuração do Projeto Supabase

### 3.1. Criar Projeto
1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e crie um novo projeto (ex: `chat-familiar`).
2. Anote a **Database Password**, a **Project URL** e a chave pública **Anon Key**.

### 3.2. Executar as Migrations SQL
Você pode rodar as migrations de duas formas:

#### Opção A: Pelo Dashboard (SQL Editor)
Abra a aba **SQL Editor** no painel do Supabase e execute o conteúdo dos arquivos na ordem:
1. `supabase/migrations/20261107000001_initial_schema.sql`
2. `supabase/migrations/20261107000002_rls_policies.sql`
3. `supabase/migrations/20261107000003_functions_and_rpcs.sql`
4. `supabase/migrations/20261107000004_realtime_setup.sql`

#### Opção B: Via Supabase CLI
```bash
# Vincular o repositório local ao projeto Supabase
npx supabase link --project-ref <seu-project-ref>

# Aplicar todas as migrations pendentes
npx supabase db push
```

---

## 4. Configuração do Supabase Auth

No painel do Supabase, acesse **Authentication -> Providers**:
1. **Email Provider**:
   - Habilitar `Enable Email provider`.
   - Recomenda-se desativar "Confirm email" em ambiente de desenvolvimento/testes locais, ou manter ativo em produção garantindo templates de e-mail seguros.
2. Em **Authentication -> URL Configuration**:
   - Defina a **Site URL** do seu frontend (ex: `https://meu-app-familiar.com` ou `http://localhost:5173`).
   - Adicione Redirect URLs necessárias (ex: `http://localhost:5173/**`).

---

## 5. Configuração do Supabase Realtime

As migrations já configuram a publicação `supabase_realtime` para as tabelas `messages`, `calls` e `call_signals`.
Para conferir no painel:
1. Vá em **Database -> Publications**.
2. Clique em `supabase_realtime`.
3. Certifique-se de que as tabelas `messages`, `calls` e `call_signals` estão listadas como publicadas.

---

## 6. Geração das Chaves VAPID (Web Push)

Para que o backend possa autenticar notificações push sem expor senhas:
```bash
# Gerar par de chaves VAPID
npx web-push generate-vapid-keys
```
A saída será parecida com:
```text
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjS5Snfyzj0n26n0UT_FYgoe35e-6W-h44fe4

Private Key:
vS8P... (sua chave privada)
```

1. Coloque a **Public Key** no `.env` do frontend (`VITE_VAPID_PUBLIC_KEY`).
2. Configure a **Public Key** e a **Private Key** nos segredos do Supabase Edge Functions.

---

## 7. Configuração e Deploy das Edge Functions

### 7.1. Configurar Segredos no Supabase
Execute no terminal ou adicione na aba **Project Settings -> Edge Functions -> Secrets**:
```bash
npx supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key" \
  VAPID_PUBLIC_KEY="sua-vapid-public-key" \
  VAPID_PRIVATE_KEY="sua-vapid-private-key" \
  VAPID_SUBJECT="mailto:contato@suafamilia.com" \
  STUN_URLS="stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302" \
  TURN_URLS="turn:turn.seu-servidor.com:3478" \
  TURN_STATIC_AUTH_SECRET="seu-segredo-coturn"
```

### 7.2. Fazer Deploy das Funções
```bash
npx supabase functions deploy create-family-invite --no-verify-jwt
npx supabase functions deploy redeem-family-invite --no-verify-jwt
npx supabase functions deploy create-call --no-verify-jwt
npx supabase functions deploy update-call-status --no-verify-jwt
npx supabase functions deploy register-push-subscription --no-verify-jwt
npx supabase functions deploy send-message-push --no-verify-jwt
npx supabase functions deploy send-incoming-call-push --no-verify-jwt
npx supabase functions deploy revoke-device --no-verify-jwt
npx supabase functions deploy get-turn-credentials --no-verify-jwt
```
*(Nota: As funções tratam o token JWT do usuário no cabeçalho `Authorization` diretamente, aplicando RLS rigoroso no PostgreSQL).*

---

## 8. Execução dos Testes Automatizados de Isolamento RLS

Para validar que nenhuma família tem acesso aos dados de outra família e que perfis infantis não conseguem escalar privilégios:
1. Abra o **SQL Editor** no Supabase Dashboard.
2. Carregue o arquivo `supabase/tests/rls_isolation_tests.sql`.
3. Clique em **RUN**.
4. Verifique os resultados na saída da tabela temporária `test_results`. Todos os 5 testes devem retornar `passed = true`.

