import { NextRequest, NextResponse } from 'next/server';
import { readUsers, writeUsers, checkAdmin, hashPassword, getSessionFromRequest } from '@/lib/auth';
import {
  RequestValidationError,
  readEnum,
  readJsonObject,
  readString,
  readStringArray,
} from '@/lib/requestValidation';

const MAX_USERS_BODY_BYTES = 16 * 1024;

function validateUsername(username: string): string {
  if (/[\u0000-\u001F\u007F]/.test(username)) {
    throw new RequestValidationError('Le nom d’utilisateur contient des caractères invalides.');
  }
  return username;
}

function normalizePermissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string' && item.length > 0))];
}

function samePermissions(left: string[] | undefined, right: string[]): boolean {
  const normalizedLeft = normalizePermissionList(left);
  return normalizedLeft.length === right.length && normalizedLeft.every((value, index) => value === right[index]);
}

export async function GET(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  const users = readUsers();
  const safeUsers = users.map(u => ({ 
    username: u.username, 
    role: u.role,
    allowedTabs: u.allowedTabs || [],
    allowedWidgets: u.allowedWidgets || []
  }));
  return NextResponse.json(safeUsers);
}

export async function POST(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const body = await readJsonObject(req, MAX_USERS_BODY_BYTES);
    const username = validateUsername(readString(body, 'username', { required: true, maxLength: 64 })!);
    const password = readString(body, 'password', { maxLength: 1024, trim: false });
    const role = readEnum(body, 'role', ['admin', 'viewer'] as const, true)!;
    const allowedTabs = readStringArray(body, 'allowedTabs', { maxItems: 100, maxItemLength: 128 }) || [];
    const allowedWidgets = readStringArray(body, 'allowedWidgets', { maxItems: 100, maxItemLength: 128 }) || [];

    const users = readUsers();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    const nextAllowedTabs = normalizePermissionList(allowedTabs);
    const nextAllowedWidgets = normalizePermissionList(allowedWidgets);

    if (userIndex !== -1) {
      // Modification
      const existingUser = users[userIndex];
      let revokeExistingSessions = false;
      if (password) {
        existingUser.passwordHash = hashPassword(password);
        revokeExistingSessions = true;
      }
      
      // Protection: Ne pas pouvoir modifier le rôle des comptes système admin et viewer
      if (username.toLowerCase() === 'admin') {
        if (existingUser.role !== 'admin') revokeExistingSessions = true;
        existingUser.role = 'admin';
      } else if (username.toLowerCase() === 'viewer') {
        if (existingUser.role !== 'viewer') revokeExistingSessions = true;
        existingUser.role = 'viewer';
      } else {
        if (existingUser.role !== role) revokeExistingSessions = true;
        existingUser.role = role;
      }

      if (!samePermissions(existingUser.allowedTabs, nextAllowedTabs)) revokeExistingSessions = true;
      if (!samePermissions(existingUser.allowedWidgets, nextAllowedWidgets)) revokeExistingSessions = true;
      existingUser.allowedTabs = nextAllowedTabs;
      existingUser.allowedWidgets = nextAllowedWidgets;
      if (revokeExistingSessions) {
        existingUser.sessionVersion = (existingUser.sessionVersion || 0) + 1;
      }
    } else {
      // Ajout
      if (!password) {
        return NextResponse.json({ error: 'Le mot de passe est obligatoire pour un nouvel utilisateur.' }, { status: 400 });
      }
      users.push({
        username,
        role,
        passwordHash: hashPassword(password),
        allowedTabs: nextAllowedTabs,
        allowedWidgets: nextAllowedWidgets,
        sessionVersion: 0
      });
    }

    if (!writeUsers(users)) {
      return NextResponse.json({ error: 'Impossible d’enregistrer les utilisateurs.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof RequestValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Erreur API Users (POST):', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Nom d\'utilisateur manquant.' }, { status: 400 });
    }
    validateUsername(readString({ username }, 'username', { required: true, maxLength: 64 })!);

    if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'viewer') {
      return NextResponse.json({ error: 'Les utilisateurs système par défaut (admin et viewer) ne peuvent pas être supprimés.' }, { status: 400 });
    }

    const users = readUsers();
    
    const payload = getSessionFromRequest(req);
    if (payload?.username.toLowerCase() === username.toLowerCase()) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer le compte avec lequel vous êtes connecté.' }, { status: 400 });
    }

    // Protection : S'assurer qu'il reste au moins un admin
    const adminCount = users.filter(u => u.role === 'admin').length;
    const targetUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (targetUser?.role === 'admin' && adminCount <= 1) {
      return NextResponse.json({ error: 'Impossible de supprimer le dernier administrateur.' }, { status: 400 });
    }

    const filteredUsers = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    
    if (filteredUsers.length === users.length) {
      return NextResponse.json({ error: 'Utilisateur non trouvé.' }, { status: 404 });
    }

    if (!writeUsers(filteredUsers)) {
      return NextResponse.json({ error: 'Impossible d’enregistrer les utilisateurs.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof RequestValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Erreur API Users (DELETE):', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
