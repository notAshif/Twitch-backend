-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "twitchId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profileImageUrl" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "followings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "broadcasterId" TEXT NOT NULL,
    "broadcasterLogin" TEXT NOT NULL,
    "broadcasterName" TEXT NOT NULL,
    "followedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "followings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "boxArtUrl" TEXT NOT NULL,
    "igdbId" TEXT,
    "cachedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "pinned_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pinned_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pinned_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "view_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelLogin" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "view_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "broadcasterId" TEXT NOT NULL,
    "broadcasterLogin" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "notification_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'css',
    "category" TEXT NOT NULL DEFAULT 'custom',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ad_allowlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'channel',
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_allowlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adsBlocked" INTEGER NOT NULL DEFAULT 0,
    "domainsBlocked" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ad_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rule_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "lastSync" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rulesCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success'
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "githubIssueUrl" TEXT,
    "githubIssueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "issues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_twitchId_key" ON "users"("twitchId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_jti_key" ON "sessions"("jti");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "followings_userId_idx" ON "followings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "followings_userId_broadcasterId_key" ON "followings"("userId", "broadcasterId");

-- CreateIndex
CREATE INDEX "pinned_categories_userId_idx" ON "pinned_categories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pinned_categories_userId_categoryId_key" ON "pinned_categories"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "view_history_userId_watchedAt_idx" ON "view_history"("userId", "watchedAt" DESC);

-- CreateIndex
CREATE INDEX "notification_prefs_userId_idx" ON "notification_prefs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_prefs_userId_broadcasterId_key" ON "notification_prefs"("userId", "broadcasterId");

-- CreateIndex
CREATE INDEX "ad_stats_userId_idx" ON "ad_stats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_stats_userId_date_key" ON "ad_stats"("userId", "date");

-- CreateIndex
CREATE INDEX "user_activities_userId_createdAt_idx" ON "user_activities"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_activities_activityType_idx" ON "user_activities"("activityType");

-- CreateIndex
CREATE INDEX "issues_userId_idx" ON "issues"("userId");

-- CreateIndex
CREATE INDEX "issues_status_idx" ON "issues"("status");
