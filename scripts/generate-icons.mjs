import fs from 'fs';
import path from 'path';

// Minimal valid transparent/colored 1x1 PNG scaled up as placeholder or valid raw buffer
// Standard 192x192 PNG generator without external deps using canvas or base64 raw chunk
// A solid indigo PNG base64:
const basePng192 = 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAMAAAB/Pny7AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAPUExURf9HR////wAAAAQEBAAAAMfX9/gAAAAFdFJOUwBAgIDAwN0RmgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAiSURBVHja7cEBDQAAAMKg909tDwcUAAAAAAAAAAAAAAAAeBo0iAABZ+Rz6QAAAABJRU5ErkJggg==';
const basePng512 = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAMAAADDpiTIAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAPUExURf9HR////wAAAAQEBAAAAMfX9/gAAAAFdFJOUwBAgIDAwN0RmgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAiSURBVHja7cEBDQAAAMKg909tDwcUAAAAAAAAAAAAAAAAeBo0iAABZ+Rz6QAAAABJRU5ErkJggg==';

const dir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon-192.png'), Buffer.from(basePng192, 'base64'));
fs.writeFileSync(path.join(dir, 'icon-512.png'), Buffer.from(basePng512, 'base64'));
console.log('Icons written successfully.');

