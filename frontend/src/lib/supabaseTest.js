import { supabase } from './supabaseClient'

export async function testSupabaseConnection() {
  try {
    const { error } = await supabase.auth.getSession()

    if (error) {
      console.error('Supabase connection error:', error)
      return false
    }

    console.log('Supabase connection successful!')
    return true
  } catch (error) {
    console.error('Supabase connection failed:', error)
    return false
  }
}
