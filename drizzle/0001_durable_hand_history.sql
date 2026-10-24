CREATE TABLE `poker_sessions` (
  `code` text PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `ended_at` integer,
  `settings` text NOT NULL
);

CREATE TABLE `poker_hand_history` (
  `room_code` text NOT NULL,
  `hand_number` integer NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer NOT NULL,
  `payload` text NOT NULL,
  PRIMARY KEY (`room_code`, `hand_number`)
);

CREATE TABLE `poker_hand_events` (
  `room_code` text NOT NULL,
  `hand_number` integer NOT NULL,
  `event_index` integer NOT NULL,
  `event_type` text NOT NULL,
  `happened_at` integer,
  `payload` text NOT NULL,
  PRIMARY KEY (`room_code`, `hand_number`, `event_index`)
);

CREATE INDEX `poker_hand_history_room_completed_idx` ON `poker_hand_history` (`room_code`, `completed_at` DESC);
