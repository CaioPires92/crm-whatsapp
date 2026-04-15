import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const missingConfigMessage =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.';

function createMissingQuery() {
  const response = Promise.resolve({
    data: null,
    error: new Error(missingConfigMessage),
  });

  let proxy: any;

  proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return response.then.bind(response);
        if (prop === 'catch') return response.catch.bind(response);
        if (prop === 'finally') return response.finally.bind(response);

        if (prop === 'subscribe') {
          return (callback?: (status: string) => void) => {
            callback?.('CHANNEL_ERROR');
            return { unsubscribe() {} };
          };
        }

        return (..._args: unknown[]) => proxy;
      },
    }
  );

  return proxy;
}

function createMissingAuth() {
  return {
    getSession: async () => ({
      data: { session: null },
      error: null,
    }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    }),
    signInWithPassword: async () => ({
      data: null,
      error: new Error(missingConfigMessage),
    }),
    signOut: async () => ({
      error: new Error(missingConfigMessage),
    }),
  };
}

function createMissingSupabaseClient() {
  const query = createMissingQuery();

  return {
    auth: createMissingAuth(),
    from: () => query,
    channel: () => query,
    removeChannel: async () => ({ data: null, error: null }),
  } as unknown as SupabaseClient;
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingSupabaseClient();
