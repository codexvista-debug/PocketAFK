import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://vbzzvnpkewllqqdtxmie.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZienp2bnBrZXdsbHFxZHR4bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzczNTEsImV4cCI6MjEwNjkxMzM1MX0.pK_svxAI5vQAkTf9VFQPAsdhN-RCdGtFD_BSNPmdZrY';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Always initialized with environment variables or authoritative project defaults
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
