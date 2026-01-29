import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Try to load from local file first (for development)
    const filePath = path.join(process.cwd(), 'public', 'data', 'plays.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return NextResponse.json(JSON.parse(data));
    } catch {
      // If local file doesn't exist, try Flask backend
      const backendUrl = process.env.FLASK_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/plays`);

      if (!response.ok) {
        throw new Error('Failed to fetch from backend');
      }

      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching plays:', error);
    return NextResponse.json(
      { error: 'Failed to load plays configuration' },
      { status: 500 }
    );
  }
}
