import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// 对于需要绕过 RLS 的操作，使用 service_role key
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Warning: Missing Supabase environment variables. Database features will be disabled.');
  // Create a mock client that does nothing but logs warnings
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      delete: () => Promise.resolve({ data: [], error: null }),
      eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) })
    }),
    auth: {
      signUp: () => Promise.resolve({ data: null, error: null }),
      signIn: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null })
    },
    table: () => ({
        insert: () => ({ execute: () => Promise.resolve({ data: [], error: null }) }),
        select: () => ({ execute: () => Promise.resolve({ data: [], error: null }) })
    })
  };
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };

// 如果有 service role key，也创建一个管理客户端
// export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabase;
