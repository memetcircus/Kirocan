/**
 * KiroCan - Ghost Animation Tile Generator
 * 
 * Generates 30 animation frames per ghost variant, each split into 9 tiles.
 * Uses Jimp (pure JavaScript, no native dependencies).
 * 
 * Usage: node scripts/build-animation-tiles.js
 */

const Jimp = require("jimp");
const { mkdirSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const CANVAS_SIZE = 360;
const TILE_SIZE = 120;
const TILES_PER_ROW = 3;
const FRAME_COUNT = 30;
const GHOST_SIZE = 270;
const BOB_AMPLITUDE = 6;
// #9145fd in Jimp RGBA int format
const BG_COLOR = Jimp.cssColorToHex("#9145fdff");

const variants = [
  { name: "normal", sourceFile: "normal.png", outputDir: "ghost-walk" },
  { name: "worried", sourceFile: "worried.png", outputDir: "ghost-walk-worried" },
  { name: "fire", sourceFile: "onfire.png", outputDir: "ghost-walk-fire" },
];

async function main() {
  const projectRoot = resolve(__dirname, "..");
  const assetsDir = join(projectRoot, "assets");
  const spritesBase = join(assetsDir, "sprites", "tiles");

  for (const variant of variants) {
    const outputDir = join(spritesBase, variant.outputDir);
    mkdirSync(outputDir, { recursive: true });

    const sourcePath = join(assetsDir, variant.sourceFile);
    if (!existsSync(sourcePath)) {
      console.error(`  ✗ Source file not found: ${sourcePath}`);
      continue;
    }

    // Load and resize source to ghost size (270x270)
    const sourceImg = await Jimp.read(sourcePath);
    const ghostNormal = sourceImg.clone().resize(GHOST_SIZE, GHOST_SIZE);
    const ghostMirrored = ghostNormal.clone().flip(true, false); // horizontal flip

    console.log(`Generating ${variant.name} variant...`);

    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      // Create 360x360 canvas with purple background
      const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, BG_COLOR);

      // Calculate ghost position
      const progress = frame / FRAME_COUNT;
      const bobY = Math.round(Math.sin(progress * Math.PI * 2) * BOB_AMPLITUDE);
      const baseY = Math.round((CANVAS_SIZE - GHOST_SIZE) / 2 + bobY);

      // Walk direction: frames 0-14 left→right, frames 15-29 right→left
      const isSecondHalf = frame >= 15;
      const halfProgress = isSecondHalf
        ? (frame - 15) / 14
        : frame / 14;

      const maxX = CANVAS_SIZE - GHOST_SIZE; // 90px
      const x = Math.round(
        isSecondHalf
          ? maxX * (1 - halfProgress)
          : maxX * halfProgress
      );

      // Composite ghost onto canvas
      const ghost = isSecondHalf ? ghostMirrored : ghostNormal;
      canvas.composite(ghost, x, baseY);

      // Split into 9 tiles (120x120 each)
      for (let tile = 0; tile < 9; tile++) {
        const tileRow = Math.floor(tile / TILES_PER_ROW);
        const tileCol = tile % TILES_PER_ROW;
        const tileX = tileCol * TILE_SIZE;
        const tileY = tileRow * TILE_SIZE;

        const tileImg = canvas.clone().crop(tileX, tileY, TILE_SIZE, TILE_SIZE);

        const frameStr = frame.toString().padStart(2, "0");
        const fileName = `frame-${frameStr}-tile-${tile}.png`;
        const filePath = join(outputDir, fileName);

        await tileImg.writeAsync(filePath);
      }

      if (frame % 10 === 0) {
        process.stdout.write(`    frame ${frame}/30...\n`);
      }
    }

    console.log(`  ✓ ${variant.name}: 30 frames × 9 tiles = 270 files`);
  }

  console.log(`\nDone! Generated 810 tile files total.`);
}

main().catch((err) => {
  console.error("Error generating sprites:", err);
  process.exit(1);
});
