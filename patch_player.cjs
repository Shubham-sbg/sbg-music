const fs = require('fs');
let code = fs.readFileSync('src/components/Player.tsx', 'utf-8');

// Add import
const importStr = `import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, AlertCircle, Loader2 } from 'lucide-react';`;
const newImportStr = `import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, AlertCircle, Loader2 } from 'lucide-react';\nimport QueueDrawer from './QueueDrawer';`;

code = code.replace(importStr, newImportStr);

// Add QueueDrawer to the Right: Volume & Status section
const volumeSectionStr = `{/* Right: Volume & Status */}
      <div className="flex items-center justify-end gap-4 md:gap-6 w-1/3 md:w-1/4">`;
const newVolumeSectionStr = `{/* Right: Volume & Status */}
      <div className="flex items-center justify-end gap-4 md:gap-6 w-1/3 md:w-1/4">
        <QueueDrawer />`;

code = code.replace(volumeSectionStr, newVolumeSectionStr);

fs.writeFileSync('src/components/Player.tsx', code);
