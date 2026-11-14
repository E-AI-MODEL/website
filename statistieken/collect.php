<?php
declare(strict_types=1);
/**
 * First-party, low-impact visit measurement for eaimodel.nl.
 * Stores only HMACs of random browser/session IDs and coarse public page actions.
 * Raw IDs, IPs, referrers, query strings and entered text are never persisted.
 * Storage must be writable OUTSIDE the public document root or the endpoint fails closed.
 */
ini_set('display_errors', '0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function respond(int $code, array $body = []): void {
    http_response_code($code);
    if ($body) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
    exit;
}

function storage_dir(): string {
    $root = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if (!$root || $root === '/' || dirname($root) === $root) {
        throw new RuntimeException('invalid document root');
    }
    $dir = dirname($root) . '/.eai-first-party-analytics';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('private storage unavailable');
    }
    if (!is_writable($dir)) {
        throw new RuntimeException('private storage unwritable');
    }
    return $dir;
}

function secret_key(string $dir): string {
    $file = $dir . '/secret.key';
    if (!is_file($file)) {
        $handle = @fopen($file, 'x');
        if ($handle !== false) {
            @chmod($file, 0600);
            fwrite($handle, bin2hex(random_bytes(32)));
            fclose($handle);
        }
    }
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $value = @file_get_contents($file);
        if (is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value)) {
            return $value;
        }
        usleep(50000);
    }
    throw new RuntimeException('secret key unavailable');
}

function allowed_page(string $path): bool {
    if (strlen($path) > 140 || !preg_match('~^/(?:[a-z0-9_-]+/){0,9}$~D', $path)) {
        return false;
    }
    static $sitemap = null;
    if ($sitemap === null) {
        $sitemap = @file_get_contents(dirname(__DIR__) . '/sitemap.xml');
    }
    if (!is_string($sitemap) || $sitemap === '') {
        return false;
    }
    return strpos($sitemap, '<loc>https://eaimodel.nl' . $path . '</loc>') !== false;
}

function read_bucket(string $file): array {
    $handle = @fopen($file, 'r');
    if ($handle === false) {
        return ['sessions' => []];
    }
    try {
        if (!flock($handle, LOCK_SH)) {
            return ['sessions' => []];
        }
        $raw = stream_get_contents($handle, 5000000);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) && isset($data['sessions']) && is_array($data['sessions'])
        ? $data : ['sessions' => []];
}

function edit_bucket(string $file, callable $edit): void {
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        throw new RuntimeException('cannot open bucket');
    }
    @chmod($file, 0600);
    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('cannot lock bucket');
        }
        $raw = stream_get_contents($handle, 5000000);
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data) || !isset($data['sessions']) || !is_array($data['sessions'])) {
            $data = ['sessions' => []];
        }
        if (strlen($raw ?: '') > 4000000) {
            throw new RuntimeException('daily bucket limit');
        }
        $edit($data);
        $encoded = json_encode($data, JSON_UNESCAPED_SLASHES);
        if ($encoded === false || strlen($encoded) > 4200000) {
            throw new RuntimeException('daily bucket full');
        }
        rewind($handle);
        if (!ftruncate($handle, 0) || fwrite($handle, $encoded) !== strlen($encoded)) {
            throw new RuntimeException('cannot write bucket');
        }
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
}

function percent_or_null(int $part, int $whole): ?float {
    return $whole >= 5 ? round(100.0 * $part / $whole, 1) : null;
}

function summarize_sessions(array $buckets, int $days, int $now): array {
    $cutoff = gmdate('Y-m-d', $now - ($days - 1) * 86400);
    $visitors = [];
    $visits = 0;
    $views = 0;
    $clicks = 0;
    $closed = 0;
    $bounced = 0;
    $pages = [];
    $targets = [];
    foreach ($buckets as $date => $bucket) {
        if ($date < $cutoff) {
            continue;
        }
        foreach (($bucket['sessions'] ?? []) as $session) {
            if (!is_array($session) || empty($session['v']) || empty($session['p']) || !is_array($session['p'])) {
                continue;
            }
            $visits++;
            $visitors[$session['v']] = true;
            $pageHits = 0;
            $last = (int) ($session['last'] ?? 0);
            $isClosed = $last + 1800 <= $now;
            foreach ($session['p'] as $path => $count) {
                if (!allowed_page((string) $path)) {
                    continue;
                }
                $count = max(0, (int) $count);
                $views += $count;
                $pageHits += $count;
                if (!isset($pages[$path])) {
                    $pages[$path] = ['path' => $path, 'views' => 0, 'visits' => 0, 'clicks' => 0,
                        '_closed' => 0, '_bounced' => 0];
                }
                $pages[$path]['views'] += $count;
                $pages[$path]['visits']++;
            }
            $isBounce = $pageHits <= 1 && empty($session['e']);
            if ($isClosed) {
                $closed++;
                if ($isBounce) {
                    $bounced++;
                }
                $landing = (string) ($session['land'] ?? '');
                if (isset($pages[$landing])) {
                    $pages[$landing]['_closed']++;
                    if ($isBounce) {
                        $pages[$landing]['_bounced']++;
                    }
                }
            }
            foreach (($session['c'] ?? []) as $path => $names) {
                if (!isset($pages[$path]) || !is_array($names)) {
                    continue;
                }
                foreach ($names as $name => $amount) {
                    if (!is_string($name) || !preg_match('~^(link|knop|invoer):[a-z0-9/_-]{1,90}$~D', $name)) {
                        continue;
                    }
                    $amount = max(0, (int) $amount);
                    $clicks += $amount;
                    $pages[$path]['clicks'] += $amount;
                    $key = $path . "\t" . $name;
                    $targets[$key] = ($targets[$key] ?? 0) + $amount;
                }
            }
        }
    }
    foreach ($pages as &$page) {
        $page['bounce_rate'] = percent_or_null($page['_bounced'], $page['_closed']);
        unset($page['_closed'], $page['_bounced']);
    }
    unset($page);
    usort($pages, fn($a, $b) => $b['views'] <=> $a['views']);
    arsort($targets, SORT_NUMERIC);
    $clickTargets = [];
    foreach ($targets as $key => $amount) {
        if ($amount < 5 || count($clickTargets) >= 40) {
            continue;
        }
        [$path, $name] = explode("\t", $key, 2);
        $clickTargets[] = ['page' => $path, 'target' => $name, 'clicks' => $amount];
    }
    return [
        'unique_visitors' => $visits ? count($visitors) : null,
        'visits' => $visits,
        'views' => $views,
        'bounce_rate' => percent_or_null($bounced, $closed),
        'clicks' => $visits ? $clicks : null,
        'pages' => array_values(array_filter(array_slice($pages, 0, 30), fn($p) => $p['views'] >= 5)),
        'click_targets' => $clickTargets,
        'completed_sessions' => $closed,
    ];
}

function stats(string $dir): array {
    $now = time();
    $buckets = [];
    for ($i = 29; $i >= 0; $i--) {
        $date = gmdate('Y-m-d', $now - $i * 86400);
        $buckets[$date] = read_bucket($dir . '/' . $date . '.json');
    }
    $last30 = summarize_sessions($buckets, 30, $now);
    $last7 = summarize_sessions($buckets, 7, $now);
    return [
        'schema' => 2,
        'source' => 'EAI first-party analytics',
        'updated_at' => gmdate('c', $now),
        'visits' => $last30['visits'],
        'unique_visitors' => $last30['unique_visitors'],
        'bounce_rate' => $last30['bounce_rate'],
        'clicks' => $last30['clicks'],
        'pages' => $last30['pages'],
        'click_targets' => $last30['click_targets'],
        'completed_sessions' => $last30['completed_sessions'],
        'period_metrics' => [
            '7' => ['unique_visitors' => $last7['unique_visitors'], 'bounce_rate' => $last7['bounce_rate'],
                'clicks' => $last7['clicks']],
            '30' => ['unique_visitors' => $last30['unique_visitors'], 'bounce_rate' => $last30['bounce_rate'],
                'clicks' => $last30['clicks']],
        ],
    ];
}

function accept_event(string $dir): void {
    $host = strtolower(explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0]);
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (!in_array($host, ['eaimodel.nl', 'www.eaimodel.nl'], true) ||
        !in_array($origin, ['https://eaimodel.nl', 'https://www.eaimodel.nl'], true)) {
        respond(403);
    }
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length < 1 || $length > 550 || !str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json')) {
        respond(400);
    }
    $body = json_decode(file_get_contents('php://input', false, null, 0, 600) ?: '', true);
    if (!is_array($body) || ($body['version'] ?? null) !== 1) {
        respond(400);
    }
    $visitor = $body['visitor'] ?? null;
    $session = $body['session'] ?? null;
    $event = $body['event'] ?? null;
    $path = $body['path'] ?? null;
    $target = $body['target'] ?? '';
    if (!is_string($visitor) || !preg_match('/^[0-9a-f]{32}$/D', $visitor) ||
        !is_string($session) || !preg_match('/^[0-9a-f]{32}$/D', $session) ||
        !is_string($path) || !allowed_page($path) ||
        !in_array($event, ['view', 'engage', 'click'], true)) {
        respond(400);
    }
    if ($event === 'click' && (!is_string($target) || !preg_match('~^(link|knop|invoer):[a-z0-9/_-]{1,90}$~D', $target))) {
        respond(400);
    }
    $key = secret_key($dir);
    $v = hash_hmac('sha256', 'v:' . $visitor, $key);
    $s = hash_hmac('sha256', 's:' . $session, $key);
    $now = time();
    $date = gmdate('Y-m-d', $now);
    edit_bucket($dir . '/' . $date . '.json', function (&$data) use ($event, $v, $s, $path, $target, $now) {
        $sessions = &$data['sessions'];
        if (!isset($sessions[$s])) {
            if ($event !== 'view' || count($sessions) > 15000) {
                return;
            }
            $sessions[$s] = ['v' => $v, 'start' => $now, 'last' => $now,
                'land' => $path, 'p' => [], 'c' => [], 'e' => 0];
        }
        $item = &$sessions[$s];
        if ($item['v'] !== $v || $now - (int) ($item['last'] ?? $now) > 1800) {
            return;
        }
        $item['last'] = $now;
        if ($event === 'view') {
            $item['p'][$path] = min(100, ($item['p'][$path] ?? 0) + 1);
        } elseif ($event === 'engage') {
            if (isset($item['p'][$path])) {
                $item['e'] = 1;
            }
        } elseif (isset($item['p'][$path])) {
            $item['e'] = 1;
            if (!isset($item['c'][$path])) {
                $item['c'][$path] = [];
            }
            $item['c'][$path][$target] = min(250, ($item['c'][$path][$target] ?? 0) + 1);
        }
    });
    // Retain at most 32 complete days; no identifiers are kept beyond that.
    if (random_int(1, 30) === 1) {
        $cutoff = gmdate('Y-m-d', $now - 32 * 86400);
        foreach (glob($dir . '/20??-??-??.json') ?: [] as $file) {
            $day = basename($file, '.json');
            if ($day < $cutoff) {
                @unlink($file);
            }
        }
    }
    respond(204);
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'POST') {
        respond(405);
    }
    $dir = storage_dir();
    if ($method === 'GET') {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, max-age=0');
        echo json_encode(stats($dir), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    accept_event($dir);
} catch (Throwable $error) {
    error_log('EAI analytics: ' . get_class($error));
    respond(503, ['error' => 'Meting tijdelijk niet beschikbaar']);
}
