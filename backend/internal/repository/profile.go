package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Profile struct {
	DisplayName  string   `json:"displayName"`
	Email        string   `json:"email"`
	Bio          string   `json:"bio"`
	AvatarURL    string   `json:"avatarUrl"`
	Phone        string   `json:"phone"`
	Province     string   `json:"province"`
	City         string   `json:"city"`
	ExtraEmails  []string `json:"extraEmails"`
	GithubURL    string   `json:"githubUrl"`
}

type ProfileUpdate struct {
	DisplayName *string  `json:"displayName"`
	Email       *string  `json:"email"`
	Bio         *string  `json:"bio"`
	Phone       *string  `json:"phone"`
	Province    *string  `json:"province"`
	City        *string  `json:"city"`
	ExtraEmails *[]string `json:"extraEmails"`
	GithubURL   *string  `json:"githubUrl"`
}

func GetProfile(ctx context.Context, db *pgxpool.Pool) (*Profile, error) {
	var p Profile
	err := db.QueryRow(ctx,
		`SELECT display_name, coalesce(email,''), coalesce(bio,''), coalesce(avatar_url,''),
		        coalesce(phone,''), coalesce(province,''), coalesce(city,''),
		        coalesce(extra_emails, '{}'), coalesce(github_url,'')
		 FROM admin_profile LIMIT 1`,
	).Scan(&p.DisplayName, &p.Email, &p.Bio, &p.AvatarURL,
		&p.Phone, &p.Province, &p.City, &p.ExtraEmails, &p.GithubURL)
	if err != nil {
		return nil, err
	}
	if p.ExtraEmails == nil {
		p.ExtraEmails = []string{}
	}
	return &p, nil
}

func UpdateProfile(ctx context.Context, db *pgxpool.Pool, u *ProfileUpdate) error {
	_, err := db.Exec(ctx,
		`UPDATE admin_profile SET
			display_name = coalesce($1, display_name),
			email = coalesce($2, email),
			bio = coalesce($3, bio),
			phone = coalesce($4, phone),
			province = coalesce($5, province),
			city = coalesce($6, city),
			extra_emails = coalesce($7, extra_emails),
			github_url = coalesce($8, github_url),
			updated_at = now()
		 WHERE id = (SELECT id FROM admin_profile LIMIT 1)`,
		u.DisplayName, u.Email, u.Bio,
		u.Phone, u.Province, u.City, u.ExtraEmails, u.GithubURL,
	)
	return err
}

func UpdateAvatarURL(ctx context.Context, db *pgxpool.Pool, url string) error {
	_, err := db.Exec(ctx,
		`UPDATE admin_profile SET avatar_url = $1, updated_at = now()
		 WHERE id = (SELECT id FROM admin_profile LIMIT 1)`,
		url,
	)
	return err
}
