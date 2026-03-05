package models

import "time"

type Message struct {
	ID        int       `json:"id" db:"id"`
	AgentID   string    `json:"agent_id" db:"agent_id" binding:"required"`
	Level     string    `json:"level" db:"level" binding:"required"`
	Content   string    `json:"content" db:"content" binding:"required"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
}

type User struct {
	ID             int        `json:"id" db:"id"`
	Username       string     `json:"username" db:"username" binding:"required"`
	PasswordHash   string     `json:"-" db:"password_hash"` // Never expose hash in JSON
	APIToken       string     `json:"api_token,omitempty" db:"api_token"`
	Role           string     `json:"role" db:"role"`
	ActorType      string     `json:"actor_type" db:"actor_type"`
	TokenHint      string     `json:"token_hint,omitempty"`
	TokenUpdatedAt *time.Time `json:"token_updated_at,omitempty"`
	Status         string     `json:"status,omitempty"`
	Online         bool       `json:"online,omitempty"`
	LastSeenAt     *time.Time `json:"last_seen_at,omitempty"`
	LastReport     string     `json:"last_report,omitempty"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ChatMessage struct {
	ID         int       `json:"id" db:"id"`
	LocalID    string    `json:"local_id" db:"local_id"`
	SenderID   int       `json:"sender_id" db:"sender_id"`
	ReceiverID int       `json:"receiver_id" db:"receiver_id"`
	Type       string    `json:"type" db:"type"` // CHAT, AUTH_REQUEST, AUTH_RESPONSE
	Payload    string    `json:"payload" db:"content"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
}

type ButlerAuthorization struct {
	ID              string     `json:"id" db:"id"`
	TargetAgentID   int        `json:"target_agent_id" db:"target_agent_id"`
	ProposedCommand string     `json:"proposed_command" db:"proposed_command"`
	Reasoning       string     `json:"reasoning" db:"reasoning"`
	Status          string     `json:"status" db:"status"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	RespondedAt     *time.Time `json:"responded_at,omitempty" db:"responded_at"`
}

type FeishuConnector struct {
	ID                 int        `json:"id" db:"id"`
	ConnectorName      string     `json:"connector_name" db:"connector_name"`
	Enabled            bool       `json:"enabled" db:"enabled"`
	Status             string     `json:"status" db:"status"`
	AppID              string     `json:"app_id" db:"app_id"`
	AppSecret          string     `json:"app_secret,omitempty" db:"app_secret"`
	AppSecretMasked    string     `json:"app_secret_masked,omitempty"`
	HasAppSecret       bool       `json:"has_app_secret,omitempty"`
	VerificationToken  string     `json:"verification_token,omitempty" db:"verification_token"`
	EncryptKey         string     `json:"encrypt_key,omitempty" db:"encrypt_key"`
	AllowDM            bool       `json:"allow_dm" db:"allow_dm"`
	AllowGroupMention  bool       `json:"allow_group_mention" db:"allow_group_mention"`
	MentionRequired    bool       `json:"mention_required" db:"mention_required"`
	PrefixCommand      string     `json:"prefix_command" db:"prefix_command"`
	IgnoreBotMessages  bool       `json:"ignore_bot_messages" db:"ignore_bot_messages"`
	RateLimitPerMinute int        `json:"rate_limit_per_minute" db:"rate_limit_per_minute"`
	AllowedChatIDs     []string   `json:"allowed_chat_ids,omitempty"`
	UserWhitelist      []string   `json:"user_whitelist,omitempty"`
	CallbackURL        string     `json:"callback_url" db:"callback_url"`
	CallbackVerified   bool       `json:"callback_verified" db:"callback_verified"`
	LastVerifiedAt     *time.Time `json:"last_verified_at,omitempty" db:"last_verified_at"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}

type IntegrationLog struct {
	ID        string    `json:"id"`
	Level     string    `json:"level"`
	Action    string    `json:"action"`
	Detail    string    `json:"detail"`
	Timestamp time.Time `json:"timestamp"`
}
