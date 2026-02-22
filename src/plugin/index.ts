// src/plugin/index.ts — VehiClaw entry point
// Connects to the OpenClaw Gateway, registers VehiClaw skills, and starts the car UI bridge server.

import { log } from '../logger.js';
import { gateway } from './gateway-client.js';
import { startServer } from './server.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('  VehiClaw v1.0.0 — Starting up');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Ensure data directory exists
  const dataDir = path.resolve(config.dataDir);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log(`Created data directory at ${dataDir}`);
  }

  // 1. Connect to OpenClaw Gateway
  try {
    await gateway.connect();

    // Register VehiClaw skills with the Gateway
    await registerSkills();

    log('OpenClaw Gateway ready');
  } catch (err) {
    log(
      `Could not connect to OpenClaw Gateway (${config.gatewayUrl}). ` +
      `Make sure OpenClaw is running: npm install -g openclaw && openclaw gateway`,
      'warn'
    );
    log('VehiClaw will continue in standalone mode with direct LLM calls.', 'warn');
  }

  // 2. Start the car UI bridge server
  await startServer();
}

async function registerSkills() {
  const skillsDir = path.resolve('./skills');
  if (!fs.existsSync(skillsDir)) {
    log('No skills directory found — skipping skill registration', 'warn');
    return;
  }

  const skillDirs = fs.readdirSync(skillsDir).filter((d) => {
    return fs.statSync(path.join(skillsDir, d)).isDirectory();
  });

  for (const skillName of skillDirs) {
    const skillMdPath = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    const skillContent = fs.readFileSync(skillMdPath, 'utf-8');

    try {
      await gateway.request('skills.register', {
        name: skillName,
        content: skillContent,
        workspacePath: path.resolve('./'),
      });
      log(`Registered skill: ${skillName}`);
    } catch (err) {
      log(`Failed to register skill ${skillName}: ${err}`, 'warn');
    }
  }
}

main().catch((err) => {
  log(`Fatal startup error: ${err}`, 'error');
  process.exit(1);
});
