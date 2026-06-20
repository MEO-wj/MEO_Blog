package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// --- GuestbookMessage ---

type GuestbookMessage struct {
	ID               string             `json:"id"`
	Nickname         string             `json:"nickname"`
	AvatarURL        string             `json:"avatarUrl"`
	Content          string             `json:"content"`
	ParentID         *string            `json:"parentId,omitempty"`
	IsAdminReply     bool               `json:"isAdminReply"`
	AdminDisplayName string             `json:"adminDisplayName,omitempty"`
	AdminAvatarURL   string             `json:"adminAvatarUrl,omitempty"`
	ModerationStatus string             `json:"moderationStatus"`
	CreatedAt        string             `json:"createdAt"`
	CanDelete        bool               `json:"canDelete"`
	Replies          []GuestbookMessage `json:"replies,omitempty"`
}

type GuestbookModerationStats struct {
	Pending   int `json:"pending"`
	Published int `json:"published"`
}

type GuestbookModerationQueue struct {
	Stats    GuestbookModerationStats `json:"stats"`
	Messages []GuestbookMessage       `json:"messages"`
}

type GuestbookMessageCreate struct {
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatarUrl"`
	Content   string `json:"content"`
}

type GuestbookReplyCreate struct {
	Content          string `json:"content"`
	AdminDisplayName string `json:"adminDisplayName"`
	AdminAvatarURL   string `json:"adminAvatarUrl"`
}

const guestbookSelectCols = `id, nickname, coalesce(avatar_url,''), content,
	parent_id, is_admin_reply, coalesce(admin_display_name,''), coalesce(admin_avatar_url,''),
	moderation_status, created_at`

func scanGuestbookMessageWithIP(row pgx.Row, clientIP string) (*GuestbookMessage, error) {
	var m GuestbookMessage
	var createdAt time.Time
	var ip *string
	err := row.Scan(
		&m.ID, &m.Nickname, &m.AvatarURL, &m.Content,
		&m.ParentID, &m.IsAdminReply, &m.AdminDisplayName, &m.AdminAvatarURL, &m.ModerationStatus, &createdAt, &ip,
	)
	if err != nil {
		return nil, err
	}
	m.CreatedAt = createdAt.Format(time.RFC3339)
	if clientIP != "" && ip != nil && *ip == clientIP {
		m.CanDelete = true
	}
	return &m, nil
}

func scanGuestbookMessage(row pgx.Row) (*GuestbookMessage, error) {
	var m GuestbookMessage
	var createdAt time.Time
	err := row.Scan(
		&m.ID, &m.Nickname, &m.AvatarURL, &m.Content,
		&m.ParentID, &m.IsAdminReply, &m.AdminDisplayName, &m.AdminAvatarURL, &m.ModerationStatus, &createdAt,
	)
	if err != nil {
		return nil, err
	}
	m.CreatedAt = createdAt.Format(time.RFC3339)
	return &m, nil
}

func ListGuestbookMessages(ctx context.Context, db *pgxpool.Pool, clientIP string) ([]GuestbookMessage, error) {
	// Query 1: top-level messages with IP for ownership check
	rows, err := db.Query(ctx,
		`SELECT `+guestbookSelectCols+`, coalesce(cast(ip_address as text),'')
		 FROM guestbook_messages
		 WHERE parent_id IS NULL
		   AND moderation_status = 'published'
		 ORDER BY created_at DESC
		 LIMIT 100`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []GuestbookMessage
	for rows.Next() {
		m, err := scanGuestbookMessageWithIP(rows, clientIP)
		if err != nil {
			return nil, err
		}
		m.Replies = []GuestbookMessage{}
		messages = append(messages, *m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if messages == nil {
		messages = []GuestbookMessage{}
	}

	// Query 2: all replies with IP
	replyRows, err := db.Query(ctx,
		`SELECT `+guestbookSelectCols+`, coalesce(cast(ip_address as text),'')
		 FROM guestbook_messages
		 WHERE parent_id IS NOT NULL
		   AND moderation_status = 'published'
		 ORDER BY created_at ASC
		 LIMIT 500`,
	)
	if err != nil {
		return nil, err
	}
	defer replyRows.Close()

	replyMap := make(map[string][]GuestbookMessage)
	for replyRows.Next() {
		r, err := scanGuestbookMessageWithIP(replyRows, clientIP)
		if err != nil {
			return nil, err
		}
		if r.ParentID != nil {
			replyMap[*r.ParentID] = append(replyMap[*r.ParentID], *r)
		}
	}
	if err := replyRows.Err(); err != nil {
		return nil, err
	}

	// Attach replies to parent messages
	for i := range messages {
		if replies, ok := replyMap[messages[i].ID]; ok {
			messages[i].Replies = replies
		}
	}

	return messages, nil
}

func CreateGuestbookMessage(ctx context.Context, db *pgxpool.Pool, clientIP string, c *GuestbookMessageCreate) (*GuestbookMessage, error) {
	return scanGuestbookMessage(db.QueryRow(ctx,
		`INSERT INTO guestbook_messages (nickname, avatar_url, content, ip_address, moderation_status)
		 VALUES ($1, $2, $3, $4::inet, 'pending')
		 RETURNING `+guestbookSelectCols,
		c.Nickname, c.AvatarURL, c.Content, clientIP,
	))
}

func CreateGuestbookReply(ctx context.Context, db *pgxpool.Pool, messageID string, c *GuestbookReplyCreate) (*GuestbookMessage, error) {
	return scanGuestbookMessage(db.QueryRow(ctx,
		`INSERT INTO guestbook_messages (nickname, content, parent_id, is_admin_reply, admin_display_name, admin_avatar_url, moderation_status, reviewed_at)
		 VALUES ($1, $2, $3, true, $4, $5, 'published', now())
		 RETURNING `+guestbookSelectCols,
		c.AdminDisplayName, c.Content, messageID, c.AdminDisplayName, c.AdminAvatarURL,
	))
}

func CreateGuestbookUserReply(ctx context.Context, db *pgxpool.Pool, messageID, nickname, content, clientIP string) (*GuestbookMessage, error) {
	return scanGuestbookMessage(db.QueryRow(ctx,
		`INSERT INTO guestbook_messages (nickname, content, parent_id, ip_address, moderation_status)
		 VALUES ($1, $2, $3, $4::inet, 'pending')
		 RETURNING `+guestbookSelectCols,
		nickname, content, messageID, clientIP,
	))
}

func GetGuestbookModerationStats(ctx context.Context, db *pgxpool.Pool) (GuestbookModerationStats, error) {
	var stats GuestbookModerationStats
	err := db.QueryRow(ctx,
		`SELECT
		 count(*) FILTER (WHERE moderation_status = 'pending')::int,
		 count(*) FILTER (WHERE moderation_status = 'published')::int
		 FROM guestbook_messages`,
	).Scan(&stats.Pending, &stats.Published)
	return stats, err
}

func ListPendingGuestbookMessages(ctx context.Context, db *pgxpool.Pool) ([]GuestbookMessage, error) {
	rows, err := db.Query(ctx,
		`SELECT `+guestbookSelectCols+`
		 FROM guestbook_messages
		 WHERE moderation_status = 'pending'
		 ORDER BY created_at DESC
		 LIMIT 100`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := []GuestbookMessage{}
	for rows.Next() {
		m, err := scanGuestbookMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, *m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return messages, nil
}

func GetGuestbookModerationQueue(ctx context.Context, db *pgxpool.Pool) (GuestbookModerationQueue, error) {
	stats, err := GetGuestbookModerationStats(ctx, db)
	if err != nil {
		return GuestbookModerationQueue{}, err
	}
	messages, err := ListPendingGuestbookMessages(ctx, db)
	if err != nil {
		return GuestbookModerationQueue{}, err
	}
	return GuestbookModerationQueue{Stats: stats, Messages: messages}, nil
}

func PublishGuestbookMessage(ctx context.Context, db *pgxpool.Pool, id string) (*GuestbookMessage, error) {
	return scanGuestbookMessage(db.QueryRow(ctx,
		`UPDATE guestbook_messages
		 SET moderation_status = 'published', reviewed_at = now()
		 WHERE id = $1
		 RETURNING `+guestbookSelectCols,
		id,
	))
}

func DeleteGuestbookMessage(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM guestbook_messages WHERE id = $1`, id)
	return err
}

func DeleteGuestbookOwnMessage(ctx context.Context, db *pgxpool.Pool, id, clientIP string) error {
	tag, err := db.Exec(ctx, `DELETE FROM guestbook_messages WHERE id = $1 AND ip_address = $2::inet`, id, clientIP)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func DeleteGuestbookReply(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM guestbook_messages WHERE id = $1 AND parent_id IS NOT NULL`, id)
	return err
}
