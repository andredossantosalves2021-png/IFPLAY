-- Correções da revisão (rodar ANTES de publicar o código desta branch).
-- Pode rodar no Supabase: SQL Editor -> New query -> colar -> Run.

-- 1. Fuso: as datas eram gravadas em UTC sem fuso e o navegador lia como horário de Brasília.
alter table public.notificacao
    alter column data_envio type timestamptz using data_envio at time zone 'UTC',
    alter column data_envio set default now();

alter table public.reclamacao
    alter column data_envio type timestamptz using data_envio at time zone 'UTC',
    alter column data_envio set default now();

-- 2. Histórico de cada reserva: quando foi pedida, quem mudou por último, quando e por quê.
alter table public.reserva
    add column if not exists criado_em timestamptz default now(),
    add column if not exists atualizado_em timestamptz,
    add column if not exists atualizado_por integer references public.usuario(id_usuario) on delete set null,
    add column if not exists motivo_cancelamento text;

-- 3. Pendentes que já passaram e nunca foram analisadas: cancela sem notificar.
update public.reserva
set status = 'CANCELADA',
    motivo_cancelamento = 'Não foi analisada por um administrador antes do horário.',
    atualizado_em = now()
where status = 'PENDENTE'
  and (data_reserva + horario_fim) <= (now() at time zone 'America/Sao_Paulo');

-- 4. O banco passa a impedir horários sobrepostos (antes só bloqueava horários idênticos).
--    Vale a partir de 25/11/2026: as 2 sobreposições antigas de agosto ficam como estão.
alter table public.reserva
    add constraint reserva_sem_sobreposicao
    exclude using gist (
        tsrange(data_reserva + horario_inicio, data_reserva + horario_fim) with &&
    )
    where (status <> 'CANCELADA' and data_reserva >= date '2026-11-25');

-- 5. Índices nas chaves estrangeiras e nas buscas mais comuns.
create index if not exists idx_reserva_id_usuario on public.reserva (id_usuario);
create index if not exists idx_reserva_data on public.reserva (data_reserva);
create index if not exists idx_notificacao_usuario_data on public.notificacao (id_usuario, data_envio desc);
create index if not exists idx_reclamacao_id_usuario on public.reclamacao (id_usuario);
create index if not exists idx_sessoes_id_usuario on public.sessoes (id_usuario);
create index if not exists idx_feedback_reserva_id_usuario on public.feedback_reserva (id_usuario);

-- 6. Sessões vencidas.
delete from public.sessoes where expira_em < now();
