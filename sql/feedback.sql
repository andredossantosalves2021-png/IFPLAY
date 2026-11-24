-- IFPlay: tabela de avaliações (feedback) das reservas
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar mais de uma vez sem problema.

-- Os tipos dos ids são copiados das tabelas que já existem, então não
-- importa se o seu id_reserva / id_usuario é número ou uuid.
DO $$
DECLARE
    tipo_id_reserva text;
    tipo_id_usuario text;
BEGIN

    SELECT format_type(a.atttypid, a.atttypmod)
      INTO tipo_id_reserva
      FROM pg_attribute a
     WHERE a.attrelid = 'public.reserva'::regclass
       AND a.attname = 'id_reserva'
       AND NOT a.attisdropped;

    SELECT format_type(a.atttypid, a.atttypmod)
      INTO tipo_id_usuario
      FROM pg_attribute a
     WHERE a.attrelid = 'public.usuario'::regclass
       AND a.attname = 'id_usuario'
       AND NOT a.attisdropped;

    IF tipo_id_reserva IS NULL OR tipo_id_usuario IS NULL THEN
        RAISE EXCEPTION 'Não achei reserva.id_reserva ou usuario.id_usuario';
    END IF;

    EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.feedback_reserva (
            id_feedback        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            id_reserva         %1$s NOT NULL UNIQUE
                               REFERENCES public.reserva(id_reserva) ON DELETE CASCADE,
            id_usuario         %2$s NOT NULL
                               REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
            estado_ao_chegar   text NOT NULL
                               CHECK (estado_ao_chegar IN ('LIMPA', 'ACEITAVEL', 'SUJA')),
            itens              jsonb NOT NULL DEFAULT '{}'::jsonb,
            deixou_organizada  boolean NOT NULL,
            observacao         text,
            tem_problema       boolean NOT NULL DEFAULT false,
            criado_em          timestamptz NOT NULL DEFAULT now()
        )
    $f$, tipo_id_reserva, tipo_id_usuario);

END $$;

CREATE INDEX IF NOT EXISTS feedback_reserva_problema_idx
    ON public.feedback_reserva (tem_problema, criado_em DESC);

-- Mesmo esquema das outras tabelas: RLS ligado com políticas liberadas
-- (quem controla o acesso é o servidor) e permissões explícitas.
ALTER TABLE public.feedback_reserva ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select" ON public.feedback_reserva;
DROP POLICY IF EXISTS "feedback_insert" ON public.feedback_reserva;

CREATE POLICY "feedback_select" ON public.feedback_reserva
    FOR SELECT USING (true);

CREATE POLICY "feedback_insert" ON public.feedback_reserva
    FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON public.feedback_reserva TO anon, authenticated;
GRANT ALL ON public.feedback_reserva TO service_role;
