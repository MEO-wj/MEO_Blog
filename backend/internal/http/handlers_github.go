package http

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/meo-blog/backend/internal/config"
)

type githubCacheEntry struct {
	data      []byte
	expiresAt time.Time
}

type githubProxy struct {
	token string
	mu    sync.RWMutex
	cache map[string]githubCacheEntry
}

var ghProxy *githubProxy

func initGitHubProxy(cfg *config.Config) {
	ghProxy = &githubProxy{
		token: cfg.GitHubToken,
		cache: make(map[string]githubCacheEntry),
	}
	// Evict expired cache entries every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			ghProxy.mu.Lock()
			now := time.Now()
			for k, v := range ghProxy.cache {
				if now.After(v.expiresAt) {
					delete(ghProxy.cache, k)
				}
			}
			ghProxy.mu.Unlock()
		}
	}()
}

func (p *githubProxy) fetchGraphQL(body []byte, fresh bool) ([]byte, int, error) {
	hash := sha256.Sum256(body)
	cacheKey := "gql:" + hex.EncodeToString(hash[:])

	p.mu.RLock()
	if !fresh {
		if entry, ok := p.cache[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
			p.mu.RUnlock()
			return entry.data, 200, nil
		}
	}
	p.mu.RUnlock()

	req, err := http.NewRequest("POST", "https://api.github.com/graphql", bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if fresh {
		req.Header.Set("Cache-Control", "no-cache")
	}
	if p.token != "" {
		req.Header.Set("Authorization", "Bearer "+p.token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	buf, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	if resp.StatusCode == 200 {
		p.mu.Lock()
		p.cache[cacheKey] = githubCacheEntry{data: buf, expiresAt: time.Now().Add(10 * time.Minute)}
		p.mu.Unlock()
	}

	return buf, resp.StatusCode, nil
}

func (p *githubProxy) fetch(url string, fresh bool) ([]byte, int, error) {
	p.mu.RLock()
	if !fresh {
		if entry, ok := p.cache[url]; ok && time.Now().Before(entry.expiresAt) {
			p.mu.RUnlock()
			return entry.data, 200, nil
		}
	}
	p.mu.RUnlock()

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	if fresh {
		req.Header.Set("Cache-Control", "no-cache")
	}
	if p.token != "" {
		req.Header.Set("Authorization", "Bearer "+p.token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	buf, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read error: %w", err)
	}

	if resp.StatusCode == 200 {
		p.mu.Lock()
		p.cache[url] = githubCacheEntry{data: buf, expiresAt: time.Now().Add(10 * time.Minute)}
		p.mu.Unlock()
	}

	return buf, resp.StatusCode, nil
}

func githubUserHandler(cfg *config.Config) http.HandlerFunc {
	initGitHubProxy(cfg)

	type ghUserData struct {
		Login       string  `json:"login"`
		Name        *string `json:"name"`
		AvatarURL   string  `json:"avatar_url"`
		Bio         *string `json:"bio"`
		Location    *string `json:"location"`
		Email       *string `json:"email"`
		PublicRepos int     `json:"public_repos"`
		Followers   int     `json:"followers"`
		Following   int     `json:"following"`
		HTMLURL     string  `json:"html_url"`
	}

	type ghRepoData struct {
		ID            int     `json:"id"`
		Name          string  `json:"name"`
		Description   *string `json:"description"`
		StargazersCnt int     `json:"stargazers_count"`
		ForksCnt      int     `json:"forks_count"`
		Language      *string `json:"language"`
		HTMLURL       string  `json:"html_url"`
		UpdatedAt     string  `json:"updated_at"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		username := chi.URLParam(r, "username")
		if username == "" {
			RespondError(w, "MISSING_USERNAME", "username is required", http.StatusBadRequest)
			return
		}

		userURL := fmt.Sprintf("https://api.github.com/users/%s", username)
		reposURL := fmt.Sprintf("https://api.github.com/users/%s/repos?sort=updated&per_page=100", username)
		fresh := r.URL.Query().Get("fresh") == "1"

		userData, userStatus, userErr := ghProxy.fetch(userURL, fresh)
		if userErr != nil {
			RespondError(w, "GITHUB_FETCH_FAILED", "failed to fetch GitHub data", http.StatusBadGateway)
			return
		}
		if userStatus != 200 {
			msg := fmt.Sprintf("GitHub API returned %d", userStatus)
			if userStatus == 403 {
				msg = "GitHub API rate limit exceeded"
			} else if userStatus == 404 {
				msg = fmt.Sprintf("GitHub user '%s' not found", username)
			}
			RespondError(w, "GITHUB_API_ERROR", msg, userStatus)
			return
		}

		reposData, reposStatus, reposErr := ghProxy.fetch(reposURL, fresh)
		if reposErr != nil {
			reposData = []byte("[]")
			reposStatus = 200
		}
		_ = reposStatus

		var user ghUserData
		if err := json.Unmarshal(userData, &user); err != nil {
			RespondError(w, "PARSE_ERROR", "failed to parse GitHub user data", http.StatusInternalServerError)
			return
		}

		var repos []ghRepoData
		if err := json.Unmarshal(reposData, &repos); err != nil {
			repos = []ghRepoData{}
		}

		RespondOK(w, map[string]any{
			"user":  user,
			"repos": repos,
		})
	}
}

func githubContributionsHandler(cfg *config.Config) http.HandlerFunc {
	type contribDay struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
		Level int    `json:"level"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		username := chi.URLParam(r, "username")
		if username == "" {
			RespondError(w, "MISSING_USERNAME", "username is required", http.StatusBadRequest)
			return
		}

		// Use GitHub GraphQL API to get contributions (public + private if token has scope)
		query := map[string]any{
			"query": `query ($login: String!) {
				user(login: $login) {
					contributionsCollection {
						contributionCalendar {
							totalContributions
							weeks {
								contributionDays {
									date
									contributionCount
									color
								}
							}
						}
					}
				}
			}`,
			"variables": map[string]string{"login": username},
		}

		body, err := json.Marshal(query)
		if err != nil {
			RespondError(w, "INTERNAL_ERROR", "failed to build request", http.StatusInternalServerError)
			return
		}

		fresh := r.URL.Query().Get("fresh") == "1"
		data, status, fetchErr := ghProxy.fetchGraphQL(body, fresh)
		if fetchErr != nil {
			RespondError(w, "CONTRIB_FETCH_FAILED", "failed to fetch contributions", http.StatusBadGateway)
			return
		}
		if status != 200 {
			RespondError(w, "CONTRIB_API_ERROR", fmt.Sprintf("GitHub GraphQL returned %d", status), status)
			return
		}

		// Parse GraphQL response
		var gqlResp struct {
			Data struct {
				User *struct {
					ContributionsCollection struct {
						ContributionCalendar struct {
							TotalContributions int `json:"totalContributions"`
							Weeks              []struct {
								ContributionDays []struct {
									Date              string `json:"date"`
									ContributionCount int    `json:"contributionCount"`
									Color             string `json:"color"`
								} `json:"contributionDays"`
							} `json:"weeks"`
						} `json:"contributionCalendar"`
					} `json:"contributionsCollection"`
				} `json:"user"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}

		if err := json.Unmarshal(data, &gqlResp); err != nil {
			RespondError(w, "PARSE_ERROR", "failed to parse GraphQL response", http.StatusInternalServerError)
			return
		}

		if len(gqlResp.Errors) > 0 {
			RespondError(w, "GITHUB_API_ERROR", gqlResp.Errors[0].Message, http.StatusBadGateway)
			return
		}

		if gqlResp.Data.User == nil {
			RespondError(w, "GITHUB_USER_NOT_FOUND", fmt.Sprintf("GitHub user '%s' not found", username), http.StatusNotFound)
			return
		}

		// Convert to flat list of contribution days
		var contributions []contribDay
		for _, week := range gqlResp.Data.User.ContributionsCollection.ContributionCalendar.Weeks {
			for _, day := range week.ContributionDays {
				level := 0
				if day.ContributionCount > 0 {
					if day.ContributionCount >= 10 {
						level = 4
					} else if day.ContributionCount >= 5 {
						level = 3
					} else if day.ContributionCount >= 2 {
						level = 2
					} else {
						level = 1
					}
				}
				contributions = append(contributions, contribDay{
					Date:  day.Date,
					Count: day.ContributionCount,
					Level: level,
				})
			}
		}

		RespondOK(w, map[string]any{
			"contributions":      contributions,
			"totalContributions": gqlResp.Data.User.ContributionsCollection.ContributionCalendar.TotalContributions,
		})
	}
}
