# Relatório de Auditoria de Segurança e Privacidade

Este documento detalha a revisão e auditoria técnica de segurança aplicada ao backend do aplicativo de comunicação familiar privada, em conformidade com as diretrizes do projeto e legislações de proteção de dados de menores (LGPD/COPPA).

---

## 1. Princípios e Modelo de Ameaças

O sistema foi modelado contra as seguintes ameaças principais:
1. **Acesso não autorizado por terceiros**: Um usuário cadastrado não pode descobrir outras famílias, membros ou mensagens.
2. **Escalação de privilégios da conta infantil**: Uma criança não pode se autopromover a responsável, gerar convites ou alterar vínculos.
3. **Sequestro ou reutilização de convites**: Tokens de convite devem ser de uso único, com alta entropia, expiração automática e nunca armazenados em texto claro.
4. **Vazamento de metadados em notificações**: Conteúdo de mensagens íntimas não pode ser exposto em telas de bloqueio de celulares.
5. **Gravação ou interceptação de chamadas**: O tráfego multimídia deve ser direto e criptografado de ponta a ponta (DTLS-SRTP), sem armazenamento de áudio/vídeo nos servidores.
6. **Vazamento de credenciais privilegiadas**: `SUPABASE_SERVICE_ROLE_KEY` e segredos TURN nunca devem ser expostos ao bundle do frontend.

---

## 2. Auditoria de Row Level Security (RLS)

Todas as tabelas do schema possuem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` ativado compulsoriamente.

| Tabela | RLS Habilitado | Permissão de Leitura (SELECT) | Permissão de Escrita (INSERT/UPDATE/DELETE) |
|---|:---:|---|---|
| `profiles` | Sim | Próprio usuário ou membros da mesma família ativa | Apenas próprio usuário (proibida alteração do campo `role`) |
| `families` | Sim | Membros ativos da família | Criar: Responsável; Editar: Responsável; Excluir: Criador |
| `family_members` | Sim | Membros ativos da mesma família | Inserção controlada; Edição de status apenas por responsável |
| `family_invites` | Sim | **Apenas responsáveis**. Bloqueado para crianças e estranhos | Apenas responsáveis da respectiva família |
| `conversations` | Sim | Membros da conversa | Membros ativos da família |
| `conversation_members` | Sim | Membros da conversa | Membros da família |
| `messages` | Sim | Membros da conversa | Membros da conversa com `sender_id = auth.uid()` |
| `calls` | Sim | Membros da conversa | Início: Membro com `initiated_by = auth.uid()`; Status: Participantes |
| `call_signals` | Sim | Apenas remetente ou destinatário intencional | Apenas remetente para chamada autorizada |
| `push_subscriptions` | Sim | Apenas o próprio usuário (`user_id = auth.uid()`) | Apenas o próprio usuário |
| `user_devices` | Sim | Próprio usuário ou responsável da família | Próprio usuário ou responsável revogando dispositivo |

### Funções de Segurança (`SECURITY DEFINER`)
As funções `is_active_family_member`, `is_active_guardian` e `is_conversation_member` utilizam:
- `SECURITY DEFINER`: Permite avaliar permissões de forma determinística sem entrar em loop de recursão RLS infinita.
- `SET search_path = public`: Previne ataques de injeção de caminho de busca (Search Path Hijacking).
- `STABLE`: Otimização pelo planejador de consultas do PostgreSQL em subconsultas de RLS.

---

## 3. Segurança no Mecanismo de Convites

- **Entropia Criptográfica**: O token de convite gerado é composto por 32 bytes aleatórios (`gen_random_bytes(32)`), totalizando 64 caracteres hexadecimais (256 bits de entropia). É matematicamente inviável advinhar por força bruta.
- **Armazenamento de Hash**: Apenas o hash SHA-256 do token é armazenado no banco de dados (`token_hash = digest(token, 'sha256')`). Mesmo que um invasor obtivesse leitura do banco, não conseguiria resgatar o token em texto claro.
- **Uso Único e Bloqueio Atômico**: A função RPC `redeem_family_invite` executa `SELECT ... FOR UPDATE` para garantir bloqueio transacional de linha, impedindo ataques de corrida (race conditions) em caso de múltiplos envios simultâneos. O campo `used_at` é gravado imediatamente.

---

## 4. Auditoria de Privacidade e Minimização de Dados (Child Safety)

- **Dados Coletados de Menores**: Não são solicitados dados sensíveis desnecessários, como endereço residencial, localização por GPS, telefone celular do menor ou lista de contatos do dispositivo.
- **Push Notifications Seguras**: A função `send-message-push` envia textos genéricos como `"Você recebeu uma mensagem na sua conversa familiar"`, **sem** expor o texto ou remetente na tela bloqueada do celular do menor.
- **Inexistência de Mídia no Backend**: Nenhuma foto de chamada, gravação de áudio ou vídeo é salva no banco de dados. Os sinais em `call_signals` são limitados estritamente a 32 KB e são excluídos periodicamente.

---

## 5. Auditoria de Segredos e Bundle Frontend

- O arquivo `.env.example` foi estruturado separando estritamente:
  - Variáveis públicas do Vite (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`).
  - Segredos das Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `TURN_STATIC_AUTH_SECRET`).
- O servidor TURN utiliza credenciais efêmeras baseadas em HMAC-SHA1 distribuídas pela função `get-turn-credentials` sob demanda para usuários autenticados. Nenhuma chave mestra do TURN é inserida no frontend.

