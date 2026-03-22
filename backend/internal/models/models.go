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
	AgentKind      string     `json:"agent_kind,omitempty" db:"agent_kind"`
	RuntimeKind    string     `json:"runtime_kind,omitempty" db:"runtime_kind"`
	Description    string     `json:"description,omitempty" db:"description"`
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
	ID             int       `json:"id" db:"id"`
	LocalID        string    `json:"local_id" db:"local_id"`
	ConversationID int       `json:"conversation_id,omitempty" db:"conversation_id"`
	SenderID       int       `json:"sender_id" db:"sender_id"`
	ReceiverID     int       `json:"receiver_id" db:"receiver_id"`
	Type           string    `json:"type" db:"type"` // CHAT, AUTH_REQUEST, AUTH_RESPONSE
	Payload        string    `json:"payload" db:"content"`
	Timestamp      time.Time `json:"timestamp" db:"timestamp"`
}

type ConversationThread struct {
	ID            int        `json:"id" db:"id"`
	OwnerUserID   int        `json:"owner_user_id" db:"owner_user_id"`
	PeerUserID    int        `json:"peer_user_id" db:"peer_user_id"`
	ChannelKind   string     `json:"channel_kind" db:"channel_kind"`
	Title         string     `json:"title" db:"title"`
	Summary       string     `json:"summary,omitempty" db:"summary"`
	IsPinned      bool       `json:"is_pinned" db:"is_pinned"`
	IsDefault     bool       `json:"is_default" db:"is_default"`
	ArchivedAt    *time.Time `json:"archived_at,omitempty" db:"archived_at"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty" db:"last_message_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
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

type SSHKey struct {
	ID            int       `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	PublicKey     string    `json:"public_key,omitempty" db:"public_key"`
	PrivateKey    string    `json:"private_key,omitempty"`
	HasPrivateKey bool      `json:"has_private_key"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type InfraNode struct {
	ID          int       `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Host        string    `json:"host" db:"host"`
	Port        int       `json:"port" db:"port"`
	SSHUser     string    `json:"ssh_user" db:"ssh_user"`
	SSHKeyID    int       `json:"ssh_key_id" db:"ssh_key_id"`
	Description string    `json:"description,omitempty" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type InfraNodeTestResult struct {
	NodeID       int       `json:"node_id"`
	OK           bool      `json:"ok"`
	Message      string    `json:"message"`
	RoundTripMS  int64     `json:"round_trip_ms"`
	CheckedAtUTC time.Time `json:"checked_at_utc"`
}

type OpenHandsTaskRecord struct {
	ID          string    `json:"id"`
	Task        string    `json:"task"`
	Reasoning   string    `json:"reasoning,omitempty"`
	Status      string    `json:"status,omitempty"`
	CurrentStep string    `json:"current_step,omitempty"`
	LiveOutput  string    `json:"live_output,omitempty"`
	Success     bool      `json:"success"`
	Summary     string    `json:"summary,omitempty"`
	Error       string    `json:"error,omitempty"`
	WorkerMode  string    `json:"worker_mode,omitempty"`
	StartedAt   time.Time `json:"started_at"`
	FinishedAt  time.Time `json:"finished_at"`
	DurationMS  int64     `json:"duration_ms"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
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
