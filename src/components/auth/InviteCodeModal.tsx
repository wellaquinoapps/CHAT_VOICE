import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { redeemInvite } from '../../lib/family';

interface InviteCodeModalProps {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onNeedAuth: () => void;
  onSuccess: () => void;
}

export const InviteCodeModal: React.FC<InviteCodeModalProps> = ({
  open,
  onClose,
  isAuthenticated,
  onNeedAuth,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onNeedAuth();
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await redeemInvite(code.trim());
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Código inválido ou expirado.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Código de convite">
      {!isAuthenticated && (
        <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 mb-4">
          Você precisa estar conectado para usar um código de convite.{' '}
          <button onClick={onNeedAuth} className="underline font-medium">
            Entrar agora
          </button>
        </p>
      )}
      <form onSubmit={handleRedeem} className="space-y-4">
        <Input
          label="Código de convite"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Cole o código recebido do responsável"
          required
          helperText="O código tem 64 caracteres e é válido por 48 horas."
        />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="flex-1" isLoading={isLoading}>
            Entrar na família
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

