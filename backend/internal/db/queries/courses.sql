-- name: ListCourses :many
select * from courses order by code;

-- name: ListStrategies :many
select * from learning_strategies order by name;
