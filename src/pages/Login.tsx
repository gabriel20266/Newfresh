import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/SupabaseProvider';
import { LogIn, AlertCircle, Mail, Lock, User as UserIcon, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';

import { Logo } from '../components/Logo';

export const Login: React.FC = () => {
  const { user, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>((searchParams.get('mode') as any) || 'login');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup' || modeParam === 'login') {
      setMode(modeParam);
    }
  }, [searchParams]);

  // Redirecionar se já estiver logado (e não estiver mostrando mensagem de sucesso)
  useEffect(() => {
    if (user && !successMessage) {
      navigate('/', { replace: true });
    }
  }, [user, successMessage, navigate]);

  // Redirecionar após o tempo do modal de sucesso (apenas se não for recuperação de senha)
  useEffect(() => {
    if (successMessage && mode !== 'forgot') {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, navigate, mode]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean, error?: string } | null>(null);

  useEffect(() => {
    import('../lib/supabase').then(({ checkSupabaseConnection }) => {
      checkSupabaseConnection().then(status => {
        setConnectionStatus(status);
      });
    });
  }, []);

  const withTimeout = async (promise: Promise<any>, ms: number = 10000) => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    );
    return Promise.race([promise, timeout]);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSupabaseError(null);
      
      if (mode === 'login') {
        await withTimeout(signInWithEmail(email, password));
        setSuccessMessage('Bem-vindo de volta! Entrando...');
      } else if (mode === 'signup') {
        await withTimeout(signUpWithEmail(email, password, name));
        setSuccessMessage('Conta criada com sucesso! Verifique seu e-mail se necessário.');
      } else if (mode === 'forgot') {
        if (!email) {
          setError('Por favor, insira seu e-mail.');
          return;
        }
        await withTimeout(resetPassword(email));
        setSuccessMessage('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
        setTimeout(() => {
          setSuccessMessage(null);
          setMode('login');
        }, 3500);
      }
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        setError("Tempo esgotado. A conexão com o Supabase falhou.");
        setShowErrorModal(true);
      } else if (err.message?.includes('fetch')) {
        setSupabaseError("Não foi possível alcançar o servidor. Verifique a URL do projeto.");
        setShowErrorModal(true);
      } else {
        setError(getErrorMessage(err));
        // Se for um erro que impede o cadastro/login, mostramos o modal para erros "fatais"
        if (err.message?.includes('database') || err.message?.includes('admin')) {
          setShowErrorModal(true);
        }
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (err: any) => {
    console.log("Supabase Auth Error:", err);
    const message = err.message || err.toString();
    
    if (message.includes('Invalid login credentials')) return 'Credenciais inválidas. Verifique seu e-mail e senha.';
    if (message.includes('Email not confirmed')) return 'E-mail não confirmado. Verifique sua caixa de entrada.';
    if (message.includes('User already registered')) return 'Este e-mail já está em uso.';
    if (message.includes('Signup disabled')) return 'O cadastro está temporariamente desativado.';
    
    return message;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background overflow-hidden relative py-10">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-secondary-container/5 rounded-full blur-[100px]"></div>

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-md p-5"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-4"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl font-bold text-on-surface">Sucesso!</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {successMessage}
                </p>
              </div>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5 }}
                className="h-1 bg-primary/10 rounded-full overflow-hidden"
              >
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '0%' }}
                  transition={{ duration: 1.5 }}
                  className="h-full bg-primary" 
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {showErrorModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-md p-5"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-5"
            >
              <div className="w-16 h-16 bg-error/10 rounded-full mx-auto flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl font-bold text-on-surface">Ops!</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {supabaseError || error || "Não foi possível completar o cadastro no momento."}
                </p>
              </div>
              <button 
                onClick={() => setShowErrorModal(false)}
                className="w-full py-3 bg-on-surface text-white rounded-xl font-bold text-sm active:scale-95 transition-transform"
              >
                Tentar novamente
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center relative z-10"
      >
        <div className="space-y-2 mb-8 flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-2"
          >
            <Logo size="lg" />
          </motion.div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              {mode === 'login' ? 'Bem-vindo de volta!' : mode === 'signup' ? 'Crie sua conta' : 'Recuperar senha'}
            </h1>
            <p className="text-sm text-on-surface-variant max-w-[280px] mx-auto">
              {mode === 'login' 
                ? 'Economize tempo e reduza desperdícios hoje.' 
                : mode === 'signup'
                ? 'Junte-se ao FreshKeep e otimize seu consumo.'
                : 'Enviaremos um link para você definir uma nova senha.'}
            </p>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 text-left bg-white p-6 rounded-3xl shadow-sm border border-outline-variant/20 mb-8">
          <AnimatePresence mode="wait">
            {mode === 'signup' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                <label className="text-[10px] font-bold text-outline uppercase ml-1 tracking-widest">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome (opcional)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-outline uppercase ml-1 tracking-widest">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-primary outline-none text-sm"
              />
            </div>
          </div>

          <AnimatePresence>
            {mode !== 'forgot' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Senha</label>
                  {mode === 'login' && (
                    <button 
                      type="button" 
                      onClick={() => setMode('forgot')}
                      className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-error-container/50 text-error rounded-xl flex items-center gap-2.5 text-xs border border-error/10"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {supabaseError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-amber-50 text-amber-800 rounded-xl flex flex-col gap-1 text-[10px] border border-amber-200"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="font-bold">Dica de Configuração:</span>
              </div>
              <span>{supabaseError}</span>
            </motion.div>
          )}

          <div className="pt-2">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-bold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 hover:brightness-110"
            >
              {loading ? 'Processando...' : (mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Continuar' : 'Enviar E-mail')}
            </button>
          </div>
          
          <div className="text-center">
            <button 
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'login' ? 'signup' : 'login');
              }}
              className="text-sm text-primary font-bold hover:opacity-80 transition-opacity"
            >
              {mode === 'login' ? 'Não tem conta? Cadastre-se' : mode === 'signup' ? 'Já é usuário? Faça login' : 'Voltar para o Login'}
            </button>
          </div>
        </form>

        <p className="text-[8px] text-outline uppercase tracking-[0.2em] pt-8 opacity-40 font-bold">Safe & Secured by FreshKeep</p>

        {connectionStatus && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center justify-center gap-1.5 opacity-60"
          >
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              connectionStatus.ok ? "bg-primary animate-pulse" : "bg-error"
            )} />
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-outline text-center">
              Supabase Cloud: {connectionStatus.ok ? 'Online' : 'Offline'}
              {!connectionStatus.ok && (
                <div className="mt-1 text-error/80 lowercase tracking-normal">
                  Tentando conectar em: {(connectionStatus as any).url || 'URL desconhecida'}
                </div>
              )}
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
