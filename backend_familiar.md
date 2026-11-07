# PROMPT — BACKEND | Aplicativo privado de comunicação familiar

## Objetivo
Implemente o backend de um aplicativo privado para comunicação entre responsável e filho menor de idade. O sistema permitirá mensagens em tempo real, chamadas de voz e vídeo pela internet, notificações no celular e instalação como PWA.

**Stack obrigatória:** Supabase (PostgreSQL, Auth, Realtime, Storage e Edge Functions quando necessário). O frontend será React + TypeScript + Tailwind CSS + shadcn/ui.

Trate este projeto como um ambiente familiar privado, com segurança e privacidade como requisitos prioritários. Não implemente recursos de rede social pública.

## 1. Arquitetura e princípios
- Use Supabase Auth para autenticação.
- Use PostgreSQL para persistência e Supabase Realtime para atualização de mensagens e sinalização de chamadas.
- Use WebRTC para transportar áudio e vídeo diretamente entre dispositivos.
- **Não transporte áudio/vídeo pelo Supabase Realtime.** O Realtime será usado apenas para sinalização (oferta, resposta, ICE candidates, estado da chamada).
- Configure STUN e TURN. Use variáveis de ambiente para credenciais TURN; nunca exponha segredos no frontend. Documente opções de implantação de TURN (por exemplo, coturn ou provedor gerenciado).
- O tráfego WebRTC deve usar os mecanismos de criptografia do próprio WebRTC (DTLS-SRTP). Não grave chamadas por padrão.
- Não crie descoberta pública de usuários, busca de pessoas, grupos abertos, feed, seguidores ou mensagens de desconhecidos.
- A comunicação deve ocorrer somente entre membros explicitamente vinculados à mesma família.
- Não confie em validações feitas apenas no frontend.

## 2. Modelo de usuários e vínculo familiar
Crie suporte a dois papéis:
- `guardian`: responsável adulto, que cria e administra o espaço familiar.
- `child`: conta infantil vinculada por convite de uso único emitido pelo responsável.

Regras:
- O responsável cria o espaço familiar e gera um convite de uso único, com validade configurável e código/token aleatório de alta entropia.
- O convite deve ser armazenado de forma segura (preferencialmente hash do token), expirar e ser invalidado após o uso.
- A associação da conta infantil deve exigir autenticação e validação do convite no servidor.
- Não permita que uma conta infantil convide usuários, altere seu papel, remova o responsável ou vincule outras famílias.
- O responsável pode revogar sessões/dispositivos e desativar o acesso da conta infantil.
- Preveja fluxo de recuperação de acesso administrado pelo responsável, sem permitir que qualquer pessoa reivindique a conta.
- Evite coletar dados desnecessários de menores. Não solicite endereço, localização, contatos ou data de nascimento completa sem necessidade funcional.

## 3. Banco de dados
Crie migrations SQL versionadas e documentadas para, no mínimo, as tabelas abaixo. Use UUIDs, `created_at`, índices e constraints apropriados.

### `profiles`
- `id` UUID, PK e FK para `auth.users.id`
- `display_name`
- `avatar_path` opcional
- `role` (`guardian` ou `child`)
- `created_at`, `updated_at`

### `families`
- `id`
- `name`
- `created_by` FK para profiles
- `created_at`

### `family_members`
- `id`
- `family_id`
- `user_id`
- `member_role`
- `status` (active/disabled)
- `created_at`
- Constraint para impedir associação duplicada do mesmo usuário à mesma família.

### `family_invites`
- `id`
- `family_id`
- `token_hash`
- `expires_at`
- `used_at`
- `created_by`
- `created_at`
- Nunca retorne `token_hash` em consultas do cliente.

### `conversations`
- `id`
- `family_id`
- `conversation_type` (direct)
- `created_at`

### `conversation_members`
- `conversation_id`
- `user_id`
- PK composta.

### `messages`
- `id`
- `conversation_id`
- `sender_id`
- `body` (texto simples no MVP)
- `message_type` (text)
- `created_at`
- `edited_at` opcional
- `deleted_at` opcional
- Índice composto por conversa e data.
- Valide tamanho máximo de mensagem no banco/servidor.

### `calls`
- `id`
- `family_id`
- `conversation_id`
- `initiated_by`
- `call_type` (audio/video)
- `status` (ringing/accepted/rejected/missed/ended/cancelled)
- `started_at`
- `answered_at`
- `ended_at`
- `created_at`

### `call_signals`
Use apenas se necessário para sinalização persistida. Se usar, armazene tipo, payload limitado, remetente, chamada e timestamp; remova sinais antigos por rotina. Alternativamente, use canais privados efêmeros do Supabase Realtime. Nunca armazene mídia.

### `push_subscriptions`
- `id`
- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `device_label` opcional
- `created_at`, `updated_at`
- Restrinja a leitura/alteração ao próprio usuário e às operações autorizadas do servidor.

### `user_devices` (opcional)
- `id`, `user_id`, `device_label`, `last_seen_at`, `created_at`.

## 4. Segurança e Row Level Security (RLS)
Habilite RLS em todas as tabelas expostas pela API. Crie policies explícitas e testes para cada caso.

Requisitos mínimos:
- Um usuário só pode ler dados de famílias das quais é membro ativo.
- Somente membros da conversa podem ler mensagens daquela conversa.
- Um usuário só pode inserir mensagem como ele próprio e em conversa da qual participa.
- Não permita alterar `sender_id`, `family_id`, `role`, `status` ou campos protegidos por meio de updates do cliente.
- Somente o responsável autorizado pode criar/revogar convites e administrar membros da sua família.
- Uma conta infantil não pode promover usuários, criar convites, alterar papéis ou acessar dados de outra família.
- Sinalização de chamadas deve ser privada e limitada aos participantes da chamada.
- Usuários só podem gerenciar suas próprias inscrições de push.
- Não exponha `service_role` no navegador. Use-a exclusivamente em Edge Functions/ambiente confiável.
- Valide autorização também nas Edge Functions.
- Adicione proteção contra abuso: limites de tamanho, frequência de mensagens, convites e chamadas; valide payloads.
- Não registre conteúdo de mensagens, tokens de convite ou credenciais em logs.
- Inclua testes SQL/automatizados que comprovem isolamento entre famílias e bloqueio de acesso não autorizado.

## 5. Mensagens em tempo real
- Persistir mensagens no banco.
- Publicar novos registros por Supabase Realtime somente para os membros autorizados.
- Ordenar mensagens por `created_at` e paginação por cursor (não carregar histórico ilimitado).
- Tratar reconexão, mensagens duplicadas e falhas de rede.
- O backend deve rejeitar mensagens de usuários não participantes.
- No MVP, mensagens de texto. Deixe anexos e envio de arquivos fora do escopo inicial, salvo se forem implementados com validação e limites rigorosos.

## 6. Chamadas de voz e vídeo com WebRTC
Implemente a infraestrutura de sinalização:
- Criar chamada de áudio ou vídeo apenas entre participantes autorizados.
- Enviar/receber SDP offer, SDP answer e ICE candidates em canal privado ou tabela protegida.
- Validar que emissor e destinatário pertencem à mesma conversa/família.
- Atualizar estados: ringing, accepted, rejected, missed, ended e cancelled.
- Tratar chamada recusada, não atendida, encerrada, perda de conexão, troca de rede e encerramento de sessão.
- Não aceitar payloads de sinalização excessivamente grandes; validar formato e tamanho.
- Definir expiração/limpeza de chamadas antigas e sinais obsoletos.
- Fornecer configuração de STUN/TURN por variáveis de ambiente. TURN é necessário para conexões em redes restritivas; documente que STUN sozinho não garante conectividade.
- Não implementar gravação, transcrição ou monitoramento de áudio/vídeo.

## 7. Notificações push
- Implementar registro e remoção de subscriptions Web Push por dispositivo.
- Usar VAPID e manter a chave privada apenas no backend/ambiente seguro.
- Criar Edge Function para disparar notificações quando houver nova mensagem ou chamada recebida.
- A notificação deve conter o mínimo de informação sensível. Preferir textos genéricos como “Você recebeu uma mensagem” e “Chamada recebida”, sem incluir o conteúdo da mensagem na tela bloqueada.
- Respeitar preferências de notificação e não enviar push para o dispositivo que originou a ação.
- Tratar subscriptions expiradas/inválidas e removê-las.
- Não enviar notificações para usuários desativados ou sem vínculo familiar ativo.

## 8. Edge Functions / endpoints sugeridos
Implemente apenas os necessários, com autenticação, validação e respostas consistentes:
- `create-family-invite`
- `redeem-family-invite`
- `create-call`
- `update-call-status`
- `register-push-subscription`
- `send-message-push`
- `send-incoming-call-push`
- `revoke-device` (se aplicável)

Não crie endpoints públicos que permitam enumerar contas ou famílias.

## 9. Configuração e documentação
Entregue:
1. Migrations SQL completas e ordenadas.
2. Policies RLS comentadas.
3. Edge Functions com validação e tratamento de erros.
4. Tipos TypeScript gerados/compatíveis com o schema.
5. `.env.example` sem valores secretos, incluindo:
   - Supabase URL e anon key (frontend)
   - VAPID public key (frontend, se necessário)
   - VAPID private key (somente backend)
   - TURN URLs, username e credential (somente conforme estratégia segura)
6. Instruções de configuração do Supabase Auth, Realtime, Storage (se usado), VAPID e TURN.
7. Instruções de deploy e testes.
8. Diagrama simples do fluxo de autenticação, mensagens, push e chamadas.

## 10. Critérios de aceite
- Usuário sem vínculo familiar não consegue consultar família, mensagens, chamadas ou sinalização.
- Criança não consegue criar convites ou alterar permissões.
- Mensagens chegam em tempo real e permanecem no histórico.
- Chamadas de áudio e vídeo funcionam entre dois dispositivos em redes diferentes, com fallback TURN configurado.
- Push funciona em dispositivos compatíveis após permissão explícita.
- Nenhum segredo privilegiado está no bundle frontend.
- Nenhuma chamada é gravada.
- Todas as tabelas relevantes têm RLS habilitado e policies testadas.

**Importante:** antes de finalizar, revise as migrations e policies como uma auditoria de segurança. Não substitua RLS por verificações apenas no frontend. Não faça alterações em recursos não relacionados.
