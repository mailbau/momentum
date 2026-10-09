-- name: CreateCard :one
insert into cards (user_id, course_id, title, stage, position)
values ($1, $2, $3, 'planning', $4)
returning *;

-- name: GetCard :one
select * from cards where id = $1 and user_id = $2;

-- name: GetCardWithCourse :one
select c.*, co.code as course_code, co.name as course_name, ls.name as strategy_name
from cards c
join courses co on co.id = c.course_id
left join learning_strategies ls on ls.id = c.strategy_id
where c.id = $1 and c.user_id = $2;

-- name: GetCardAnyUser :one
select * from cards where id = $1;

-- name: ListActiveCards :many
select c.*, co.code as course_code, co.name as course_name, ls.name as strategy_name
from cards c
join courses co on co.id = c.course_id
left join learning_strategies ls on ls.id = c.strategy_id
where c.user_id = $1 and c.archived_at is null
order by c.stage, c.position;

-- name: ListArchivedCards :many
select * from cards
where user_id = $1 and archived_at is not null
order by archived_at desc;

-- name: NextPositionInStage :one
select (coalesce(max(position), 0) + 1024)::float8 as next_position
from cards
where user_id = $1 and stage = $2 and archived_at is null;

-- name: MoveCard :one
update cards
set stage = $3, position = $4, updated_at = now()
where id = $1 and user_id = $2
returning *;

-- name: UpdateCardDetail :one
update cards set
  description = $3,
  strategy_id = $4,
  difficulty = $5,
  priority = $6,
  pre_test = $7,
  post_test = $8,
  prior_knowledge = $9,
  notes = $10,
  rating = $11,
  updated_at = now()
where id = $1 and user_id = $2
returning *;

-- name: ArchiveCard :exec
update cards set archived_at = now(), archive_reason = $3
where id = $1 and user_id = $2;

-- name: RestoreCard :exec
update cards set archived_at = null, archive_reason = null
where id = $1 and user_id = $2;

-- name: DeleteCard :exec
delete from cards where id = $1 and user_id = $2;

-- Checklist items

-- name: CreateChecklistItem :one
insert into checklist_items (card_id, text, position)
values ($1, $2, $3)
returning *;

-- name: ListChecklistItemsByCardIDs :many
select * from checklist_items where card_id = any($1::uuid[]) order by position;

-- name: UpdateChecklistItem :one
update checklist_items set text = $2, done = $3 where id = $1
returning *;

-- name: DeleteChecklistItem :exec
delete from checklist_items where id = $1;

-- name: NextChecklistPosition :one
select (coalesce(max(position), 0) + 1024)::float8 as next_position from checklist_items where card_id = $1;

-- Links

-- name: CreateCardLink :one
insert into card_links (card_id, url, label)
values ($1, $2, $3)
returning *;

-- name: ListLinksByCardIDs :many
select * from card_links where card_id = any($1::uuid[]) order by id;

-- name: DeleteCardLink :exec
delete from card_links where id = $1;

-- Study sessions

-- name: StartStudySession :one
insert into study_sessions (user_id, card_id)
values ($1, $2)
returning *;

-- name: GetActiveStudySession :one
select * from study_sessions where user_id = $1 and ended_at is null;

-- name: StopStudySession :exec
update study_sessions set ended_at = now()
where user_id = $1 and ended_at is null;

-- name: TotalStudyMinutesByCardIDs :many
select card_id, coalesce(sum(extract(epoch from (coalesce(ended_at, now()) - started_at)) / 60), 0)::float8 as minutes
from study_sessions
where card_id = any($1::uuid[])
group by card_id;
