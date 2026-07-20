import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your project values.'
  )
}

// Default client targets the `veille` schema directly since that is where
// all application data lives (see migrations from the Airtable -> Supabase
// migration). Use `supabase.schema('public')` only if auth-adjacent public
// helpers are ever added.
export const supabase = createClient(url, anonKey, {
  db: { schema: 'veille' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// A second client pinned to the default (public) schema, used only for
// calling Edge Functions (functions.invoke does not depend on db.schema).
export const supabaseFunctions = supabase
