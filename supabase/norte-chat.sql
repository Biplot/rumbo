-- Rumbo · 🧭 Norte, tu brújula: los límites de la charla (api/norte-chat.js → notifier/norte-chat.mjs).
-- Cuánto conversó, habló y escuchó Norte con cada persona cada día (hora de Chile), para cuidar el gasto de
-- Claude y el plan gratis de Azure, que comparte con Atlas. Solo el servidor (service_role) la lee y la escribe.
-- Idempotente: se puede correr más de una vez.
BEGIN;

CREATE TABLE IF NOT EXISTS norte_uso (
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  dia        date NOT NULL,
  charlas    integer NOT NULL DEFAULT 0 CHECK (charlas >= 0),
  caracteres integer NOT NULL DEFAULT 0 CHECK (caracteres >= 0),
  segundos   integer NOT NULL DEFAULT 0 CHECK (segundos >= 0),
  PRIMARY KEY (user_id, dia)
);
ALTER TABLE norte_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE norte_uso FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE norte_uso TO service_role;

-- Suma lo de un pedido si no pasa los límites del día. { ok: true, charlas, caracteres, segundos }
-- o { ok: false, limite: 'charlas' | 'caracteres' | 'segundos' } (y entonces no suma nada).
CREATE OR REPLACE FUNCTION norte_uso_sumar(p_user uuid, p_dia date, p_charlas integer, p_caracteres integer, p_segundos integer,
                                           p_max_charlas integer, p_max_caracteres integer, p_max_segundos integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u norte_uso%ROWTYPE;
BEGIN
  IF least(p_charlas, p_caracteres, p_segundos) < 0 THEN RAISE EXCEPTION 'dato'; END IF;
  INSERT INTO norte_uso (user_id, dia) VALUES (p_user, p_dia) ON CONFLICT DO NOTHING;
  SELECT * INTO u FROM norte_uso WHERE user_id = p_user AND dia = p_dia FOR UPDATE;
  IF u.charlas + p_charlas > p_max_charlas THEN RETURN jsonb_build_object('ok', false, 'limite', 'charlas'); END IF;
  IF u.caracteres + p_caracteres > p_max_caracteres THEN RETURN jsonb_build_object('ok', false, 'limite', 'caracteres'); END IF;
  IF u.segundos + p_segundos > p_max_segundos THEN RETURN jsonb_build_object('ok', false, 'limite', 'segundos'); END IF;
  UPDATE norte_uso SET charlas = charlas + p_charlas, caracteres = caracteres + p_caracteres, segundos = segundos + p_segundos
    WHERE user_id = p_user AND dia = p_dia RETURNING * INTO u;
  DELETE FROM norte_uso WHERE dia < p_dia - 60;
  RETURN jsonb_build_object('ok', true, 'charlas', u.charlas, 'caracteres', u.caracteres, 'segundos', u.segundos);
END $$;
REVOKE ALL ON FUNCTION norte_uso_sumar(uuid, date, integer, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION norte_uso_sumar(uuid, date, integer, integer, integer, integer, integer, integer) TO service_role;

COMMIT;
