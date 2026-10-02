import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://neijncjguyjlxhwhvwen.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5laWpuY2pndXlqbHhod2h2d2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4OTg4NTMsImV4cCI6MjEwNjQ3NDg1M30.xeLKrdIbVS3BJ18OE4qrCgghvRvSKPVUiDdjJEAPRj4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
