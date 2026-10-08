-- name: CreateUser :one
insert into users (email, username, password_hash, first_name, last_name, role, program_id)
values ($1, $2, $3, $4, $5, $6, $7)
returning *;

-- name: GetUserByID :one
select * from users where id = $1;

-- name: GetUserByEmailOrUsername :one
select * from users where email = $1 or username = $1;

-- name: UpdateUserProfile :one
update users
set first_name = $2, last_name = $3, email = $4, username = $5
where id = $1
returning *;

-- name: UpdateUserPassword :exec
update users set password_hash = $2 where id = $1;

-- name: MarkUserOnboarded :exec
update users set onboarded_at = now() where id = $1;

-- name: CountUsers :one
select count(*) from users;

-- name: ListUsers :many
select * from users
where ($1::text = '' or email ilike '%' || $1 || '%' or username ilike '%' || $1 || '%'
       or first_name ilike '%' || $1 || '%' or last_name ilike '%' || $1 || '%')
order by created_at desc
limit $2 offset $3;
