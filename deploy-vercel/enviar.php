<?php
/**
 * Recebe o cadastro de Fornecedores / Trabalhe Conosco.
 * Grava no MySQL e envia um e-mail de aviso. Sem dependências externas.
 *
 * Requer db-config.php na mesma pasta (fora do git; ver db-config.example.php).
 */

declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Método não permitido.');
}

$config = @include __DIR__ . '/db-config.php';
if (!is_array($config)) {
    error_log('enviar.php: db-config.php ausente ou inválido.');
    responder(false, 'Não foi possível registrar o cadastro agora. Tente novamente mais tarde.');
}

/* ---------- Honeypot: se veio preenchido, é robô ---------- */
if (trim((string)($_POST['website'] ?? '')) !== '') {
    responder(true, 'Cadastro recebido. Obrigado!');
}

/* ---------- Coleta e validação ---------- */
$tipo     = in_array($_POST['tipo'] ?? '', ['fornecedor', 'candidato'], true) ? $_POST['tipo'] : 'fornecedor';
$nome     = limitar(trim((string)($_POST['nome'] ?? '')), 120);
$empresa  = limitar(trim((string)($_POST['empresa'] ?? '')), 120);
$email    = limitar(trim((string)($_POST['email'] ?? '')), 160);
$telefone = limitar(trim((string)($_POST['telefone'] ?? '')), 30);
$area     = limitar(trim((string)($_POST['area'] ?? '')), 120);
$mensagem = limitar(trim((string)($_POST['mensagem'] ?? '')), 2000);
$consent  = ($_POST['consentimento'] ?? '') === '1';

$erros = [];
if ($nome === '')                                     { $erros[] = 'informe seu nome'; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL))       { $erros[] = 'informe um e-mail válido'; }
if (preg_match('/\d/', $telefone) !== 1)              { $erros[] = 'informe um telefone válido'; }
if (!$consent)                                        { $erros[] = 'é preciso autorizar o tratamento dos dados'; }

if ($erros) {
    responder(false, 'Não foi possível enviar: ' . implode(', ', $erros) . '.');
}

/* ---------- Grava no banco ---------- */
$gravou = false;
try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['host'], $config['database']),
        $config['user'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS cadastros (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            tipo VARCHAR(20) NOT NULL,
            nome VARCHAR(120) NOT NULL,
            empresa VARCHAR(120) NULL,
            email VARCHAR(160) NOT NULL,
            telefone VARCHAR(30) NOT NULL,
            area VARCHAR(120) NULL,
            mensagem TEXT NULL,
            ip VARCHAR(45) NULL,
            criado_em DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $stmt = $pdo->prepare(
        'INSERT INTO cadastros (tipo, nome, empresa, email, telefone, area, mensagem, ip, criado_em)
         VALUES (:tipo, :nome, :empresa, :email, :telefone, :area, :mensagem, :ip, NOW())'
    );
    $stmt->execute([
        ':tipo'     => $tipo,
        ':nome'     => $nome,
        ':empresa'  => $empresa !== '' ? $empresa : null,
        ':email'    => $email,
        ':telefone' => $telefone,
        ':area'     => $area !== '' ? $area : null,
        ':mensagem' => $mensagem !== '' ? $mensagem : null,
        ':ip'       => $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
    $gravou = true;
} catch (Throwable $e) {
    error_log('enviar.php (banco): ' . $e->getMessage());
}

/* ---------- Avisa por e-mail ---------- */
if (!empty($config['notificar_email'])) {
    $rotulo  = $tipo === 'candidato' ? 'Trabalhe Conosco' : 'Fornecedor';
    $assunto = '=?UTF-8?B?' . base64_encode("[Site Ápice] Novo cadastro: {$rotulo}") . '?=';
    $corpo   = "Tipo: {$rotulo}\n"
             . "Nome: {$nome}\n"
             . "Empresa: " . ($empresa !== '' ? $empresa : 'não informada') . "\n"
             . "E-mail: {$email}\n"
             . "Telefone: {$telefone}\n"
             . "Área: " . ($area !== '' ? $area : 'não informada') . "\n\n"
             . "Mensagem:\n" . ($mensagem !== '' ? $mensagem : 'sem mensagem') . "\n\n"
             . 'Gravado no banco: ' . ($gravou ? 'sim' : 'NÃO, verifique o log') . "\n";

    $headers = "From: {$config['remetente_email']}\r\n"
             . "Reply-To: {$email}\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n";

    @mail($config['notificar_email'], $assunto, $corpo, $headers);
}

responder(true, 'Cadastro recebido. Obrigado, entraremos em contato se houver demanda compatível.');

/* ================= helpers ================= */

function limitar(string $v, int $max): string
{
    return mb_substr($v, 0, $max, 'UTF-8');
}

function responder(bool $ok, string $msg): void
{
    $aceitaJson = str_contains((string)($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
    if ($aceitaJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'mensagem' => $msg], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $titulo = $ok ? 'Cadastro enviado' : 'Não foi possível enviar';
    $seguro = htmlspecialchars($msg, ENT_QUOTES, 'UTF-8');
    http_response_code($ok ? 200 : 400);
    echo <<<HTML
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$titulo} | Ápice</title>
<link rel="stylesheet" href="assets/css/style.css"></head>
<body><main class="page"><div class="shell"><div class="page__inner">
<p class="eyebrow">Fornecedores</p><h1>{$titulo}</h1><p>{$seguro}</p>
<p style="margin-top:2rem"><a class="btn btn--ghost" href="index.html">Voltar ao site</a></p>
</div></div></main></body></html>
HTML;
    exit;
}
