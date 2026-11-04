import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('createPortal import check', () => {
  it('all ts and tsx files using createPortal must import it from react-dom', () => {
    const srcDir = path.resolve(__dirname, '..')
    
    function getAllFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...getAllFiles(fullPath))
        } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !entry.name.includes('.test.')) {
          files.push(fullPath)
        }
      }
      return files
    }

    const allFiles = getAllFiles(srcDir)
    const filesWithMissingImport: string[] = []

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      if (/\bcreatePortal\b/.test(content)) {
        const hasImport = /import\s+.*\{[^}]*\bcreatePortal\b[^}]*\}\s+from\s+['"]react-dom['"]/.test(content)
        if (!hasImport) {
          filesWithMissingImport.push(path.relative(srcDir, file))
        }
      }
    }

    expect(filesWithMissingImport).toEqual([])
  })
})
