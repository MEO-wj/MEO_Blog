package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Project struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	RepoURL     string   `json:"repoUrl"`
	DemoURL     string   `json:"demoUrl"`
	CoverURL    string   `json:"coverUrl"`
	IconURL     string   `json:"iconUrl"`
	AccentColor string   `json:"accentColor"`
	Category    string   `json:"category"`
	Status      string   `json:"status"`
	TechStack   []string `json:"techStack"`
	Pinned      bool     `json:"pinned"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

type ProjectCreate struct {
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	RepoURL     string   `json:"repoUrl"`
	IconURL     string   `json:"iconUrl"`
	AccentColor string   `json:"accentColor"`
	Category    string   `json:"category"`
	Status      string   `json:"status"`
	TechStack   []string `json:"techStack"`
}

type ProjectUpdate struct {
	Name        *string   `json:"name"`
	Slug        *string   `json:"slug"`
	Description *string   `json:"description"`
	RepoURL     *string   `json:"repoUrl"`
	IconURL     *string   `json:"iconUrl"`
	AccentColor *string   `json:"accentColor"`
	Category    *string   `json:"category"`
	Status      *string   `json:"status"`
	TechStack   *[]string `json:"techStack"`
}

func scanProject(row pgx.Row) (*Project, error) {
	var p Project
	var createdAt, updatedAt time.Time
	err := row.Scan(
		&p.ID, &p.Name, &p.Slug, &p.Description,
		&p.RepoURL, &p.DemoURL, &p.CoverURL,
		&p.IconURL, &p.AccentColor, &p.Category, &p.Status,
		&p.TechStack, &p.Pinned, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.CreatedAt = createdAt.Format(time.RFC3339)
	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &p, nil
}

func ListProjects(ctx context.Context, db *pgxpool.Pool) ([]Project, error) {
	rows, err := db.Query(ctx,
		`SELECT id, name, slug, coalesce(description,''),
			coalesce(repo_url,''), coalesce(demo_url,''), coalesce(cover_url,''),
			coalesce(icon_url,''), coalesce(accent_color,'#24c9f4'),
			coalesce(category,''), coalesce(status,'ready'),
			coalesce(tech_stack,'{}'), pinned, created_at, updated_at
		 FROM projects ORDER BY pinned DESC, created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, *p)
	}
	if projects == nil {
		projects = []Project{}
	}
	return projects, rows.Err()
}

func CreateProject(ctx context.Context, db *pgxpool.Pool, c *ProjectCreate) (*Project, error) {
	tech := c.TechStack
	if tech == nil {
		tech = []string{}
	}
	return scanProject(db.QueryRow(ctx,
		`INSERT INTO projects (name, slug, description, repo_url, icon_url, accent_color, category, status, tech_stack)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, name, slug, coalesce(description,''),
			coalesce(repo_url,''), coalesce(demo_url,''), coalesce(cover_url,''),
			coalesce(icon_url,''), coalesce(accent_color,'#24c9f4'),
			coalesce(category,''), coalesce(status,'ready'),
			coalesce(tech_stack,'{}'), pinned, created_at, updated_at`,
		c.Name, c.Slug, c.Description, c.RepoURL, c.IconURL, c.AccentColor, c.Category, c.Status, tech,
	))
}

func UpdateProject(ctx context.Context, db *pgxpool.Pool, id string, u *ProjectUpdate) (*Project, error) {
	return scanProject(db.QueryRow(ctx,
		`UPDATE projects SET
			name = coalesce($1, name),
			slug = coalesce($2, slug),
			description = coalesce($3, description),
			repo_url = coalesce($4, repo_url),
			icon_url = coalesce($5, icon_url),
			accent_color = coalesce($6, accent_color),
			category = coalesce($7, category),
			status = coalesce($8, status),
			tech_stack = CASE WHEN $9::text[] IS NOT NULL THEN $9::text[] ELSE tech_stack END,
			updated_at = now()
		 WHERE id = $10
		 RETURNING id, name, slug, coalesce(description,''),
			coalesce(repo_url,''), coalesce(demo_url,''), coalesce(cover_url,''),
			coalesce(icon_url,''), coalesce(accent_color,'#24c9f4'),
			coalesce(category,''), coalesce(status,'ready'),
			coalesce(tech_stack,'{}'), pinned, created_at, updated_at`,
		u.Name, u.Slug, u.Description, u.RepoURL, u.IconURL, u.AccentColor, u.Category, u.Status, u.TechStack, id,
	))
}

func DeleteProject(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	return err
}

func UpdateProjectIcon(ctx context.Context, db *pgxpool.Pool, id string, iconURL string) error {
	_, err := db.Exec(ctx,
		`UPDATE projects SET icon_url = $1, updated_at = now() WHERE id = $2`,
		iconURL, id,
	)
	return err
}

func GetProjectIconURL(ctx context.Context, db *pgxpool.Pool, id string) (string, error) {
	var url string
	err := db.QueryRow(ctx, `SELECT coalesce(icon_url,'') FROM projects WHERE id = $1`, id).Scan(&url)
	return url, err
}
