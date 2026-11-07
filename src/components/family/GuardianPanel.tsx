import React, { useEffect, useState } from 'react';
import { Copy, Check, Users, UserPlus, PauseCircle, PlayCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { generateInvite, setChildMemberStatus } from '../../lib/family';
import type { Family, FamilyMember } from '../../lib/family';

interface GuardianPanelProps {
  family: Family;
  members: FamilyMember[];
  currentUserId: string;
  onMembersChanged: () => void;
}

export const GuardianPanel: React.FC<GuardianPanelProps> = ({
  family,
  members,
  currentUserId,
  onMembersChanged,
}) => {
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateInvite(family.id, 48);
      setInviteToken(result.token);
      setInviteExpiry(result.expires_at);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar convite.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteToken) return;
    await navigator.clipboard.writeText(inviteToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleStatus = async (member: FamilyMember) => {
    setTogglingId(member.id);
    setError(null);
    try {
      const newStatus = member.status === 'active' ? 'disabled' : 'active';
      await setChildMemberStatus(family.id, member.user_id, newStatus);
      onMembersChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar acesso.');
    } finally {
      setTogglingId(null);
    }
  };

  const children = members.filter(m => m.member_role === 'child');

  return (
    <div className="space-y-4">
      {/* Family info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle>{family.name}</CardTitle>
              <CardDescription>{members.length} membro{members.length !== 1 ? 's' : ''}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Invite */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Convidar criança</CardTitle>
              <CardDescription>Gere um link de convite para adicionar um membro</CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateInvite}
              isLoading={isGenerating}
            >
              <UserPlus className="h-4 w-4" />
              Gerar
            </Button>
          </div>
        </CardHeader>
        {inviteToken && (
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700 break-all mb-2">
              {inviteToken}
            </div>
            {inviteExpiry && (
              <p className="text-xs text-gray-400 mb-2">
                Expira em: {new Date(inviteExpiry).toLocaleString('pt-BR')}
              </p>
            )}
            <Button
              variant={copied ? 'success' : 'outline'}
              size="sm"
              onClick={handleCopy}
              className="w-full"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar código'}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Members */}
      {children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Crianças</CardTitle>
            <CardDescription>Gerencie o acesso de cada membro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {children.map(member => {
                const isCurrentUser = member.user_id === currentUserId;
                const profile = member.profile;
                const isActive = member.status === 'active';

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50"
                  >
                    <Avatar name={profile?.display_name ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {profile?.display_name ?? 'Sem nome'}
                      </p>
                      <Badge variant={isActive ? 'success' : 'danger'}>
                        {isActive ? 'Ativo' : 'Suspenso'}
                      </Badge>
                    </div>
                    {!isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={togglingId === member.id}
                        onClick={() => handleToggleStatus(member)}
                        title={isActive ? 'Suspender acesso' : 'Reativar acesso'}
                      >
                        {isActive ? (
                          <PauseCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <PlayCircle className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}
    </div>
  );
};

