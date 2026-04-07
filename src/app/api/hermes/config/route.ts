import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { readConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

function getHermesDataPath(): string {
  const config = readConfig();
  return config.settings?.hermesDataPath || '/appdata/hermes';
}

// GET /api/hermes/config — read config.yaml
export async function GET() {
  try {
    const dataPath = getHermesDataPath();
    const configPath = path.join(dataPath, 'config.yaml');

    if (!fs.existsSync(configPath)) {
      return NextResponse.json(
        { error: 'config.yaml not found', path: configPath, configured: false },
        { status: 404 }
      );
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw) as Record<string, any> || {};

    // Also read .env for API keys (mask sensitive values)
    const envPath = path.join(dataPath, '.env');
    const envVars: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        // Mask API keys and tokens
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
          envVars[key] = val ? '••••••••' : '';
        } else {
          envVars[key] = val;
        }
      }
    }

    return NextResponse.json({ config: parsed, env: envVars, raw, configured: true });
  } catch (e: any) {
    console.error('Hermes config read error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/hermes/config — write config.yaml
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const dataPath = getHermesDataPath();
    const configPath = path.join(dataPath, 'config.yaml');

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Hermes data directory not found' }, { status: 404 });
    }

    if (body.raw !== undefined) {
      // Raw YAML mode — write as-is
      fs.writeFileSync(configPath, body.raw, 'utf-8');
    } else if (body.config !== undefined) {
      // Structured mode — convert to YAML
      const yamlStr = yaml.dump(body.config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
      fs.writeFileSync(configPath, yamlStr, 'utf-8');
    } else {
      return NextResponse.json({ error: 'Missing config or raw field' }, { status: 400 });
    }

    // Handle .env updates if provided
    if (body.envUpdates && typeof body.envUpdates === 'object') {
      const envPath = path.join(dataPath, '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      for (const [key, value] of Object.entries(body.envUpdates)) {
        if (typeof value !== 'string' || value === '••••••••') continue; // Skip masked values
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent = envContent.trimEnd() + `\n${key}=${value}\n`;
        }
      }

      fs.writeFileSync(envPath, envContent, 'utf-8');
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Hermes config write error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
