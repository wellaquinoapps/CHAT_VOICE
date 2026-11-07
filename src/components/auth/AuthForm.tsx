import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { signInWithEmail, signUpWithEmail, sendPasswordReset } from '../../lib/auth';

export type AuthMode = 'signin' | 'signup' | 'forgot-password';

interface AuthFormProps {
  initialMode?: AuthMode;
  onBack: () => void;
  onSuccess: () => void;
}

const titles: Record<AuthMode, string> = {
  signin: 'Entrar',
  signup: 'Criar conta',
  'forgot-password': 'Recuperar senha',
};

export const AuthForm: React.FC<AuthFormProps> = ({
  initialMode = 'signin',
  onBack,
  onSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onSuccess();
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
        onSuccess();
      } else {
        await sendPasswordReset(email);
        setSuccessMsg('Email de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">{titles[mode]}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {mode === 'signup' && (
            <Input
              label="Nome completo"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              required
              autoComplete="name"
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
          />
          {mode !== 'forgot-password' && (
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              helperText={mode === 'signup' ? 'Mínimo de 8 caracteres' : undefined}
            />
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {successMsg && (
            <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{successMsg}</p>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
            {titles[mode]}
          </Button>
        </form>

        <div className="text-center space-y-2 text-sm">
          {mode === 'signin' && (
            <>
              <button
                onClick={() => setMode('forgot-password')}
                className="text-indigo-600 hover:underline block w-full"
              >
                Esqueci minha senha
              </button>
            </>
          )}
          {mode !== 'forgot-password' && (
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-gray-600 hover:text-gray-900"
            >
              {mode === 'signin'
                ? 'Não tem conta? Criar uma'
                : 'Já tenho conta. Entrar'}
            </button>
          )}
          {mode === 'forgot-password' && (
            <button
              onClick={() => setMode('signin')}
              className="text-gray-600 hover:text-gray-900"
            >
              Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

