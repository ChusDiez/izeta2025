-- Tabla para almacenar datos generales del enrollment de Evolcampus
CREATE TABLE IF NOT EXISTS evolcampus_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES public.users(id) ON DELETE CASCADE,
  enrollmentid    int NOT NULL,
  study           text,
  group_name      text,
  begin_date      date,
  end_date        date,
  completed_percent numeric,
  grade           numeric,
  last_connect    timestamptz,
  time_connected  int, -- segundos totales conectado
  connections     int, -- número de sesiones
  enrollment_status int,
  pass_requirements int,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE(student_id, enrollmentid)
);

CREATE INDEX IF NOT EXISTS evolcampus_enrollments_student_idx ON evolcampus_enrollments(student_id);
CREATE INDEX IF NOT EXISTS evolcampus_enrollments_sync_idx ON evolcampus_enrollments(synced_at);

-- Vista para ver el resumen de Evolcampus por estudiante
CREATE OR REPLACE VIEW evolcampus_student_summary AS
SELECT 
  u.id as student_id,
  u.username,
  u.email,
  u.cohort,
  ee.study,
  ee.completed_percent,
  ee.grade,
  ee.time_connected,
  ee.connections,
  ee.last_connect,
  COUNT(DISTINCT tr.topic_code) as topics_studied,
  AVG(tr.score) as avg_topic_score,
  MAX(tr.last_attempt) as last_activity
FROM users u
LEFT JOIN evolcampus_enrollments ee ON u.id = ee.student_id
LEFT JOIN topic_results tr ON u.id = tr.student_id AND tr.source = 'evolcampus'
GROUP BY u.id, u.username, u.email, u.cohort, ee.study, ee.completed_percent, 
         ee.grade, ee.time_connected, ee.connections, ee.last_connect; 