-- Novas funções: limite semanal, usuários, esqueci minha senha, lembrete e bloqueios.
-- Rodar ANTES de publicar o código desta branch.
-- Supabase: SQL Editor -> New query -> colar -> Run.

-- 1. Conta desativada pelo administrador
alter type public.status_cadastro_enum add value if not exists 'DESATIVADO';

-- 2. Links de "esqueci minha senha" (guarda só o hash do token)
create table if not exists public.redefinicao_senha (
    id_redefinicao  bigint generated always as identity primary key,
    id_usuario      integer not null references public.usuario(id_usuario) on delete cascade,
    token_hash      text not null unique,
    expira_em       timestamptz not null,
    usado_em        timestamptz,
    criado_em       timestamptz not null default now()
);

create index if not exists idx_redefinicao_senha_usuario on public.redefinicao_senha (id_usuario);
alter table public.redefinicao_senha enable row level security;

-- 3. Bloqueios de horário (dia inteiro quando os horários ficam vazios)
create table if not exists public.bloqueio (
    id_bloqueio     bigint generated always as identity primary key,
    data_inicio     date not null,
    data_fim        date not null,
    horario_inicio  time,
    horario_fim     time,
    motivo          text not null,
    criado_por      integer references public.usuario(id_usuario) on delete set null,
    criado_em       timestamptz not null default now(),
    constraint bloqueio_datas check (data_fim >= data_inicio),
    constraint bloqueio_horarios check (
        (horario_inicio is null and horario_fim is null) or
        (horario_inicio is not null and horario_fim is not null and horario_fim > horario_inicio)
    ),
    constraint bloqueio_motivo check (char_length(motivo) between 3 and 200)
);

create index if not exists idx_bloqueio_datas on public.bloqueio (data_inicio, data_fim);
alter table public.bloqueio enable row level security;

-- 4. Lembrete 1 hora antes (marca quando o lembrete foi enviado)
alter table public.reserva add column if not exists lembrete_enviado_em timestamptz;

create index if not exists idx_reserva_lembrete
    on public.reserva (data_reserva)
    where status = 'APROVADA' and lembrete_enviado_em is null;
