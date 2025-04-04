import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jnfzkxxtqiehgmiaxvnj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZnpreHh0cWllaGdtaWF4dm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3OTMzNDksImV4cCI6MjA1OTM2OTM0OX0.zMXC6jC-8aYva3RZIgixqE1XZ-PC-79FpsVAuiG1Y3E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)