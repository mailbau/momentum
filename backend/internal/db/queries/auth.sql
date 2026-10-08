-- name: CreateRefreshToken :one
insert into refresh_tokens (user_id, token_hash, expires_at)
values ($1, $2, $3)
returning *;

-- name: GetRefreshToken :one
select * from refresh_tokens
where token_hash = $1 and revoked_at is null and expires_at > now();

-- name: RevokeRefreshToken :exec
update refresh_tokens set revoked_at = now() where token_hash = $1;

-- name: RevokeAllUserRefreshTokens :exec
update refresh_tokens set revoked_at = now()
where user_id = $1 and revoked_at is null;

-- name: CreatePasswordReset :exec
insert into password_resets (token_hash, user_id, expires_at)
values ($1, $2, $3);

-- name: GetPasswordReset :one
select * from password_resets
where token_hash = $1 and used_at is null and expires_at > now();

-- name: ConsumePasswordReset :exec
update password_resets set used_at = now() where token_hash = $1;

-- name: CreateEvent :exec
insert into events (user_id, card_id, type, data)
values ($1, $2, $3, $4);

-- name: ListEvents :many
select e.*, u.username
from events e
left join users u on u.id = e.user_id
where ($1::text = '' or e.type = $1)
order by e.created_at desc
limit $2 offset $3;
