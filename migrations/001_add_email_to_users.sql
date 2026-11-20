ALTER TABLE users
  ADD COLUMN email VARCHAR(254) NULL,
  ADD UNIQUE INDEX uq_users_email (email);
