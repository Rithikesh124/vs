<?php
// ============================================================
// CORS
// ============================================================
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Serve homepage
if ($_SERVER['REQUEST_URI'] === '/' || $_SERVER['REQUEST_URI'] === '/index.php') {
    readfile(__DIR__ . '/index.html');
    exit;
}

// Autoloader
spl_autoload_register(function ($class) {
    $file = __DIR__ . '/src/' . str_replace('\\', '/', $class) . '.php';
    if (file_exists($file)) require $file;
});

// Parse request
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$endpoint = str_replace('/api', '', $path);
$method = $_SERVER['REQUEST_METHOD'];

try {
    // ---------- HEALTH ----------
    if ($endpoint === '/health' && $method === 'GET') {
        $pdo = new PDO("mysql:host=localhost;dbname=uwutpbkw_vs;charset=utf8mb4", "uwutpbkw_vs", "uwutpbkw_vs");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        echo json_encode(["status" => "OK", "db" => "connected", "time" => date('c')]);
        exit;
    }

    // ---------- AUTH ----------
    if ($endpoint === '/auth/register' && $method === 'POST') {
        (new \Controllers\AuthController())->register();
        exit;
    }
    if ($endpoint === '/auth/login' && $method === 'POST') {
        (new \Controllers\AuthController())->login();
        exit;
    }

    // ---------- PROJECTS & FILES ----------
    if (preg_match('#^/projects/(\d+)(/files.*)?$#', $endpoint, $matches)) {
        $projectId = (int)$matches[1];
        $fileSub = $matches[2] ?? '';

        // ----- FILES routes -----
        if ($fileSub !== '') {
            $controller = new \Controllers\FileController();

            // /projects/{id}/files  => list tree (GET) or create (POST)
            if ($fileSub === '/files') {
                if ($method === 'GET') {
                    $controller->tree($projectId);
                } elseif ($method === 'POST') {
                    $controller->create($projectId);
                } else {
                    http_response_code(405);
                    echo json_encode(["error" => "Method not allowed"]);
                }
                exit;
            }

            // /projects/{id}/files/read?path=...  => read
            if ($fileSub === '/files/read' && $method === 'GET') {
                $controller->read($projectId);
                exit;
            }

            // /projects/{id}/files/update  => update content
            if ($fileSub === '/files/update' && $method === 'PUT') {
                $controller->update($projectId);
                exit;
            }

            // /projects/{id}/files/delete  => delete
            if ($fileSub === '/files/delete' && $method === 'DELETE') {
                $controller->delete($projectId);
                exit;
            }

            // /projects/{id}/files/rename  => rename/move
            if ($fileSub === '/files/rename' && $method === 'POST') {
                $controller->rename($projectId);
                exit;
            }

            http_response_code(404);
            echo json_encode(["error" => "File endpoint not found"]);
            exit;
        }

        // ----- PROJECT root routes -----
        $controller = new \Controllers\ProjectController();
        if ($method === 'GET') {
            $controller->get($projectId);
        } elseif ($method === 'PUT') {
            $controller->update($projectId);
        } elseif ($method === 'DELETE') {
            $controller->delete($projectId);
        } else {
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
        }
        exit;
    }

    // ---------- PROJECTS (list/create) ----------
    if ($endpoint === '/projects') {
        $controller = new \Controllers\ProjectController();
        if ($method === 'GET') {
            $controller->list();
        } elseif ($method === 'POST') {
            $controller->create();
        } else {
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
        }
        exit;
    }

    // ---------- 404 ----------
    http_response_code(404);
    echo json_encode(["error" => "Endpoint not found"]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}