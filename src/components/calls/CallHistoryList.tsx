import React from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { Call } from '../../lib/calls';

interface CallHistoryListProps {
  calls: Call[];
  currentUserId: string;
  memberNames?: Record<string, string>;
}

function calculateDurationSeconds(startedAt?: string | null, endedAt?: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const diff = Math.floor((end - start) / 1000);
  return diff > 0 ? diff : null;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}min ${s}s`;
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'outline';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  ended: { label: 'Encerrada', variant: 'default' },
  accepted: { label: 'Atendida', variant: 'success' },
  rejected: { label: 'Recusada', variant: 'danger' },
  missed: { label: 'Perdida', variant: 'warning' },
  ringing: { label: 'Chamando', variant: 'outline' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
};

export const CallHistoryList: React.FC<CallHistoryListProps> = ({
  calls,
  currentUserId,
  memberNames = {},
}) => {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Phone className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Nenhuma chamada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {calls.map(call => {
        const isOutgoing = call.initiated_by === currentUserId;
        const isVideo = call.call_type === 'video';
        const status = statusConfig[call.status] ?? { label: call.status, variant: 'outline' as BadgeVariant };
        const durationSec = calculateDurationSeconds(call.answered_at ?? call.started_at, call.ended_at);
        const duration = formatDuration(durationSec);
        const peerName = memberNames[isOutgoing ? call.initiated_by : call.initiated_by] ?? 'Desconhecido';

        return (
          <div
            key={call.id}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
          >
            <div className="flex-shrink-0 text-gray-400">
              {call.status === 'missed' || call.status === 'rejected' ? (
                <PhoneMissed className="h-5 w-5 text-red-400" />
              ) : isOutgoing ? (
                <PhoneOutgoing className="h-5 w-5 text-indigo-500" />
              ) : (
                <PhoneIncoming className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {isVideo ? (
                    <Video className="inline h-3 w-3 mr-1 text-gray-400" />
                  ) : (
                    <Phone className="inline h-3 w-3 mr-1 text-gray-400" />
                  )}
                  {peerName}
                </p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-400">{formatDate(call.created_at)}</p>
                {duration && <p className="text-xs text-gray-400">· {duration}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

