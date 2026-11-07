# Configuração de Infraestrutura STUN e TURN

## 1. Por que STUN sozinho NÃO é suficiente?

O protocolo **WebRTC** foi desenhado prioritariamente para tráfego direto P2P (Peer-to-Peer) entre navegadores. Para que dois celulares se comuniquem diretamente na Internet:
- O servidor **STUN** (Session Traversal Utilities for NAT) permite que o dispositivo descubra seu IP público e porta externa mapeada pelo seu roteador ou operadora móvel.
- **Entretanto**, em redes móveis (4G/5G com CGNAT - Carrier-Grade NAT) e redes Wi-Fi corporativas ou residenciais com NAT Simétrico, as portas externas mudam dinamicamente a cada novo destino. Nesses cenários, o STUN **falha em mais de 15% a 25% das tentativas de conexão**.
- O servidor **TURN** (Traversal Using Relays around NAT) atua como um servidor de relay intermediário dedicado. Se o caminho direto P2P for impossível de ser estabelecido, o áudio e vídeo criptografados (DTLS-SRTP) são encaminhados com baixa latência pelo servidor TURN.

> **Importante:** Sem um servidor TURN configurado, chamadas entre celular em 4G e computador/celular em Wi-Fi frequentemente falham ou ficam sem áudio/vídeo. O Supabase Realtime serve **apenas para sinalização de texto**, nunca para streaming de mídia.

---

## 2. Opção 1: Coturn Autogerenciado (Recomendado para Produção Privada)

O **Coturn** é o servidor TURN de código aberto mais utilizado mundialmente.

### 2.1. Requisitos de Servidor
- Uma VPS com IP público dedicado (ex: Hetzner, DigitalOcean, AWS Lightsail, Linode) - custo aprox. \$4 a \$5/mês.
- Portas liberadas no Firewall:
  - `3478 UDP/TCP` (STUN/TURN padrão)
  - `5349 TCP` (TURN TLS/TURNS - opcional com SSL)
  - `49152:65535 UDP` (Portas de relay de mídia)

### 2.2. Executando Coturn via Docker
Crie o arquivo `docker-compose.yml` na sua VPS:

```yaml
version: '3.8'

services:
  coturn:
    image: coturn/coturn:latest
    container_name: coturn-server
    restart: always
    network_mode: "host"
    environment:
      - DETECT_EXTERNAL_IP=yes
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf:ro
```

### 2.3. Configuração do `turnserver.conf`
Crie o arquivo `turnserver.conf`:

```conf
# Endereço e portas de escuta
listening-port=3478
tls-listening-port=5349

# Habilitar fingerprint e mecanismo de longo prazo
fingerprint
lt-cred-mech

# Segredo compartilhado estático para autenticação de credenciais efêmeras baseadas em tempo (HMAC-SHA1)
# Gere uma chave aleatória segura: openssl rand -hex 32
use-auth-secret
static-auth-secret=sua_chave_secreta_longa_e_aleatoria_aqui

# Domínio / Realm
realm=turn.suafamilia.com

# Faixa de portas de relay
min-port=49152
max-port=65535

# Logs
verbose
no-cli
```

Inicie o container:
```bash
docker compose up -d
```

### 2.4. Integração com a Edge Function do Projeto
Nas variáveis de ambiente das Edge Functions do Supabase:
```bash
npx supabase secrets set \
  TURN_URLS="turn:turn.suafamilia.com:3478?transport=udp,turn:turn.suafamilia.com:3478?transport=tcp" \
  TURN_STATIC_AUTH_SECRET="sua_chave_secreta_longa_e_aleatoria_aqui"
```
A Edge Function `get-turn-credentials` gera automaticamente tokens temporários com HMAC-SHA1 assinados para cada usuário autenticado, válidos por 1 hora. **A chave mestra jamais é exposta ao navegador.**

---

## 3. Opção 2: Provedores Gerenciados (Sem manutenção de servidor)

Se você preferir não manter uma VPS, pode usar serviços que oferecem cota gratuita:

### 3.1. Metered Video (Recomendado - 50GB/mês grátis)
1. Crie uma conta em [metered.ca](https://www.metered.ca/tools/openrelay/).
2. Copie suas credenciais de TURN:
   - URL: `turn:openrelay.metered.ca:80`
   - Username: `openrelayproject`
   - Credential: `openrelayproject`
3. Configure nas Edge Functions:
   ```bash
   npx supabase secrets set \
     TURN_URLS="turn:openrelay.metered.ca:80,turn:openrelay.metered.ca:443" \
     TURN_USERNAME="openrelayproject" \
     TURN_CREDENTIAL="openrelayproject"
   ```

### 3.2. Twilio Network Traversal Service
1. Crie uma conta no Twilio.
2. Ative o serviço **Network Traversal**.
3. Obtenha os servidores ICE ou configure a chave de API na Edge Function.

---

## 4. Testando a Conectividade TURN

Para validar se o seu servidor TURN está funcionando antes de conectar o app:
1. Abra a ferramenta oficial [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).
2. Em **STUN or TURN URI**, adicione sua URL: `turn:turn.suafamilia.com:3478`.
3. Preencha o usuário e credencial gerados.
4. Clique em **Gather candidates**.
5. Se aparecer candidatos do tipo **relay**, seu servidor TURN está 100% operacional.

