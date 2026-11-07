import React, { useEffect, useState } from 'react';
import { Smartphone, Trash2, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { fetchUserDevices, revokeDevice } from '../../lib/family';

type UserDevice = {
  id: string;
  user_id: string;
  device_label: string;
  user_agent: string | null;
  last_seen_at: string;
  created_at: string;
};

export const DeviceSessionsPanel: React.FC = () => {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserDevices();
      setDevices(data as UserDevice[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    setError(null);
    try {
      await revokeDevice(deviceId);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao revogar dispositivo.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispositivos conectados</CardTitle>
        <CardDescription>Gerencie os dispositivos com acesso à sua conta</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Carregando...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nenhum dispositivo registrado.</p>
        ) : (
          <div className="space-y-2">
            {devices.map(device => (
              <div
                key={device.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <Smartphone className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {device.device_label || device.user_agent || 'Dispositivo desconhecido'}
                  </p>
                  {device.last_seen_at && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <p className="text-xs text-gray-400">
                        Visto em {new Date(device.last_seen_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  isLoading={revokingId === device.id}
                  onClick={() => handleRevoke(device.id)}
                  title="Revogar acesso"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
};

