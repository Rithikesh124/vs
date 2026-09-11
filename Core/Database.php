<?php
namespace Core;

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        $host = 'localhost';
        $dbname = 'uwutpbkw_vs';
        $user = 'uwutpbkw_vs';
        $pass = 'uwutpbkw_vs';
        $this->pdo = new \PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
        $this->pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance->pdo;
    }
}
