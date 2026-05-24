import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { validateSolution, GameStateSnapshotDto } from './validator';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Bootstrapping function to ensure default profile and default configurations exist
async function seedDefaultData() {
  console.log("Seeding default Level Configurations...");
  await prisma.levelConfiguration.deleteMany({}); // Reset levels
  await prisma.levelConfiguration.createMany({
    data: [
      // Sector 1: The Cothon Slums (5x5 Grid)
      {
        sectorId: "sector_01",
        levelNumber: 1,
        seed: 101,
        width: 5,
        height: 5,
        maxNeuralLoad: 200,
        baseDecayRate: 0.15,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_01",
        levelNumber: 2,
        seed: 102,
        width: 5,
        height: 5,
        maxNeuralLoad: 200,
        baseDecayRate: 0.20,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_01",
        levelNumber: 3,
        seed: 103,
        width: 5,
        height: 5,
        maxNeuralLoad: 200,
        baseDecayRate: 0.22,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_01",
        levelNumber: 4,
        seed: 104,
        width: 5,
        height: 5,
        maxNeuralLoad: 200,
        baseDecayRate: 0.25,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_01",
        levelNumber: 5,
        seed: 105,
        width: 5,
        height: 5,
        maxNeuralLoad: 220,
        baseDecayRate: 0.28,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_01",
        levelNumber: 6,
        seed: 106,
        width: 5,
        height: 5,
        maxNeuralLoad: 220,
        baseDecayRate: 0.32,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_01",
        levelNumber: 7,
        seed: 107,
        width: 5,
        height: 5,
        maxNeuralLoad: 240,
        baseDecayRate: 0.36,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      // Sector 2: Byrsa Citadel (7x7 Grid)
      {
        sectorId: "sector_02",
        levelNumber: 8,
        seed: 201,
        width: 7,
        height: 7,
        maxNeuralLoad: 280,
        baseDecayRate: 0.60,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_02",
        levelNumber: 9,
        seed: 202,
        width: 7,
        height: 7,
        maxNeuralLoad: 300,
        baseDecayRate: 0.70,
        allowedScalpels: 3,
        allowedSutures: 4,
        isShifting: false
      },
      {
        sectorId: "sector_02",
        levelNumber: 10,
        seed: 203,
        width: 7,
        height: 7,
        maxNeuralLoad: 320,
        baseDecayRate: 0.80,
        allowedScalpels: 4,
        allowedSutures: 5,
        isShifting: false
      },
      // Sector 3: The Oracle Core (9x9 Grid)
      {
        sectorId: "sector_03",
        levelNumber: 11,
        seed: 301,
        width: 9,
        height: 9,
        maxNeuralLoad: 450,
        baseDecayRate: 1.10,
        allowedScalpels: 4,
        allowedSutures: 5,
        isShifting: true
      },
      {
        sectorId: "sector_03",
        levelNumber: 12,
        seed: 302,
        width: 9,
        height: 9,
        maxNeuralLoad: 480,
        baseDecayRate: 1.20,
        allowedScalpels: 4,
        allowedSutures: 5,
        isShifting: true
      },
      {
        sectorId: "sector_03",
        levelNumber: 13,
        seed: 303,
        width: 9,
        height: 9,
        maxNeuralLoad: 500,
        baseDecayRate: 1.30,
        allowedScalpels: 4,
        allowedSutures: 5,
        isShifting: true
      },
      {
        sectorId: "sector_03",
        levelNumber: 14,
        seed: 304,
        width: 9,
        height: 9,
        maxNeuralLoad: 550,
        baseDecayRate: 1.40,
        allowedScalpels: 5,
        allowedSutures: 6,
        isShifting: true
      }
    ]
  });

  // Create default user profile if none exist
  const defaultUser = await prisma.userProfile.findUnique({
    where: { username: "cabanist_1" }
  });

  if (!defaultUser) {
    console.log("Creating default player profile 'cabanist_1'...");
    const profile = await prisma.userProfile.create({
      data: {
        username: "cabanist_1",
        bioShards: 350,
        activeSectorId: "sector_01",
        unlockedSectors: "sector_01"
      }
    });

    // Seed default inventory items
    await prisma.userInventoryItem.createMany({
      data: [
        { userProfileId: profile.id, itemType: "LASER_SCALPEL", quantity: 3 },
        { userProfileId: profile.id, itemType: "SUTURE_NEEDLE", quantity: 5 },
        { userProfileId: profile.id, itemType: "CHEMICAL_INJECTOR", quantity: 2 }
      ]
    });

    // Seed upgrades tree at Tier 0
    await prisma.userUpgrade.createMany({
      data: [
        { userProfileId: profile.id, upgradeKey: "MAX_LOAD_BUFFER", tier: 0 },
        { userProfileId: profile.id, upgradeKey: "DIAGNOSTIC_PRECISION", tier: 0 },
        { userProfileId: profile.id, upgradeKey: "TOOL_EFFICIENCY", tier: 0 }
      ]
    });

    // Seed sector stability tracking
    await prisma.sectorStability.createMany({
      data: [
        { userProfileId: profile.id, sectorId: "sector_01", stabilityScore: 100.0 },
        { userProfileId: profile.id, sectorId: "sector_02", stabilityScore: 100.0 },
        { userProfileId: profile.id, sectorId: "sector_03", stabilityScore: 100.0 }
      ]
    });
  }
}

// Helper to retrieve user profile complete with completed level IDs
async function getProfilePayload(profileId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: {
      inventory: true,
      upgrades: true,
      sectorStability: true
    }
  });
  if (!profile) return null;

  const completedSnapshots = await prisma.gameStateSnapshot.findMany({
    where: {
      userProfileId: profileId,
      isValidated: true
    },
    select: {
      levelId: true
    }
  });
  const completedLevelIds = Array.from(new Set(completedSnapshots.map(s => s.levelId)));

  return {
    ...profile,
    completedLevelIds
  };
}

// 1. Get User Profile and related data
app.get('/api/profile', async (req, res) => {
  try {
    let profile = await prisma.userProfile.findUnique({
      where: { username: "cabanist_1" }
    });

    if (!profile) {
      await seedDefaultData();
      profile = await prisma.userProfile.findUnique({
        where: { username: "cabanist_1" }
      });
    }

    if (!profile) {
      return res.status(500).json({ error: "Could not retrieve user profile." });
    }

    const payload = await getProfilePayload(profile.id);
    res.json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch Level configurations
app.get('/api/levels', async (req, res) => {
  try {
    const levels = await prisma.levelConfiguration.findMany();
    res.json(levels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Upgrade purchase tree at the Temple of Tanit
app.post('/api/upgrade', async (req, res) => {
  const { upgradeKey } = req.body; // "MAX_LOAD_BUFFER", "DIAGNOSTIC_PRECISION", "TOOL_EFFICIENCY"
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { username: "cabanist_1" },
      include: { upgrades: true }
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const currentUpgrade = profile.upgrades.find(u => u.upgradeKey === upgradeKey);
    const currentTier = currentUpgrade ? currentUpgrade.tier : 0;

    if (currentTier >= 5) {
      return res.status(400).json({ error: "Upgrade already at maximum tier" });
    }

    // Progression costs: Tier 1=100, Tier 2=200, Tier 3=400, Tier 4=800, Tier 5=1600
    const cost = 100 * Math.pow(2, currentTier);

    if (profile.bioShards < cost) {
      return res.status(400).json({ error: `Insufficient Shards. Required: ${cost}, Wallet: ${profile.bioShards}` });
    }

    // Deduct Shards and increment upgrade tier
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: profile.id },
        data: { bioShards: profile.bioShards - cost }
      }),
      prisma.userUpgrade.upsert({
        where: {
          userProfileId_upgradeKey: {
            userProfileId: profile.id,
            upgradeKey: upgradeKey
          }
        },
        create: {
          userProfileId: profile.id,
          upgradeKey: upgradeKey,
          tier: 1
        },
        update: {
          tier: currentTier + 1
        }
      })
    ]);

    const updatedProfile = await getProfilePayload(profile.id);

    res.json({ message: "Upgrade successful", profile: updatedProfile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Buy Tool Charges using shards
app.post('/api/inventory/buy', async (req, res) => {
  const { itemType, quantity } = req.body; // e.g. "LASER_SCALPEL", "SUTURE_NEEDLE"
  const costPerItem = itemType === "CHEMICAL_INJECTOR" ? 25 : 10;
  const totalCost = costPerItem * quantity;

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { username: "cabanist_1" },
      include: { inventory: true }
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    if (profile.bioShards < totalCost) {
      return res.status(400).json({ error: "Insufficient Bio-Shards" });
    }

    const currentInventory = profile.inventory.find(i => i.itemType === itemType);
    const existingQty = currentInventory ? currentInventory.quantity : 0;

    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: profile.id },
        data: { bioShards: profile.bioShards - totalCost }
      }),
      prisma.userInventoryItem.upsert({
        where: {
          userProfileId_itemType: {
            userProfileId: profile.id,
            itemType: itemType
          }
        },
        create: {
          userProfileId: profile.id,
          itemType: itemType,
          quantity: quantity
        },
        update: {
          quantity: existingQty + quantity
        }
      })
    ]);

    const updatedProfile = await getProfilePayload(profile.id);

    res.json({ message: "Purchase completed", profile: updatedProfile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4.5 Deduct shards for using diagnostic hint
app.post('/api/hint/use', async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { username: "cabanist_1" }
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    if (profile.bioShards < 15) {
      return res.status(400).json({ error: "Insufficient Bio-Shards" });
    }

    await prisma.userProfile.update({
      where: { id: profile.id },
      data: { bioShards: profile.bioShards - 15 }
    });

    const updatedProfile = await getProfilePayload(profile.id);
    res.json({ message: "Hint unlocked", profile: updatedProfile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Restore stability to a sector
app.post('/api/stability/cleanse', async (req, res) => {
  const { sectorId } = req.body;
  const cost = 150; // cost in shards to restore +25% stability

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { username: "cabanist_1" },
      include: { sectorStability: true }
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    if (profile.bioShards < cost) {
      return res.status(400).json({ error: "Insufficient Bio-Shards" });
    }

    const sectorStable = profile.sectorStability.find(s => s.sectorId === sectorId);
    if (!sectorStable) return res.status(404).json({ error: "Sector tracking not found" });

    const newStability = Math.min(100.0, sectorStable.stabilityScore + 25.0);

    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: profile.id },
        data: { bioShards: profile.bioShards - cost }
      }),
      prisma.sectorStability.update({
        where: { id: sectorStable.id },
        data: { stabilityScore: newStability }
      })
    ]);

    const updatedProfile = await getProfilePayload(profile.id);

    res.json({ message: "Stability restored", profile: updatedProfile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Validate Completed Level and Issue Rewards
app.post('/api/level/validate', async (req, res) => {
  const snapshotDto = req.body as GameStateSnapshotDto;
  
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { username: "cabanist_1" },
      include: { upgrades: true, sectorStability: true, inventory: true }
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    // Fetch matching level config from seed/levelNumber
    const levelConfig = await prisma.levelConfiguration.findFirst({
      where: { seed: snapshotDto.seed }
    });

    if (!levelConfig) {
      return res.status(404).json({ error: "Level config matching this seed not found." });
    }

    // Apply Upgrade Modifiers
    // 1. Max Neural Load Buffer increases the allowed MS/Ph
    const maxLoadUpgrade = profile.upgrades.find(u => u.upgradeKey === "MAX_LOAD_BUFFER");
    const bonusLoadPercent = maxLoadUpgrade ? maxLoadUpgrade.tier * 0.05 : 0;
    const finalMaxLoad = Math.round(levelConfig.maxNeuralLoad * (1 + bonusLoadPercent));

    // 2. Sector Stability modifier
    const sectorStable = profile.sectorStability.find(s => s.sectorId === levelConfig.sectorId);
    const stability = sectorStable ? sectorStable.stabilityScore : 100.0;
    let decayMultiplier = 1.0;
    if (stability < 30.0) {
      decayMultiplier = 1.15; // permanent 15% decay speed increase
    }
    const finalDecayRate = levelConfig.baseDecayRate * decayMultiplier;

    const validationConfig = {
      maxNeuralLoad: finalMaxLoad,
      baseDecayRate: finalDecayRate,
      allowedScalpels: levelConfig.allowedScalpels,
      allowedSutures: levelConfig.allowedSutures
    };

    // Run core engine validation
    const validationResult = validateSolution(snapshotDto, validationConfig);

    if (!validationResult.isValid) {
      // Reduce Stability on failure
      const newStability = Math.max(0.0, stability - 10.0);
      await prisma.sectorStability.update({
        where: { id: sectorStable?.id },
        data: { stabilityScore: newStability }
      });

      // Save failed snapshot in DB for records
      await prisma.gameStateSnapshot.create({
        data: {
          userProfileId: profile.id,
          levelId: snapshotDto.levelId,
          seed: snapshotDto.seed,
          elapsedSeconds: snapshotDto.elapsedSeconds,
          finalVitality: snapshotDto.finalVitality,
          finalNeuralLoad: snapshotDto.finalNeuralLoad,
          actionsLog: JSON.stringify(snapshotDto.actions),
          gridCoordinates: JSON.stringify(snapshotDto.grid),
          isValidated: false
        }
      });

      const updatedProfile = await getProfilePayload(profile.id);

      return res.status(400).json({
        success: false,
        reason: validationResult.reason || "Validation failed",
        profile: updatedProfile
      });
    }

    // Successful Solution! Award Bio-Shards based on remaining Vitality & accuracy
    const baseReward = 50;
    const vitalityBonus = Math.round(snapshotDto.finalVitality * 0.5); // +0.5 shards per % vitality remaining
    const totalReward = baseReward + vitalityBonus;

    // Update Sector Stability (+5% per success, capped at 100%)
    const newStability = Math.min(100.0, stability + 5.0);

    // If successfully clearing the final level of Sector 1 (level 3), unlock Sector 2.
    // If successfully clearing the final level of Sector 2 (level 6), unlock Sector 3.
    let unlocked = profile.unlockedSectors;
    if (levelConfig.levelNumber === 7 && !unlocked.includes("sector_02")) {
      unlocked += ",sector_02";
    } else if (levelConfig.levelNumber === 10 && !unlocked.includes("sector_03")) {
      unlocked += ",sector_03";
    }

    // Execute updates
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          bioShards: profile.bioShards + totalReward,
          unlockedSectors: unlocked
        }
      }),
      prisma.sectorStability.update({
        where: { id: sectorStable?.id },
        data: { stabilityScore: newStability }
      }),
      prisma.gameStateSnapshot.create({
        data: {
          userProfileId: profile.id,
          levelId: snapshotDto.levelId,
          seed: snapshotDto.seed,
          elapsedSeconds: snapshotDto.elapsedSeconds,
          finalVitality: snapshotDto.finalVitality,
          finalNeuralLoad: snapshotDto.finalNeuralLoad,
          actionsLog: JSON.stringify(snapshotDto.actions),
          gridCoordinates: JSON.stringify(snapshotDto.grid),
          isValidated: true
        }
      })
    ]);

    const updatedProfile = await getProfilePayload(profile.id);

    res.json({
      success: true,
      reward: totalReward,
      profile: updatedProfile
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start Express Server
app.listen(PORT, async () => {
  console.log(`Neural-Carthage Server boot complete. Listening on http://localhost:${PORT}`);
  try {
    await seedDefaultData();
    console.log("Database initialized and default seed records created.");
  } catch (err) {
    console.error("Error running database setup:", err);
  }
});
