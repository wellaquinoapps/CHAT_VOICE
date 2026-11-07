import React, { useState } from 'react';
import { Copy, Check, Users, UserPlus, PauseCircle, PlayCircle, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Dialog } from '../ui/Dialog';
import { supabase } from '../../lib/supabase';
import { setChildMemberStatus } from '../../lib/family';

// Usa /api/register-child (servidor local em dev, Vercel Serverless Function em produção)
const REGISTER_CHILD_ENDPOINT = '/api/register-child';
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
  // Invite code (legacy - requires SQL function deployed)
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Direct child registration
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [childName, setChildName] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [isRegisteringChild, setIsRegisteringChild] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // Generic
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Registrar filho diretamente via Edge Function ───────────────────────────
  const handleRegisterChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRegisterSuccess(null);
    if (!childName.trim() || !childEmail.trim() || !childPassword) return;

    setIsRegisteringChild(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch(REGISTER_CHILD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          familyId: family.id,
          childName: childName.trim(),
          childEmail: childEmail.trim().toLowerCase(),
          childPassword,
        }),
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        throw new Error(text || `Erro HTTP ${response.status}`);
      }

      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao cadastrar filho.');

      setRegisterSuccess(`✓ Conta de ${childName.trim()} criada! Login: ${childEmail.trim().toLowerCase()}`);
      setChildName('');
      setChildEmail('');
      setChildPassword('');
      onMembersChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar filho.';
      setError(msg);
    } finally {
      setIsRegisteringChild(false);
    }
  };

  // ── Código de convite (requer SQL function deployed) ───────────────────────
  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_family_invite', {
        p_family_id: family.id,
        p_expires_in_hours: 48,
      });
      if (rpcError) throw rpcError;
      setInviteToken(data.token);
      setInviteExpiry(data.expires_at);
    } catch (err: unknown) {
      setError(
        'Código de convite indisponível no momento. Use o cadastro direto acima.'
      );
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

      {/* ── CADASTRO DIRETO DO FILHO ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Adicionar filho</CardTitle>
              <CardDescription>Crie a conta do seu filho diretamente aqui</CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setShowAddChildModal(true); setError(null); setRegisterSuccess(null); }}
            >
              <UserPlus className="h-4 w-4" />
              Cadastrar filho
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ── CÓDIGO DE CONVITE (alternativa) ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Código de convite</CardTitle>
              <CardDescription>Alternativa: gere um código para o filho usar no app</CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateInvite}
              isLoading={isGenerating}
            >
              Gerar código
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

      {/* ── LISTA DE FILHOS ───────────────────────────────────────────────────── */}
      {children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filhos cadastrados</CardTitle>
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
                    <Avatar name={(profile as any)?.display_name ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {(profile as any)?.display_name ?? 'Sem nome'}
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

      {/* ── MODAL CADASTRO DO FILHO ───────────────────────────────────────────── */}
      <Dialog
        open={showAddChildModal}
        onClose={() => setShowAddChildModal(false)}
        title="Cadastrar conta do filho"
      >
        <form onSubmit={handleRegisterChild} className="space-y-4">
          <p className="text-sm text-gray-500">
            Preencha as informações abaixo para criar a conta do seu filho.
            Ele usará este e-mail e senha para fazer login.
          </p>

          <Input
            label="Nome do filho"
            type="text"
            value={childName}
            onChange={e => setChildName(e.target.value)}
            placeholder="Ex: João Silva"
            required
            autoComplete="off"
          />
          <Input
            label="E-mail do filho"
            type="email"
            value={childEmail}
            onChange={e => setChildEmail(e.target.value)}
            placeholder="filho@email.com"
            required
            autoComplete="off"
            helperText="Pode ser um e-mail criado por você para ele"
          />
          <Input
            label="Senha"
            type="password"
            value={childPassword}
            onChange={e => setChildPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            autoComplete="new-password"
            helperText="Anote essa senha para dar ao seu filho"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {registerSuccess && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{registerSuccess}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowAddChildModal(false)}
            >
              Fechar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={isRegisteringChild}
            >
              Criar conta
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
