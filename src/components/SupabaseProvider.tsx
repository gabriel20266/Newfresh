import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface UserSettings {
  notificationsEnabled: boolean;
  advanceDays: number;
  currency: string;
  photoURL?: string;
  displayName?: string;
  email?: string;
  role: 'admin' | 'user';
  plan: 'basic' | 'pro';
  premiumStatus: 'none' | 'pending' | 'approved' | 'rejected';
  productCount: number;
  productLimit: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  settings: UserSettings;
  isAdmin: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  updateProfileImage: (photoURL: string) => Promise<void>;
  requestPremium: (comprovanteUrl?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({ 
    notificationsEnabled: true, 
    advanceDays: 3,
    currency: 'BRL',
    role: 'user',
    plan: 'basic',
    premiumStatus: 'none',
    productCount: 0,
    productLimit: 100
  });

  const isAdmin = settings.role === 'admin';

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Supabase Session Error:", error);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserSettings(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Supabase initial session error:", err);
        // If it's a fetch error, it's likely a bad URL or network issue
        if (err.message?.includes('fetch') || err.name === 'TypeError') {
          console.error("CRITICAL: Failed to connect to Supabase. Check VITE_SUPABASE_URL.");
        }
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSettings(session.user.id);
      } else {
        setLoading(false);
        setSettings({ 
          notificationsEnabled: true, 
          advanceDays: 3,
          currency: 'BRL',
          role: 'user',
          plan: 'basic',
          premiumStatus: 'none',
          productCount: 0,
          productLimit: 100
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserSettings = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error loading settings:", error);
      }

      if (data) {
        // Convert snake_case from DB to camelCase for app
        const mappedSettings: UserSettings = {
          notificationsEnabled: data.notifications_enabled,
          advanceDays: data.advance_days,
          currency: data.currency,
          photoURL: data.photo_url,
          displayName: data.display_name,
          email: data.email,
          role: data.role as 'admin' | 'user',
          plan: data.plan as 'basic' | 'pro',
          premiumStatus: data.premium_status as any,
          productCount: data.product_count,
          productLimit: data.product_limit,
        };

        const isMasterAdmin = data.email?.toLowerCase() === 'gabrielpe3109@gmail.com';
        
        // Safety check for master admin
        if (isMasterAdmin && mappedSettings.role !== 'admin') {
          mappedSettings.role = 'admin';
          await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
        }

        setSettings(mappedSettings);
      }
    } catch (err) {
      console.error("Error in loadUserSettings:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return;
    
    // Map camelCase to snake_case for Supabase
    const dbUpdates: any = {};
    if (updates.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = updates.notificationsEnabled;
    if (updates.advanceDays !== undefined) dbUpdates.advance_days = updates.advanceDays;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.photoURL !== undefined) dbUpdates.photo_url = updates.photoURL;
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.plan !== undefined) dbUpdates.plan = updates.plan;
    if (updates.premiumStatus !== undefined) dbUpdates.premium_status = updates.premiumStatus;
    if (updates.productCount !== undefined) dbUpdates.product_count = updates.productCount;
    if (updates.productLimit !== undefined) dbUpdates.product_limit = updates.productLimit;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id);

    if (error) {
      console.error("Error updating settings:", error);
      throw error;
    }

    setSettings(prev => ({ ...prev, ...updates }));
  };

  const requestPremium = async (comprovanteUrl: string = '') => {
    if (!user) return;
    
    try {
      const { error } = await supabase.from('payments').insert({
        user_id: user.id,
        user_email: user.email,
        comprovante_url: comprovanteUrl,
        referencia: `PREMIUM_${user.id}_${Date.now()}`,
        status: 'pendente'
      });

      if (error) throw error;

      await updateSettings({ premiumStatus: 'pending' });
    } catch (err) {
      console.error("Error requesting premium:", err);
      throw err;
    }
  };

  const updateProfileImage = async (photoURL: string) => {
    await updateSettings({ photoURL });
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: name,
        }
      }
    });

    if (error) throw error;
    
    // Note: Profiles are created via SQL Trigger in Supabase (see supabase-schema.sql)
    // but we can update the local state manually if needed or wait for auth state change
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session,
      loading, 
      settings, 
      isAdmin, 
      signInWithEmail, 
      signUpWithEmail, 
      resetPassword, 
      logout, 
      updateSettings, 
      updateProfileImage, 
      requestPremium 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a SupabaseProvider');
  }
  return context;
};
