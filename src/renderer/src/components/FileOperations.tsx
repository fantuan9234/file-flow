import { useState } from 'react'
import type { FileInfo, RenameOperation, RenameResult, RenameHistory } from '../electron'

interface FileScannerProps {
  onFilesScanned?: (files: FileInfo[]) => void
}

export function FileScanner({ onFilesScanned }: FileScannerProps) {
  const [dirPath, setDirPath] = useState<string>('')
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    if (!dirPath) {
      setError('Please enter a directory path')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const scannedFiles = await window.api.scanFiles(dirPath)
      setFiles(scannedFiles)
      onFilesScanned?.(scannedFiles)
    } catch (err) {
      setError(`Failed to scan directory: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString()
  }

  return (
    <div className="file-scanner">
      <div className="scanner-input">
        <input
          type="text"
          value={dirPath}
          onChange={(e) => setDirPath(e.target.value)}
          placeholder="Enter directory path..."
          className="path-input"
        />
        <button onClick={handleScan} disabled={loading} className="scan-button">
          {loading ? 'Scanning...' : 'Scan Files'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {files.length > 0 && (
        <div className="file-list">
          <h3>Found {files.length} files</h3>
          <ul>
            {files.map((file, index) => (
              <li key={index} className="file-item">
                <span className="file-path" title={file.path}>
                  {file.path}
                </span>
                <span className="file-size">{formatFileSize(file.size)}</span>
                <span className="file-mtime">{formatDate(file.mtime)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface RenameManagerProps {
  lastOperations?: RenameOperation[]
  onOperationsChange?: (operations: RenameOperation[]) => void
}

export function RenameManager({ lastOperations, onOperationsChange }: RenameManagerProps) {
  const [operations, setOperations] = useState<RenameOperation[]>([])
  const [results, setResults] = useState<RenameResult[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const addOperation = () => {
    setOperations([...operations, { oldPath: '', newPath: '' }])
  }

  const updateOperation = (index: number, field: 'oldPath' | 'newPath', value: string) => {
    const newOperations = [...operations]
    newOperations[index][field] = value
    setOperations(newOperations)
  }

  const removeOperation = (index: number) => {
    setOperations(operations.filter((_, i) => i !== index))
  }

  const handleExecute = async () => {
    const validOperations = operations.filter(
      (op) => op.oldPath.trim() && op.newPath.trim()
    )

    if (validOperations.length === 0) {
      return
    }

    setLoading(true)
    try {
      const renameResults = await window.api.renameFiles(validOperations)
      setResults(renameResults)
      onOperationsChange?.(validOperations)
    } catch (err) {
      setResults([
        {
          success: false,
          message: `Failed to execute rename: ${(err as Error).message}`
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleUndo = async () => {
    if (!lastOperations || lastOperations.length === 0) {
      return
    }

    setLoading(true)
    const history: RenameHistory = {
      operations: lastOperations,
      timestamp: Date.now()
    }

    try {
      const undoResults = await window.api.undoRename(history)
      setResults(undoResults)
      onOperationsChange?.([])
    } catch (err) {
      setResults([
        {
          success: false,
          message: `Failed to undo rename: ${(err as Error).message}`
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rename-manager">
      <h3>Batch Rename</h3>

      <div className="operations-list">
        {operations.map((op, index) => (
          <div key={index} className="operation-row">
            <input
              type="text"
              placeholder="Old path"
              value={op.oldPath}
              onChange={(e) => updateOperation(index, 'oldPath', e.target.value)}
              className="path-input"
            />
            <span className="arrow">→</span>
            <input
              type="text"
              placeholder="New path"
              value={op.newPath}
              onChange={(e) => updateOperation(index, 'newPath', e.target.value)}
              className="path-input"
            />
            <button
              onClick={() => removeOperation(index)}
              className="remove-button"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="rename-actions">
        <button onClick={addOperation} className="add-button">
          + Add Operation
        </button>
        <button
          onClick={handleExecute}
          disabled={loading || operations.length === 0}
          className="execute-button"
        >
          {loading ? 'Executing...' : 'Execute Rename'}
        </button>
        <button
          onClick={handleUndo}
          disabled={loading || !lastOperations || lastOperations.length === 0}
          className="undo-button"
        >
          Undo Last Operation
        </button>
      </div>

      {results.length > 0 && (
        <div className="results">
          <h4>Results:</h4>
          {results.map((result, index) => (
            <div
              key={index}
              className={`result-item ${result.success ? 'success' : 'error'}`}
            >
              {result.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
