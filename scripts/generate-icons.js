const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_ICON = path.join(__dirname, '..', 'src', 'assets', 'app-icon.png');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android icon sizes for different densities
const ANDROID_ICONS = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function generateAndroidIcons() {
  console.log('Generating Android icons from:', SOURCE_ICON);

  for (const { folder, size } of ANDROID_ICONS) {
    const outputDir = path.join(ANDROID_RES, folder);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate ic_launcher.png
    const outputPath = path.join(outputDir, 'ic_launcher.png');
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated ${folder}/ic_launcher.png (${size}x${size})`);

    // Generate ic_launcher_round.png (same as regular for now)
    const roundOutputPath = path.join(outputDir, 'ic_launcher_round.png');
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(roundOutputPath);

    console.log(`Generated ${folder}/ic_launcher_round.png (${size}x${size})`);
  }

  console.log('Done! Rebuild the app to see the new icon.');
}

generateAndroidIcons().catch(console.error);
