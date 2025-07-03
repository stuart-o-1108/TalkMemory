// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://orvjgvoofoqcnhguqehx.supabase.co'  // 自分のプロジェクトのURL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydmpndm9vZm9xY25oZ3VxZWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNTg2MjIsImV4cCI6MjA2NjkzNDYyMn0.ySzRBgQZFP9WrSZ6fsN6s6yN3S54wz988banhMj3Bmo'           // プロジェクトのanonパブリックキー

export const supabase = createClient(supabaseUrl, supabaseKey)
