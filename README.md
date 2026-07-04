# IFPlay

Sistema web de gerenciamento e agendamento da quadra esportiva do Instituto Federal, desenvolvido para a disciplina PROJETEC.

## Sobre o Projeto

O IFPlay tem como objetivo facilitar a reserva da quadra esportiva do Instituto Federal por meio de uma plataforma web simples e organizada. O sistema permite que alunos, professores e administradores realizem reservas, acompanhem agendamentos e utilizem recursos complementares, como calendário, notificações e reclamações.

## Funcionalidades

* Login de usuários por RA e senha;
* Diferentes tipos de usuários (Aluno, Professor e Administrador);
* Agendamento de reservas da quadra;
* Reservas recorrentes para professores e administradores;
* Visualização de reservas existentes;
* Calendário de reservas;
* Sistema de notificações;
* Registro de reclamações;
* Modo escuro.

## Tecnologias Utilizadas

### Front-end

* HTML5
* CSS3
* JavaScript

### Back-end

* Node.js
* Hono

### Banco de Dados

* Supabase (PostgreSQL)

### Ferramentas de Desenvolvimento

* Git
* GitHub
* Visual Studio Code

## Estrutura do Projeto

```text
PROJETEC
│
├── public
│   ├── LOGIN
│   ├── DASHBOARD
│   ├── AGENDA
│   ├── RESERVA
│   ├── CALENDARIO
│   ├── CSS
│   ├── JS
│   └── LOGO
│
├── server.js
├── package.json
├── package-lock.json
├── .env
└── README.md
```

## Configuração do Ambiente Local

### Primeira vez utilizando o projeto

Instale todas as dependências:

```bash
npm install
```

## Executando a Aplicação

Sempre antes de começar a mexer no projeto:

```bash
git pull
npm run dev
```

O sistema ficará disponível em:

```text
http://localhost:3333
```

## Salvando Alterações

Depois de realizar mudanças no projeto:

```bash
git add .
git commit -m "mensagem"
git push
```

Caso seja necessário reiniciar o servidor Node.js:

```powershell
Stop-Process -Name node -Force
npm run dev
```

## Banco de Dados

O banco de dados utiliza PostgreSQL através do Supabase.

As principais tabelas são:

* usuario
* reserva
* reclamacao
* notificacao

Para configurar o ambiente local, crie um arquivo `.env` na raiz do projeto:

```env
SUPABASE_URL=https://sxufrnplreddigozngzi.supabase.co

SUPABASE_KEY=sb_publishable_bhJqtKY1mk57Fa-wF4xuHQ_wr96lVkn
```

Após criar o projeto no Supabase, execute os scripts SQL disponibilizados pela equipe para gerar as tabelas e relacionamentos necessários.

## Usuários de Teste

**Aluno**

* RA: 123456
* Senha: 123

**Servidor**

* RA: 0083367
* Senha: 6742

## Integrantes

* André Alves
* Arthur Luiz
* Claudio Junio
* Diogo Rocha
* Geovanna
* Othávio Camillo
* Stephanie

## Status do Projeto

Em desenvolvimento.

As funcionalidades principais de autenticação e agendamento já foram implementadas, enquanto novas melhorias e integrações continuam sendo desenvolvidas pela equipe.
