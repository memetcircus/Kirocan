import { createCanvas, loadImage } from "canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CANVAS_SIZE = 360;
const TILE_SIZE = 120;
const TILES_PER_ROW = 3;
const FRAME_COUNT = 30;
const GHOST_SIZE = 270; // 75% of 360
const BOB_AMPLITUDE = 6;
const BG_COLOR = "#9145fd";

interface Variant {
  name: string;
  sourceFile: string;
  outputDir: string;
}

const variants: Variant[] = [
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

    const sourceImage = await loadImage(join(assetsDir, variant.sourceFile));

    console.log(`Generating ${variant.name} variant...`);

    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      // Create 360x360 canvas
      const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
      const ctx = canvas.getContext("2d");

      // Fill background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Calculate ghost position
      const progress = frame / FRAME_COUNT;
      const bobY = Math.sin(progress * Math.PI * 2) * BOB_AMPLITUDE;
      const baseY = (CANVAS_SIZE - GHOST_SIZE) / 2 + bobY;

      // Walk direction: frames 0-14 left->right, frames 15-29 right->left
      const isSecondHalf = frame >= 15;
      const halfProgress = isSecondHalf
        ? (frame - 15) / 14 // 0->1 during second half
        : frame / 14; // 0->1 during first half

      const maxX = CANVAS_SIZE - GHOST_SIZE; // 90px
      const x = isSecondHalf
        ? maxX * (1 - halfProgress) // right->left
        : maxX * halfProgress; // left->right

      // Draw ghost (mirrored in second half)
      ctx.save();
      if (isSecondHalf) {
        // Flip horizontally around the ghost center
        ctx.translate(x + GHOST_SIZE, baseY);
        ctx.scale(-1, 1);
        ctx.drawImage(sourceImage, 0, 0, GHOST_SIZE, GHOST_SIZE);
      } else {
        ctx.drawImage(sourceImage, x, baseY, GHOST_SIZE, GHOST_SIZE);
      }
      ctx.restore();

      // Split into 9 tiles (120x120 each)
      for (let tile = 0; tile < 9; tile++) {
        const tileRow = Math.floor(tile / TILES_PER_ROW);
        const tileCol = tile % TILES_PER_ROW;
        const tileX = tileCol * TILE_SIZE;
        const tileY = tileRow * TILE_SIZE;

        const tileCanvas = createCanvas(TILE_SIZE, TILE_SIZE);
        const tileCtx = tileCanvas.getContext("2d");
        tileCtx.drawImage(
          canvas,
          tileX,
          tileY,
          TILE_SIZE,
          TILE_SIZE,
          0,
          0,
          TILE_SIZE,
          TILE_SIZE
        );

        const frameStr = frame.toString().padStart(2, "0");
        const fileName = `frame-${frameStr}-tile-${tile}.png`;
        const filePath = join(outputDir, fileName);
        writeFileSync(filePath, tileCanvas.toBuffer("image/png"));
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
