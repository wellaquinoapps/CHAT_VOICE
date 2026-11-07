import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { getCurrentUserProfile, signOutUser, type Profile } from './lib/auth';
import { getUserFamilyData, createFamily, type Family, type FamilyMember, type Conversation } from './lib/family';
import { fetchMessages, sendMessage, subscribeToMessages, type Message } from './lib/messages';
import { initiateCall, updateCallStatus, subscribeToCalls, fetchCallHistory, type Call } from './lib/calls';
import { registerServiceWorker } from './lib/push';

// Layout & UI
import { AppShell } from './components/layout/AppShell';
import type { NavTab } from './components/layout/MobileBottomNav';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

// Screens & Panels
import { WelcomeScreen } from './components/auth/WelcomeScreen';
import { AuthForm, type AuthMode } from './components/auth/AuthForm';
import { InviteCodeModal } from './components/auth/InviteCodeModal';
import { ChatHeader } from './components/chat/ChatHeader';
import { MessageList } from './components/chat/MessageList';
import { MessageComposer } from './components/chat/MessageComposer';
import { IncomingCallModal } from './components/calls/IncomingCallModal';
import { ActiveCallScreen } from './components/calls/ActiveCallScreen';
import { CallHistoryList } from './components/calls/CallHistoryList';
import { GuardianPanel } from './components/family/GuardianPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';

export function App() {
  // Auth state
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Auth flow screens
  const [unauthScreen, setUnauthScreen] = useState<'welcome' | 'auth' | 'invite'>('welcome');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Invite code modal (overlay on top of auth)
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Family & conversation state
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [peerProfile, setPeerProfile] = useState<Profile | null>(null);

  // App Navigation Tab
  const [activeTab, setActiveTab] = useState<NavTab>('chat');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

  // Calls state
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);

  // Create Family Modal (for new guardians)
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [isCreatingFamily, setIsCreatingFamily] = useState(false);

  // 1. Initial Auth Check and Service Worker registration
  useEffect(() => {
    registerServiceWorker();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile();
      } else {
        setIsAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile();
      } else {
        setProfile(null);
        setFamily(null);
        setConversation(null);
        setIsAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserProfile = async () => {
    setIsAuthLoading(true);
    try {
      const userProf = await getCurrentUserProfile();
      setProfile(userProf);
      if (userProf) {
        await loadFamilyData(userProf);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loadFamilyData = async (userProf: Profile) => {
    const familyData = await getUserFamilyData();
    if (familyData) {
      setFamily(familyData.family);
      setMembers(familyData.members);
      setConversation(familyData.conversation);

      const otherMember = familyData.members.find((m) => m.user_id !== userProf.id);
      setPeerProfile((otherMember?.profile as Profile) ?? null);

      if (familyData.conversation) {
        loadChatMessages(familyData.conversation.id);
        loadCallHistoryData(familyData.conversation.id);
      }
    } else {
      if (userProf.role === 'guardian') {
        setShowCreateFamilyModal(true);
      } else {
        setShowInviteModal(true);
      }
    }
  };

  const loadChatMessages = async (convId: string) => {
    try {
      const fetched = await fetchMessages(convId, 30);
      setMessages(fetched);
      setHasMoreMessages(fetched.length === 30);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  const loadMoreMessages = async () => {
    if (!conversation || messages.length === 0 || isLoadingMoreMessages) return;
    setIsLoadingMoreMessages(true);
    try {
      const oldestMsgDate = messages[0].created_at;
      const older = await fetchMessages(conversation.id, 20, oldestMsgDate);
      setMessages((prev) => [...older, ...prev]);
      setHasMoreMessages(older.length === 20);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  const loadCallHistoryData = async (convId: string) => {
    try {
      const history = await fetchCallHistory(convId);
      setCallHistory(history);
    } catch (e) {
      console.error('Failed to load call history:', e);
    }
  };

  // 2. Realtime Subscriptions
  useEffect(() => {
    if (!conversation || !profile) return;

    const unsubMessages = subscribeToMessages(
      conversation.id,
      (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      },
      (updatedMsg) => {
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
      },
      (deletedId) => {
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      }
    );

    const unsubCalls = subscribeToCalls(
      conversation.id,
      (newCall) => {
        if (newCall.status === 'ringing' && newCall.initiated_by !== profile.id) {
          setIncomingCall(newCall);
        }
        loadCallHistoryData(conversation.id);
      },
      (updatedCall) => {
        const ended = ['ended', 'rejected', 'missed', 'cancelled'].includes(updatedCall.status);
        if (ended) {
          setIncomingCall((current) => (current?.id === updatedCall.id ? null : current));
          setActiveCall((current) => (current?.id === updatedCall.id ? null : current));
        } else {
          setActiveCall((current) => (current?.id === updatedCall.id ? updatedCall : current));
        }
        loadCallHistoryData(conversation.id);
      }
    );

    return () => {
      unsubMessages();
      unsubCalls();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, profile?.id]);

  // Actions
  const handleSendMessage = async (text: string) => {
    if (!conversation) return;
    await sendMessage(conversation.id, text);
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!conversation) return;
    try {
      const call = await initiateCall(conversation.id, type);
      setActiveCall(call);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert(`Falha ao iniciar chamada: ${msg}`);
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const updated = await updateCallStatus(incomingCall.id, 'accepted');
      setActiveCall(updated);
      setIncomingCall(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert(`Falha ao atender: ${msg}`);
    }
  };

  const handleRejectIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await updateCallStatus(incomingCall.id, 'rejected');
      setIncomingCall(null);
    } catch (e) {
      console.error(e);
      setIncomingCall(null);
    }
  };

  const handleHangUpActiveCall = () => {
    // ActiveCallScreen handles status update internally
    setActiveCall(null);
  };

  const handleCreateFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setIsCreatingFamily(true);
    try {
      await createFamily(newFamilyName.trim());
      setShowCreateFamilyModal(false);
      if (profile) loadFamilyData(profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert(`Erro: ${msg}`);
    } finally {
      setIsCreatingFamily(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setSessionUser(null);
    setProfile(null);
    setFamily(null);
    setUnauthScreen('welcome');
  };

  // Build member names map for chat/calls
  const memberNames: Record<string, string> = {};
  for (const m of members) {
    if (m.profile && 'display_name' in m.profile && m.profile.display_name) {
      memberNames[m.user_id] = m.profile.display_name as string;
    }
  }

  // ─── Loading Screen ───────────────────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center animate-pulse shadow-lg shadow-indigo-200">
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-4">Carregando ambiente seguro...</p>
      </div>
    );
  }

  // ─── Unauthenticated Screens ──────────────────────────────────────────────
  if (!sessionUser || !profile) {
    if (unauthScreen === 'welcome') {
      return (
        <>
          <WelcomeScreen
            onSignInClick={() => { setAuthMode('signin'); setUnauthScreen('auth'); }}
            onSignUpClick={() => { setAuthMode('signup'); setUnauthScreen('auth'); }}
            onInviteCodeClick={() => setShowInviteModal(true)}
          />
          <InviteCodeModal
            open={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            isAuthenticated={!!sessionUser}
            onNeedAuth={() => { setShowInviteModal(false); setAuthMode('signin'); setUnauthScreen('auth'); }}
            onSuccess={() => loadUserProfile()}
          />
        </>
      );
    }

    if (unauthScreen === 'auth') {
      return (
        <AuthForm
          initialMode={authMode}
          onBack={() => setUnauthScreen('welcome')}
          onSuccess={() => loadUserProfile()}
        />
      );
    }

    return null;
  }

  // ─── Create Family Modal (Guardian without family) ────────────────────────
  if (showCreateFamilyModal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/60 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Criar Espaço Familiar</h2>
            <p className="text-xs text-slate-500 mt-1">
              Dê um nome para o espaço privado da sua família (ex: "Família Silva").
            </p>
          </div>
          <form onSubmit={handleCreateFamilySubmit} className="space-y-4">
            <Input
              label="Nome da Família"
              placeholder="Ex: Família Silva"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              disabled={isCreatingFamily}
              required
            />
            <Button type="submit" size="lg" className="w-full" isLoading={isCreatingFamily}>
              Criar Espaço Familiar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const isGuardian = profile.role === 'guardian';

  // ─── Authenticated App ────────────────────────────────────────────────────
  return (
    <>
      <AppShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isGuardian={isGuardian}
        userName={profile.display_name ?? undefined}
        onSignOut={handleSignOut}
      >
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <ChatHeader
              peerName={peerProfile?.display_name ?? family?.name}
              peerAvatar={null}
              peerOnline={false}
              onVoiceCall={() => handleStartCall('audio')}
              onVideoCall={() => handleStartCall('video')}
            />
            <MessageList
              messages={messages}
              currentUserId={profile.id}
              hasMore={hasMoreMessages}
              isLoadingMore={isLoadingMoreMessages}
              onLoadMore={loadMoreMessages}
              memberNames={memberNames}
            />
            <MessageComposer
              onSend={handleSendMessage}
              disabled={!conversation}
            />
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Histórico de chamadas</h2>
            <CallHistoryList
              calls={callHistory}
              currentUserId={profile.id}
              memberNames={memberNames}
            />
          </div>
        )}

        {activeTab === 'family' && isGuardian && family && (
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Gerenciar família</h2>
            <GuardianPanel
              family={family}
              members={members}
              currentUserId={profile.id}
              onMembersChanged={() => loadFamilyData(profile)}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Configurações</h2>
            <SettingsPanel
              userName={profile.display_name ?? undefined}
              userEmail={sessionUser?.email as string | undefined}
              onSignOut={handleSignOut}
            />
          </div>
        )}
      </AppShell>

      {/* Invite code modal for authenticated user without family */}
      <InviteCodeModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        isAuthenticated
        onNeedAuth={() => {}}
        onSuccess={() => loadUserProfile()}
      />

      {/* Incoming Call Modal Overlay */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          callerName={memberNames[incomingCall.initiated_by] ?? peerProfile?.display_name ?? undefined}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />
      )}

      {/* Active Call Fullscreen Overlay */}
      {activeCall && (
        <ActiveCallScreen
          call={activeCall}
          isInitiator={activeCall.initiated_by === profile.id}
          peerId={peerProfile?.id}
          peerName={peerProfile?.display_name ?? undefined}
          onCallEnded={handleHangUpActiveCall}
        />
      )}
    </>
  );
}

export default App;
