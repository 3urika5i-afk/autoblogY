-- settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- content calendar
CREATE TABLE IF NOT EXISTS content_calendar (
  id TEXT PRIMARY KEY,
  target_keyword TEXT NOT NULL,
  publish_at DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  published_article_id TEXT
);

-- articles
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT,
  slug TEXT UNIQUE,
  summary TEXT,
  body TEXT,
  status TEXT CHECK (status IN ('draft','published')) DEFAULT 'draft',
  hero_image TEXT,
  meta TEXT,
  schema_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME
);

-- images
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  article_id TEXT,
  url TEXT,
  alt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(article_id) REFERENCES articles(id)
);

-- affiliate links
CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  keyword TEXT,
  url TEXT,
  network TEXT,
  clicks INTEGER DEFAULT 0
);

-- subscribers
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- email events
CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  email TEXT,
  type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- revenue
CREATE TABLE IF NOT EXISTS revenue (
  id TEXT PRIMARY KEY,
  stream TEXT,
  month TEXT,
  amount REAL,
  notes TEXT
);

-- ab tests
CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  name TEXT,
  variant_a TEXT,
  variant_b TEXT,
  metric TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
