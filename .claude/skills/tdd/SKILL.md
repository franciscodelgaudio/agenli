---
name: tdd
description: Fluxo obrigatório de TDD do projeto — teste primeiro, aprovação do usuário, depois implementação mínima. Use sempre que for criar, editar ou excluir uma função de lógica de negócio (lib, service, action, hook com lógica) antes de escrever qualquer código de implementação.
---

# TDD · 4Quote

Fluxo obrigatório para criar, editar ou excluir funções de lógica de negócio.
Testes usam Vitest (`npm test` roda `vitest run`), seguindo o padrão de
[project/src/lib/tests/](../../../project/src/lib/tests/).

**Nunca pule etapas nem escreva a implementação antes de ter aprovação
explícita do usuário para o teste.**

## Escopo

Vale para funções de lógica de negócio: `lib/`, `service/`, `actions/`,
hooks com lógica própria (ex: `useEstimate`). NÃO se aplica a componentes
React puramente visuais nem a wiring trivial (ex: um `onClick` que só chama
outra função já testada, um `map` de renderização). Na dúvida se algo é
"lógica" ou "wiring", pergunte antes de aplicar ou pular o fluxo.

## Fluxo

### 1. Função nova ou edição de comportamento

1. Escreva o teste unitário/integração que descreve o comportamento esperado
   (inputs, outputs, casos de borda, erros). Não escreva a função ainda —
   nem um esqueleto vazio para o teste "encaixar".
2. Rode o teste (`vitest run <arquivo>`) e confirme que ele falha pelo motivo
   certo (função ainda não existe, ou comportamento antigo diverge do novo
   teste). Isso é o RED do ciclo — sem confirmar o RED, o teste pode estar
   com um bug e "passar por acidente" depois.
3. Informe ao usuário: o que o teste cobre, os casos incluídos, e o resultado
   do RED. Pare aqui e aguarde aprovação explícita antes de tocar em código
   de implementação.
4. Só depois da aprovação, escreva a implementação MÍNIMA suficiente para
   passar no teste — sem generalizar além do que o teste exige, sem
   abstrações especulativas.
5. Rode o teste de novo, confirme GREEN, e informe o usuário para review e
   refactor. Refactor só altera a implementação; se o refactor exigir mudar
   o teste, trate como o caso abaixo.

### 2. Editar função que já existe mas ainda não tem teste

Antes de editar, escreva primeiro um teste de caracterização cobrindo o
comportamento ATUAL da função (mesmo que você ache que esse comportamento é o
bug a corrigir). Informe esse teste e o resultado (deve passar contra o
código atual — é o baseline). Só depois disso escreva o novo teste para o
comportamento desejado e siga o fluxo normal (RED → aprovação → implementação
mínima → GREEN).

### 3. Excluir ou substituir uma função

Se a função a ser excluída tem testes dependentes dela (diretos ou via
integração), reescreva esses testes primeiro para refletir o novo
comportamento esperado do sistema sem ela — antes de tocar na função ou nos
callers. Informe quais testes foram reescritos e por quê, aguarde aprovação,
só então remova a função e ajuste os callers.

## Regras sobre o teste em si

- **Nunca altere um teste depois de escrito** para fazê-lo "encaixar" numa
  implementação, a não ser que o usuário dê permissão explícita para aquela
  alteração específica.
- Se, depois de aprovado, você perceber que o teste tem um erro genuíno
  (asserção errada, setup quebrado, caso mal formulado) que impede a
  implementação correta de passar, **pare, explique o erro encontrado e peça
  autorização** antes de alterar o teste. Não corrija silenciosamente.
- A implementação nunca deve ser ajustada para "capturar" um caso que o teste
  não cobre — se faltou um caso, isso é uma decisão de teste, volte para a
  etapa de teste e peça aprovação do caso novo antes de mudar a implementação
  por causa dele.

## Formato do aviso ao usuário

Ao informar sobre um teste novo (ou reescrito), inclua:

- Arquivo do teste e função/módulo sob teste.
- Lista curta dos casos cobertos (comportamento esperado, bordas, erros).
- Resultado do RED (comando rodado e por que falhou) ou, no caso de
  caracterização, confirmação de que passa contra o código atual.

Ao informar sobre a implementação, inclua:

- Resultado do GREEN (teste passando).
- Um convite claro para review/refactor — não assuma aprovação tácita.
