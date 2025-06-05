CREATE TABLE IF NOT EXISTS topic_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES public.users(id) ON DELETE CASCADE,
  topic_code      text NOT NULL,
  activity        text,
  score           numeric,
  max_score       numeric,
  first_attempt   timestamptz,
  last_attempt    timestamptz,
  attempts        int,
  source          text DEFAULT 'evolcampus',
  created_at      timestamptz DEFAULT now(),
  UNIQUE(student_id, topic_code, activity)
);

CREATE INDEX IF NOT EXISTS topic_results_student_idx ON topic_results(student_id);
CREATE INDEX IF NOT EXISTS topic_results_topic_idx ON topic_results(topic_code);

-- Registro de sincronizaciones con la API de EvolCampus
CREATE TABLE IF NOT EXISTS api_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint        text NOT NULL,
  status_code     int,
  records_synced  int,
  executed_at     timestamptz DEFAULT now(),
  details         jsonb
); 