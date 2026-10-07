# Frotos - app do proprietário

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

Libere a porta **54321** (API do Supabase) no Firewall do Windows, e confira se o IP no `.env` é o do PC na rede atual.

## Testes

```bash
npx tsc --noEmit
npx jest
```
