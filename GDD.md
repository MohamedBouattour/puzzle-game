# Game Design Document (GDD)
## Project Name: Neural-Carthage: Bio-Architect
**Document Version:** 1.0.0  
**Target Platform:** Web (React + SVG Grid Render)  
**Target Audience:** Tech-savvy puzzle enthusiasts, strategy gamers, and cyberpunk/dark-fantasy fans.

---

## 1. Executive Summary & Design Pillars

### 1.1 The High Concept
*Neural-Carthage: Bio-Architect* is a visceral, high-stakes bio-mechanical puzzle game where players assume the role of a *Cabanist Bio-Architect*. You must splice biological neural pathways and ancient bronze machinery to construct cybernetic circuits within the brains of legionaries, priests, and bio-digital entities. You operate under severe constraints: the patient's organic tissue is decaying, and overloading the system will blow the subject's consciousness into the void.

```
       [Macro Loop: Temple of Tanit]
                     │
         Expends Bio-Shards on Upgrades
                     │
                     ▼
         [Micro Loop: Surgery Chamber] ◄── Decreased Stability increases decay
                     │
        Completes Levels (Seed-Based Hex Grid)
                     │
                     ▼
          [Harvests Bio-Shards]
```

### 1.2 The Narrative Context
In an alternate-history antiquity, Carthage did not fall; instead, they discovered *Tanit's Fluid*—an organic cybernetic energy source found in deep coastal reefs. The empire synthesized clay, weathered sandstone, hammered bronze, and biological tissue to build the first biomechanical hive mind. Players serve the high council, performing neuro-splicing operations on citizens to optimize the network, while managing the instability of a decaying empire.

### 1.3 Design Pillars
*   **Neoclassical Punic Med-Tech Aesthetic:** Visceral dark fantasy meets high-precision medical UI. Hammered bronze framing, weathered stone backdrops, wet biological tissue, and glowing cybernetic cyan energy lines.
*   **Decay vs. Overclocking:** The core tension is temporal (organic decay ticking down) vs. spatial/computational (neural load adding latency). You must act fast but place efficiently.
*   **Risk-Reward Splicing:** Levels feature a safe, optimal route for basic completion, and sub-optimal branches leading to high-value *Bio-Shard* caches that invite catastrophic failure if mismanaged.

---

## 2. Core Gameplay Mechanics (The Micro Loop)

The core gameplay loop is located in the **Surgery Chamber** interface, rendered inside a circular bio-mechanical viewport representation.

### 2.1 The Hexagonal Grid System
The Surgery Chamber features a hexagonal matrix representing the subject's brain tissue.
*   **Hex Matrix Topology:** Hexagonal tiles allow for 6-directional connection possibilities (0°, 60°, 120°, 180°, 240°, 300°), mirroring biological neural matrices.
*   **Tile Classifications:**
    1.  **Input Node (Brain Stem):** The entry point where cybernetic cyan energy enters the grid.
    2.  **Output Node (Organ/Implant):** The destination target that must receive the energy to stabilize the patient.
    3.  **Healthy Tissue Tile:** Standard blank tiles where players can place bio-mechanical connectors.
    4.  **Blocked (Sandstone/Bone Obstruction):** Impassable tiles containing fossilized bone or sandstone. Must be cleared with a Laser Scalpel tool before connectors can be placed.
    5.  **Corrupted Tissue:** Spreads decay. Splicing a connector through active corruption increases the Vitality depletion rate unless cleansed.
    6.  **Bio-Shard Cache Node:** Optional targets containing raw Bio-Shards. Connecting them to the active network harvests the shards, but increases the overall Neural Load (MS/Ph) and path length.

### 2.2 Win and Loss Conditions
*   **Win Condition:** Establish a continuous, closed neural network path of connected cyber-veins/bronze-gears from the **Input Node** to the **Output Node**.
*   **Loss Condition A (Patient Death):** **Subject Vitality (%)** ticks down to 0% before the connection is completed.
*   **Loss Condition B (Systemic Overclock):** The cumulative **Neural Load (MS/Ph)** of all placed and rotated connectors exceeds the level's maximum threshold, causing a thermal overload of the cybernetic implants.

### 2.3 The State Constraints
To maintain a high-stress puzzle environment, the system tracks two live variables:

#### Subject Vitality (%)
*   Starts at 100% (or lower on hard levels/low stability sectors).
*   Ticks down at a base rate of $R_d$ per second (e.g., $1.5\%$ per second).
*   Formula for live vitality:
    $$V(t) = V_0 - \int_{0}^{t} \left( R_d \cdot (1 + \mu_c \cdot N_c) \right) dt$$
    where $V_0$ is initial vitality, $\mu_c$ is the corruption penalty modifier, and $N_c$ is the number of connected corrupted tiles.
*   If vitality reaches 0, the grid locks, emitting a low-frequency bone vibration sound, and the procedure fails.

#### Neural Load (MS/Ph - Milliseconds per Phase)
*   Every connector component has an inherent latency (representing signal propagation delay).
*   Standard Straight Connector: $10 \text{ MS/Ph}$
*   60° Curved Connector: $15 \text{ MS/Ph}$
*   120° Curved Connector: $20 \text{ MS/Ph}$
*   Split-Y Connector (distributes signal): $30 \text{ MS/Ph}$
*   Every active placement or rotation action adds a small transient load spike ($+5 \text{ MS/Ph}$) representing mechanical friction.
*   The cumulative Neural Load is calculated as:
    $$L = \sum_{i \in \text{Path}} L_{\text{comp}}(i) + \sum_{j \in \text{Actions}} L_{\text{friction}}(j)$$
*   If $L > L_{\max}$, the network enters **Systemic Overclock** and fails instantly.

### 2.4 Tactical Surgical Tools
Players have a hot-bar containing surgical tools with limited usage per level:
1.  **Laser Scalpel:** Clears a Blocked (Sandstone/Bone) tile, transforming it into Healthy Tissue. Consumes 1 charge.
2.  **Suture Needle:** Locks a connector tile in its current rotation. Once sutured, the piece cannot be rotated or deleted, protecting it from accidental gestures or dynamic hazards.
3.  **Chemical Injector:** Temporarily freezes the Subject Vitality depletion tracker for exactly 5 seconds. Consumes Bio-Shards from the player's pool (default: 15 Bio-Shards per injection).

---

## 3. Level Design & Progression Matrix

The narrative and difficulty progression is split into three major sectors of Carthage.

| Sector Name | Grid Size | Core Mechanic Intro | Dominant Enemy/Hazard Type | Typical $L_{\max}$ |
| :--- | :--- | :--- | :--- | :--- |
| **Sector 01: The Cothon Slums** | 5x5 | Flow mechanics, simple bone blockages, basic vitality decay. | Infected Workers / Servitors | $120 \text{ MS/Ph}$ |
| **Sector 02: Byrsa Citadel** | 7x7 | "Leaking Synapses" (energy leaks out of open connections, accelerating decay). | Corrupted Legionary Sentinels | $250 \text{ MS/Ph}$ |
| **Sector 03: The Oracle Core** | 9x9 / 11x11 | Pulsing hidden paths; shifting tiles; moving corruption clouds. | High Priests / The Blind Oracle | $450 \text{ MS/Ph}$ |

### 3.1 Sector Mechanics Deep Dive
*   **Leaking Synapses (Sector 2):** Any connector pathway that terminates in an empty space while carrying cyan energy acts as a leak. A leaking synapse doubles the baseline Subject Vitality decay rate due to electrical hemorrhaging.
*   **Shifting Corruption (Sector 3):** Necrotic spots move across the grid on a timer (e.g., every 8 seconds). If a player has placed a pathway in their path, it becomes corrupted, immediately altering the system's Neural Load and Vitality decay rate. Suture needles do not prevent corruption, only rotation.
*   **Blind Pulsing (Sector 3):** The grid is shrouded in an organic membrane. A neural diagnostic pulse fires every 4 seconds, revealing the healthy and blocked tiles for 1 second before fading back to shadow.

### 3.2 Procedural Generation and Seeding
Levels are seed-generated to ensure infinite replayability. The generation algorithm takes a 32-bit integer seed and performs the following constraints:
1.  **Optimal Path Reservation:** The algorithm uses a pathfinder (A* or Dijkstra) on the raw grid matrix to verify that at least one path from Input to Output exists that falls under $80\%$ of the level's $L_{\max}$.
2.  **Lure Generation:** Branches are generated off the optimal path that lead to Bio-Shard nodes. Splicing into these branches requires placing curves and splits that push the load value to $95\% - 99\%$ of $L_{\max}$, forcing the player to calculate their route precisely.

---

## 4. System Economy & Meta Loop (The Macro Loop)

Outside of the Surgery Chamber, the player manages their standing in the empire and their splicing arsenal.

### 4.1 Currency: Bio-Shards
*   **Acquisition:** Awarded upon successful surgical operations. Bonus shards are awarded for high-precision runs (finishing with high remaining vitality or minimal neural load).
*   **Usage:** Used to purchase upgrades at the Temple of Tanit or buy tactical items (e.g., Suture Needles, Scalpels).

### 4.2 The Upgrades Tree (The Temple of Tanit)
Players upgrade their bio-mechanical rig using Bio-Shards:
*   **Max Neural Load Buffer:** Increases the maximum load threshold ($L_{\max}$) by $5\%$ per tier (Max: 5 Tiers).
*   **Diagnostic Precision:** At the start of a level, shows a ghost outline of the shortest path for 3 seconds (Tier 1: 3s, Tier 2: 5s, Tier 3: Permanent toggle).
*   **Tool Efficiency:** Reduces the shard cost of the Chemical Injector or increases the duration of the vitality freeze by 1 second per tier.

### 4.3 Sector Stability & Permadeath Penalties
Failing an operation has geopolitical consequences:
*   Each sector has a **Stability Factor (%)** starting at 100%.
*   Failing a level reduces the stability of the active sector by $10\%$.
*   **The Penalty Threshold:** If a sector's stability falls below $30\%$, the tissue degradation becomes volatile. Future operations in that sector suffer a permanent **15% increase in baseline Vitality decay speeds** ($R_d$).
*   **Recovery:** Players can purchase a **Cleansing Script** (costing 500 Bio-Shards) or complete 3 consecutive low-risk operations successfully to restore $25\%$ stability.

---

## 5. UI & Screen Mapping (Stitch Integration)

The game UI matches the mockups defined in the Stitch project `projects/2786671574267274961`:

1.  **Splash Screen / Tanit Emblem** (`13f4eb98f67649e4a0c5c312b26883d5`):
    *   Displays a glowing cyan Punic Tanit emblem pulsing over a dark sandstone texture.
2.  **Master Dashboard** (`abb5725b8e6e415c8e4730552cef8e57`):
    *   The primary hub showing total Bio-Shards, active operations count, and general player stats.
3.  **Neural Map Selection** (`1dba5bc13a6442d6976749c12f9a4cad`):
    *   A map representing the Sectors of Carthage (Cothon Slums, Byrsa Citadel, Oracle Core) showing their current Stability Factor.
4.  **Surgery Chamber** (`f22cdb9d76f94b9bae1f881d4e398c6b`):
    *   The core gameplay screen. A circular viewport with weathered bronze trim, a central hexagonal grid, a Vitality percentage bar pulsing red when low, and the bottom surgical tool hot-bar.
5.  **The Temple of Tanit** (`c228426c00c84236849c119675d1825e`):
    *   The upgrade screen where players unlock technologies on the neoclassical tech tree.
6.  **The Sanctuary Inventory** (`9dad91ee537a4a03817c5e08f40e8085`):
    *   Manages surgical items (Neural-Spikes, spare scalpel blades, chemical reagents).
7.  **The Oracle of Tanit** (`95f7f58de3b34265a4421000a2a021d7`):
    *   The narrative hub where the Blind Oracle issues decree tasks and storyline progress is updated.
8.  **Procedure Successful** (`8b8530d09e7446a2918daaf2627ca47f`):
    *   Displays procedural stats: shards harvested, final vitality, total neural load, and updates stability levels.
9.  **Readouts Terminal** (`7230e0842e8346bba0a7ed53b80288bb`):
    *   A system log terminal detailing neural signal frequency and diagnostics in Space Mono font.
