BEGIN;

-- Añade el estado/condición de la carta (nullable para no romper datos existentes)
ALTER TABLE collection ADD COLUMN condition TEXT;

-- Opcional: si quieres inicializar con 'NM' para todas las filas existentes:
-- UPDATE collection SET condition = 'NM' WHERE condition IS NULL;

COMMIT;
