// Mede o áudio decodificado no mesmo navegador do jogo, sem alterar os originais.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
async function main() {
  const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
  vm.runInContext(fs.readFileSync('js/battle-announcements.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/cenas/preload.js', 'utf8'), context);
  const sounds = [];
  vm.runInContext('CenaPreload', context).prototype.carregarAssets.call({ load: {
    image() {}, spritesheet() {}, video() {}, audio(key, file) { sounds.push([key, file]); },
  } });
  sounds.push(['menuClick', 'assets/sons/clique-menu.mp3'], ['menuSwipe', 'assets/sons/swipe-menu.mp3']);
  for (const name of fs.readdirSync('assets/videos').filter(name => name.startsWith('carregamento_'))) {
    const file = `assets/videos/${name}`;
    if (fs.readFileSync(file).includes(Buffer.from('soun'))) sounds.push([name, file]);
  }
  const browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined });
  try {
    const page = await browser.newPage();
    const levels = {}, measurements = [];
    for (const [key, file] of sounds) {
      const measured = await page.evaluate(async encoded => {
        const audio = new AudioContext();
        try {
          const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          const buffer = await audio.decodeAudioData(data.buffer);
          let energy = 0, count = 0, peak = 0;
          // Blocos de 50 ms; ignora silêncio abaixo de -45 dBFS.
          const block = Math.round(buffer.sampleRate * .05);
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const samples = buffer.getChannelData(c);
            for (let offset = 0; offset < samples.length; offset += block) {
              let sum = 0;
              const end = Math.min(samples.length, offset + block);
              for (let i = offset; i < end; i++) { sum += samples[i] ** 2; peak = Math.max(peak, Math.abs(samples[i])); }
              if (sum / (end - offset) > .00003162) { energy += sum; count += end - offset; }
            }
          }
          return { rms: count ? Math.sqrt(energy / count) : 0, peak, duration: buffer.duration };
        } catch (error) { return { error: error.message }; }
        finally { await audio.close(); }
      }, fs.readFileSync(file).toString('base64'));
      if (measured.error) throw Error(`${file}: ${measured.error}`);
      const target = key.startsWith('musica') || key.endsWith('.mp4') ? .12 : .18;
      // Reserva margem de pico; ganho máximo de +12 dB para preservar sons discretos.
      levels[key] = measured.rms ? Number(Math.min(4, target / measured.rms, .95 / measured.peak).toFixed(4)) : 1;
      measurements.push({ key, file, gain: levels[key], ...measured });
    }
    fs.writeFileSync('js/audio-levels.js', '// Gerado por node scripts/calibrate-audio.js (RMS com porta de silêncio e margem de pico).\n' +
      'window.CYBERDUEL_AUDIO_GAINS = Object.freeze(' + JSON.stringify(levels, null, 2) + ');\n');
    fs.mkdirSync('output/sindicato/audio', { recursive: true });
    fs.writeFileSync(path.join('output/sindicato/audio', 'measurements.json'), JSON.stringify(measurements, null, 2));
    console.log(`${measurements.length} sons medidos; ganhos salvos em js/audio-levels.js.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
