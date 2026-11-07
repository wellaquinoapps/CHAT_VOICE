# Arquitetura e Fluxos do Sistema

Este documento descreve a topologia, os componentes e os diagramas de fluxo do backend para a comunicação familiar privada.

---

## 1. Visão Geral da Arquitetura

O sistema é baseado em uma arquitetura privada e isolada, construída com:
- **Supabase Auth**: Gerenciamento de credenciais e emissão de JWTs assinados.
- **PostgreSQL com RLS Estrito**: Isolamento total de tenant (família). Apenas membros ativos da mesma família autorizados podem consultar registros.
- **Supabase Realtime**: Notificação de novas mensagens e troca de sinais efêmeros WebRTC via publicação/assinatura segura.
- **Edge Functions (Deno runtime)**: Endpoints atômicos e protegidos para operações que exigem integridade transacional (ex: criação e resgate de convites, push notifications, emissão de credenciais TURN).
- **WebRTC Peer-to-Peer**: Transporte de áudio e vídeo de ponta a ponta criptografado (DTLS-SRTP). Nenhuma mídia passa ou é armazenada no Supabase.

```mermaid
flowchart TD
    subgraph DispositivoResponsavel["Dispositivo Responsável (Guardian)"]
        UI_G["React Frontend PWA"]
        RTC_G["WebRTC PeerConnection"]
        SW_G["Service Worker (Push)"]
    end

    subgraph DispositivoFilho["Dispositivo Filho (Child)"]
        UI_C["React Frontend PWA"]
        RTC_C["WebRTC PeerConnection"]
        SW_C["Service Worker (Push)"]
    end

    subgraph SupabaseCloud["Supabase Backend"]
        Auth["Supabase Auth"]
        DB[("PostgreSQL (RLS Habilitado)")]
        RT["Supabase Realtime Engine"]
        EF["Edge Functions (Deno)"]
    end

    subgraph InfraestruturaWebRTC["Infraestrutura WebRTC"]
        STUN["Servidores STUN (Google / Público)"]
        TURN["Servidor TURN (Coturn / Provedor Gerenciado)"]
    end

    subgraph ProvedoresPush["Notificações Push"]
        WebPush["Web Push Gateway (FCM/Apple/Mozilla)"]
    end

    UI_G -->|Auth / Login| Auth
    UI_C -->|Auth / Login| Auth
    UI_G -->|Consultas com RLS| DB
    UI_C -->|Consultas com RLS| DB
    UI_G <-->|Subscrição Realtime| RT
    UI_C <-->|Subscrição Realtime| RT
    UI_G -->|Ações Protegidas| EF
    UI_C -->|Ações Protegidas| EF

    EF -->|Disparo VAPID| WebPush
    WebPush -->|Entrega Push| SW_G
    WebPush -->|Entrega Push| SW_C

    RTC_G <-->|Sinalização SDP/ICE via Realtime| RTC_C
    RTC_G <-->|Mídia Direta DTLS-SRTP (P2P)| RTC_C
    RTC_G -.->|Relay de Mídia em Redes Restritas| TURN
    RTC_C -.->|Relay de Mídia em Redes Restritas| TURN
```

---

## 2. Fluxo de Autenticação e Vínculo Familiar

```mermaid
sequenceDiagram
    autonumber
    actor G as Responsável (Guardian)
    participant FE_G as App do Responsável
    participant EF as Edge Functions
    participant DB as PostgreSQL (RLS)
    actor C as Filho (Child)
    participant FE_C as App do Filho

    Note over G,FE_G: 1. Responsável cria conta e família
    G->>FE_G: Cadastro / Login
    FE_G->>DB: create_family_with_guardian("Família Silva")
    DB-->>FE_G: Família criada, usuário registrado como guardian

    Note over G,FE_G: 2. Geração do convite de uso único
    G->>FE_G: Clica em "Gerar Convite para Filho"
    FE_G->>EF: POST /create-family-invite { familyId }
    EF->>DB: rpc('generate_family_invite')
    Note over DB: Gera token de alta entropia (32 bytes)<br/>Grava apenas hash SHA-256 no banco
    DB-->>EF: Retorna token em texto claro 1x
    EF-->>FE_G: Token do convite
    G->>C: Fornece código do convite pessoalmente

    Note over C,FE_C: 3. Filho resgata o convite
    C->>FE_C: Cadastro / Login
    C->>FE_C: Insere código do convite
    FE_C->>EF: POST /redeem-family-invite { token }
    EF->>DB: rpc('redeem_family_invite')
    Note over DB: 1. Calcula SHA-256 do token<br/>2. Bloqueia linha (FOR UPDATE)<br/>3. Valida validade e se não foi usado<br/>4. Define perfil como child<br/>5. Insere em family_members<br/>6. Marca used_at = now()<br/>7. Cria conversa direta vinculando ambos
    DB-->>EF: Vínculo confirmado + conversationId
    EF-->>FE_C: Sucesso (Família Vinculada)
```

---

## 3. Fluxo de Mensagens em Tempo Real e Push

```mermaid
sequenceDiagram
    autonumber
    actor Emissor as Membro Emissor
    participant FE_E as App Emissor
    participant DB as PostgreSQL
    participant RT as Supabase Realtime
    participant EF as Edge Function (send-message-push)
    participant WPG as Web Push Service
    participant SW_R as Service Worker (Destinatário)
    actor Receptor as Membro Destinatário

    Emissor->>FE_E: Digita texto e envia
    FE_E->>DB: INSERT INTO messages (conversation_id, sender_id, body)
    Note over DB: RLS valida que sender_id = auth.uid()<br/>e usuário pertence à conversa
    DB-->>RT: Publica evento INSERT no canal messages
    RT-->>FE_E: Confirmação de envio

    par Atualização em Tempo Real (se online)
        RT->>Receptor: Transmite nova mensagem via WebSocket
    and Disparo de Notificação Push
        FE_E->>EF: POST /send-message-push { messageId }
        EF->>DB: Localiza destinatários e inscrições push ativas
        EF->>WPG: Dispara Web Push com VAPID assinado (Texto genérico: "Nova mensagem")
        WPG->>SW_R: Entrega notificação ao dispositivo
        SW_R->>Receptor: Notificação visível (sem vazar conteúdo confidencial na tela de bloqueio)
    end
```

---

## 4. Fluxo de Chamadas WebRTC e Sinalização

```mermaid
sequenceDiagram
    autonumber
    actor Chamador as Responsável / Filho
    participant App_A as Dispositivo Chamador
    participant EF as Edge Functions
    participant DB as Supabase DB / Realtime
    participant App_B as Dispositivo Chamado
    actor Chamado as Destinatário

    Chamador->>App_A: Clica em "Ligar (Voz ou Vídeo)"
    App_A->>EF: POST /create-call { conversationId, callType }
    EF->>DB: Cria registro em 'calls' (status: ringing)
    EF-->>App_A: Retorna callId

    par Notificação do Destinatário
        EF->>App_B: Dispara Push "Chamada recebida"
    and Sinalização Realtime
        DB->>App_B: Evento INSERT na tabela calls via Realtime
    end

    App_B->>Chamado: Toca aviso de chamada recebida com opções Atender/Recusar

    alt Chamado Atende
        Chamado->>App_B: Clica em "Atender"
        App_B->>EF: POST /get-turn-credentials
        EF-->>App_B: Retorna servidores STUN/TURN com credenciais temporárias
        App_A->>EF: POST /get-turn-credentials
        EF-->>App_A: Retorna servidores STUN/TURN com credenciais temporárias

        App_B->>EF: POST /update-call-status { callId, status: 'accepted' }

        Note over App_A,App_B: Troca de SDP Offer / Answer via call_signals
        App_A->>DB: INSERT INTO call_signals (type: 'offer', payload: sdp)
        DB->>App_B: Entrega Offer via Realtime
        App_B->>DB: INSERT INTO call_signals (type: 'answer', payload: sdp)
        DB->>App_A: Entrega Answer via Realtime

        Note over App_A,App_B: Troca de ICE Candidates via call_signals
        App_A<->App_B: Negociação de conectividade direta P2P (ou via TURN se restrito)

        Note over App_A,App_B: Conversa de áudio/vídeo em andamento (DTLS-SRTP Criptografada)
    else Chamado Recusa ou Desliga
        Chamado->>App_B: Clica em "Recusar" ou "Encerrar"
        App_B->>EF: POST /update-call-status { callId, status: 'rejected' ou 'ended' }
        DB->>App_A: Notifica encerramento via Realtime
        Note over App_A,App_B: Câmera e microfone são imediatamente liberados
    end
```

