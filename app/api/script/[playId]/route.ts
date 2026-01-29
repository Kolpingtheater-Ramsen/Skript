import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface PlaysConfig {
  [key: string]: {
    name: string;
    sheet: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playId: string }> }
) {
  const { playId } = await params;

  try {
    // Load plays config to get sheet URL
    const configPath = path.join(process.cwd(), 'public', 'data', 'plays.json');
    let playsConfig: PlaysConfig;

    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      playsConfig = JSON.parse(configData);
    } catch {
      // Fallback to Flask backend
      const backendUrl = process.env.FLASK_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/script/${playId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch from backend');
      }

      const csvText = await response.text();
      return new NextResponse(csvText, {
        headers: {
          'Content-Type': 'text/csv',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    const play = playsConfig[playId];
    if (!play) {
      return NextResponse.json(
        { error: `Play not found: ${playId}` },
        { status: 404 }
      );
    }

    // Fetch from Google Sheets
    const response = await fetch(play.sheet);
    if (!response.ok) {
      throw new Error('Failed to fetch script from Google Sheets');
    }

    const csvText = await response.text();
    return new NextResponse(csvText, {
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error fetching script:', error);
    return NextResponse.json(
      { error: 'Failed to load script' },
      { status: 500 }
    );
  }
}
