// Conexión a Supabase
// Aquí solo va la clave PÚBLICA (publishable / anon). Nunca la secret ni la service_role.
const SUPABASE_URL = "https://swwxfvbbhpehefwooiud.supabase.co";
const SUPABASE_KEY = "sb_publishable_A3QLGnF5sQGtaJ_KJe8dVA_rRjoOuYY";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
