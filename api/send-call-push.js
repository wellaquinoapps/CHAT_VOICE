import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contato@privateline.local',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { callId } = req.body || {};
    if (!callId) return res.status(400).json({ error: 'callId é obrigatório' });

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Buscar a chamada e conversa
    const { data: call } = await adminClient
      .from('calls')
      .select('*, conversations(*)')
      .eq('id', callId)
      .single();

    if (!call || call.status !== 'ringing') {
      return res.status(200).json({ message: 'Chamada encerrada ou inexistente' });
    }

    // 2. Buscar o nome do iniciador
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', call.initiated_by)
      .single();

    const callerName = callerProfile?.display_name || 'Alguém da família';

    // 3. Buscar membros da conversa para notificar (exceto quem ligou)
    const { data: members } = await adminClient
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', call.conversation_id)
      .neq('user_id', call.initiated_by);

    if (!members || members.length === 0) return res.status(200).json({ message: 'Nenhum membro a notificar' });

    const targetUserIds = members.map(m => m.user_id);

    // 4. Buscar inscrições push dos destinatários
    const { data: subscriptions } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'Nenhuma inscrição push encontrada' });
    }

    const payload = JSON.stringify({
      title: '📞 Chamada recebida!',
      body: `${callerName} está chamando você...`,
      callId: call.id,
      callType: call.call_type,
      tag: `call-${call.id}`,
    });

    // 5. Disparar Web Push para cada aparelho
    const promises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      return webpush.sendNotification(pushSubscription, payload, {
        TTL: 60, // 60 segundos de urgência
        urgency: 'high',
      }).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Inscrição expirada, remove do banco
          adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
      });
    });

    await Promise.all(promises);

    return res.status(200).json({ success: true, count: subscriptions.length });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}

