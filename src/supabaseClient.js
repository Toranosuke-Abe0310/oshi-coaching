import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sqyfduzymmbxmpcwswqk.supabase.co'
const supabaseAnonKey = 'sb_publishable_wT_lJ0xVYR9BJMS0l_VKBg_3Rb5B_x2'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
