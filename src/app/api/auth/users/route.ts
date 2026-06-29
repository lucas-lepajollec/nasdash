import { NextRequest, NextResponse } from 'next/server';
import { readUsers, writeUsers, verifyToken, hashPassword } from '@/lib/auth';

function checkAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('nasdash_session')?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.role === 'admin';
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

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
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const { username, password, role, allowedTabs, allowedWidgets } = await req.json();

    if (!username || !role) {
      return NextResponse.json({ error: 'Informations incomplètes.' }, { status: 400 });
    }

    if (role !== 'admin' && role !== 'viewer') {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());

    if (userIndex !== -1) {
      // Modification
      if (password) {
        users[userIndex].passwordHash = hashPassword(password);
      }
      
      // Protection: Ne pas pouvoir modifier le rôle des comptes système admin et viewer
      if (username.toLowerCase() === 'admin') {
        users[userIndex].role = 'admin';
      } else if (username.toLowerCase() === 'viewer') {
        users[userIndex].role = 'viewer';
      } else {
        users[userIndex].role = role;
      }
      
      users[userIndex].allowedTabs = allowedTabs || [];
      users[userIndex].allowedWidgets = allowedWidgets || [];
    } else {
      // Ajout
      if (!password) {
        return NextResponse.json({ error: 'Le mot de passe est obligatoire pour un nouvel utilisateur.' }, { status: 400 });
      }
      users.push({
        username,
        role,
        passwordHash: hashPassword(password),
        allowedTabs: allowedTabs || [],
        allowedWidgets: allowedWidgets || []
      });
    }

    writeUsers(users);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Erreur API Users (POST):', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Nom d\'utilisateur manquant.' }, { status: 400 });
    }

    if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'viewer') {
      return NextResponse.json({ error: 'Les utilisateurs système par défaut (admin et viewer) ne peuvent pas être supprimés.' }, { status: 400 });
    }

    const users = readUsers();
    
    // Protection : Ne pas pouvoir supprimer l'admin actuellement connecté pour ne pas se bloquer dehors
    const token = req.cookies.get('nasdash_session')?.value;
    const payload = verifyToken(token!);
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

    writeUsers(filteredUsers);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Erreur API Users (DELETE):', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
