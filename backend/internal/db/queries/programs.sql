-- name: ListPrograms :many
select * from programs order by name;

-- name: GetProgramByCode :one
select * from programs where code = $1;
