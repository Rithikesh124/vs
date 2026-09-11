<?php
namespace Controllers;

use Models\UserModel;

class AuthController {
    private $userModel;

    public function __construct() {
        $this->userModel = new UserModel();
    }

    public function register() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Basic validation
        if (empty($input['username']) || empty($input['email']) || empty($input['password'])) {
            http_response_code(400);
            echo json_encode(["error" => "Username, email, and password are required"]);
            return;
        }

        // Check if user exists
        if ($this->userModel->findByEmail($input['email'])) {
            http_response_code(409);
            echo json_encode(["error" => "Email already registered"]);
            return;
        }
        if ($this->userModel->findByUsername($input['username'])) {
            http_response_code(409);
            echo json_encode(["error" => "Username already taken"]);
            return;
        }

        // Create user
        $id = $this->userModel->create($input['username'], $input['email'], $input['password']);
        
        http_response_code(201);
        echo json_encode([
            "message" => "User registered successfully",
            "user" => [
                "id" => $id,
                "username" => $input['username'],
                "email" => $input['email']
            ]
        ]);
    }

    public function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['email']) || empty($input['password'])) {
            http_response_code(400);
            echo json_encode(["error" => "Email and password are required"]);
            return;
        }

        $user = $this->userModel->findByEmail($input['email']);
        if (!$user || !password_verify($input['password'], $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(["error" => "Invalid credentials"]);
            return;
        }

        // Generate JWT (simple base64 encoding for phase 1 - we'll add proper JWT library later)
        $payload = json_encode([
            "user_id" => $user['id'],
            "username" => $user['username'],
            "email" => $user['email'],
            "exp" => time() + 3600 * 24 // 24 hours
        ]);
        $token = base64_encode($payload);

        http_response_code(200);
        echo json_encode([
            "message" => "Login successful",
            "token" => $token,
            "user" => [
                "id" => $user['id'],
                "username" => $user['username'],
                "email" => $user['email']
            ]
        ]);
    }
}