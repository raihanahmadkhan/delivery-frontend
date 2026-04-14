

import { useRef, useState } from 'react'

export default function FileUpload({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState(null)

  const handle = (file) => {
    if (!file || !file.name.endsWith('.csv')) return
    setFileName(file.name)
    onFile(file)
  }

  return (
    <div>
      <span className="label">Upload CSV</span>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handle(e.dataTransfer.files[0])
        }}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${dragging ? 'border-blue-400 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <p className="text-2xl mb-1">📄</p>
        {fileName ? (
          <p className="text-xs text-green-400 font-medium">{fileName}</p>
        ) : (
          <>
            <p className="text-xs text-slate-300 font-medium">Drop CSV or click to browse</p>
            <p className="text-xs text-slate-500 mt-0.5">id, name, latitude, longitude, demand, ...</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handle(e.target.files[0])}
      />
    </div>
  )
}
