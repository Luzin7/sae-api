-- Read-only audit of migration 0010: rows per current distinct `monster.size`
-- and what the migration will do with each value (mapped key or NULL).
SELECT
  "size" AS current_size,
  count(*) AS rows,
  CASE translate(lower(btrim("size")), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
    WHEN 'miudo' THEN 'miudo'
    WHEN 'pequeno' THEN 'pequeno'
    WHEN 'medio' THEN 'medio'
    WHEN 'grande' THEN 'grande'
    WHEN 'enorme' THEN 'enorme'
    ELSE NULL END AS becomes
FROM "monster"
WHERE "size" IS NOT NULL
GROUP BY "size"
ORDER BY rows DESC, current_size;
