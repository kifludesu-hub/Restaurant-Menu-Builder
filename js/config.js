// Replace these two values with the values from Supabase Project Settings > API.
window.DESU_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};
window.desuSupabase = window.supabase.createClient(
  window.DESU_CONFIG.SUPABASE_URL,
  window.DESU_CONFIG.SUPABASE_PUBLISHABLE_KEY
);