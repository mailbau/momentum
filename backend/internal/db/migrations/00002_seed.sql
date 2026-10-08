-- +goose Up
insert into programs (code, name) values ('IT', 'Information Technology');

-- password: Admin123 (bcrypt hash generated at migration-write time)
insert into users (email, username, password_hash, first_name, last_name, role, program_id)
values (
  'admin@momentum.local',
  'admin',
  '$2a$10$wFqITXC1waborNLoNFzFbOVQw6jiTNmnPHJPRZIZg1FXHGjuLuEyC',
  'Momentum',
  'Admin',
  'admin',
  (select id from programs where code = 'IT')
);

-- +goose Down
delete from users where username = 'admin';
delete from programs where code = 'IT';
