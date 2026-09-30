CREATE TABLE assistant_conversations(
  id TEXT PRIMARY KEY, user_id INTEGER, lang TEXT NOT NULL DEFAULT 'pt', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE assistant_messages(
  id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_assistant_msgs_conv ON assistant_messages(conversation_id, id);
