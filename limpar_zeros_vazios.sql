-- Limpa os registros de Pluviometria que estão como 0 (que antes significavam vazio).
-- Assim eles voltam a ficar cinzas (vazios) na tela.
-- O que você preencher com 0 a partir de agora ficará vermelho corretamente!

DELETE FROM pluviometria_registros WHERE volume_mm = 0;
