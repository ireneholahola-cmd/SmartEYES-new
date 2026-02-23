import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// 对于需要绕过 RLS 的操作，使用 service_role key
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// 如果有 service role key，也创建一个管理客户端
// export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabase;
