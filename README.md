# CHAT_VOICE — Aplicativo Privado de Comunicação Familiar

Sistema privado e seguro de comunicação familiar (responsável e filho menor de idade), suportando mensagens em tempo real, chamadas de voz e vídeo (WebRTC), notificações Web Push (VAPID) e instalação PWA.

---

## 📁 Estrutura do Backend (Supabase)

O backend foi implementado seguindo rigorosamente os requisitos de [backend_familiar.md](backend_familiar.md):

```text
CHAT_VOICE/
├── supabase/
│   ├── migrations/
│   │   ├── 20261107000001_initial_schema.sql       # Tabelas, enums, triggers e constraints
│   │   ├── 20261107000002_rls_policies.sql          # Row Level Security (RLS) completo e comentado
│   │   ├── 20261107000003_functions_and_rpcs.sql     # Stored procedures atômicas (convites, resgate)
│   │   └── 20261107000004_realtime_setup.sql        # Publicação Supabase Realtime para mensagens e chamadas
│   ├── functions/
│   │   ├── _shared/                                 # Utilitários CORS, Supabase Clients e WebPush VAPID
│   │   ├── create-family-invite/                    # Geração de convite de uso único com hash SHA-256
│   │   ├── redeem-family-invite/                    # Vínculo da conta infantil com trava atômica
│   │   ├── create-call/                             # Iniciação de chamadas WebRTC
│   │   ├── update-call-status/                      # Atualização de estado da chamada
│   │   ├── register-push-subscription/              # Inscrição de dispositivo para Web Push
│   │   ├── send-message-push/                       # Push de mensagem sem vazar conteúdo sensível
│   │   ├── send-incoming-call-push/                 # Push de chamada recebida
│   │   ├── revoke-device/                           # Revogação de dispositivo por responsável
│   │   └── get-turn-credentials/                    # Emissão segura de credenciais temporárias TURN
│   └── tests/
│       └── rls_isolation_tests.sql                  # Testes SQL automatizados de isolamento RLS
├── src/
│   └── types/
│       └── database.types.ts                        # Tipos TypeScript estritos gerados do schema
├── docs/
│   ├── BACKEND_SETUP.md                             # Guia completo de configuração e deploy
│   ├── ARCHITECTURE.md                              # Diagramas de arquitetura, auth, mensagens e chamadas
│   ├── TURN_SETUP.md                                # Configuração de STUN/TURN (Coturn / Provedor)
│   └── SECURITY_AUDIT.md                            # Auditoria de segurança e privacidade infantil
└── .env.example                                     # Modelo de variáveis de ambiente
```

---

## 🚀 Como Iniciar

1. Consulte o [Guia de Configuração e Implantação](docs/BACKEND_SETUP.md) para instruções detalhadas.
2. Copie `.env.example` para `.env` e preencha as credenciais do seu projeto Supabase.
3. Aplique as migrations no seu banco PostgreSQL do Supabase via Dashboard (SQL Editor) ou Supabase CLI:
   ```bash
   npx supabase db push
   ```
4. Execute os testes de isolamento de segurança contidos em [supabase/tests/rls_isolation_tests.sql](supabase/tests/rls_isolation_tests.sql).
5. Para saber mais sobre como hospedar ou configurar o servidor TURN para redes móveis 4G/5G, leia [docs/TURN_SETUP.md](docs/TURN_SETUP.md).
