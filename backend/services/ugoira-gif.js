const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');
// These dependencies are expected in project dependencies
const AdmZip = require('adm-zip');
const jpeg = require('jpeg-js');
const GIFEncoder = require('gifencoder');

/**
 * Generate an animated GIF preview from a Pixiv ugoira ZIP and frame metadata.
 * - Extracts frames from ZIP into a temp directory
 * - Encodes frames into GIF honoring per-frame delays
 * - Writes GIF to outPath
 *
 * @param {string} zipPath - Path to the downloaded ugoira ZIP file
 * @param {Array<{file:string, delay:number}>} frames - Frame metadata from Pixiv API
 * @param {string} outPath - Destination path for the generated GIF (e.g., preview.gif)
 */
async function generatePreviewGifFromUgoira(zipPath, frames, outPath) {
  if (!zipPath || !Array.isArray(frames) || frames.length === 0 || !outPath) {
    throw new Error('Invalid parameters for generating ugoira preview GIF');
  }

  const tmpDir = path.join(path.dirname(outPath), '.ugoira_tmp');

  await fsExtra.ensureDir(tmpDir);

  try {
    // Extract all frames
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tmpDir, true);

    // Determine size from first frame
    const firstFramePath = path.join(tmpDir, frames[0].file);
    const firstBuf = fs.readFileSync(firstFramePath);
    const firstDecoded = jpeg.decode(firstBuf, { useTArray: true });

    const width = firstDecoded.width;
    const height = firstDecoded.height;

    // Initialize encoder and output stream
    const encoder = new GIFEncoder(width, height);
    const ws = fs.createWriteStream(outPath);
    encoder.createReadStream().pipe(ws);

    encoder.start();
    encoder.setRepeat(0); // loop forever
    encoder.setQuality(10);

    // Add frames honoring per-frame delay
    for (const f of frames) {
      const framePath = path.join(tmpDir, f.file);
      const buf = fs.readFileSync(framePath);
      const decoded = jpeg.decode(buf, { useTArray: true });

      // Ensure dimensions match; if not, skip or resize (skip for simplicity)
      if (decoded.width !== width || decoded.height !== height) {
        // Skip mismatched frames to keep encoder stable
        continue;
      }

      encoder.setDelay(typeof f.delay === 'number' ? f.delay : 0);
      encoder.addFrame(decoded.data);
    }

    encoder.finish();

    await new Promise((resolve, reject) => {
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
  } finally {
    // Cleanup extracted frames
    try { await fsExtra.remove(tmpDir); } catch (_) {}
  }
}

module.exports = {
  generatePreviewGifFromUgoira,
};