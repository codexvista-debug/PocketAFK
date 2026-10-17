import { Vec3 } from 'vec3';
import { TerrainGridData, TerrainPaletteItem } from './types';

// Standard Minecraft Top-down Map Colors
const KNOWN_BLOCK_COLORS: Record<string, string> = {
  // Grass & Greens
  grass_block: '#5d9236',
  grass: '#5d9236',
  short_grass: '#5d9236',
  tall_grass: '#52852e',
  fern: '#52852e',
  large_fern: '#52852e',
  moss_block: '#596e2c',
  moss_carpet: '#596e2c',

  // Leaves & Foliage
  oak_leaves: '#3b6a24',
  birch_leaves: '#688e40',
  spruce_leaves: '#3d5e38',
  jungle_leaves: '#34661c',
  acacia_leaves: '#4a6b22',
  dark_oak_leaves: '#2c4d16',
  mangrove_leaves: '#516723',
  azalea_leaves: '#58732d',
  flowering_azalea_leaves: '#6b6640',
  cherry_leaves: '#e69bb0',

  // Water & Liquids
  water: '#3465b5',
  flowing_water: '#3465b5',
  bubble_column: '#4376c7',
  kelp: '#295420',
  kelp_plant: '#295420',
  seagrass: '#2d6124',
  tall_seagrass: '#2d6124',
  lava: '#d94f09',
  flowing_lava: '#d94f09',
  magma_block: '#9c3809',

  // Dirt, Path, Farmland
  dirt: '#866043',
  coarse_dirt: '#775236',
  dirt_path: '#946f3a',
  farmland: '#5b3c22',
  mud: '#3c383d',
  muddy_mangrove_roots: '#443831',
  podzol: '#5c4028',
  rooted_dirt: '#8b6447',
  clay: '#9ea4b0',
  gravel: '#787373',

  // Sand & Desert
  sand: '#ded299',
  red_sand: '#bf5f28',
  sandstone: '#ded299',
  cut_sandstone: '#d1c48c',
  smooth_sandstone: '#d8cb93',
  red_sandstone: '#b85822',

  // Stone, Deepslate, Cobblestone, Minerals
  stone: '#787878',
  cobblestone: '#666666',
  mossy_cobblestone: '#546654',
  stone_bricks: '#737373',
  mossy_stone_bricks: '#596c57',
  cracked_stone_bricks: '#696969',
  chiseled_stone_bricks: '#6c6c6c',
  smooth_stone: '#969696',
  andesite: '#858586',
  polished_andesite: '#8a8a8b',
  diorite: '#b5b5b5',
  polished_diorite: '#bfbfbf',
  granite: '#966453',
  polished_granite: '#9e6a59',
  deepslate: '#4d4d54',
  cobbled_deepslate: '#43434a',
  polished_deepslate: '#484850',
  deepslate_bricks: '#3c3c42',
  deepslate_tiles: '#34343a',
  tuff: '#63675e',
  calcite: '#d9d7ce',
  dripstone_block: '#7a6052',
  pointed_dripstone: '#7a6052',
  bedrock: '#333333',
  obsidian: '#1a1429',
  crying_obsidian: '#24133b',

  // Woods & Planks
  oak_planks: '#a88653',
  oak_log: '#6b5433',
  oak_wood: '#6b5433',
  stripped_oak_log: '#b08f5a',
  spruce_planks: '#6b4f31',
  spruce_log: '#3b2b1a',
  spruce_wood: '#3b2b1a',
  stripped_spruce_log: '#735738',
  birch_planks: '#c7b37e',
  birch_log: '#dedede',
  birch_wood: '#dedede',
  stripped_birch_log: '#c7b37e',
  jungle_planks: '#a07455',
  jungle_log: '#564327',
  jungle_wood: '#564327',
  stripped_jungle_log: '#a37554',
  acacia_planks: '#a85a32',
  acacia_log: '#68615b',
  acacia_wood: '#68615b',
  stripped_acacia_log: '#ad5f37',
  dark_oak_planks: '#432b15',
  dark_oak_log: '#302213',
  dark_oak_wood: '#302213',
  stripped_dark_oak_log: '#483018',
  mangrove_planks: '#753630',
  mangrove_log: '#542721',
  mangrove_wood: '#542721',
  stripped_mangrove_log: '#7a3b34',
  cherry_planks: '#e3a8b6',
  cherry_log: '#362326',
  cherry_wood: '#362326',
  stripped_cherry_log: '#e3abb7',
  bamboo_planks: '#c2b04f',
  bamboo_block: '#6e8529',
  crimson_planks: '#782b3d',
  crimson_stem: '#5c1b29',
  warped_planks: '#2b6e68',
  warped_stem: '#2a5a54',

  // Snow & Ice
  snow: '#edf2f7',
  snow_block: '#edf2f7',
  powder_snow: '#e2ebf2',
  ice: '#90c7f7',
  packed_ice: '#77b2e8',
  blue_ice: '#65a5e3',

  // Nether & End
  netherrack: '#692525',
  soul_sand: '#4d3d34',
  soul_soil: '#47362d',
  glowstone: '#c29d4c',
  nether_bricks: '#30161a',
  red_nether_bricks: '#4a151b',
  blackstone: '#2b272d',
  basalt: '#4f4b4f',
  end_stone: '#dcdb9e',
  end_stone_bricks: '#dcdb9e',
  purpur_block: '#a373a3',
  purpur_pillar: '#a97ba9',

  // Architecture / Glass / Wool
  glass: '#c5d9e8',
  glass_pane: '#c5d9e8',
  white_wool: '#e9ecef',
  red_wool: '#a12929',
  blue_wool: '#334cb2',
  yellow_wool: '#e5b22b',
  green_wool: '#57701e',
  black_wool: '#15161a',
  bricks: '#964b38',
  terracotta: '#985e43',
  iron_block: '#d8d8d8',
  gold_block: '#f6d03d',
  diamond_block: '#62e3d8',
  netherite_block: '#3c353a',

  // Redstone, Machines & Cobblestone Farm Blocks
  respawn_anchor: '#211036',
  furnace: '#646464',
  blast_furnace: '#4a4d52',
  smoker: '#453a2e',
  dispenser: '#696969',
  dropper: '#696969',
  piston: '#7a6a4f',
  sticky_piston: '#717549',
  piston_head: '#98835d',
  moving_piston: '#7a6a4f',
  slime_block: '#72b53a',
  honey_block: '#e89e24',
  hopper: '#3f3f45',
  tnt: '#db3236',
  chest: '#8f652b',
  trapped_chest: '#8f552b',
  barrel: '#735738',
  cauldron: '#3c3c3c',
  anvil: '#454545',
  chipped_anvil: '#454545',
  damaged_anvil: '#454545',
  enchanting_table: '#752d37',
  beacon: '#73dacd',
  redstone_wire: '#e62e2e',
  redstone_block: '#bd1717',
  repeater: '#9c9c9c',
  comparator: '#a6a6a6',
  redstone_torch: '#d44933',
  redstone_wall_torch: '#d44933',
  lever: '#594d3b',
  stone_button: '#787878',
  observer: '#595959',
  target: '#e8ded8',
  daylight_detector: '#918063',
  tripwire_hook: '#706f6b',
  rail: '#8c765c',
  powered_rail: '#c79c38',
  detector_rail: '#8c4f42',
  activator_rail: '#99735c',
  iron_bars: '#7d8085',
  chain: '#383b42',
};

export function getBlockColor(blockName: string): string {
  if (!blockName) return '#4a5568';
  const name = blockName.toLowerCase().replace(/^minecraft:/, '');

  if (KNOWN_BLOCK_COLORS[name]) {
    return KNOWN_BLOCK_COLORS[name];
  }

  // Heuristic pattern fallbacks
  if (name.includes('water')) return '#3465b5';
  if (name.includes('lava') || name.includes('fire')) return '#d94f09';
  if (name.includes('leaves')) return '#3b6a24';
  if (name.includes('grass')) return '#5d9236';
  if (name.includes('moss')) return '#596e2c';
  if (name.includes('sandstone')) return '#ded299';
  if (name.includes('sand')) return '#ded299';
  if (name.includes('plank')) return '#a88653';
  if (name.includes('log') || name.includes('wood') || name.includes('stem')) return '#6b5433';
  if (name.includes('dirt') || name.includes('soil') || name.includes('mud')) return '#866043';
  if (name.includes('deepslate')) return '#4d4d54';
  if (name.includes('stone') || name.includes('cobble') || name.includes('andesite') || name.includes('tuff')) return '#787878';
  if (name.includes('diorite') || name.includes('calcite')) return '#b5b5b5';
  if (name.includes('granite')) return '#966453';
  if (name.includes('snow') || name.includes('ice')) return '#edf2f7';
  if (name.includes('netherrack') || name.includes('crimson')) return '#692525';
  if (name.includes('end_stone')) return '#dcdb9e';
  if (name.includes('glass')) return '#c5d9e8';
  if (name.includes('wool') || name.includes('carpet') || name.includes('concrete')) return '#a0aec0';
  if (name.includes('brick')) return '#964b38';
  if (name.includes('iron')) return '#d8d8d8';
  if (name.includes('gold')) return '#f6d03d';
  if (name.includes('diamond')) return '#62e3d8';

  return '#5a626d';
}

export function formatName(str?: string): string {
  if (!str) return '';
  return str
    .replace(/^minecraft:/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Reusable vector for fast 0-allocation sampling
const probeVec = new Vec3(0, 0, 0);

export function sampleTerrainGrid(bot: any, radius = 14): TerrainGridData | null {
  if (!bot || !bot.entity || !bot.entity.position) {
    return null;
  }

  const pos = bot.entity.position;
  const bx = Math.floor(pos.x);
  const by = Math.floor(pos.y);
  const bz = Math.floor(pos.z);

  // 1. Current Biome
  let currentBiome: string | undefined = undefined;
  try {
    const curBlock = bot.blockAt ? bot.blockAt(pos) : null;
    if (curBlock?.biome?.name) {
      currentBiome = formatName(curBlock.biome.name);
    } else if ((bot.world as any)?.getBiome) {
      const bObj = (bot.world as any).getBiome(pos);
      if (typeof bObj === 'string') currentBiome = formatName(bObj);
      else if (bObj?.name) currentBiome = formatName(bObj.name);
    }
  } catch (e) {}

  // 2. Current Land Block (what bot is standing on)
  let currentLandBlock: string | undefined = undefined;
  try {
    probeVec.set(bx, by, bz);
    let standingOn = bot.blockAt ? bot.blockAt(probeVec) : null;
    if (!standingOn || standingOn.name === 'air' || standingOn.name === 'cave_air') {
      probeVec.set(bx, by - 1, bz);
      standingOn = bot.blockAt ? bot.blockAt(probeVec) : null;
    }
    if (standingOn && standingOn.name !== 'air') {
      currentLandBlock = formatName(standingOn.name);
    }
  } catch (e) {}

  // 3. Grid Sample
  const size = radius * 2 + 1; // e.g. 14*2 + 1 = 29
  const totalCells = size * size;
  const cells: number[] = new Array(totalCells).fill(0);
  const heights: number[] = new Array(totalCells).fill(0);

  const palette: TerrainPaletteItem[] = [
    { id: 0, name: 'Air / Void', color: '#111827' }
  ];
  const paletteMap = new Map<string, number>();
  paletteMap.set('air', 0);
  paletteMap.set('cave_air', 0);
  paletteMap.set('void_air', 0);

  try {
    for (let rz = 0; rz < size; rz++) {
      const dz = rz - radius;
      const wz = bz + dz;

      for (let rx = 0; rx < size; rx++) {
        const dx = rx - radius;
        const wx = bx + dx;
        const cellIndex = rz * size + rx;

        // Scan downwards from by + 5 down to by - 8
        let foundBlock: any = null;
        let foundY = by;

        for (let wy = by + 5; wy >= by - 8; wy--) {
          probeVec.set(wx, wy, wz);
          const b = bot.blockAt(probeVec);
          if (b && b.name !== 'air' && b.name !== 'cave_air' && b.name !== 'void_air') {
            foundBlock = b;
            foundY = wy;
            break;
          }
        }

        if (foundBlock) {
          const bname = foundBlock.name;
          let palId = paletteMap.get(bname);
          if (palId === undefined) {
            palId = palette.length;
            paletteMap.set(bname, palId);
            palette.push({
              id: palId,
              name: formatName(bname),
              color: getBlockColor(bname),
            });
          }
          cells[cellIndex] = palId;
          heights[cellIndex] = Math.max(-10, Math.min(10, foundY - by));
        } else {
          cells[cellIndex] = 0;
          heights[cellIndex] = 0;
        }
      }
    }
  } catch (err) {
    // Graceful fallback if world blocks unavailable during world transition
  }

  // 4. Landscape Environment & Sky Clearance Analysis
  let timeOfDay = 'Day';
  try {
    if (bot.time) {
      const t = (bot.time as any).timeOfDay ?? 6000;
      if (t >= 0 && t < 12000) {
        const hour = Math.floor((t / 1000 + 6) % 24);
        timeOfDay = `Day (${hour}:00)`;
      } else if (t >= 12000 && t < 13800) {
        timeOfDay = 'Sunset 🌇';
      } else if (t >= 13800 && t < 22200) {
        timeOfDay = 'Night 🌙';
      } else {
        timeOfDay = 'Sunrise 🌅';
      }
    }
  } catch (e) {}

  let weather = 'Clear ☀️';
  try {
    if (bot.isRaining) {
      weather = (bot as any).thunderState > 0 ? 'Thunderstorm ⚡' : 'Raining 🌧️';
    }
  } catch (e) {}

  let lightLevel = 15;
  try {
    probeVec.set(bx, by, bz);
    const blk = bot.blockAt ? bot.blockAt(probeVec) : null;
    if (blk && typeof blk.light === 'number') {
      lightLevel = blk.light;
    }
  } catch (e) {}

  let skyClearance = 'Open Sky 🌤️';
  try {
    for (let wy = by + 2; wy <= Math.min(by + 35, 319); wy++) {
      probeVec.set(bx, wy, bz);
      const b = bot.blockAt ? bot.blockAt(probeVec) : null;
      if (b && b.name !== 'air' && b.name !== 'cave_air' && b.name !== 'void_air') {
        skyClearance = `Ceiling at Y: ${wy} (${formatName(b.name)})`;
        break;
      }
    }
  } catch (e) {}

  // 5. Landscape Block Composition & Dominant Terrain Summary
  const counts = new Map<number, number>();
  let solidCount = 0;
  for (let i = 0; i < totalCells; i++) {
    const palId = cells[i];
    if (palId > 0) {
      counts.set(palId, (counts.get(palId) || 0) + 1);
      solidCount++;
    }
  }

  const landscapeSummary: Array<{ name: string; percentage: number; color: string }> = [];
  if (solidCount > 0) {
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [palId, cnt] of sorted) {
      const item = palette[palId];
      if (item) {
        landscapeSummary.push({
          name: item.name,
          percentage: Math.round((cnt / solidCount) * 100),
          color: item.color,
        });
      }
    }
  }

  // 6. Hazard & Environmental Proximity Scanner
  const hazards: string[] = [];
  try {
    let hasLava = false;
    let hasWater = false;
    for (const [palId] of counts.entries()) {
      const item = palette[palId];
      if (!item) continue;
      const lower = item.name.toLowerCase();
      if (lower.includes('lava') || lower.includes('magma')) hasLava = true;
      if (lower.includes('water')) hasWater = true;
    }
    if (hasLava) hazards.push('⚠️ Lava detected within 14 blocks');
    if (hasWater) hazards.push('💧 Water body in immediate area');
    if (hazards.length === 0) hazards.push('🛡️ Area clear of immediate hazards');
  } catch (e) {}

  return {
    radius,
    size,
    currentBiome: currentBiome || 'Plains',
    currentLandBlock: currentLandBlock || 'Grass Block',
    palette,
    cells,
    heights,
    timeOfDay,
    weather,
    lightLevel,
    groundElevation: by,
    seaLevelDelta: by - 63,
    skyClearance,
    landscapeSummary,
    hazards,
  };
}
