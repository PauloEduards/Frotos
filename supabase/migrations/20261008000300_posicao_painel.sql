-- Bloco 1: a foto do painel passa a ser uma das posições da retirada/devolução.
-- Fica sozinha porque um valor novo de enum não pode ser usado na mesma transação.
alter type public.posicao_foto add value if not exists 'painel';
