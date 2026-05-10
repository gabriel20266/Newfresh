import { createClient } from '@supabase/supabase-js';

// These should be configured in your .env file or environment secrets
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize inputs (remove quotes, spaces, invisible characters)
const sanitize = (val: any) => {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/['"\s]/g, '').trim();
};

const sanitizedEnvUrl = sanitize(envUrl);
const sanitizedEnvKey = sanitize(envKey);

// Hardcoded fallbacks if env is missing or empty
const DEFAULT_URL = 'https://oqxvclbpqutncunmircg.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xeHZjbGJwcXV0bmN1cW1pcmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NzA3MDksImV4cCI6MjA5MzM0NjcwOX0.y1AJT_XoQIeeD3XuGt0ysmrwoZB9PzM6p90wjTsITT8';

const supabaseUrl = sanitizedEnvUrl || DEFAULT_URL;
const supabaseAnonKey = sanitizedEnvKey || DEFAULT_KEY;

// Ensure the URL is valid
let finalUrl = supabaseUrl;

// If we only have the ID, expand it (e.g. "oqxvclbpqutncunmircg" -> "https://oqxvclbpqutncunmircg.supabase.co")
if (finalUrl && !finalUrl.includes('.') && !finalUrl.startsWith('http')) {
  finalUrl = `https://${finalUrl}.supabase.co`;
}

// Ensure it has protocol
if (finalUrl && !finalUrl.startsWith('http')) {
  finalUrl = `https://${finalUrl}`;
}

// Export for diagnostics
export const SUPABASE_CONFIG = {
  url: finalUrl,
  isUsingFallback: !sanitizedEnvUrl,
  envUrl: sanitizedEnvUrl
};

// Log connection attempt for debugging
if (import.meta.env.DEV) {
  console.log('Supabase Config:', SUPABASE_CONFIG);
}

// Diagnostics: check if the final URL is valid
const isInvalidUrl = !finalUrl || !finalUrl.startsWith('https://') || !finalUrl.includes('.supabase.co');

if (isInvalidUrl && import.meta.env.DEV) {
  console.error('CRITICAL: The Supabase URL could not be resolved correctly. Found:', finalUrl);
}

export const supabase = createClient(finalUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/**
 * Diagnostic helper to check connection
 */
export async function checkSupabaseConnection() {
  try {
    // Try to get a simple response from the API
    const startTime = Date.now();
    const { error } = await supabase.from('products').select('count', { count: 'exact', head: true }).limit(0);
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error("Supabase Connection Error Detail:", error);
      
      // If it's a "fetch" error, it's a network/URL issue
      if (error.message?.includes('fetch') || error.code === 'PGRST301' || !error.code) {
        return { 
          ok: false, 
          error: `Erro de rede: Não foi possível alcançar o servidor Supabase. Verifique sua conexão e a URL do projeto.`,
          url: finalUrl
        };
      }
      
      // 42P01 means the 'products' table doesn't exist yet
      if (error.code === '42P01') { 
        console.warn("AVISO: Conectado ao Supabase, mas a tabela 'products' não existe. Execute o script supabase-schema.sql.");
        return { 
          ok: true, 
          warning: 'Conectado, mas as tabelas do banco de dados estão ausentes.', 
          url: finalUrl 
        };
      }

      return { ok: false, error: `Erro Supabase: ${error.message} (${error.code})`, url: finalUrl };
    }
    
    if (import.meta.env.DEV) {
      console.log('✅ Supabase conectado com sucesso!');
    }
    return { ok: true, url: finalUrl, duration };
  } catch (err: any) {
    console.error("Supabase Fatal Error Detail:", err);
    return { ok: false, error: `Erro Fatal: ${err.message || 'Falha na conexão'}`, url: finalUrl };
  }
}

/**
 * Helper to get the current user from Supabase session
 */
export async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}
