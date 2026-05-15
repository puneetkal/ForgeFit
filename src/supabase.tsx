import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jcoizajzsfktjcrfmjnh.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjb2l6YWp6c2ZrdGpjcmZtam5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDE3NzcsImV4cCI6MjA5NDExNzc3N30.KrQ9B4ieH2SLYXMImcTlETYTWSu0dOA_eMYBjHlebzY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
