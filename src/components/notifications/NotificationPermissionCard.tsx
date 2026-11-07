import React, { useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription,
  registerServiceWorker,
} from '../../lib/push';

export const NotificationPermissionCard: React.FC = () => {
  const [supported] = useState(() => isPushNotificationSupported());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isIOS] = useState(() => /iP(hone|ad|od)/.test(navigator.userAgent));

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermissionState());
    getCurrentPushSubscription().then(sub => setIsSubscribed(!!sub));
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const reg = await registerServiceWorker();
      if (!reg) {
        throw new Error('Falha ao inicializar Service Worker. Tente fechar e abrir o app.');
      }
      const success = await subscribeToPushNotifications();
      if (success) {
        setIsSubscribed(true);
        setPermission('granted');
      } else {
        const currentPerm = getNotificationPermissionState();
        setPermission(currentPerm);
        if (currentPerm === 'granted') {
          // Permissão dada no sistema, mas inscrição falhou
          setErrorMessage('Permissão concedida no sistema, mas erro ao registrar credencial push.');
        }
      }
    } catch (err: unknown) {
      console.error('Error enabling notifications:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao ativar notificações.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      await unsubscribeFromPushNotifications();
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificações push</CardTitle>
          <CardDescription>Não suportado neste dispositivo ou navegador.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle>Notificações push</CardTitle>
            <CardDescription>Receba alertas de mensagens e chamadas</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isIOS && (
          <div className="flex gap-2 items-start bg-yellow-50 rounded-lg p-3 mb-3">
            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">
              No iOS, adicione este app à tela inicial como PWA para receber notificações.
            </p>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-3">
            {errorMessage}
          </p>
        )}

        {permission === 'denied' && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-3">
            Permissão negada. Acesse as configurações do navegador para habilitar.
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isSubscribed ? 'Notificações ativas' : 'Notificações desativadas'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              As mensagens não incluem texto por privacidade
            </p>
          </div>
          {isSubscribed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisable}
              isLoading={isLoading}
            >
              <BellOff className="h-4 w-4" />
              Desativar
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnable}
              isLoading={isLoading}
              disabled={permission === 'denied'}
            >
              <Bell className="h-4 w-4" />
              Ativar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

