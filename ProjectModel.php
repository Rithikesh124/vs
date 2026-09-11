<?php
namespace Models;

use Core\Database;

class ProjectModel {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function create($userId, $name, $description = '') {
        $stmt = $this->db->prepare("INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $name, $description]);
        return $this->db->lastInsertId();
    }

    public function getByUser($userId) {
        $stmt = $this->db->prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC");
        $stmt->execute([$userId]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function getById($projectId, $userId) {
        $stmt = $this->db->prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?");
        $stmt->execute([$projectId, $userId]);
        return $stmt->fetch(\PDO::FETCH_ASSOC);
    }

    public function update($projectId, $userId, $name, $description) {
        $stmt = $this->db->prepare("UPDATE projects SET name = ?, description = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$name, $description, $projectId, $userId]);
        return $stmt->rowCount() > 0;
    }

    public function delete($projectId, $userId) {
        // First delete the physical folder (we'll handle in controller)
        $stmt = $this->db->prepare("DELETE FROM projects WHERE id = ? AND user_id = ?");
        $stmt->execute([$projectId, $userId]);
        return $stmt->rowCount() > 0;
    }
}