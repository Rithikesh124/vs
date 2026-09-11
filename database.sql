-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 10, 2026 at 10:41 PM
-- Server version: 10.11.17-MariaDB-cll-lve
-- PHP Version: 8.4.24

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `uwutpbkw_vs`
--

-- --------------------------------------------------------

--
-- Table structure for table `file_versions`
--

CREATE TABLE `file_versions` (
  `id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `content` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `file_versions`
--

INSERT INTO `file_versions` (`id`, `project_id`, `file_path`, `content`, `created_at`) VALUES
(1, 1, 'src/index.js', 'console.log(\"Hello World\");', '2026-09-10 00:48:22'),
(2, 2, 'index.js', '', '2026-09-10 14:35:59'),
(3, 2, 'index.js', 'const API_BASE = \'/api\';\n\nconst API = {\n  token: localStorage.getItem(\'token\') || null,\n\n  setToken(t) { this.token = t; localStorage.setItem(\'token\', t); },\n  clearToken() { this.token = null; localStorage.removeItem(\'token\'); },\n  setUser(u) { localStorage.setItem(\'user\', JSON.stringify(u)); },\n  getUser() {\n    try { return JSON.parse(localStorage.getItem(\'user\') || \'null\'); }\n    catch { return null; }\n  },\n  clearUser() { localStorage.removeItem(\'user\'); },\n  logout() { this.clearToken(); this.clearUser(); },\n\n  async request(method, path, body = null) {\n    const headers = {};\n    if (this.token) headers[\'Authorization\'] = \'Bearer \' + this.token;\n    if (body !== null) headers[\'Content-Type\'] = \'application/json\';\n\n    const opts = { method, headers };\n    if (body !== null) opts.body = JSON.stringify(body);\n\n    const res = await fetch(API_BASE + path, opts);\n    const text = await res.text();\n    let data;\n    try { data = JSON.parse(text); } catch { data = { error: text }; }\n\n    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);\n    return data;\n  },\n\n  get(p) { return this.request(\'GET\', p); },\n  post(p, b) { return this.request(\'POST\', p, b); },\n  put(p, b) { return this.request(\'PUT\', p, b); },\n  del(p, b) { return this.request(\'DELETE\', p, b); }\n};', '2026-09-10 14:36:27');

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `projects`
--

INSERT INTO `projects` (`id`, `user_id`, `name`, `description`, `created_at`, `updated_at`) VALUES
(1, 1, 'Test Project', 'My first project', '2026-09-09 18:47:27', '2026-09-09 18:47:27'),
(2, 2, '1st', '', '2026-09-10 14:35:10', '2026-09-10 14:35:10');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `created_at`) VALUES
(1, 'john_doe', 'john@example.com', '$2y$10$fAitsDBq7nORhDzjyezLk.c.H1fQUqdZ81AbG0mmJjeZNbUL1ct0a', '2026-09-09 18:41:28'),
(2, 'boss', 'choutakurinagal@gmail.com', '$2y$10$sJa3CsvMSB.iunijvwRTt.gOOJkKfBZOsTNAtzBvhurNc.r/hotsC', '2026-09-10 14:34:49'),
(3, 'Purnendra ', 'kpurnendra957@gmail.com', '$2y$10$0gki2roAC1P8fQEC4nQGzuqPUfopwDI/5VUnTASfcgKYgaI4mRPdy', '2026-09-10 16:50:38');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `file_versions`
--
ALTER TABLE `file_versions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- Indexes for table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `file_versions`
--
ALTER TABLE `file_versions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `file_versions`
--
ALTER TABLE `file_versions`
  ADD CONSTRAINT `file_versions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
