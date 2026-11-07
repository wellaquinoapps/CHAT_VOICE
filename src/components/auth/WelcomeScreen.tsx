import React from 'react';
import { Shield, MessageCircle, Phone, Lock, Zap } from 'lucide-react';
import { Button } from '../ui/Button';

interface WelcomeScreenProps {
  onEnter?: () => void;
  onCreateAccount?: () => void;
  onInviteCode?: () => void;
  onSignInClick?: () => void;
  onSignUpClick?: () => void;
  onInviteCodeClick?: () => void;
}

const features = [
  { icon: <Lock className="h-4 w-4" />, text: 'Privacidade total' },
  { icon: <MessageCircle className="h-4 w-4" />, text: 'Chat em tempo real' },
  { icon: <Phone className="h-4 w-4" />, text: 'Voz e vídeo' },
  { icon: <Zap className="h-4 w-4" />, text: 'Funciona offline' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onEnter,
  onCreateAccount,
  onInviteCode,
  onSignInClick,
  onSignUpClick,
  onInviteCodeClick,
}) => {
  const handleEnter = onSignInClick ?? onEnter ?? (() => {});
  const handleCreate = onSignUpClick ?? onCreateAccount ?? (() => {});
  const handleInvite = onInviteCodeClick ?? onInviteCode ?? (() => {});
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PrivateLine</h1>
            <p className="text-gray-500 mt-1">Comunicação privada em família</p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-2">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100"
            >
              <span className="text-indigo-600">{f.icon}</span>
              <span className="text-sm text-gray-700 font-medium">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" onClick={handleEnter}>
            Entrar na minha conta
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={handleCreate}>
            Criar conta de responsável
          </Button>
          <div className="text-center">
            <button
              onClick={handleInvite}
              className="text-sm text-indigo-600 hover:text-indigo-800 underline-offset-4 hover:underline transition-colors"
            >
              Tenho um código de convite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
