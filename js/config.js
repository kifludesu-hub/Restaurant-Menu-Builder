// Replace these two values with the values from Supabase Project Settings > API.
window.DESU_CONFIG = {
  SUPABASE_URL: "https://oyldpfvfluizpbyovdiv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xFDdfKQ9J4zfLR_stKfyrg_ru_k3UfZ"
};
window.desuSupabase = window.supabase.createClient(
  window.DESU_CONFIG.SUPABASE_URL,
  window.DESU_CONFIG.SUPABASE_PUBLISHABLE_KEY
);