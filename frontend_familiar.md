# PROMPT — FRONTEND | Aplicativo privado de comunicação familiar

## Objetivo
Crie o frontend responsivo de um aplicativo privado para um responsável conversar com seu filho menor de idade, por mensagens em tempo real e chamadas de voz/vídeo pela internet. O app deve ser instalável no celular (PWA) e oferecer notificações push em dispositivos compatíveis.

**Stack obrigatória:**
- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui
- Lucide React
- Supabase JS Client (Auth, Database e Realtime)
- WebRTC para chamadas de áudio e vídeo
- PWA com manifest e service worker

O backend Supabase, as tabelas, RLS e Edge Functions serão implementados em uma tarefa separada. Integre-se ao contrato descrito neste prompt e ao schema efetivamente entregue pelo backend.

## 1. Diretrizes de produto e segurança
- Aplicativo familiar privado, simples e acolhedor, sem aparência de rede social.
- Somente responsável e filho vinculados à mesma família podem conversar e realizar chamadas.
- Não criar busca pública de usuários, contatos desconhecidos, grupos abertos, feed, seguidores ou publicidade.
- Não solicitar localização, lista de contatos, câmera ou microfone antes de o usuário iniciar uma ação que precise desses recursos.
- Não gravar chamadas nem capturar áudio/vídeo em segundo plano.
- Exibir claramente os estados de chamada e os indicadores de microfone/câmera.
- Não mostrar conteúdo sensível de mensagens nas notificações de tela bloqueada; usar texto genérico.
- Não permitir que a interface infantil acesse configurações administrativas do responsável.
- Tratar erros de rede, permissões negadas e sessão expirada de forma clara.

## 2. Design system
Crie uma interface premium, amigável e minimalista:
- Layout mobile-first, totalmente responsivo para celular, tablet e desktop.
- Tailwind CSS para estilos e shadcn/ui para componentes.
- Use cards com cantos suaves, espaçamento confortável, tipografia legível e ícones Lucide.
- Paleta sugerida: fundo claro neutro, azul/índigo como cor primária, verde para estados positivos e vermelho apenas para encerrar/recusar.
- Contraste acessível, foco visível, navegação por teclado e áreas de toque grandes.
- Evite excesso de elementos, menus complexos e animações que atrapalhem a usabilidade.
- Em celular, use navegação inferior simples; em telas maiores, use sidebar compacta.
- Não use hamburger como única forma de navegação mobile.

## 3. Perfis e navegação
A aplicação terá dois papéis:
- `guardian`: responsável adulto.
- `child`: filho.

Após login, carregar perfil e vínculo familiar do usuário. Direcionar para a experiência correspondente ao papel.

### Navegação comum
- Conversa
- Chamadas recentes
- Perfil / dispositivos
- Ajuda

### Área do responsável
- Conversa com o filho
- Iniciar chamada de voz
- Iniciar chamada de vídeo
- Gerenciar convite/vínculo da conta infantil
- Preferências de notificação
- Dispositivos conectados e opção de revogar dispositivo/sessão, conforme suporte do backend

### Área infantil
- Conversa com o responsável
- Atender/recusar chamada recebida
- Iniciar chamada de voz ou vídeo
- Histórico simples de chamadas
- Perfil básico e preferências permitidas

Não exiba ações administrativas ao perfil infantil. A autorização real deve continuar no backend/RLS; esconder botões não é controle de segurança.

## 4. Telas obrigatórias
Implemente as seguintes telas com estados de carregamento, vazio e erro:

1. **Boas-vindas**
   - Explicação curta: espaço privado para conversar com a família.
   - Botões “Entrar” e “Criar conta”.

2. **Cadastro e login**
   - E-mail e senha, com validação.
   - Recuperação de senha.
   - Mensagens de erro claras.
   - Não armazenar senha manualmente no localStorage.

3. **Vincular conta infantil**
   - Campo para inserir código de convite fornecido pelo responsável.
   - Mostrar confirmação do vínculo antes de concluir.
   - Tratar convite inválido, expirado ou já utilizado.
   - O token deve ser enviado ao backend para validação; não validar apenas no cliente.

4. **Início / conversa**
   - Cabeçalho com nome e avatar da pessoa vinculada.
   - Mensagens em balões diferenciados por remetente.
   - Horário das mensagens.
   - Campo de texto, botão enviar e estado de envio.
   - Paginação do histórico ao rolar para cima.
   - Indicador de conexão/reconexão.
   - Estado vazio amigável.
   - Atualização em tempo real via Supabase Realtime.
   - Prevenir mensagens duplicadas e preservar ordem.

5. **Tela de chamada recebida**
   - Identificar quem está chamando e se é áudio ou vídeo.
   - Botões grandes “Atender” e “Recusar”.
   - Somente solicitar permissões necessárias ao atender.
   - Se o navegador não suportar a função, explicar a limitação e oferecer alternativa de abrir em navegador compatível.

6. **Tela de chamada ativa**
   - Para áudio: avatar, nome, duração, estado da conexão e controles de microfone/alto-falante quando suportados.
   - Para vídeo: vídeo remoto em destaque e prévia local menor.
   - Controles para ligar/desligar câmera, silenciar microfone, alternar câmera frontal/traseira em dispositivos compatíveis e encerrar.
   - Mostrar estados: chamando, conectando, conectado, reconectando, encerrado e falha.
   - Tratar permissões negadas, dispositivo sem câmera/microfone, falha de ICE e perda de rede.
   - Encerrar tracks de mídia e fechar RTCPeerConnection ao finalizar a chamada ou sair da tela.
   - Nunca iniciar captura de mídia sem ação explícita do usuário.

7. **Histórico de chamadas**
   - Lista com tipo (voz/vídeo), participante, data, duração quando disponível e resultado.
   - Estados: atendida, perdida, recusada e cancelada.
   - Não exibir dados de outros membros/famílias.

8. **Configurações**
   - Nome e avatar, se suportado.
   - Preferências de push.
   - Gerenciar permissão de notificações com instruções quando o navegador bloquear.
   - Dispositivos/sessões, quando suportado pelo backend.
   - Sair da conta.

9. **Painel do responsável**
   - Estado do vínculo familiar.
   - Gerar/renovar convite de uso único.
   - Exibir código apenas no momento da criação e permitir copiar/compartilhar com cuidado.
   - Revogar convite pendente.
   - Desativar acesso infantil com confirmação explícita.
   - Não exibir dados desnecessários do menor.

## 5. Integração Supabase
- Criar um módulo central `lib/supabase.ts`.
- Usar variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Nunca incluir `service_role`, VAPID private key ou credenciais TURN secretas no frontend.
- Implementar hooks/serviços separados para auth, perfil, família, mensagens, chamadas e notificações.
- Consultar apenas dados permitidos pelo RLS.
- Usar Supabase Realtime para novas mensagens e sinalização de chamada privada.
- Remover subscriptions ao desmontar componentes.
- Tratar sessão expirada, reconexão e erros.
- Não simular segurança apenas com rotas protegidas; o backend deve autorizar cada operação.

## 6. WebRTC — chamadas de voz e vídeo
Implemente um serviço reutilizável `webrtcService`:
- `getUserMedia` somente após clique em iniciar/atender.
- `RTCPeerConnection` com configuração ICE obtida de configuração pública segura e credenciais TURN temporárias/seguras conforme backend.
- Criar e receber SDP offer/answer.
- Enviar e receber ICE candidates pelo canal privado de sinalização.
- Adicionar tracks locais e renderizar streams remotos.
- Implementar estados de conexão e recuperação.
- Tratar `ontrack`, `onicecandidate`, `onconnectionstatechange` e encerramento.
- Liberar câmera/microfone (`MediaStreamTrack.stop`) e fechar conexão em todos os caminhos de saída.
- Evitar múltiplas chamadas simultâneas para a mesma conversa.
- Não implementar gravação, captura de tela ou transmissão em segundo plano.
- Documentar que a conectividade depende de STUN/TURN configurados no backend. Supabase Realtime não é servidor de mídia.

## 7. PWA e notificações no celular
- Criar `manifest.webmanifest` com nome, ícones, cores e `display: standalone`.
- Criar service worker para recursos PWA e recebimento de push.
- Criar tela/fluxo para instalar o app, sem insistir se o navegador não oferecer instalação.
- Implementar inscrição Web Push com permissão explícita do usuário.
- Registrar subscription no backend por Edge Function.
- Permitir desativar notificações e remover subscription.
- Tratar clique na notificação e navegar para a conversa ou tela de chamada apropriada.
- Não incluir texto da mensagem ou informações íntimas no payload de push.
- Mostrar aviso de compatibilidade: push e instalação dependem do navegador, sistema operacional e instalação do PWA. No iPhone/iPad, Web Push requer versão compatível do iOS/iPadOS e o app adicionado à Tela de Início; não prometa funcionamento universal.
- Para chamadas recebidas, explicar que notificações web não garantem comportamento idêntico a uma ligação telefônica quando o navegador/app está fechado ou suspenso. Não prometer chamadas confiáveis em segundo plano em todos os celulares.

## 8. Componentes sugeridos
Organize componentes reutilizáveis:
- `AppShell`, `MobileBottomNav`, `DesktopSidebar`
- `AuthForm`, `InviteCodeForm`
- `ChatHeader`, `MessageList`, `MessageBubble`, `MessageComposer`
- `IncomingCallDialog`, `ActiveAudioCall`, `ActiveVideoCall`, `CallControls`
- `CallHistoryList`
- `NotificationPermissionCard`, `InstallAppBanner`
- `GuardianFamilyPanel`, `DeviceSessionsPanel`
- `LoadingState`, `EmptyState`, `ErrorState`, `OfflineBanner`

Use componentes shadcn/ui como Button, Card, Input, Textarea, Dialog, AlertDialog, Avatar, Badge, Tabs, DropdownMenu, Tooltip, Separator, Skeleton e Toast/Sonner conforme necessário.

## 9. Organização sugerida
```text
src/
  components/
    auth/
    chat/
    calls/
    layout/
    notifications/
    family/
    ui/
  pages/
  hooks/
  lib/
    supabase.ts
    auth.ts
    messages.ts
    family.ts
    calls.ts
    webrtcService.ts
    push.ts
  types/
  routes/
  App.tsx
  main.tsx
public/
  manifest.webmanifest
  icons/
  service-worker.js
```

## 10. Qualidade, testes e entrega
- TypeScript estrito; evitar `any`.
- Componentes pequenos e reutilizáveis.
- Layout testado em larguras mobile, tablet e desktop.
- Testar login, logout, convite inválido, vínculo, envio/recebimento de mensagens, permissões de câmera/microfone, chamada encerrada e push.
- Testar estados sem internet e reconexão.
- Não deixar botões sem ação.
- Não usar dados mockados na versão integrada; se usar mocks durante desenvolvimento, isolar e remover/desativar no build final.
- Criar `.env.example` apenas com variáveis públicas necessárias ao frontend.
- Incluir README com instalação, execução, build, deploy e configuração PWA.
- Não alterar telas ou funcionalidades existentes que não estejam diretamente relacionadas a este escopo.

## 11. Critérios de aceite
- Login e cadastro funcionam com Supabase Auth.
- O responsável consegue vincular a conta infantil por convite.
- Somente os membros vinculados conseguem trocar mensagens.
- Mensagens atualizam em tempo real.
- Chamadas de áudio e vídeo funcionam entre dispositivos distintos quando STUN/TURN e permissões estão configurados.
- Usuário consegue instalar o PWA em dispositivos compatíveis.
- Push é solicitado com consentimento e pode ser revogado.
- A interface infantil não mostra controles administrativos.
- Câmera e microfone são desligados ao terminar a chamada.
- O app informa limitações reais de push/chamadas em segundo plano, sem prometer disponibilidade que a plataforma não oferece.

**Importante:** priorize segurança, privacidade infantil, acessibilidade e funcionamento real. Não substitua integração por telas demonstrativas. Não exponha segredos no frontend.
