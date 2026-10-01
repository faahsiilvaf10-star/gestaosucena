UPDATE reminders
SET last_notified_at = NULL
WHERE status IN ('Pendente', 'Em andamento')
AND (
  (is_recurring = false AND due_date::date = (now() AT TIME ZONE 'America/Belem')::date)
  OR
  (is_recurring = true AND recurrence_config->'days' @> to_jsonb(EXTRACT(DOW FROM now() AT TIME ZONE 'America/Belem')::integer))
);
SELECT id, title, is_recurring, due_date FROM reminders WHERE last_notified_at IS NULL AND status IN ('Pendente', 'Em andamento');
