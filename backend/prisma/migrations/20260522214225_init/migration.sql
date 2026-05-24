-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "bioShards" INTEGER NOT NULL DEFAULT 200,
    "activeSectorId" TEXT NOT NULL DEFAULT 'sector_01',
    "unlockedSectors" TEXT NOT NULL DEFAULT 'sector_01',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserInventoryItem_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserUpgrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "upgradeKey" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserUpgrade_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectorStability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "stabilityScore" REAL NOT NULL DEFAULT 100.0,
    CONSTRAINT "SectorStability_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LevelConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectorId" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "maxNeuralLoad" INTEGER NOT NULL,
    "baseDecayRate" REAL NOT NULL,
    "allowedScalpels" INTEGER NOT NULL DEFAULT 0,
    "allowedSutures" INTEGER NOT NULL DEFAULT 0,
    "isShifting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GameStateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProfileId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "elapsedSeconds" REAL NOT NULL,
    "finalVitality" REAL NOT NULL,
    "finalNeuralLoad" INTEGER NOT NULL,
    "actionsLog" TEXT NOT NULL,
    "gridCoordinates" TEXT NOT NULL,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameStateSnapshot_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserInventoryItem_userProfileId_itemType_key" ON "UserInventoryItem"("userProfileId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "UserUpgrade_userProfileId_upgradeKey_key" ON "UserUpgrade"("userProfileId", "upgradeKey");

-- CreateIndex
CREATE UNIQUE INDEX "SectorStability_userProfileId_sectorId_key" ON "SectorStability"("userProfileId", "sectorId");
