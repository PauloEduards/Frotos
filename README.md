# Projeto Frotos

Backend (Supabase) do MVP de manutenção de frotas.

## Pré-requisitos

- Node 20+
- Docker Desktop (aberto e em execução)

## Primeira vez

```bash
npm install
npm run db:start
```

A primeira execução demora porque baixa as imagens do Docker.

## Testes

- `npm run db:test`: testes do banco (pgTAP).
- `npm test`: testes das funções (Vitest).

## Resetar o banco

```bash
npm run db:reset
```

## Notificações push

(a preencher na Task 11)
