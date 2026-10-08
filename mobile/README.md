# Frotos - app (proprietário e motorista)

App Expo (React Native, Expo Router, TypeScript) para o proprietário acompanhar a frota: carros, manutenções, pendências, gastos, motoristas e avisos.

## Como rodar

1. Suba o backend na raiz do repositório com `npm run db:start` (Docker aberto). No fim da saída aparece a **anon key**.
2. Em `mobile/`, copie `.env.example` para `.env` e preencha:
   - `EXPO_PUBLIC_SUPABASE_URL` com o IP do seu PC na rede, por exemplo `http://192.168.0.10:54321` (não use `localhost`, o celular não enxerga).
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` com a anon key do passo 1.
3. Instale as dependências e inicie o app:

   ```bash
   npm install
   npx expo start
   ```

4. Abra no celular Android com o **Expo Go** (celular e PC na mesma rede Wi-Fi) lendo o QR code, ou no emulador.
5. Entre com `dono@frotos.dev` / `senha123`.

## Se o celular não conectar

Libere no Firewall do Windows as portas **54321** (API do Supabase) e **8081** (servidor do Expo, que entrega o app ao Expo Go), e confira se o IP no `.env` é o do PC na rede atual.

## Testes

```bash
npx tsc --noEmit
npx jest
```

## Contas de teste

| Conta | Papel | Situação |
|---|---|---|
| `dono@frotos.dev` | proprietário | Frota Piloto (São Paulo/SP), Argo e Kwid anunciados na busca |
| `ana@frotos.dev` | motorista | na frota, com o Onix |
| `bruno@frotos.dev` | motorista | na frota, com o HB20 |
| `caio@frotos.dev` | motorista | pedido de entrada pendente |

Senha de todas: `senha123`. Para testar a busca de carros, crie uma conta nova de motorista em São Paulo/SP.

## Build de teste (Android)

O push e a câmera funcionam de verdade só numa build instalada (no Expo Go o push não funciona).

1. Instale a ferramenta: `npm i -g eas-cli`
2. Entre na sua conta Expo (gratuita): `eas login`
3. Na pasta `mobile`, ligue o projeto: `eas init` (grava o `projectId` no `app.json`)
4. **Endereço do Supabase na build:** o `.env` vai junto com a build (veja `.easignore`). Para o piloto, ele precisa
   apontar para um endereço que o celular alcance de qualquer lugar: o ideal é um projeto Supabase na nuvem
   (o IP do PC só funciona na mesma rede Wi-Fi e com o PC ligado).
5. **Push no Android (Firebase):**
   1. No [console do Firebase](https://console.firebase.google.com), crie um projeto e adicione um app Android com o
      pacote `dev.frotos.app`.
   2. Baixe o `google-services.json` e coloque na pasta `mobile/`.
   3. No `app.json`, dentro de `"android"`, adicione `"googleServicesFile": "./google-services.json"`.
   4. Em Configurações do projeto → Contas de serviço, gere uma chave privada (arquivo JSON).
   5. Rode `eas credentials`, escolha Android → Google Service Account Key for Push Notifications (FCM V1) e envie esse JSON.
6. Build para desenvolvimento: `eas build -p android --profile development`
   - Instale o APK pelo link que aparece no fim e rode `npx expo start --dev-client`
7. Build para o piloto: `eas build -p android --profile preview`
   - Mande o link do APK para o dono e os motoristas instalarem

Sem o passo 5 o app funciona normalmente, mas sem notificações push (os avisos continuam na aba Avisos).

O iPhone usa o mesmo código; a build depende só da conta Apple Developer.
