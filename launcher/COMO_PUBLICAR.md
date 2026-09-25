# Publicação e Distribuição

## 1. Publicar o Aplicativo Principal
Para o launcher baixar a atualização, o aplicativo Gestão Sucena precisa ser compilado e o arquivo `.zip` enviado ao GitHub.

**Como fazer:**
1. Abra o terminal na pasta `electron-wrapper` (que fica na raiz do gestaosucena principal).
2. Rode `npm run build`.
3. O arquivo gerado estará na pasta `electron-wrapper/dist-release/GestaoSucena-1.0.0-win.zip`.
4. Vá no seu repositório no GitHub (`faahsiilvaf10-star/gestaosucena`) > **Releases** > **Draft a new release**.
5. Crie a tag `v1.0.0` e faça o upload deste `.zip`.
*O Launcher buscará automaticamente o arquivo `.zip` na sua Release.*

## 2. Compilar o Instalador do Launcher (NSIS)
Este é o `.exe` que você enviará aos seus clientes para instalarem o sistema na máquina deles pela primeira vez.

**Como fazer:**
1. Abra o terminal nesta pasta do Launcher (`gestaosucena/launcher`).
2. Rode `npm run dist`.
3. O `electron-builder` criará o instalador executável na pasta `launcher/dist-release/`.
4. Entregue este executável `.exe` ao seu cliente. Ele é o Launcher que instalará o Gestão Sucena e gerenciará todas as futuras atualizações automaticamente.
