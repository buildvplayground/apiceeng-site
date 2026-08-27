<?php
/**
 * Copie este arquivo para `db-config.php` no servidor e preencha com os dados reais.
 * `db-config.php` está no .gitignore e NUNCA deve ser versionado.
 */
return [
    'host'             => 'localhost',
    'database'         => 'NOME_DO_BANCO',
    'user'             => 'USUARIO_DO_BANCO',
    'password'         => 'SENHA_DO_BANCO',

    // Para onde vai o aviso de novo cadastro
    'notificar_email'  => 'contato@apicearqeng.com.br',

    // Remetente do aviso — deve ser um endereço do próprio domínio
    'remetente_email'  => 'no-reply@apicearqeng.com.br',
];
