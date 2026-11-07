// Conexión a Supabase
// Aquí solo va la clave PÚBLICA (publishable / anon). Nunca la secret ni la service_role.
const SUPABASE_URL = "https://TU-ID.supabase.co";
const SUPABASE_KEY = "TU_CLAVE_PUBLICA";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
