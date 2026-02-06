import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const homeDir = os.homedir();
  let requestedPath = searchParams.get('path');
  let currentPath: string;

  if (requestedPath) {
    currentPath = requestedPath;
  } else {
    // Default to Downloads if it exists, otherwise Home
    const downloadsPath = path.join(homeDir, 'Downloads');
    currentPath = fs.existsSync(downloadsPath) ? downloadsPath : homeDir;
  }

  try {
    // Resolve home directory if ~ is used
    if (currentPath.startsWith('~')) {
      currentPath = currentPath.replace('~', os.homedir());
    }

    // Ensure the path is absolute
    if (!path.isAbsolute(currentPath)) {
        currentPath = path.resolve(currentPath);
    }

    const files = await fs.promises.readdir(currentPath, { withFileTypes: true });
    
    const directories = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        path: path.join(currentPath, dirent.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      code: 200,
      data: {
        currentPath,
        parentPath: path.dirname(currentPath),
        directories
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      code: 500,
      message: error.message
    }, { status: 500 });
  }
}
