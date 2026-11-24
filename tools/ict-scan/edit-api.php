<?php
declare(strict_types=1);
/* ICT-scan write service. All GitHub credentials remain on the hosting server.
 * The authenticated shared editor can propose changes to the configured
 * register files and layouts only. No direct main write or general API proxy. */
const ICT_REPO = '/repos/E-AI-MODEL/website';
const ICT_SOURCE = 'tools/ict-scan/bronnen/';
const ICT_LAYOUT = 'tools/ict-scan/dashboard-layouts/layouts.json';
const ICT_MANIFEST = ICT_SOURCE . 'manifest.json';

function ict_fail(string $message, int $status = 400): void {
    throw new RuntimeException($message, $status);
}
function ict_sha($v): bool {
    return is_string($v) && preg_match('/^[a-f0-9]{40}$/D', $v) === 1;
}
function ict_private_dir(): string {
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if (!$root || $root === '/' || dirname($root) === $root) ict_fail('Bewerkservice niet ingericht.', 503);
    $dir = dirname($root) . '/.eai-ict-scan';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) ict_fail('Bewerkservice niet ingericht.', 503);
    $real = realpath($dir);
    if (!$real || $real === $root || str_starts_with($real, $root . '/') || !is_writable($real)) ict_fail('Bewerkservice niet ingericht.', 503);
    return $real;
}
function ict_config(string $dir): array {
    $raw = @file_get_contents($dir . '/editor.json', false, null, 0, 16384);
    $file = is_string($raw) ? json_decode($raw, true) : [];
    if (!is_array($file)) $file = [];
    $hash = getenv('ICT_SCAN_EDITOR_PASSWORD_HASH') ?: ($file['passwordHash'] ?? '');
    $token = getenv('ICT_SCAN_GITHUB_TOKEN') ?: ($file['githubToken'] ?? '');
    if (!is_string($hash) || password_get_info($hash)['algoName'] === 'unknown' ||
        !is_string($token) || strlen($token) < 20 || strlen($token) > 512 ||
        !function_exists('curl_init')) ict_fail('Opslaan op GitHub is nog niet ingericht op de server.', 503);
    return ['hash'=>$hash, 'token'=>$token, 'actor'=>'ICT-scan-editor'];
}
function ict_policy_files(array $profile): array {
    $src = $profile['source'] ?? [];
    if (($src['repository'] ?? '') !== 'E-AI-MODEL/website' || ($src['baseRef'] ?? '') !== 'main' ||
        ($src['sourceDir'] ?? '') !== rtrim(ICT_SOURCE, '/')) ict_fail('Organisatieprofiel niet ondersteund.', 503);
    $data = [];
    foreach (($src['registerFiles'] ?? []) as $name) {
        if (!is_string($name) || !preg_match('/^2026-[a-z]+\.json$/D', $name)) ict_fail('Onbekend registerpad.', 503);
        $data[ICT_SOURCE . $name] = true;
    }
    if (!$data) ict_fail('Registerpaden ontbreken.', 503);
    $config = [
        'tools/ict-scan/assurance/profiles/emmauscollege.json',
        'tools/ict-scan/frameworks.json',
        'tools/ict-scan/assurance/engine.js',
        'tools/ict-scan/assurance/source-register.js'
    ];
    return ['data'=>array_keys($data), 'read'=>array_merge(array_keys($data), [ICT_MANIFEST, ICT_LAYOUT], $config)];
}
function ict_no_secrets(string $value, array $cfg): void {
    if (str_contains($value, $cfg['token']) || str_contains($value, $cfg['hash']) ||
        preg_match('/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{15,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/', $value))
        ict_fail('Verwijder toegangssleutels uit de gegevens.');
}
function ict_exact(array $payload, array $keys): bool {
    $actual = array_keys($payload); sort($actual); sort($keys);
    return $actual === $keys;
}
/* Pure route policy. State is server-side; the browser cannot choose an
 * arbitrary repository, branch, path, upstream URL or permission level. */
function ict_route(string $method, string $url, array $body, array $state, array $files, array $cfg): array {
    $u = parse_url($url);
    if (!$u || ($u['scheme'] ?? '') !== 'https' || ($u['host'] ?? '') !== 'api.github.com' ||
        isset($u['port']) || isset($u['user']) || isset($u['pass']) || isset($u['fragment'])) ict_fail('GitHub-route niet toegestaan.', 403);
    $path = rawurldecode($u['path'] ?? '');
    $query = $u['query'] ?? '';
    if ($method === 'GET' && $path === '/user' && $query === '') return ['kind'=>'actor'];
    if (!str_starts_with($path, ICT_REPO . '/')) ict_fail('Repository niet toegestaan.', 403);
    $rel = substr($path, strlen(ICT_REPO));
    if ($method === 'GET' && !$body) {
        if ($rel === '/git/ref/heads/main' && $query === '') return ['kind'=>'head','path'=>$rel];
        if (str_starts_with($rel, '/contents/')) {
            $file = substr($rel, strlen('/contents/'));
            if (!in_array($file, $files['read'], true) || !ict_sha($state['base'] ?? null) ||
                $query !== 'ref=' . $state['base']) ict_fail('Bronpad of bronversie niet toegestaan.', 403);
            return ['kind'=>'read','path'=>$rel.'?'.$query,'file'=>$file];
        }
        if (preg_match('~^/git/blobs/([a-f0-9]{40})$~D', $rel, $m) && $query === '' &&
            in_array($m[1], array_values($state['seen'] ?? []), true)) return ['kind'=>'blob','path'=>$rel];
    }
    if ($query !== '') ict_fail('Schrijfroute niet toegestaan.', 403);
    if ($method === 'POST' && $rel === '/git/refs' && ict_exact($body, ['ref','sha'])) {
        if (!is_string($body['ref']) ||
            !preg_match('~^refs/heads/(applicatielandschap/(kaart|ontwerp)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-f0-9]{8})$~D', $body['ref'], $m) ||
            !ict_sha($body['sha']) || $body['sha'] !== ($state['base'] ?? null) ||
            count($state['branches'] ?? []) >= 8) ict_fail('Nieuwe wijzigingsbranch niet toegestaan. Synchroniseer opnieuw.', 409);
        return ['kind'=>'branch','path'=>$rel,'branch'=>$m[1],'type'=>$m[2],'body'=>$body];
    }
    if ($method === 'PUT' && str_starts_with($rel, '/contents/') && ict_exact($body, ['message','content','sha','branch'])) {
        $file = substr($rel, strlen('/contents/'));
        $branch = is_string($body['branch']) ? ($state['branches'][$body['branch']] ?? null) : null;
        if (!$branch || isset($branch['writes'][$file]) ||
            ($branch['type'] === 'ontwerp' ? $file !== ICT_LAYOUT :
                (!in_array($file, $files['data'], true) && $file !== ICT_MANIFEST)) ||
            ($branch['type'] === 'kaart' && isset($branch['writes'][ICT_MANIFEST])) ||
            !ict_sha($body['sha']) || $body['sha'] !== ($branch['seen'][$file] ?? null) ||
            !is_string($body['message']) || strlen($body['message']) > 500 ||
            !is_string($body['content']) || strlen($body['content']) > 2000000) ict_fail('Bestand of wijzigingsbranch niet toegestaan.', 403);
        $decoded = base64_decode($body['content'], true);
        $doc = is_string($decoded) ? json_decode($decoded, true) : null;
        $expectedSchema = $file === ICT_LAYOUT ? 'eai-ict-dashboard-designs-v1' :
            ($file === ICT_MANIFEST ? 'eai-school-ict-manifest-v1' : 'eai-school-ict-v1');
        if (!is_array($doc) || ($doc['schema'] ?? '') !== $expectedSchema) ict_fail('Onbekend bestandsformaat.');
        ict_no_secrets($decoded, $cfg); ict_no_secrets($body['message'], $cfg);
        if ($file === ICT_MANIFEST) {
            if (!$branch['writes'] || !is_array($doc['dataFiles'] ?? null)) ict_fail('Manifest zonder registerwijziging.');
            $manifest = [];
            foreach ($doc['dataFiles'] as $entry) {
                $p = ICT_SOURCE . ($entry['path'] ?? '');
                if (!in_array($p, $files['data'], true) || isset($manifest[$p]) || !ict_sha($entry['sha'] ?? null) ||
                    $entry['sha'] !== ($branch['writes'][$p] ?? $branch['seen'][$p] ?? null)) ict_fail('Manifest en bronbestanden komen niet overeen.');
                $manifest[$p] = true;
            }
            if (count($manifest) !== count($files['data'])) ict_fail('Manifest is onvolledig.');
        }
        return ['kind'=>'write','path'=>$rel,'branch'=>$body['branch'],'file'=>$file,'body'=>$body];
    }
    if ($method === 'POST' && $rel === '/pulls' && ict_exact($body, ['title','head','base','body'])) {
        $branch = is_string($body['head']) ? ($state['branches'][$body['head']] ?? null) : null;
        if (!$branch || ($body['base'] ?? '') !== 'main' ||
            ($branch['type'] === 'kaart' ? !isset($branch['writes'][ICT_MANIFEST]) : !isset($branch['writes'][ICT_LAYOUT])) ||
            !is_string($body['title']) || strlen($body['title']) > 300 ||
            !is_string($body['body']) || strlen($body['body']) > 100000) ict_fail('Wijzigingsvoorstel niet toegestaan.', 403);
        ict_no_secrets($body['title']."\n".$body['body'], $cfg);
        return ['kind'=>'pull','path'=>$rel,'branch'=>$body['head'],'body'=>$body];
    }
    ict_fail('GitHub-route niet toegestaan.', 403);
}
function ict_upstream(string $method, string $path, ?array $body, array $cfg): array {
    $h = curl_init('https://api.github.com' . ICT_REPO . $path);
    $headers = ['Accept: application/vnd.github+json', 'Authorization: Bearer ' . $cfg['token'],
        'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: EAI-ICT-scan-editor', 'Content-Type: application/json'];
    curl_setopt_array($h, [CURLOPT_CUSTOMREQUEST=>$method, CURLOPT_HTTPHEADER=>$headers, CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_FOLLOWLOCATION=>false, CURLOPT_CONNECTTIMEOUT=>8, CURLOPT_TIMEOUT=>30, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2]);
    if ($body !== null) curl_setopt($h, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    $result = curl_exec($h); $status = (int)curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
    if (!is_string($result) || $status < 200 || $status >= 300)
        ict_fail('GitHub kon het verzoek niet afronden' . ($status ? ' (HTTP '.$status.')' : '') . '. De bron is niet automatisch gepubliceerd.', 502);
    $data = json_decode($result, true);
    if (!is_array($data)) ict_fail('GitHub gaf geen geldig antwoord.', 502);
    // Do not forward an upstream response containing the server's own secret.
    if (str_contains($result, $cfg['token']) || str_contains($result, $cfg['hash'])) ict_fail('GitHub-antwoord afgeschermd.', 502);
    return $data;
}
function ict_record_result(array $route, array $data, array &$state): void {
    switch ($route['kind']) {
        case 'head':
            if (!ict_sha($data['object']['sha'] ?? null)) ict_fail('Geen geldige GitHub-versie.', 502);
            $state['base'] = $data['object']['sha']; $state['seen'] = []; break;
        case 'read':
            if (!ict_sha($data['sha'] ?? null)) ict_fail('Geen geldige bestandsversie.', 502);
            $state['seen'][$route['file']] = $data['sha']; break;
        case 'branch':
            $state['branches'][$route['branch']] = ['type'=>$route['type'], 'seen'=>$state['seen'] ?? [], 'writes'=>[]]; break;
        case 'write':
            if (!ict_sha($data['content']['sha'] ?? null)) ict_fail('Geen geldige nieuwe bestandsversie.', 502);
            $state['branches'][$route['branch']]['writes'][$route['file']] = $data['content']['sha']; break;
        case 'pull':
            unset($state['branches'][$route['branch']]); break;
    }
}
function ict_rate_limit(string $dir, array $cfg): void {
    // Store only a keyed network identifier, not raw addresses.
    $key = hash_hmac('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $cfg['hash']);
    $path = $dir . '/login-' . $key;
    $f = @fopen($path, 'c+');
    if (!$f) ict_fail('Aanmelden tijdelijk niet beschikbaar.', 503);
    @chmod($path, 0600);
    try {
        if (!flock($f, LOCK_EX)) ict_fail('Aanmelden tijdelijk niet beschikbaar.', 503);
        $old = json_decode(stream_get_contents($f, 4096) ?: '[]', true);
        $now = time(); $attempts = array_values(array_filter(is_array($old) ? $old : [], fn($t)=>is_int($t) && $t > $now-900));
        if (count($attempts) >= 6) ict_fail('Te veel pogingen. Probeer later opnieuw.', 429);
        $attempts[] = $now;
        rewind($f); ftruncate($f, 0); fwrite($f, json_encode($attempts)); fflush($f);
    } finally { fclose($f); }
    if (random_int(1, 32) === 1) foreach (glob($dir . '/login-*') ?: [] as $p) {
        if (is_file($p) && filemtime($p) < time()-86400) @unlink($p);
    }
}
function ict_respond(int $status, array $data): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
function ict_run(): void {
    ini_set('display_errors', '0');
    try {
        $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') ict_fail('Alleen POST toegestaan.', 405);
        if (!in_array($host, ['eaimodel.nl','www.eaimodel.nl'], true) ||
            ($_SERVER['HTTP_ORIGIN'] ?? '') !== 'https://' . $host) ict_fail('Herkomst niet toegestaan.', 403);
        if (!str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json') ||
            (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2200000) ict_fail('Ongeldig verzoek.');
        $input = json_decode(file_get_contents('php://input', false, null, 0, 2200001) ?: '', true);
        if (!is_array($input)) ict_fail('Ongeldig verzoek.');
        $dir = ict_private_dir(); $cfg = ict_config($dir);
        ini_set('session.use_strict_mode','1'); ini_set('session.use_only_cookies','1');
        session_name('ICTSCANEDITOR'); session_set_cookie_params(['lifetime'=>0, 'path'=>'/tools/ict-scan/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Strict']);
        if (!session_start()) ict_fail('Bewerksessie niet beschikbaar.', 503);
        $now = time();
        $active = isset($_SESSION['csrf'], $_SESSION['issued'], $_SESSION['last'], $_SESSION['config']) &&
            $_SESSION['issued'] + 14400 > $now && $_SESSION['last'] + 1800 > $now &&
            hash_equals(hash('sha256',$cfg['hash']),$_SESSION['config']);
        if (!$active) $_SESSION = [];
        $action = $input['action'] ?? '';
        if ($action === 'status') {
            if ($active) $_SESSION['last']=$now;
            ict_respond(200, ['unlocked'=>$active, 'csrf'=>$active?$_SESSION['csrf']:null]);
        }
        if ($action === 'login') {
            ict_rate_limit($dir, $cfg);
            $password = $input['password'] ?? '';
            if (!is_string($password) || strlen($password)>512 || !password_verify($password,$cfg['hash'])) ict_fail('Het wachtwoord klopt niet.', 401);
            session_regenerate_id(true);
            $_SESSION = ['csrf'=>bin2hex(random_bytes(32)), 'issued'=>$now, 'last'=>$now, 'config'=>hash('sha256',$cfg['hash']), 'branches'=>[]];
            ict_respond(200, ['unlocked'=>true,'csrf'=>$_SESSION['csrf']]);
        }
        if (!$active || !hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_ICT_CSRF'] ?? ''))) ict_fail('Bewerksessie verlopen. Ontgrendel opnieuw.', 401);
        $_SESSION['last']=$now;
        if ($action === 'logout') { $_SESSION=[]; session_destroy(); ict_respond(200,['unlocked'=>false]); }
        if ($action !== 'github') ict_fail('Onbekende handeling.', 403);
        $profile = json_decode(file_get_contents(__DIR__.'/assurance/profiles/emmauscollege.json'),true);
        if (!is_array($profile)) ict_fail('Organisatieprofiel ontbreekt.',503);
        $method = $input['method'] ?? ''; $url = $input['url'] ?? ''; $body = $input['payload'] ?? [];
        if (!is_string($method) || !is_string($url) || !is_array($body)) ict_fail('Ongeldig verzoek.');
        $route = ict_route($method,$url,$body,$_SESSION,ict_policy_files($profile),$cfg);
        if ($route['kind'] === 'actor') ict_respond(200,['data'=>['login'=>$cfg['actor']]]);
        $data = ict_upstream($method,$route['path'],$route['body'] ?? null,$cfg);
        ict_record_result($route,$data,$_SESSION);
        ict_respond(200,['data'=>$data]);
    } catch (Throwable $e) {
        $code = $e instanceof RuntimeException && in_array($e->getCode(),[400,401,403,405,409,429,502,503],true)?$e->getCode():503;
        ict_respond($code,['error'=>$code===503 && $e->getCode()!==503?'Bewerkservice tijdelijk niet beschikbaar.':$e->getMessage()]);
    }
}
if (PHP_SAPI !== 'cli') ict_run();
