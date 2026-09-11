<?php
namespace Controllers;

use Models\ProjectModel;
use Core\Database;

class FileController {
    private $projectModel;
    private $basePath;

    public function __construct() {
        $this->projectModel = new ProjectModel();
        $this->basePath = realpath(__DIR__ . '/../../projects/');
    }

    // -------- Auth helper --------
    private function getUserId() {
        $headers = getallheaders();
        if (!isset($headers['Authorization'])) {
            http_response_code(401);
            echo json_encode(["error" => "Missing token"]);
            exit;
        }
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        $payload = json_decode(base64_decode($token), true);
        if (!$payload || !isset($payload['user_id']) || $payload['exp'] < time()) {
            http_response_code(401);
            echo json_encode(["error" => "Invalid or expired token"]);
            exit;
        }
        return $payload['user_id'];
    }

    // -------- Validate project ownership + return project path --------
    private function getProjectPath($projectId, $userId) {
        $project = $this->projectModel->getById($projectId, $userId);
        if (!$project) {
            http_response_code(404);
            echo json_encode(["error" => "Project not found"]);
            exit;
        }
        $path = $this->basePath . '/' . $userId . '/' . $projectId;
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
        return $path;
    }

    // -------- Prevent directory traversal --------
    private function safePath($base, $relative) {
        $relative = ltrim(str_replace(['..', '\\'], '', $relative), '/');
        $full = realpath($base . '/' . $relative);
        if ($full === false) {
            // For new files, verify path after normalizing manually
            $full = $base . '/' . $relative;
            $realBase = realpath($base);
            if (strpos(realpath(dirname($full)) ?: '', $realBase) !== 0) {
                http_response_code(400);
                echo json_encode(["error" => "Invalid path"]);
                exit;
            }
        }
        if (strpos($full, realpath($base)) !== 0) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid path"]);
            exit;
        }
        return $full;
    }

    // -------- LIST file tree --------
    public function tree($projectId) {
        $userId = $this->getUserId();
        $projectPath = $this->getProjectPath($projectId, $userId);
        $tree = $this->buildTree($projectPath, '');
        echo json_encode(["tree" => $tree]);
    }

    private function buildTree($dir, $relative) {
        $result = [];
        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') continue;
            $full = $dir . '/' . $item;
            $rel = $relative === '' ? $item : $relative . '/' . $item;
            if (is_dir($full)) {
                $result[] = [
                    "name" => $item,
                    "path" => $rel,
                    "type" => "folder",
                    "children" => $this->buildTree($full, $rel)
                ];
            } else {
                $result[] = [
                    "name" => $item,
                    "path" => $rel,
                    "type" => "file",
                    "size" => filesize($full)
                ];
            }
        }
        return $result;
    }

    // -------- READ file content --------
    public function read($projectId) {
        $userId = $this->getUserId();
        $projectPath = $this->getProjectPath($projectId, $userId);
        $filePath = $_GET['path'] ?? '';
        if ($filePath === '') {
            http_response_code(400);
            echo json_encode(["error" => "Missing path parameter"]);
            return;
        }
        $full = $this->safePath($projectPath, $filePath);
        if (!is_file($full)) {
            http_response_code(404);
            echo json_encode(["error" => "File not found"]);
            return;
        }
        echo json_encode([
            "path" => $filePath,
            "content" => file_get_contents($full),
            "size" => filesize($full),
            "modified" => date('c', filemtime($full))
        ]);
    }

    // -------- CREATE file or folder --------
    public function create($projectId) {
        $userId = $this->getUserId();
        $projectPath = $this->getProjectPath($projectId, $userId);
        $input = json_decode(file_get_contents('php://input'), true);

        $path = $input['path'] ?? '';
        $type = $input['type'] ?? 'file';
        if ($path === '') {
            http_response_code(400);
            echo json_encode(["error" => "Path required"]);
            return;
        }

        $full = $this->safePath($projectPath, $path);

        if (file_exists($full)) {
            http_response_code(409);
            echo json_encode(["error" => "Already exists"]);
            return;
        }

        if ($type === 'folder') {
            if (!mkdir($full, 0755, true)) {
                http_response_code(500);
                echo json_encode(["error" => "Failed to create folder"]);
                return;
            }
        } else {
            $parent = dirname($full);
            if (!is_dir($parent)) mkdir($parent, 0755, true);
            if (file_put_contents($full, $input['content'] ?? '') === false) {
                http_response_code(500);
                echo json_encode(["error" => "Failed to create file"]);
                return;
            }
        }

        http_response_code(201);
        echo json_encode([
            "message" => "Created",
            "path" => $path,
            "type" => $type
        ]);
    }

    // -------- UPDATE file content --------
    public function update($projectId) {
        $userId = $this->getUserId();
        $projectPath = $this->getProjectPath($projectId, $userId);
        $input = json_decode(file_get_contents('php://input'), true);

        $path = $input['path'] ?? '';
        if ($path === '' || !isset($input['content'])) {
            http_response_code(400);
            echo json_encode(["error" => "path and content required"]);
            return;
        }

        $full = $this->safePath($projectPath, $path);
        if (!is_file($full)) {
            http_response_code(404);
            echo json_encode(["error" => "File not found"]);
            return;
        }

        // Save version before overwriting
        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO file_versions (project_id, file_path, content) VALUES (?, ?, ?)");
        $stmt->execute([$projectId, $path, file_get_contents($full)]);

        if (file_put_contents($full, $input['content']) === false) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to write file"]);
            return;
        }

        echo json_encode(["message" => "File saved", "path" => $path]);
    }

    // -------- DELETE file or folder --------
    public function delete($projectId) {
        $userId = $this->getUserId();
        $projectPath = $this->getProjectPath($projectId, $userId);
        $input = json_decode(file_get_contents('php://input'), true);
        $path = $input['path'] ?? '';
        if ($path === '') {
            http_response_code(400);
            echo json_encode(["error" => "Path required"]);
            return;
        }
        $full = $this->safePath($projectPath, $path);
        if (!file_exists($full)) {
            http_response_code(404);
            echo json_encode(["error" => "Not found"]);
            return;
        }
        if (is_dir($full)) {
            $this->deleteDir($full);
        } else {
            unlink($full);
        }
        echo json_encode(["message" => "Deleted", "path" => $path]);
    }

    private function deleteDir($dir) {
        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') continue;
            $p = $dir . '/' . $item;
            is_dir($p) ? $this->deleteDir($p) : unlink($p);
        }
        rmdir($dir);
    }

    // -------- RENAME / MOVE --------
    public function rename($projectId) {
        $userId = $this->getUserId();
        $projectPath = $this->getProjectPath($projectId, $userId);
        $input = json_decode(file_get_contents('php://input'), true);

        $from = $input['from'] ?? '';
        $to = $input['to'] ?? '';
        if ($from === '' || $to === '') {
            http_response_code(400);
            echo json_encode(["error" => "from and to required"]);
            return;
        }

        $src = $this->safePath($projectPath, $from);
        $dst = $this->safePath($projectPath, $to);

        if (!file_exists($src)) {
            http_response_code(404);
            echo json_encode(["error" => "Source not found"]);
            return;
        }
        if (file_exists($dst)) {
            http_response_code(409);
            echo json_encode(["error" => "Destination already exists"]);
            return;
        }

        $dstParent = dirname($dst);
        if (!is_dir($dstParent)) mkdir($dstParent, 0755, true);

        if (!rename($src, $dst)) {
            http_response_code(500);
            echo json_encode(["error" => "Rename failed"]);
            return;
        }
        echo json_encode(["message" => "Renamed", "from" => $from, "to" => $to]);
    }
}