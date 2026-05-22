package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// --- BlogCategory ---

type BlogCategory struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	SortOrder   int    `json:"sortOrder"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type BlogCategoryCreate struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	SortOrder   int    `json:"sortOrder"`
}

type BlogCategoryUpdate struct {
	Name        *string `json:"name"`
	Slug        *string `json:"slug"`
	Description *string `json:"description"`
	Icon        *string `json:"icon"`
	Color       *string `json:"color"`
	SortOrder   *int    `json:"sortOrder"`
}

func scanBlogCategory(row pgx.Row) (*BlogCategory, error) {
	var c BlogCategory
	var createdAt, updatedAt time.Time
	err := row.Scan(
		&c.ID, &c.Name, &c.Slug, &c.Description,
		&c.Icon, &c.Color, &c.SortOrder, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}
	c.CreatedAt = createdAt.Format(time.RFC3339)
	c.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &c, nil
}

func ListBlogCategories(ctx context.Context, db *pgxpool.Pool) ([]BlogCategory, error) {
	rows, err := db.Query(ctx,
		`SELECT id, name, slug, coalesce(description,''),
			coalesce(icon,'📖'), coalesce(color,'#24c9f4'),
			sort_order, created_at, updated_at
		 FROM blog_categories ORDER BY sort_order ASC, created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []BlogCategory
	for rows.Next() {
		c, err := scanBlogCategory(rows)
		if err != nil {
			return nil, err
		}
		categories = append(categories, *c)
	}
	if categories == nil {
		categories = []BlogCategory{}
	}
	return categories, rows.Err()
}

func CreateBlogCategory(ctx context.Context, db *pgxpool.Pool, c *BlogCategoryCreate) (*BlogCategory, error) {
	return scanBlogCategory(db.QueryRow(ctx,
		`INSERT INTO blog_categories (name, slug, description, icon, color, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, name, slug, coalesce(description,''),
			coalesce(icon,'📖'), coalesce(color,'#24c9f4'),
			sort_order, created_at, updated_at`,
		c.Name, c.Slug, c.Description, c.Icon, c.Color, c.SortOrder,
	))
}

func UpdateBlogCategory(ctx context.Context, db *pgxpool.Pool, id string, u *BlogCategoryUpdate) (*BlogCategory, error) {
	return scanBlogCategory(db.QueryRow(ctx,
		`UPDATE blog_categories SET
			name = coalesce($1, name),
			slug = coalesce($2, slug),
			description = coalesce($3, description),
			icon = coalesce($4, icon),
			color = coalesce($5, color),
			sort_order = coalesce($6, sort_order),
			updated_at = now()
		 WHERE id = $7
		 RETURNING id, name, slug, coalesce(description,''),
			coalesce(icon,'📖'), coalesce(color,'#24c9f4'),
			sort_order, created_at, updated_at`,
		u.Name, u.Slug, u.Description, u.Icon, u.Color, u.SortOrder, id,
	))
}

func DeleteBlogCategory(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM blog_categories WHERE id = $1`, id)
	return err
}

// --- BlogPost ---

type BlogPost struct {
	ID          string  `json:"id"`
	Slug        string  `json:"slug"`
	Title       string  `json:"title"`
	Summary     string  `json:"summary"`
	ContentMD   string  `json:"contentMd"`
	CoverURL    string  `json:"coverUrl"`
	Status      string  `json:"status"`
	CategoryID  string  `json:"categoryId"`
	PublishedAt *string `json:"publishedAt"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

type BlogPostCreate struct {
	Slug       string `json:"slug"`
	Title      string `json:"title"`
	Summary    string `json:"summary"`
	ContentMD  string `json:"contentMd"`
	CoverURL   string `json:"coverUrl"`
	Status     string `json:"status"`
	CategoryID string `json:"categoryId"`
}

type BlogPostUpdate struct {
	Slug       *string `json:"slug"`
	Title      *string `json:"title"`
	Summary    *string `json:"summary"`
	ContentMD  *string `json:"contentMd"`
	CoverURL   *string `json:"coverUrl"`
	Status     *string `json:"status"`
	CategoryID *string `json:"categoryId"`
}

func scanBlogPost(row pgx.Row) (*BlogPost, error) {
	var p BlogPost
	var createdAt, updatedAt time.Time
	var publishedAt *time.Time
	err := row.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Summary, &p.ContentMD,
		&p.CoverURL, &p.Status, &p.CategoryID, &publishedAt,
		&createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.CreatedAt = createdAt.Format(time.RFC3339)
	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	if publishedAt != nil {
		s := publishedAt.Format(time.RFC3339)
		p.PublishedAt = &s
	}
	return &p, nil
}

const blogPostSelectCols = `id, slug, title, coalesce(summary,''), coalesce(content_md,''),
	coalesce(cover_url,''), coalesce(status,'draft'),
	coalesce(cast(category_id as text),''), published_at, created_at, updated_at`

func ListBlogPosts(ctx context.Context, db *pgxpool.Pool, categoryID string, includeDrafts bool) ([]BlogPost, error) {
	// List queries exclude content_md for efficiency; use GetBlogPost for full content.
	query := `SELECT id, slug, title, coalesce(summary,''), '',
		coalesce(cover_url,''), coalesce(status,'draft'),
		coalesce(cast(category_id as text),''), published_at, created_at, updated_at
		FROM posts`
	var args []any

	if categoryID != "" {
		args = append(args, categoryID)
		query += ` WHERE category_id = $1`
		if !includeDrafts {
			query += ` AND status = 'published'`
		}
	} else if !includeDrafts {
		query += ` WHERE status = 'published'`
	}

	if includeDrafts {
		query += ` ORDER BY created_at DESC LIMIT 200`
	} else {
		query += ` ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 50`
	}

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []BlogPost
	for rows.Next() {
		p, err := scanBlogPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, *p)
	}
	if posts == nil {
		posts = []BlogPost{}
	}
	return posts, rows.Err()
}

func GetBlogPost(ctx context.Context, db *pgxpool.Pool, id string) (*BlogPost, error) {
	return scanBlogPost(db.QueryRow(ctx,
		`SELECT `+blogPostSelectCols+` FROM posts WHERE id = $1`, id,
	))
}

func CreateBlogPost(ctx context.Context, db *pgxpool.Pool, c *BlogPostCreate) (*BlogPost, error) {
	var publishedAt *time.Time
	if c.Status == "published" {
		now := time.Now()
		publishedAt = &now
	}
	return scanBlogPost(db.QueryRow(ctx,
		`INSERT INTO posts (slug, title, summary, content_md, cover_url, status, category_id, published_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7,'')::uuid, $8)
		 RETURNING `+blogPostSelectCols,
		c.Slug, c.Title, c.Summary, c.ContentMD, c.CoverURL, c.Status, c.CategoryID, publishedAt,
	))
}

func UpdateBlogPost(ctx context.Context, db *pgxpool.Pool, id string, u *BlogPostUpdate) (*BlogPost, error) {
	// If status is being changed to published, set published_at
	var setPublished string
	if u.Status != nil && *u.Status == "published" {
		setPublished = ", published_at = coalesce(published_at, now())"
	}
	query := `UPDATE posts SET
		slug = coalesce($1, slug),
		title = coalesce($2, title),
		summary = coalesce($3, summary),
		content_md = coalesce($4, content_md),
		cover_url = coalesce($5, cover_url),
		status = coalesce($6, status),
		category_id = NULLIF($7, '')::uuid,
		updated_at = now()` + setPublished + `
		WHERE id = $8
		RETURNING ` + blogPostSelectCols
	return scanBlogPost(db.QueryRow(ctx, query,
		u.Slug, u.Title, u.Summary, u.ContentMD, u.CoverURL, u.Status, u.CategoryID, id,
	))
}

func DeleteBlogPost(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM posts WHERE id = $1`, id)
	return err
}

// --- BlogComment ---

type BlogComment struct {
	ID          string `json:"id"`
	PostID      string `json:"postId"`
	AuthorName  string `json:"authorName"`
	AuthorEmail string `json:"authorEmail"`
	Content     string `json:"content"`
	CreatedAt   string `json:"createdAt"`
}

type BlogCommentCreate struct {
	PostID      string `json:"postId"`
	AuthorName  string `json:"authorName"`
	AuthorEmail string `json:"authorEmail"`
	Content     string `json:"content"`
}

func scanBlogComment(row pgx.Row) (*BlogComment, error) {
	var c BlogComment
	var createdAt time.Time
	err := row.Scan(&c.ID, &c.PostID, &c.AuthorName, &c.AuthorEmail, &c.Content, &createdAt)
	if err != nil {
		return nil, err
	}
	c.CreatedAt = createdAt.Format(time.RFC3339)
	return &c, nil
}

func ListBlogComments(ctx context.Context, db *pgxpool.Pool, postID string) ([]BlogComment, error) {
	rows, err := db.Query(ctx,
		`SELECT id, post_id, author_name, coalesce(author_email,''), content, created_at
		 FROM blog_comments WHERE post_id = $1 ORDER BY created_at ASC`, postID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []BlogComment
	for rows.Next() {
		c, err := scanBlogComment(rows)
		if err != nil {
			return nil, err
		}
		comments = append(comments, *c)
	}
	if comments == nil {
		comments = []BlogComment{}
	}
	return comments, rows.Err()
}

func CreateBlogComment(ctx context.Context, db *pgxpool.Pool, c *BlogCommentCreate) (*BlogComment, error) {
	return scanBlogComment(db.QueryRow(ctx,
		`INSERT INTO blog_comments (post_id, author_name, author_email, content)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, post_id, author_name, coalesce(author_email,''), content, created_at`,
		c.PostID, c.AuthorName, c.AuthorEmail, c.Content,
	))
}

func DeleteBlogComment(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM blog_comments WHERE id = $1`, id)
	return err
}
