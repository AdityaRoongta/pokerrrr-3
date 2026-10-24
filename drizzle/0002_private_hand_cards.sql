CREATE TABLE `poker_hand_private_cards` (
  `room_code` text NOT NULL,
  `hand_number` integer NOT NULL,
  `player_key` text NOT NULL,
  `seat` integer NOT NULL,
  `name` text NOT NULL,
  `cards` text NOT NULL,
  PRIMARY KEY (`room_code`, `hand_number`, `player_key`)
);

CREATE INDEX `poker_hand_private_cards_player_idx` ON `poker_hand_private_cards` (`room_code`, `player_key`, `hand_number`);
