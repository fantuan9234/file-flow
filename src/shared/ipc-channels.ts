// ==================== IPC Channel Definitions ====================
// All IPC channel names and their request/response types are defined here.
// Both main process and renderer process should use these constants.

// ==================== File Operations ====================
export const IPC_CHANNELS = {
  SELECT_FOLDER: 'select-folder',
  SELECT_FILE: 'select-file',
  SELECT_FILES: 'select-files',
  SCAN_FILES: 'scan-files',
  EXECUTE_RENAME: 'execute-rename',
  UNDO_RENAME: 'undo-rename',
  CONVERT_FILE: 'convert-file',
  EXECUTE_WORKFLOW: 'execute-workflow',
  UNDO_WORKFLOW: 'undo-workflow',
  SAVE_DIALOG: 'save-dialog',
  OPEN_DIALOG_JSON: 'open-dialog-json',
  READ_FILE: 'read-file',
  WRITE_FILE: 'write-file',
  CREATE_FOLDER_RESPONSE: 'create-folder-response',
  EXECUTE_CLASSIFY: 'execute-classify',
  ASK_CREATE_FOLDER: 'ask-create-folder',
  UNDO_CLASSIFY: 'undo-classify',
  DELETE_FILES: 'delete-files',
  MOVE_FILES: 'move-files',
  OPEN_EXTERNAL: 'open-external',

  // Window Control
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE: 'window-maximize',
  WINDOW_CLOSE: 'window-close',
  WINDOW_IS_MAXIMIZED: 'window-is-maximized',

  // Update
  CHECK_FOR_UPDATES: 'check-for-updates',

  // Dedup
  FIND_EXACT_DUPLICATES: 'find-exact-duplicates',
  FIND_SIMILAR_DUPLICATES: 'find-similar-duplicates',

  // AI Semantic Search
  SEARCH_FILES: 'search-files',
  DESCRIBE_IMAGE: 'describe-image',

  // AI Classification
  CLASSIFY_CONTENT: 'classify-content',
  OLLAMA_CHECK_STATUS: 'ollama-check-status',
  OLLAMA_CLASSIFY: 'ollama-classify',
  TEST_AI_CONNECTION: 'test-ai-connection',
  AI_CLASSIFY: 'ai-classify',

  // OCR
  EXTRACT_TEXT: 'extract-text',
  PADDLE_EXTRACT_TEXT: 'paddle-extract-text',
  HYBRID_EXTRACT_TEXT: 'hybrid-extract-text',
  PADDLE_OCR_STATUS: 'paddle-ocr-status',
  PADDLE_OCR_OPEN_LOG: 'paddle-ocr-open-log',
  PADDLE_OCR_STATUS_CHANGED: 'paddleocr-status-changed',

  // API Key
  API_KEY_SET: 'api-key-set',
  API_KEY_GET: 'api-key-get',
  API_KEY_SAVE: 'api-key-save',

  // LAN Transfer
  LAN_START_SERVER: 'lan-start-server',
  LAN_STOP_SERVER: 'lan-stop-server',
  LAN_SERVER_STARTED: 'lan-server-started',
  LAN_SERVER_STOPPED: 'lan-server-stopped',
  LAN_FILE_RECEIVED: 'lan-file-received',

  // P2P Transfer
  P2P_START_SERVER: 'p2p-start-server',
  P2P_STOP_SERVER: 'p2p-stop-server',
  P2P_SELECT_RECEIVE_DIR: 'p2p-select-receive-dir',
  P2P_GET_RECEIVE_DIR: 'p2p-get-receive-dir',
  P2P_GET_PEERS: 'p2p-get-peers',
  P2P_GET_TRANSFERS: 'p2p-get-transfers',
  P2P_SERVER_STARTED: 'p2p-server-started',
  P2P_SERVER_STOPPED: 'p2p-server-stopped',
  P2P_STATUS_CHANGE: 'p2p-status-change',
  P2P_PEER_CONNECTED: 'p2p-peer-connected',
  P2P_PEER_DISCONNECTED: 'p2p-peer-disconnected',
  P2P_FILE_RECEIVED: 'p2p-file-received',
  P2P_TRANSFER_PROGRESS: 'p2p-transfer-progress',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ==================== Request/Response Types ====================

export interface SelectFolderResponse {
  success: boolean;
  path?: string;
}

export interface SelectFileResponse {
  success: boolean;
  path?: string;
}

export interface SelectFilesResponse {
  success: boolean;
  filePaths?: string[];
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

export interface ScanFilesResponse {
  success: boolean;
  data?: FileInfo[];
  error?: string;
}

export interface ExecuteRenameResponse {
  success: boolean;
  error?: string;
}

export interface ConvertFileParams {
  sourcePath: string | string[];
  sourceType: string;
  targetType: string;
}

export interface ConvertFileResponse {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface WorkflowStep {
  type: string;
  params: Record<string, any>;
}

export interface ExecuteWorkflowParams {
  folderPath: string;
  steps: WorkflowStep[];
  keepOriginal: boolean;
}

export interface ExecuteWorkflowResponse {
  success: boolean;
  error?: string;
}

export interface DedupGroup {
  hash?: string;
  similarity?: number;
  files: FileInfo[];
}

export interface FindDuplicatesResponse {
  success: boolean;
  groups?: DedupGroup[];
  totalDuplicates?: number;
  error?: string;
}

export interface OCRStatusResponse {
  status: 'starting' | 'running' | 'stopped' | 'failed';
  running: boolean;
  errorLogPath: string;
}

export interface ExtractTextResponse {
  success: boolean;
  text: string;
  confidence: number;
  error?: string;
}

export interface HybridExtractTextResponse {
  success: boolean;
  text: string;
  confidence: number;
  paddleText: string;
  paddleConfidence: number;
  tesseractText: string;
  tesseractConfidence: number;
  consensus: 'high' | 'low' | 'paddle_only' | 'tesseract_only';
  error?: string;
}

export interface LanServerResponse {
  success: boolean;
  url?: string;
  qrCode?: string;
  port?: number;
  ip?: string;
  error?: string;
}

export interface P2PStartServerResponse {
  success: boolean;
  url?: string;
  port?: number;
  ip?: string;
  qrCode?: string;
  receiveDir?: string;
  error?: string;
}

export interface P2PPeer {
  id: string;
  name: string;
  type: string;
  connectedAt: number;
}

export interface P2PTransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: string;
  direction: string;
  peerId: string;
  savedPath?: string;
}

export interface P2PGetPeersResponse {
  success: boolean;
  peers?: P2PPeer[];
  error?: string;
}

export interface P2PGetTransfersResponse {
  success: boolean;
  transfers?: P2PTransferFile[];
  error?: string;
}

export interface CheckUpdatesResponse {
  success: boolean;
  available?: boolean;
  version?: string;
  currentVersion?: string;
  error?: string;
}

export interface SearchFilesResponse {
  success: boolean;
  results?: { path: string; name: string; score: number; reason: string }[];
  error?: string;
}

export interface DescribeImageResponse {
  success: boolean;
  description?: string;
  error?: string;
}

export interface OllamaStatusResponse {
  running: boolean;
  models?: string[];
  error?: string;
}

export interface OllamaClassifyResponse {
  success: boolean;
  category?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
}

export interface AIConnectionTestResponse {
  success: boolean;
  models?: string[];
  error?: string;
}

export interface ClassifyContentResponse {
  success: boolean;
  category?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
}

export interface ApiKeyResponse {
  success: boolean;
  encrypted?: string;
  key?: string;
  configured?: boolean;
  error?: string;
}

export interface DeleteFilesResponse {
  success: boolean;
  deletedCount: number;
  errors?: string[];
}

export interface MoveFilesResponse {
  success: boolean;
  movedCount: number;
  errors?: string[];
}

// ==================== Event Payload Types ====================

export interface PaddleOCRStatusEvent {
  status: 'starting' | 'running' | 'stopped' | 'failed';
  errorLogPath: string;
}

export interface LanServerStartedEvent {
  url: string;
  port: number;
  ip: string;
}

export interface P2PStatusChangeEvent {
  status: string;
}

export interface P2PTransferProgressEvent {
  fileId: string;
  progress: number;
}

export interface MissingFoldersEvent {
  dirs: string[];
}
