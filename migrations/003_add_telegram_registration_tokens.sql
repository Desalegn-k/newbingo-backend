CREATE TABLE telegram_registration_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  telegram_user_id BIGINT UNSIGNED NOT NULL,
  phone VARCHAR(20) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_telegram_registration_tokens_hash (token_hash),
  KEY idx_telegram_registration_tokens_expiry (expires_at, used_at)
);
