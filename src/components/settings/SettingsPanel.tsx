import React, { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NotificationPermissionCard } from '../notifications/NotificationPermissionCard';
import { DeviceSessionsPanel } from '../family/DeviceSessionsPanel';
import { InstallAppBanner } from '../notifications/InstallAppBanner';
import { supabase } from '../../lib/supabase';

interface SettingsPanelProps {
  userName?: string;
  userEmail?: string;
  onSignOut: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  userName,
  userEmail,
  onSignOut,
}) => {
  const [displayName, setDisplayName] = useState(userName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado.');
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id);
      if (error) throw error;
      setSaveMsg('Nome atualizado com sucesso!');
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <InstallAppBanner />

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <CardTitle>Perfil</CardTitle>
              <CardDescription>{userEmail}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-3">
            <Input
              label="Nome de exibição"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              required
            />
            {saveMsg && <p className="text-sm text-green-600">{saveMsg}</p>}
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
              Salvar nome
            </Button>
          </form>
        </CardContent>
      </Card>

      <NotificationPermissionCard />

      <DeviceSessionsPanel />

      {/* Signout */}
      <div className="pt-2">
        <Button variant="danger" size="lg" className="w-full" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

