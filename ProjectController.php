<?php
namespace Controllers;

use Models\ProjectModel;

class ProjectController {
    private $projectModel;
    private $basePath;

    public function __construct() {
        $this->projectModel = new ProjectModel();
        $this->basePath = __DIR__ . '/../../projects/';
    }

    // Helper to get authenticated user (from token)
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

    // LIST all projects for the user
    public function list() {
        $userId = $this->getUserId();
        $projects = $this->projectModel->getByUser($userId);
        echo json_encode($projects);
    }

    // CREATE a new project
    public function create() {
        $userId = $this->getUserId();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['name'])) {
            http_response_code(400);
            echo json_encode(["error" => "Project name is required"]);
            return;
        }

        $projectId = $this->projectModel->create($userId, $input['name'], $input['description'] ?? '');
        
        // Create physical folder
        $projectPath = $this->basePath . $userId . '/' . $projectId;
        if (!is_dir($projectPath)) {
            mkdir($projectPath, 0755, true);
        }

        http_response_code(201);
        echo json_encode([
            "message" => "Project created",
            "project" => [
                "id" => $projectId,
                "name" => $input['name'],
                "description" => $input['description'] ?? ''
            ]
        ]);
    }

    // GET a single project
    public function get($projectId) {
        $userId = $this->getUserId();
        $project = $this->projectModel->getById($projectId, $userId);
        if (!$project) {
            http_response_code(404);
            echo json_encode(["error" => "Project not found"]);
            return;
        }
        echo json_encode($project);
    }

    // UPDATE a project
    public function update($projectId) {
        $userId = $this->getUserId();
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['name'])) {
            http_response_code(400);
            echo json_encode(["error" => "Project name is required"]);
            return;
        }

        $updated = $this->projectModel->update($projectId, $userId, $input['name'], $input['description'] ?? '');
        if (!$updated) {
            http_response_code(404);
            echo json_encode(["error" => "Project not found or no changes"]);
            return;
        }

        echo json_encode(["message" => "Project updated"]);
    }

    // DELETE a project (also remove its folder)
    public function delete($projectId) {
        $userId = $this->getUserId();
        $project = $this->projectModel->getById($projectId, $userId);
        if (!$project) {
            http_response_code(404);
            echo json_encode(["error" => "Project not found"]);
            return;
        }

        // Delete physical folder recursively
        $projectPath = $this->basePath . $userId . '/' . $projectId;
        if (is_dir($projectPath)) {
            $this->deleteDirectory($projectPath);
        }

        $deleted = $this->projectModel->delete($projectId, $userId);
        echo json_encode(["message" => "Project deleted"]);
    }

    private function deleteDirectory($dir) {
        if (!file_exists($dir)) return true;
        if (!is_dir($dir)) return unlink($dir);
        foreach (scandir($dir) as $item) {
            if ($item == '.' || $item == '..') continue;
            if (!$this->deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return rmdir($dir);
    }
}